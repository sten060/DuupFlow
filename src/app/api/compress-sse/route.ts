// SSE-based file compressor — reduces the weight of images (sharp) and videos
// (ffmpeg) while preserving visual quality. Mirrors the duplicate-image-sse
// pattern: files are pre-uploaded via /api/upload-direct, then this route
// processes each one server-side and emits fileReady events as they finish.
//
// Hard guarantee: a compressed output is NEVER heavier than its source. If the
// re-encode happens to produce a bigger file (already-optimal input), we keep
// the original bytes and report 0% saved.
//
// Heavy files: video encodes go through the GLOBAL encode queue shared with the
// video duplication (acquireEncodeSlot) with threads sized from the real vCPU, so
// a big compression never steals the whole box. The job survives the client
// leaving / losing its connection (only an explicit Stop aborts it), and each
// video gets at most COMPRESS_TIMEOUT_MS of encoding, with a precise error.
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { spawn } from "child_process";
import { createClient } from "@/lib/supabase/server";
import { getServerT, getServerLocale } from "@/lib/i18n/server";
import { getOutDirForCurrentUser, cleanupOldFiles } from "@/app/dashboard/utils";
import { runImageOp } from "@/lib/imageProcessingLimiter";
import { getFFmpegBin, acquireEncodeSlot, releaseEncodeSlot, encodeThreadsPerTask } from "@/app/dashboard/videos/processVideos";
import { compressJobRegistry } from "./jobRegistry";
import { compressImage, LEVELS, type CompressLevel } from "@/lib/compress-pipeline";
import { COMPRESS_MAX_FILES, COMPRESS_MAX_TOTAL_BYTES, formatBytes } from "@/lib/compress-limits";

export const runtime = "nodejs";
export const maxDuration = 300;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
};

/* ============== constants ============== */
const OUT_PREFIX = "CMP_DuupFlow_";
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];
// Max encoding time for ONE video (queue wait excluded).
const COMPRESS_TIMEOUT_MS = 10 * 60 * 1000;
const randHex = (n = 4) => crypto.randomBytes(n).toString("hex");
const extOf = (n: string) => {
  const i = n.lastIndexOf(".");
  return i >= 0 ? n.slice(i).toLowerCase() : "";
};

// Failure reasons we can name precisely to the user (mapped to i18n keys).
type FailReason = "timeout" | "corrupt" | "engineMissing" | "diskFull" | "encodeFailed" | "imageUnreadable";
class CompressError extends Error {
  constructor(public reason: FailReason, detail?: string) { super(detail || reason); }
}
function reasonOf(e: any, isImage: boolean): FailReason {
  if (e instanceof CompressError) return e.reason;
  if (e?.code === "ENOSPC") return "diskFull";
  return isImage ? "imageUnreadable" : "encodeFailed";
}
// ffmpeg stderr signatures of an unreadable / truncated / non-video input.
const CORRUPT_RE = /moov atom not found|Invalid data found|could not find codec parameters|does not contain any stream|Output file #0 does not contain any stream|End of file|Invalid NAL unit|Error while decoding stream/i;

/* ============== video probing (lightweight, ffmpeg -i parse) ============== */
type Probe = { duration: number; is10bitHEVC: boolean; width?: number; height?: number; fps?: number };
async function probeVideo(input: string, bin: string): Promise<Probe> {
  return new Promise((resolve) => {
    let stderr = "";
    let settled = false;
    const done = (v: Probe) => {
      if (!settled) { settled = true; clearTimeout(timer); resolve(v); }
    };
    const p = spawn(bin, ["-hide_banner", "-i", input], { stdio: ["ignore", "ignore", "pipe"] });
    p.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    p.on("error", () => done({ duration: 0, is10bitHEVC: false }));
    p.on("close", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
      const duration = m ? parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]) : 0;
      const is10bit = /10le|10be|p010/.test(stderr);
      const isHEVC = /hevc|h\.?265/i.test(stderr);
      const res = stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
      const fps = stderr.match(/([\d.]+) fps/);
      done({
        duration, is10bitHEVC: is10bit && isHEVC,
        width: res ? +res[1] : undefined, height: res ? +res[2] : undefined,
        fps: fps ? Math.round(parseFloat(fps[1])) : undefined,
      });
    });
    const timer = setTimeout(() => { p.kill("SIGKILL"); done({ duration: 0, is10bitHEVC: false }); }, 8_000);
  });
}

/* ============== performance trace ============== */
// One `[compress][perf]` line per video (success OR failure) so a slow/failed
// compression in prod can be diagnosed from Railway logs alone: video specs,
// threads actually used, queue wait vs encode time, real ffmpeg speed, version.
type PerfStats = Partial<Probe> & { threads?: number; lastPct?: number; speed?: string };
let ffmpegVersion: string | null = null;
async function getFFmpegVersion(bin: string): Promise<string> {
  if (ffmpegVersion) return ffmpegVersion;
  ffmpegVersion = await new Promise<string>((resolve) => {
    let out = "";
    const p = spawn(bin, ["-version"], { stdio: ["ignore", "pipe", "ignore"] });
    p.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    p.on("error", () => resolve("?"));
    p.on("close", () => resolve(out.match(/ffmpeg version (\S+)/)?.[1] ?? "?"));
  });
  return ffmpegVersion;
}

/* ============== video compression (ffmpeg) ============== */
async function compressVideo(
  input: string,
  output: string,
  level: CompressLevel,
  srcBytes: number,
  onTick: (pct: number) => void,
  signal?: AbortSignal,
  stats: PerfStats = {},
): Promise<void> {
  const cfg = LEVELS[level];
  const bin = await getFFmpegBin().catch(() => { throw new CompressError("engineMissing"); });
  const probe = await probeVideo(input, bin);
  const { duration, is10bitHEVC } = probe;
  Object.assign(stats, probe, { threads: encodeThreadsPerTask() });

  // Source bitrate (kbps): file size ÷ duration. We cap the encode below this so
  // the copy keeps the source's look but is never heavier (0 = unknown → no cap).
  const srcKbps = duration > 0 && srcBytes > 0 ? Math.round((srcBytes * 8) / duration / 1000) : 0;

  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error", "-stats", "-i", input];
  args.push("-max_muxing_queue_size", "1024");
  args.push("-map", "0:v:0", "-map", "0:a:0?");

  const vf: string[] = [];
  // Downscale FIRST, then tone-map: the HDR chain works in 32-bit float per pixel,
  // so running it on the already-shrunk frame instead of full 4K cut encode time
  // by ~20% on real iPhone 4K HDR clips (11–26%, same output size and look).
  if (cfg.maxDim > 0) {
    // Downscale longest side to maxDim, keep aspect, only shrink. -2 keeps even dims.
    vf.push(`scale='if(gt(iw,ih),min(${cfg.maxDim},iw),-2)':'if(gt(iw,ih),-2,min(${cfg.maxDim},ih))'`);
  }
  // HDR (10-bit HEVC, typically iPhone) → tone-map to SDR so 8-bit H.264 output
  // doesn't look washed out / over-bright. npl=100 + hable is deliberate here:
  // judged closer to the iPhone's own display than the AI editor's npl=203 +
  // mobius on real footage (Sten, 2026-09-25) — don't "align" the two.
  if (is10bitHEVC) {
    vf.push(
      "zscale=t=linear:npl=100", "format=gbrpf32le", "zscale=p=bt709",
      "tonemap=hable:desat=0", "zscale=t=bt709:m=bt709:r=tv", "format=yuv420p",
    );
  }
  if (vf.length) args.push("-vf", vf.join(","));

  args.push(
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", String(cfg.crf),
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    // Threads from the real vCPU budget — without this ffmpeg sizes itself from
    // os.cpus(), i.e. the Railway HOST core count, and oversubscribes the box.
    "-threads", String(encodeThreadsPerTask()),
  );
  // VBV cap to the source bitrate → guarantees the copy is never heavier.
  if (srcKbps > 0) {
    const cap = Math.min(60000, Math.max(400, Math.round(srcKbps * 0.95)));
    args.push("-maxrate", `${cap}k`, "-bufsize", `${cap * 2}k`);
  }
  args.push("-movflags", "+faststart");
  args.push(output);

  await new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { p.kill("SIGKILL"); } catch {}
      reject(new CompressError("timeout"));
    }, COMPRESS_TIMEOUT_MS);
    const onAbort = () => { try { p.kill("SIGKILL"); } catch {} reject(new Error("stopped")); };
    const cleanup = () => { clearTimeout(timer); if (signal) signal.removeEventListener("abort", onAbort); };
    p.stderr.on("data", (d: Buffer) => {
      const chunk = String(d);
      stderr = (stderr + chunk).slice(-8000); // keep the tail only (long encodes)
      const m = chunk.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (m && duration > 0) {
        const t = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
        const pct = Math.max(0, Math.min(99, Math.round((t / duration) * 100)));
        stats.lastPct = pct;
        onTick(pct);
      }
      const sp = chunk.match(/speed=\s*([\d.]+x)/);
      if (sp) stats.speed = sp[1];
    });
    p.on("error", (err) => { cleanup(); reject(new CompressError("engineMissing", err.message)); });
    p.on("close", (code) => {
      cleanup();
      if (timedOut) return; // already rejected with "timeout"
      if (code === 0) return resolve();
      if (signal?.aborted) return reject(new Error("stopped"));
      console.error("[compress][ffmpeg] stderr:", stderr);
      if (/No space left on device/i.test(stderr)) return reject(new CompressError("diskFull"));
      if (CORRUPT_RE.test(stderr)) return reject(new CompressError("corrupt"));
      reject(new CompressError("encodeFailed", `FFmpeg failed (${code})`));
    });
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/* ============== SSE handler ============== */
export async function POST(req: Request) {
  const t = await getServerT();

  void cleanupOldFiles(1 * 60 * 60 * 1000);

  // Auth — compression is a logged-in-only feature.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) {
    return Response.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: t("errors.upload.missingBody") }, { status: 400 });
  }

  const jobId = (form.get("jobId") as string | null) || null;
  const encoder = new TextEncoder();
  const existing = jobId ? compressJobRegistry.get(jobId) : undefined;
  if (existing && existing.userId !== user.id) {
    return Response.json({ error: t("errors.auth.notAuthenticated") }, { status: 403 });
  }

  // ── Stop path: the job no longer dies with the connection, so Stop is explicit. ──
  if (form.get("stop") === "1") {
    existing?.abort.abort("stopped");
    return Response.json({ ok: true, found: !!existing });
  }

  // ── Reconnect path: replay buffered events for a still-running job. ──
  if (jobId && existing) {
    const job = existing;
    return new Response(
      new ReadableStream({
        async start(controller) {
          let i = 0;
          const fwd = (d: object) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`)); } catch {} };
          while (true) {
            while (i < job.events.length) fwd(job.events[i++]);
            if (job.done) break;
            await new Promise((r) => setTimeout(r, 50));
          }
          while (i < job.events.length) fwd(job.events[i++]);
          try { controller.close(); } catch {}
        },
      }),
      { headers: SSE_HEADERS },
    );
  }
  if (form.get("reconnectOnly") === "1") {
    return new Response(
      encoder.encode(`data: ${JSON.stringify({ done: true, stale: true })}\n\n`),
      { headers: SSE_HEADERS },
    );
  }

  const directUploadIds = form.getAll("directUploadIds") as string[];
  const fileNames       = form.getAll("fileNames")       as string[];
  const levelRaw        = String(form.get("level") ?? "balanced");
  const level: CompressLevel = (["light", "balanced", "strong"] as const).includes(levelRaw as CompressLevel)
    ? (levelRaw as CompressLevel)
    : "balanced";

  if (directUploadIds.length === 0) {
    return Response.json({ error: t("errors.upload.missingBody") }, { status: 400 });
  }

  // ── Batch limits, re-checked server-side (the UI enforces them too, but a
  // scripted call must not bypass them): max files + max total weight. Over the
  // limit → nothing is processed and the uploads are deleted right away.
  const validIds = directUploadIds.filter((id) => /^duup_direct_[\w.-]+$/.test(id));
  let batchBytes = 0;
  for (const id of validIds) {
    batchBytes += await fs.stat(path.join(os.tmpdir(), id)).then((st) => st.size).catch(() => 0);
  }
  if (directUploadIds.length > COMPRESS_MAX_FILES || batchBytes > COMPRESS_MAX_TOTAL_BYTES) {
    await Promise.all(validIds.map((id) => fs.unlink(path.join(os.tmpdir(), id)).catch(() => {})));
    const locale = await getServerLocale();
    return Response.json({
      error: t("compress.errors.batchLimitServer", {
        maxFiles: String(COMPRESS_MAX_FILES),
        max: formatBytes(COMPRESS_MAX_TOTAL_BYTES, locale),
      }),
    }, { status: 413 });
  }

  let dir: string;
  let userId: string;
  try {
    ({ dir, userId } = await getOutDirForCurrentUser());
  } catch (e: any) {
    return Response.json({ error: e?.message || t("errors.auth.notAuthenticated") }, { status: 500 });
  }

  const VALID_PREFIX = path.join(os.tmpdir(), "duup_direct_");
  const stamp = (() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  })();

  // NOT tied to req.signal: a closed tab / dropped connection must not kill the
  // job (the client re-attaches by jobId). Only an explicit Stop aborts it.
  const abort = new AbortController();
  const jobEntry: { events: object[]; done: boolean; userId: string; abort: AbortController } =
    { events: [], done: false, userId, abort };
  if (jobId) compressJobRegistry.set(jobId, jobEntry);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        jobEntry.events.push(data);
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch {}
      }, 20_000);

      let processedOk = 0;
      try {
        const total = directUploadIds.length;
        for (let i = 0; i < directUploadIds.length; i++) {
          const uploadId = directUploadIds[i];
          if (!/^duup_direct_[\w.-]+$/.test(uploadId)) {
            send({ error: true, msg: t("errors.image.invalidPath") });
            continue;
          }
          const tmpPath = path.join(os.tmpdir(), uploadId);
          if (!tmpPath.startsWith(VALID_PREFIX)) {
            send({ error: true, msg: t("errors.image.invalidPath") });
            continue;
          }

          const fileName = fileNames[i] ?? uploadId;
          const ext = extOf(fileName) || extOf(uploadId);
          const isImage = IMAGE_EXTS.includes(ext);
          const isVideo = VIDEO_EXTS.includes(ext);
          const baseName = path.basename(fileName, path.extname(fileName)).replace(/[^a-zA-Z0-9_\- ]+/g, "").slice(0, 60) || `file${i + 1}`;
          const fileLabel = `${i + 1}/${total}`;

          let srcBytes = 0;
          try { srcBytes = (await fs.stat(tmpPath)).size; } catch {}

          send({ percent: Math.round((i / total) * 100), msg: `${fileLabel} — ${fileName}…` });

          try {
            if (isImage) {
              const buf = await fs.readFile(tmpPath);
              const { data, outExt } = await runImageOp(() => compressImage(buf, ext, level));
              // Never heavier than source — fall back to the original bytes.
              const finalData = data.length < srcBytes || srcBytes === 0 ? data : buf;
              const finalExt = data.length < srcBytes || srcBytes === 0 ? outExt : ext;
              const outName = `${OUT_PREFIX}${stamp}_${baseName}_${Date.now()}${randHex(3)}${finalExt}`;
              await fs.writeFile(path.join(dir, outName), finalData);
              const saved = srcBytes > 0 ? Math.max(0, Math.round((1 - finalData.length / srcBytes) * 100)) : 0;
              processedOk++;
              send({
                percent: Math.round(((i + 1) / total) * 100),
                fileReady: { name: outName, url: `/api/out/${userId}/${outName}`, savedPercent: saved, srcBytes, outBytes: finalData.length },
              });
            } else if (isVideo) {
              const srcExt = ext || ".mp4";
              const tag = `${stamp}_${baseName}_${Date.now()}${randHex(3)}`;
              // Compress into a temp mp4 (hidden from listings via the __progress_ prefix).
              const tempOut = path.join(dir, `__progress_${OUT_PREFIX}${tag}.mp4`);
              // Shared queue with the video duplication: wait our turn (Stop-aware).
              send({ percent: Math.round((i / total) * 100), msg: t("compress.waitingSlot", { label: fileLabel, name: fileName }) });
              const tQueue = Date.now();
              await acquireEncodeSlot(abort.signal);
              const tEncode = Date.now();
              const perf: PerfStats = {};
              let outcome = "OK";
              try {
                await compressVideo(
                  tmpPath, tempOut, level, srcBytes,
                  (pct) => send({ percent: Math.round(((i + (pct / 100)) / total) * 100), msg: `${fileLabel} — ${fileName} (${pct}%)…` }),
                  abort.signal,
                  perf,
                );
              } catch (e: any) {
                outcome = e?.message === "stopped" ? "ARRÊTÉ" : `ÉCHEC(${reasonOf(e, false)})`;
                await fs.unlink(tempOut).catch(() => {});
                throw e;
              } finally {
                releaseEncodeSlot();
                const encSec = Math.round((Date.now() - tEncode) / 1000);
                const dur = Math.round(perf.duration ?? 0);
                console.log(
                  `[compress][perf] "${fileName}" ${outcome} — vidéo=${dur}s ${perf.width ?? "?"}x${perf.height ?? "?"}@${perf.fps ?? "?"}fps` +
                  `${perf.is10bitHEVC ? " HDR" : ""} niveau=${level} src=${Math.round(srcBytes / 1048576)}Mo` +
                  ` | attente=${Math.round((tEncode - tQueue) / 1000)}s encodage=${encSec}s` +
                  ` ratio=${dur ? (encSec / dur).toFixed(2) : "?"}x speed=${perf.speed ?? "?"} avancement=${outcome === "OK" ? 100 : perf.lastPct ?? 0}%` +
                  ` | threads=${perf.threads ?? "?"} FFMPEG_VCPU=${process.env.FFMPEG_VCPU ?? "absent(8)"}` +
                  ` MAX_CONCURRENT_ENCODES=${process.env.MAX_CONCURRENT_ENCODES ?? "absent(2)"} cpus=${os.cpus().length}` +
                  ` ffmpeg=${await getFFmpegVersion(await getFFmpegBin().catch(() => "")).catch(() => "?")}`,
                );
              }
              let outBytes = 0;
              try { outBytes = (await fs.stat(tempOut)).size; } catch {}
              // Never heavier than source: if the encode bloated, keep the ORIGINAL
              // bytes — and keep its real extension so the container isn't mislabeled
              // (a .mov/.webm copied into a ".mp4" name would be a broken container).
              let outName: string;
              if (srcBytes > 0 && outBytes >= srcBytes) {
                outName = `${OUT_PREFIX}${tag}${srcExt}`;
                await fs.copyFile(tmpPath, path.join(dir, outName)).catch(() => {});
                await fs.unlink(tempOut).catch(() => {});
                outBytes = srcBytes;
              } else {
                outName = `${OUT_PREFIX}${tag}.mp4`;
                const outPath = path.join(dir, outName);
                await fs.rename(tempOut, outPath).catch(async () => {
                  await fs.copyFile(tempOut, outPath); await fs.unlink(tempOut).catch(() => {});
                });
              }
              const saved = srcBytes > 0 ? Math.max(0, Math.round((1 - outBytes / srcBytes) * 100)) : 0;
              processedOk++;
              send({
                percent: Math.round(((i + 1) / total) * 100),
                fileReady: { name: outName, url: `/api/out/${userId}/${outName}`, savedPercent: saved, srcBytes, outBytes },
              });
            } else {
              send({ error: true, msg: t("compress.errors.unsupported", { name: fileName }) });
            }
          } catch (e: any) {
            if (e?.message === "stopped") throw e; // bubble up: whole job stopped
            const reason = reasonOf(e, isImage);
            console.error(`[compress] file failed (${fileName}) reason=${reason}:`, e?.message);
            send({
              error: true,
              reason,
              msg: t(`compress.errors.reason.${reason}`, { name: fileName, minutes: String(COMPRESS_TIMEOUT_MS / 60000) }),
            });
          } finally {
            await fs.unlink(tmpPath).catch(() => {});
          }
        }

        send({ percent: 100, msg: t("compress.doneMsg"), done: true, processedOk });
      } catch (e: any) {
        if (e?.message === "stopped") {
          send({ stopped: true, done: true, processedOk });
        } else {
          console.error("[compress] error:", e?.message);
          send({ error: true, msg: t("compress.errors.processingFailed"), code: "CMP-002" });
        }
      } finally {
        // Stop / fatal error mid-batch: drop the uploads we never got to.
        for (const id of directUploadIds) {
          if (/^duup_direct_[\w.-]+$/.test(id)) await fs.unlink(path.join(os.tmpdir(), id)).catch(() => {});
        }
        clearInterval(keepalive);
        jobEntry.done = true;
        if (jobId) setTimeout(() => compressJobRegistry.delete(jobId), 120_000);
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
