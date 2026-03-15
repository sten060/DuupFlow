// Shared video duplication logic — no "use server", importable from both server actions and API routes
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import zlib from "zlib";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";

// On Vercel, native binaries cannot be included in the serverless function bundle
// via NFT tracing or outputFileTracingIncludes (Next.js zero-config limitation).
// Solution: download the tarball from the official npm registry, extract the
// binary in memory, and write it to /tmp on first invocation.
// /tmp persists across warm starts, so the download only happens on cold starts.
const FFMPEG_TMP = "/tmp/ffmpeg";
const FFMPEG_TARBALL =
  "https://registry.npmjs.org/@ffmpeg-installer/linux-x64/-/linux-x64-4.1.0.tgz";

// Extract a named entry from an uncompressed tar buffer.
function extractTarEntry(tar: Buffer, entryName: string): Buffer | null {
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const name = tar.subarray(offset, offset + 100).toString("utf8").replace(/\0+$/, "");
    if (!name) break; // end-of-archive
    const size = parseInt(
      tar.subarray(offset + 124, offset + 136).toString("utf8").replace(/\0/g, "").trim(),
      8
    ) || 0;
    offset += 512;
    if (name === entryName) return tar.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
  }
  return null;
}

async function downloadFfmpeg(): Promise<string> {
  console.log("[ffmpeg] cold start — downloading tarball from npm registry…");
  const res = await fetch(FFMPEG_TARBALL);
  if (!res.ok) throw new Error(`[ffmpeg] npm registry returned HTTP ${res.status}`);

  const tgz = Buffer.from(await res.arrayBuffer());
  console.log(`[ffmpeg] tarball: ${tgz.length} bytes, decompressing…`);

  const tar = await new Promise<Buffer>((resolve, reject) =>
    zlib.gunzip(tgz, (err, result) => (err ? reject(err) : resolve(result)))
  );

  const binary = extractTarEntry(tar, "package/ffmpeg");
  if (!binary) throw new Error("[ffmpeg] entry 'package/ffmpeg' not found in tarball");

  const tmpPart = FFMPEG_TMP + ".part";
  await fs.writeFile(tmpPart, binary);
  await fs.chmod(tmpPart, 0o755);
  await fs.rename(tmpPart, FFMPEG_TMP);
  console.log(`[ffmpeg] ready — ${binary.length} bytes at ${FFMPEG_TMP}`);
  return FFMPEG_TMP;
}

let _ffmpegBin: string | null = null;
let _downloadPromise: Promise<string> | null = null;

async function getFFmpegBin(): Promise<string> {
  // Env override — useful for local dev or a custom deploy with a real binary.
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;

  // Already resolved this Lambda instance.
  if (_ffmpegBin) return _ffmpegBin;

  // Check if ffmpeg is available in PATH (e.g. installed via nixpacks on Railway).
  try {
    const { execFileSync } = await import("child_process");
    const whichPath = execFileSync("which", ["ffmpeg"], { encoding: "utf8" }).trim();
    if (whichPath) {
      console.log(`[ffmpeg] found in PATH at ${whichPath}`);
      _ffmpegBin = whichPath;
      return _ffmpegBin;
    }
  } catch {
    // not in PATH, continue
  }

  // Warm start: binary already in /tmp from a previous invocation.
  const { existsSync } = await import("fs");
  if (existsSync(FFMPEG_TMP)) {
    _ffmpegBin = FFMPEG_TMP;
    return _ffmpegBin;
  }

  // Cold start: download + extract (deduplicated across concurrent requests).
  if (!_downloadPromise) {
    _downloadPromise = downloadFfmpeg().catch((err) => {
      _downloadPromise = null; // allow retry on next request
      throw err;
    });
  }

  _ffmpegBin = await _downloadPromise;
  return _ffmpegBin;
}

/* ------------------ utils ------------------ */

const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];

function extOf(n: string) {
  const i = n.lastIndexOf(".");
  return i >= 0 ? n.slice(i).toLowerCase() : "";
}
function isVideo(n: string) {
  return VIDEO_EXTS.includes(extOf(n));
}
function safeBase(n: string) {
  return n
    .replace(/\.[^.]+$/g, "")
    .replace(/[^a-zA-Z0-9_\- ]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}
function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${da}`;
}
type Channel = "simple" | "advanced";
function channelCaps(channel: Channel) {
  return channel === "advanced" ? "ADVANCED" : "SIMPLE";
}
export function videoPrefix(channel: Channel) {
  return `${channelCaps(channel)}_DuupFlow_`;
}
function videoOutName(opts: {
  channel: Channel;
  date: string;
  fileIndex: number;
  copyIndex: number;
  origName: string;
  runTag: string;
}) {
  const { channel, date, fileIndex, copyIndex, origName, runTag } = opts;
  const base = safeBase(origName);
  return `${channelCaps(channel)}_DuupFlow_${date}_vid${fileIndex}_c${String(
    copyIndex
  ).padStart(2, "0")}_r${runTag}__${base}.mp4`;
}
export function filterFinals(names: string[]) {
  return names
    .filter((n) => !!n && typeof n === "string")
    .filter(
      (n) =>
        !n.startsWith(".") &&
        !n.startsWith("tmp_") &&
        !n.startsWith("__in__") &&
        !n.startsWith("__progress_") &&
        !n.endsWith(".part") &&
        isVideo(n)
    );
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ---- Metadata injection helpers ---- */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
const VIDEO_HUMAN_NAMES = [
  "Alex Martin", "Sophie Renaud", "Jordan Lee", "Emma Dubois",
  "Lucas Bernard", "Camille Thomas", "Noah Petit", "Léa Moreau",
  "Antoine Durand", "Manon Lefebvre",
];
const VIDEO_ENCODERS = [
  "HandBrake 1.8.0", "DaVinci Resolve 19.1", "Adobe Premiere Pro 24.6",
  "Final Cut Pro 11.6", "CapCut Desktop 3.2", "iMovie 14.0",
];
const VIDEO_COMMENTS = [
  "Export final", "Client review", "Draft v2", "Social media cut",
  "Archive copy", "Timeline export", "Delivery package",
];
function getVideoMetadataArgs(): string[] {
  const artist = pickRandom(VIDEO_HUMAN_NAMES);
  const encoder = pickRandom(VIDEO_ENCODERS);
  const comment = pickRandom(VIDEO_COMMENTS);
  const daysAgo = Math.floor(Math.random() * 365);
  const creationDate = new Date(Date.now() - daysAgo * 86400000);
  const isoDate = creationDate.toISOString().slice(0, 19) + "Z";
  return [
    "-map_metadata", "-1",
    "-metadata", `artist=${artist}`,
    "-metadata", `encoder=${encoder}`,
    "-metadata", `creation_time=${isoDate}`,
    "-metadata", `comment=${comment}`,
    "-metadata", `copyright=© ${creationDate.getFullYear()} ${artist}`,
  ];
}

const LIMITS: Record<string, { min: number; max: number }> = {
  brightness:   { min: -1.0, max: 1.0 },
  contrast:     { min: 0.0,  max: 3.0 },
  saturation:   { min: 0.0,  max: 3.0 },
  gamma:        { min: 0.1,  max: 3.0 },
  hue_rad:      { min: -Math.PI, max: Math.PI },
  vignette:     { min: 0.0,  max: Math.PI },
  noise:        { min: 0,    max: 64 },
  lens_k:       { min: -1.0, max: 1.0 },
  unsharp:      { min: 0.0,  max: 5.0 },
  speed:        { min: 0.5,  max: 2.0 },
  zoom:         { min: 0.5,  max: 2.0 },
  pixelshift:   { min: 0,    max: 200 },
  rotation_deg: { min: -45,  max: 45 },
  fps:          { min: 5,    max: 120 },
  border_px:    { min: 0,    max: 500 },
  vbitrate:     { min: 200,  max: 50000 },
  gop:          { min: 1,    max: 1000 },
  cut_start:    { min: 0,    max: 36000 },
  cut_end:      { min: 0,    max: 36000 },
  volume_db:    { min: -30,  max: 30 },
  afreq_hz:     { min: 20,   max: 20000 },
  abitrate_k:   { min: 32,   max: 512 },
};

/* ------------------ FFmpeg wrapper ------------------ */

async function runFFmpegSafe(
  input: string,
  output: string,
  vfParts: string[],
  afParts: string[] = [],
  extraArgs: string[] = [],
  metaArgs: string[] = [],
) {
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error", "-i", input];

  // Stream copy when no video/audio filters and no encode-level args → near-instant
  const useStreamCopy = vfParts.length === 0 && afParts.length === 0 && extraArgs.length === 0;

  if (useStreamCopy) {
    args.push("-c", "copy");
  } else {
    if (vfParts.length) args.push("-vf", vfParts.join(","));
    if (afParts.length) args.push("-af", afParts.join(","));
    args.push(
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "256k",
    );
    // extraArgs can override crf/bitrate (e.g. technical pack sets its own values)
    if (extraArgs.length) args.push(...extraArgs);
  }

  args.push("-movflags", "+faststart");
  if (metaArgs.length) args.push(...metaArgs);

  args.push(output);

  const ffmpegBin = await getFFmpegBin();
  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegBin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += String(d)));
    p.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`FFmpeg introuvable ou inaccessible : ${err.message}`));
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      console.error("FFmpeg error:", stderr);
      reject(new Error(`FFmpeg failed (${code})\n${stderr}`));
    });
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error("FFmpeg timed out after 15 minutes"));
    }, 15 * 60 * 1000);
  });
}

/* =========================================================
   Core processing — returns channel for redirect URL
   ========================================================= */

export type PreDownloadedFile = { name: string; tmpPath: string };

export async function processVideos(
  formData: FormData,
  onProgress?: (pct: number, msg: string) => Promise<void>,
  preResolvedDir?: string,
  preDownloadedFiles?: PreDownloadedFile[]
): Promise<{ channel: string; outputPaths: string[] }> {
  const channel = (formData.get("channel") as Channel) ?? "simple";
  const mode = (formData.get("mode") as string) ?? "simple";
  const count = Math.max(1, Number(formData.get("count") || 1));
  const uploadedFiles = (formData.getAll("files") as unknown as File[]).filter(Boolean);
  // Use pre-downloaded files when provided (bypasses Vercel body limit)
  const files: Array<File | PreDownloadedFile> = preDownloadedFiles ?? uploadedFiles;
  const runTag = Math.random().toString(36).slice(2, 6);

  const { dir } = preResolvedDir
    ? { dir: preResolvedDir }
    : await getOutDirForCurrentUser();
  await fs.mkdir(dir, { recursive: true });

  const stamp = todayStamp();

  const singlesRaw = (formData.get("singles") as string) || "{}";
  const rangesRaw = (formData.get("advancedRanges") as string) || "{}";
  const singles = JSON.parse(singlesRaw || "{}");
  const ranges = JSON.parse(rangesRaw || "{}");

  const totalCopies = files.length * count;
  let doneCopies = 0;
  const outputPaths: string[] = [];

  await onProgress?.(0, "Préparation…");

  let fileIndex = 0;
  for (const f of files) {
    fileIndex += 1;

    const fileName = "tmpPath" in f ? f.name : (f as File).name;
    const origExt = extOf(fileName) || ".mp4";
    let tmpIn: string;
    let ownsTmpIn = false;
    if ("tmpPath" in f) {
      // Already downloaded to a temp path — use it directly
      tmpIn = f.tmpPath;
    } else {
      tmpIn = path.join(
        dir,
        `__in__${Date.now()}_${Math.random().toString(36).slice(2)}${origExt}`
      );
      await fs.writeFile(tmpIn, Buffer.from(await (f as File).arrayBuffer()));
      ownsTmpIn = true;
    }

    for (let c = 1; c <= count; c++) {
      await onProgress?.(
        Math.min(99, Math.round((doneCopies / totalCopies) * 100)),
        `Encodage ${doneCopies + 1}/${totalCopies}…`
      );

      const outName = videoOutName({
        channel,
        date: stamp,
        fileIndex,
        copyIndex: c,
        origName: fileName,
        runTag,
      });
      const outPath = path.join(dir, outName);

      const vfParts: string[] = [];
      const afParts: string[] = [];
      const extraArgs: string[] = [];

      if (mode === "simple") {
        /* ----------- MODE SIMPLE ----------- */
        const packs = String(formData.get("packs") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (packs.includes("visual")) {
          // Subtle eq — brightness ±3%, contrast ±5%, saturation ±5%, gamma ±3%
          const b  = clamp(Number((-0.03 + Math.random() * 0.06).toFixed(3)), LIMITS.brightness.min, LIMITS.brightness.max);
          const ct = clamp(Number((0.96 + Math.random() * 0.08).toFixed(3)),  LIMITS.contrast.min,   LIMITS.contrast.max);
          const st = clamp(Number((0.96 + Math.random() * 0.08).toFixed(3)),  LIMITS.saturation.min, LIMITS.saturation.max);
          const gm = clamp(Number((0.97 + Math.random() * 0.06).toFixed(3)),  0.1, 3.0);
          vfParts.push(`eq=brightness=${b}:contrast=${ct}:saturation=${st}:gamma=${gm}`);
          // Micro hue shift ±3°
          const hue = clamp(Number((Math.random() * 0.10 - 0.05).toFixed(3)), -1, 1);
          vfParts.push(`hue=h=${hue}`);
          // Very light sharpening — imperceptible
          vfParts.push("unsharp=lx=3:ly=3:la=0.3:cx=3:cy=3:ca=0.3");
          // Imperceptible noise (2 vs 10 before)
          vfParts.push("noise=alls=2:allf=t+u");
          // Removed: vignette (darkens corners — very visible)
          // Removed: lenscorrection (distorts/rounds the image — very visible)
        }

        if (packs.includes("motion")) {
          const zoom = clamp(1.04 + Math.random() * 0.31, LIMITS.zoom.min, LIMITS.zoom.max);
          vfParts.push(`scale=iw*${zoom.toFixed(3)}:ih*${zoom.toFixed(3)}`);
          const offx = (Math.random() * 0.5).toFixed(4);
          const offy = (Math.random() * 0.5).toFixed(4);
          vfParts.push(`crop=iw:ih:x=(in_w-out_w)*${offx}:y=(in_h-out_h)*${offy}`);
          const shift = (Math.random() * 0.02).toFixed(4);
          vfParts.push(`scale=iw*(1+${shift}):ih*(1+${shift}),crop=iw:ih`);
          const side = Math.random() > 0.5 ? 1 : -1;
          const deviation = 0.07 + Math.random() * 0.07;
          const sp = clamp(1.0 + side * deviation, LIMITS.speed.min, LIMITS.speed.max);
          vfParts.push(`setpts=${(1 / sp).toFixed(4)}*PTS`);
          afParts.push(`atempo=${sp.toFixed(3)}`);
        }

        if (packs.includes("technical")) {
          const crf = 14 + Math.floor(Math.random() * 15);
          extraArgs.push("-crf", String(crf));
          const vbit = clamp(3000 + Math.floor(Math.random() * 19001), LIMITS.vbitrate.min, LIMITS.vbitrate.max);
          extraArgs.push("-b:v", `${vbit}k`);
          const gop = clamp(30 + Math.floor(Math.random() * 471), LIMITS.gop.min, LIMITS.gop.max);
          extraArgs.push("-g", String(gop));
          const profiles = ["baseline", "main", "high"];
          const levels = ["5.0", "5.1", "5.2", "6.0"];
          extraArgs.push("-profile:v", profiles[Math.floor(Math.random() * profiles.length)]);
          extraArgs.push("-level:v", levels[Math.floor(Math.random() * levels.length)]);
          const fpsPool = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
          extraArgs.push("-r", String(fpsPool[Math.floor(Math.random() * fpsPool.length)]));
        }

        if (singles?.flip) vfParts.push("vflip");
        if (singles?.reverse) vfParts.push("hflip");

        if (singles?.rotation?.enabled) {
          let a = Number(singles.rotation.min_deg ?? 0);
          let b = Number(singles.rotation.max_deg ?? 0);
          if (a > b) [a, b] = [b, a];
          a = clamp(a, LIMITS.rotation_deg.min, LIMITS.rotation_deg.max);
          b = clamp(b, LIMITS.rotation_deg.min, LIMITS.rotation_deg.max);
          const deg = a + Math.random() * (b - a);
          const rad = (deg * Math.PI) / 180;
          vfParts.push(`rotate=${rad.toFixed(6)}:c=black@0:ow=rotw(iw):oh=roth(ih),scale=iw*1.04:ih*1.04,crop=in_w:in_h:(ow-in_w)/2:(oh-in_h)/2`);
        }

        if (singles?.dims?.enabled) {
          const fx = Number(singles.dims.w_factor ?? 1);
          const fy = Number(singles.dims.h_factor ?? 1);
          if (fx > 0 && fy > 0 && (fx !== 1 || fy !== 1)) {
            vfParts.push(`scale=iw*${fx.toFixed(6)}:ih*${fy.toFixed(6)}:flags=bicubic`);
          }
        }

        if (singles?.border?.enabled) {
          let min = Number(singles.border.min_pct ?? 0);
          let max = Number(singles.border.max_pct ?? 0);
          if (min > max) [min, max] = [max, min];
          min = clamp(min, 0, 40);
          max = clamp(max, 0, 40);
          const pct = min + Math.random() * (max - min);
          const pad = (pct / 100).toFixed(3);
          const horiz = singles.border.horizontal ?? false;
          const lat = singles.border.lateral ?? false;
          const padTop    = horiz || (!horiz && !lat) ? pad : 0;
          const padBottom = horiz || (!horiz && !lat) ? pad : 0;
          const padLeft   = lat  || (!horiz && !lat) ? pad : 0;
          const padRight  = lat  || (!horiz && !lat) ? pad : 0;
          vfParts.push(`pad=iw*(1+${padLeft}+${padRight}):ih*(1+${padTop}+${padBottom}):iw*${padLeft}:ih*${padTop}:color=black`);
        }

        // Ensure H.264-compatible dimensions (even pixels) only when re-encoding
        if (vfParts.length > 0 || extraArgs.length > 0) {
          vfParts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
        }

      } else {
        /* ----------- MODE ADVANCED ----------- */
        const _clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
        const get = (key: string, defMin: number, defMax: number, lo: number, hi: number) => {
          const r = ranges?.[key] ?? {};
          const enabled = !!r.enabled;
          let min = Number(r.min ?? defMin);
          let max = Number(r.max ?? defMax);
          if (min > max) [min, max] = [max, min];
          let value = enabled ? min + Math.random() * (max - min) : NaN;
          if (enabled) value = _clamp(value, lo, hi);
          return { enabled, value };
        };

        const sat = get("saturation", 1.0, 1.0, 0.0, 3.0);
        const con = get("contrast",   1.0, 1.0, 0.0, 3.0);
        const bri = get("brightness", 0.0, 0.0, -1.0, 1.0);
        const gam = get("gamma",      1.0, 1.0,  0.1, 3.0);

        if (sat.enabled || con.enabled || bri.enabled || gam.enabled) {
          const s = Number.isFinite(sat.value) ? sat.value : 1.0;
          const c = Number.isFinite(con.value) ? con.value : 1.0;
          const b = Number.isFinite(bri.value) ? bri.value : 0.0;
          const g = Number.isFinite(gam.value) ? gam.value : 1.0;
          vfParts.push(`eq=brightness=${b.toFixed(3)}:contrast=${c.toFixed(3)}:saturation=${s.toFixed(3)}:gamma=${g.toFixed(3)}`);
        }

        const hue = get("hue_rad", 0, 0, -1.0, 1.0);
        if (hue.enabled) vfParts.push(`hue=h=${hue.value.toFixed(3)}`);

        const vig = get("vignette", 0, 0, 0.0, 1.5);
        if (vig.enabled) vfParts.push(`vignette=angle=${vig.value.toFixed(3)}:mode=forward`);

        const noi = get("noise", 0, 0, 0, 64);
        if (noi.enabled && noi.value > 0)
          vfParts.push(`noise=alls=${Math.max(0, Math.round(noi.value))}:allf=t+u`);

        const lens = get("lens_k", 0, 0, -0.3, 0.3);
        if (lens.enabled && Math.abs(lens.value) >= 0.0005) {
          const k1 = lens.value;
          vfParts.push(`lenscorrection=k1=${k1.toFixed(5)}:k2=${(-k1 / 2).toFixed(5)}`);
        }

        const un = get("unsharp", 0, 0, 0.0, 1.0);
        if (un.enabled && un.value > 0) {
          const a = 0.8 * un.value;
          vfParts.push(`unsharp=lx=3:ly=3:la=${a.toFixed(2)}:cx=3:cy=3:ca=${a.toFixed(2)}`);
        }

        const spd = get("speed", 1.0, 1.0, 0.5, 2.0);
        if (spd.enabled && spd.value !== 1.0) {
          const s = spd.value;
          vfParts.push(`setpts=${(1 / s).toFixed(4)}*PTS`);
          afParts.push(`atempo=${s.toFixed(3)}`);
        }

        const zm = get("zoom", 1.0, 1.0, 0.8, 1.5);
        if (zm.enabled && zm.value !== 1.0) {
          const z = zm.value;
          vfParts.push(`scale=iw*${z.toFixed(3)}:ih*${z.toFixed(3)}`);
          vfParts.push(`crop=iw:ih:x=(in_w-out_w)/2:y=(in_h-out_h)/2`);
        }

        const pxs = get("pixelshift", 0, 0, 0, 20);
        if (pxs.enabled && pxs.value >= 1) {
          const p = Math.round(pxs.value);
          vfParts.push(`crop=iw:ih:${p}:${p}`);
          vfParts.push(`pad=iw+${p}:ih+${p}:${p}:${p}:color=black`);
        }

        const rot = get("rotation_deg", 0, 0, -15, 15);
        if (rot.enabled && Math.abs(rot.value) > 0.001) {
          const r = (rot.value * Math.PI) / 180;
          vfParts.push(`rotate=${r.toFixed(6)}:c=black@1.0`);
        }

        const fr = get("fps", 0, 0, 10, 60);
        if (fr.enabled) extraArgs.push("-r", String(Math.round(fr.value)));

        const dimW = ranges?.dim_w?.enabled ? _clamp(Number(ranges.dim_w.min), -30, 30) : 0;
        const dimH = ranges?.dim_h?.enabled ? _clamp(Number(ranges.dim_h.min), -30, 30) : 0;
        if (dimW || dimH) {
          vfParts.push(`scale=iw*${(1 + dimW / 100).toFixed(6)}:ih*${(1 + dimH / 100).toFixed(6)}:flags=bicubic`);
        }

        const padPx = get("border_px", 0, 0, 0, 200);
        if (padPx.enabled && padPx.value > 0) {
          const p = Math.round(padPx.value);
          vfParts.push(`pad=iw+${2 * p}:ih+${2 * p}:${p}:${p}:color=black`);
        }

        const vbr = get("vbitrate", 0, 0, 500, 50000);
        if (vbr.enabled) extraArgs.push("-b:v", `${Math.round(vbr.value)}k`);
        const gop = get("gop", 0, 0, 10, 300);
        if (gop.enabled) extraArgs.push("-g", String(Math.round(gop.value)));

        const cStart = get("cut_start", 0, 0, 0, Number.MAX_SAFE_INTEGER);
        const cEnd   = get("cut_end",   0, 0, 0, Number.MAX_SAFE_INTEGER);
        if (cStart.enabled && cStart.value > 0) extraArgs.push("-ss", cStart.value.toFixed(3));
        if (cEnd.enabled && cEnd.value > 0) {
          const to = !cStart.enabled ? cEnd.value : Math.max(cStart.value + 0.05, cEnd.value);
          extraArgs.push("-to", to.toFixed(3));
        }

        const vol = get("volume_db", 0, 0, -30, 30);
        if (vol.enabled && vol.value !== 0) afParts.push(`volume=${vol.value.toFixed(2)}dB`);

        const wf = get("afreq_hz", 0, 0, 20, 16000);
        if (wf.enabled && wf.value) {
          const hz = Math.round(Math.abs(wf.value));
          if (hz < 500) afParts.push(`bass=g=5:f=${hz}`);
          else if (hz > 4000) afParts.push(`treble=g=5:f=${hz}`);
          else afParts.push(`equalizer=f=${hz}:width_type=h:width=200:g=3`);
        }

        const abr = get("abitrate_k", 0, 0, 32, 320);
        if (abr.enabled) extraArgs.push("-b:a", `${Math.round(abr.value)}k`);

        if (Boolean(ranges?.flip?.enabled))    vfParts.push("vflip");
        if (Boolean(ranges?.reverse?.enabled)) vfParts.push("hflip");

        // Ensure H.264-compatible dimensions only when re-encoding
        if (vfParts.length > 0 || extraArgs.length > 0) {
          vfParts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
        }
      }

      const metaArgs = getVideoMetadataArgs();
      await runFFmpegSafe(tmpIn, outPath, vfParts, afParts, extraArgs, metaArgs);
      outputPaths.push(outPath);
      doneCopies++;
      await onProgress?.(
        Math.min(99, Math.round((doneCopies / totalCopies) * 100)),
        `Encodage ${doneCopies}/${totalCopies}…`
      );
    }

    if (ownsTmpIn) await fs.unlink(tmpIn).catch(() => {});
  }

  return { channel, outputPaths };
}
