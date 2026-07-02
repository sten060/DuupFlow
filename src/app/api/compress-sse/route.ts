// SSE-based file compressor — reduces the weight of images (sharp) and videos
// (ffmpeg) while preserving visual quality. Mirrors the duplicate-image-sse
// pattern: files are pre-uploaded via /api/upload-direct, then this route
// processes each one server-side and emits fileReady events as they finish.
//
// Hard guarantee: a compressed output is NEVER heavier than its source. If the
// re-encode happens to produce a bigger file (already-optimal input), we keep
// the original bytes and report 0% saved.
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { spawn } from "child_process";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { getOutDirForCurrentUser, cleanupOldFiles } from "@/app/dashboard/utils";
import { runImageOp } from "@/lib/imageProcessingLimiter";
import { getFFmpegBin } from "@/app/dashboard/videos/processVideos";
import { compressJobRegistry } from "./jobRegistry";
import { compressImage, LEVELS, type CompressLevel } from "@/lib/compress-pipeline";

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
const randHex = (n = 4) => crypto.randomBytes(n).toString("hex");
const extOf = (n: string) => {
  const i = n.lastIndexOf(".");
  return i >= 0 ? n.slice(i).toLowerCase() : "";
};




/* ============== video probing (lightweight, ffmpeg -i parse) ============== */
async function probeVideo(input: string, bin: string): Promise<{ duration: number; is10bitHEVC: boolean }> {
  return new Promise((resolve) => {
    let stderr = "";
    let settled = false;
    const done = (v: { duration: number; is10bitHEVC: boolean }) => {
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
      done({ duration, is10bitHEVC: is10bit && isHEVC });
    });
    const timer = setTimeout(() => { p.kill("SIGKILL"); done({ duration: 0, is10bitHEVC: false }); }, 8_000);
  });
}

/* ============== video compression (ffmpeg) ============== */
async function compressVideo(
  input: string,
  output: string,
  level: CompressLevel,
  srcBytes: number,
  onTick: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const cfg = LEVELS[level];
  const bin = await getFFmpegBin();
  const { duration, is10bitHEVC } = await probeVideo(input, bin);

  // Source bitrate (kbps): file size ÷ duration. We cap the encode below this so
  // the copy keeps the source's look but is never heavier (0 = unknown → no cap).
  const srcKbps = duration > 0 && srcBytes > 0 ? Math.round((srcBytes * 8) / duration / 1000) : 0;

  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error", "-stats", "-i", input];
  args.push("-max_muxing_queue_size", "1024");
  args.push("-map", "0:v:0", "-map", "0:a:0?");

  const vf: string[] = [];
  // HDR (10-bit HEVC, typically iPhone) → tone-map to SDR so 8-bit H.264 output
  // doesn't look washed out / over-bright.
  if (is10bitHEVC) {
    vf.push(
      "zscale=t=linear:npl=100", "format=gbrpf32le", "zscale=p=bt709",
      "tonemap=hable:desat=0", "zscale=t=bt709:m=bt709:r=tv", "format=yuv420p",
    );
  }
  if (cfg.maxDim > 0) {
    // Downscale longest side to maxDim, keep aspect, only shrink. -2 keeps even dims.
    vf.push(`scale='if(gt(iw,ih),min(${cfg.maxDim},iw),-2)':'if(gt(iw,ih),-2,min(${cfg.maxDim},ih))'`);
  }
  if (vf.length) args.push("-vf", vf.join(","));

  args.push(
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", String(cfg.crf),
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
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
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("FFmpeg timed out after 15 minutes")); }, 15 * 60 * 1000);
    const onAbort = () => { try { p.kill("SIGKILL"); } catch {} reject(new Error("stopped")); };
    const cleanup = () => { clearTimeout(timer); if (signal) signal.removeEventListener("abort", onAbort); };
    p.stderr.on("data", (d: Buffer) => {
      const chunk = String(d);
      stderr += chunk;
      const m = chunk.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (m && duration > 0) {
        const t = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
        onTick(Math.max(0, Math.min(99, Math.round((t / duration) * 100))));
      }
    });
    p.on("error", (err) => { cleanup(); reject(new Error(`FFmpeg introuvable : ${err.message}`)); });
    p.on("close", (code) => {
      cleanup();
      if (code === 0) return resolve();
      if (signal?.aborted) return reject(new Error("stopped"));
      console.error("[compress][ffmpeg] stderr:", stderr);
      reject(new Error(`FFmpeg failed (${code})`));
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

  // ── Reconnect path: replay buffered events for a still-running job. ──
  if (jobId && compressJobRegistry.has(jobId)) {
    const job = compressJobRegistry.get(jobId)!;
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

  const jobEntry: { events: object[]; done: boolean } = { events: [], done: false };
  if (jobId) compressJobRegistry.set(jobId, jobEntry);

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort("client_gone"), { once: true });

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
              await compressVideo(
                tmpPath, tempOut, level, srcBytes,
                (pct) => send({ percent: Math.round(((i + (pct / 100)) / total) * 100), msg: `${fileLabel} — ${fileName} (${pct}%)…` }),
                abort.signal,
              );
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
            console.error(`[compress] file failed (${fileName}):`, e?.message);
            send({ error: true, msg: t("compress.errors.fileFailed", { name: fileName }) });
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
        clearInterval(keepalive);
        jobEntry.done = true;
        if (jobId) setTimeout(() => compressJobRegistry.delete(jobId), 120_000);
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
