// FFmpeg self-test, run once at server start (see src/instrumentation.ts).
//
// Why: a 4 min 54 iPhone 4K HDR clip compressed in 4 min 27 on a Mac but blew
// the 10-min limit on Railway. To compare machines/ffmpeg builds WITHOUT anyone
// uploading a test file, the server generates its own short 4K HLG HEVC clip and
// runs the compressor's exact "balanced" pipeline on it, then logs one line:
//
//   [ffmpeg][selftest] ffmpeg=… cpu="…" cœurs=24 threads=3 | clip 4K HDR 5s :
//   décodage seul=…s, compression équilibré=…s (ratio …x) | génération=…s
//
// ratio = compression time ÷ clip duration (1.0x = as long as the video).
// Disable with FFMPEG_SELFTEST=0. Costs a few seconds of CPU once per deploy.
import os from "os";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { getFFmpegBin, encodeThreadsPerTask } from "@/app/dashboard/videos/processVideos";
import { LEVELS } from "@/lib/compress-pipeline";
import { compressVideoFilters } from "@/lib/compress-video-filters";

const CLIP_SECONDS = 5;
const STEP_TIMEOUT_MS = 5 * 60 * 1000;

function timed(bin: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    let stderr = "";
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    p.stderr.on("data", (d: Buffer) => { stderr = (stderr + d.toString()).slice(-2000); });
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("timeout")); }, STEP_TIMEOUT_MS);
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve((Date.now() - t0) / 1000);
      else reject(new Error(`exit ${code}: ${stderr.trim().split("\n").pop()}`));
    });
  });
}

function version(bin: string): Promise<string> {
  return new Promise((resolve) => {
    let out = "";
    const p = spawn(bin, ["-version"], { stdio: ["ignore", "pipe", "ignore"] });
    p.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    p.on("error", () => resolve("?"));
    p.on("close", () => resolve(out.match(/ffmpeg version (\S+)/)?.[1] ?? "?"));
  });
}

export async function runFFmpegSelfTest(): Promise<void> {
  if (process.env.FFMPEG_SELFTEST === "0") return;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_selftest_"));
  const src = path.join(dir, "src.mp4");
  const out = path.join(dir, "out.mp4");
  const threads = encodeThreadsPerTask();
  const q = ["-y", "-hide_banner", "-loglevel", "error"];
  try {
    const bin = await getFFmpegBin();
    const ver = await version(bin);

    // Synthetic iPhone-like source: 4K 30 fps, 10-bit HEVC tagged HLG / BT.2020.
    const gen = await timed(bin, [
      ...q, "-f", "lavfi", "-i", `testsrc2=size=3840x2160:rate=30:duration=${CLIP_SECONDS}`,
      "-pix_fmt", "yuv420p10le", "-c:v", "libx265", "-preset", "ultrafast",
      "-x265-params", "log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc",
      "-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-colorspace", "bt2020nc",
      "-tag:v", "hvc1", src,
    ]);

    // Decode only (reading the HEVC 10-bit source is a big fixed cost).
    const dec = await timed(bin, ["-hide_banner", "-loglevel", "error", "-i", src, "-f", "null", "-"]);

    // The compressor's exact "balanced" video pipeline.
    const cfg = LEVELS.balanced;
    const cmp = await timed(bin, [
      ...q, "-i", src, "-vf", compressVideoFilters(cfg.maxDim, true).join(","),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", String(cfg.crf), "-pix_fmt", "yuv420p",
      "-threads", String(threads), out,
    ]);

    const cpu = os.cpus()[0]?.model?.replace(/\s+/g, " ").trim() ?? "?";
    console.log(
      `[ffmpeg][selftest] ffmpeg=${ver} cpu="${cpu}" cœurs=${os.cpus().length} threads=${threads}` +
      ` | clip 4K HDR ${CLIP_SECONDS}s : décodage seul=${dec.toFixed(1)}s,` +
      ` compression équilibré=${cmp.toFixed(1)}s (ratio ${(cmp / CLIP_SECONDS).toFixed(2)}x)` +
      ` | génération=${gen.toFixed(1)}s`,
    );
  } catch (e: any) {
    console.warn(`[ffmpeg][selftest] échec : ${e?.message ?? e}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
