// Shared video duplication logic — no "use server", importable from both server actions and API routes
import fs from "fs/promises";
import os from "os";
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

export async function getFFmpegBin(): Promise<string> {
  // Env override — useful for local dev or a custom deploy with a real binary.
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;

  // Already resolved this process instance.
  if (_ffmpegBin) return _ffmpegBin;

  const { existsSync } = await import("fs");

  // ── 1. PATH lookup via shell built-in (works even if `which` is absent) ──
  try {
    const { execSync } = await import("child_process");
    const found = execSync("command -v ffmpeg", { encoding: "utf8", shell: "/bin/sh" }).trim();
    if (found && existsSync(found)) {
      console.log(`[ffmpeg] found via PATH at ${found}`);
      _ffmpegBin = found;
      return _ffmpegBin;
    }
  } catch {
    // not in PATH, continue
  }

  // ── 2. Explicit well-known paths (nixpacks, apt, Nix store symlink) ──
  const CANDIDATES = [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/nix/var/nix/profiles/default/bin/ffmpeg",
  ];
  for (const p of CANDIDATES) {
    if (existsSync(p)) {
      console.log(`[ffmpeg] found at known path ${p}`);
      _ffmpegBin = p;
      return _ffmpegBin;
    }
  }

  // ── 3. Warm start: binary already in /tmp from a previous invocation ──
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
  "Antoine Durand", "Manon Lefebvre", "Théo Garnier", "Inès Fontaine",
  "Baptiste Morin", "Clara Rousseau", "Maxime Girard", "Julie Chevalier",
];
const VIDEO_ENCODERS = [
  "HandBrake 1.8.0", "DaVinci Resolve 19.1", "Adobe Premiere Pro 24.6",
  "Final Cut Pro 11.6", "CapCut Desktop 3.2", "iMovie 14.0",
  "Kdenlive 23.08", "Vegas Pro 22", "Shotcut 23.11", "Resolve 18.6",
];
const VIDEO_COMMENTS = [
  "Export final", "Client review", "Draft v2", "Social media cut",
  "Archive copy", "Timeline export", "Delivery package", "Version approuvée",
  "Montage court", "Réseaux sociaux", "Post-production", "Rendu final",
];
const VIDEO_TITLES = [
  "Untitled Project", "My Video", "New Clip", "Export", "Final Cut",
  "Project Export", "Video Draft", "Timeline Export", "Master",
];
const VIDEO_GENRES = [
  "Documentary", "Short Film", "Vlog", "Tutorial", "Promotional",
  "Personal", "Entertainment", "Educational", "Social",
];
const VIDEO_SERVICE_NAMES = [
  "Personal Device", "Mobile Upload", "Desktop Export", "Cloud Backup",
];
function randMetaHex(n = 8): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}
function getVideoMetadataArgs(): string[] {
  const artist = pickRandom(VIDEO_HUMAN_NAMES);
  const encoder = pickRandom(VIDEO_ENCODERS);
  const comment = pickRandom(VIDEO_COMMENTS);
  const title = pickRandom(VIDEO_TITLES);
  const genre = pickRandom(VIDEO_GENRES);
  const service = pickRandom(VIDEO_SERVICE_NAMES);
  const uid = `${randMetaHex(8)}-${randMetaHex(4)}-${randMetaHex(4)}-${randMetaHex(4)}-${randMetaHex(12)}`;
  const daysAgo = Math.floor(Math.random() * 365);
  const hoursAgo = Math.floor(Math.random() * 24);
  const minsAgo = Math.floor(Math.random() * 60);
  const creationDate = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000 - minsAgo * 60000);
  const isoDate = creationDate.toISOString().slice(0, 19) + "Z";
  return [
    "-map_metadata", "-1",
    "-metadata", `title=${title}`,
    "-metadata", `artist=${artist}`,
    "-metadata", `author=${artist}`,
    "-metadata", `encoder=${encoder}`,
    "-metadata", `encoded_by=${encoder}`,
    "-metadata", `creation_time=${isoDate}`,
    "-metadata", `comment=${comment}`,
    "-metadata", `description=${comment}`,
    "-metadata", `copyright=© ${creationDate.getFullYear()} ${artist}`,
    "-metadata", `genre=${genre}`,
    "-metadata", `service_name=${service}`,
    "-metadata", `handler_name=${encoder}`,
    "-metadata", `major_brand=isom`,
    "-metadata", `minor_version=512`,
    "-metadata", `compatible_brands=isomiso2avc1mp41`,
    "-metadata:g", `uid=${uid}`,
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

// Run up to `concurrency` async tasks simultaneously.
async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      await fn(queue.shift()!);
    }
  });
  await Promise.all(workers);
}

async function runFFmpegSafe(
  input: string,
  output: string,
  vfParts: string[],
  afParts: string[] = [],
  extraArgs: string[] = [],
  metaArgs: string[] = [],
  // Called with the current encoded time (e.g. "00:00:12.34") as FFmpeg progresses.
  onTick?: (elapsed: string) => void,
  // Pre-resolved ffmpeg binary path — avoids redundant disk/PATH lookups per copy.
  binPath?: string,
  // Threads to allocate to this FFmpeg process (computed by caller from os.cpus()).
  threads = 1,
) {
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
  // -stats prints "frame= fps= time=…" to stderr even at loglevel error,
  // so the UI can show real encoding progress without spamming log output.
  if (onTick) args.push("-stats");
  args.push("-i", input);

  // Three tiers:
  // 1. No filters at all → full stream copy (near-instant, no re-encode)
  // 2. Audio filters only → copy video track, encode audio (fast: no video decode)
  // 3. Any video/extra filters → full encode
  const useStreamCopy = vfParts.length === 0 && afParts.length === 0 && extraArgs.length === 0;
  const audioOnly = vfParts.length === 0 && afParts.length > 0 && extraArgs.length === 0;

  if (useStreamCopy) {
    args.push("-c", "copy");
  } else if (audioOnly) {
    args.push("-af", afParts.join(","));
    args.push("-c:v", "copy", "-c:a", "aac", "-b:a", "192k");
  } else {
    if (vfParts.length) args.push("-vf", vfParts.join(","));
    if (afParts.length) args.push("-af", afParts.join(","));
    args.push(
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",     // disables lookahead → slightly faster, no quality loss
      "-threads", String(threads), // caller allocates threads based on os.cpus()
      "-crf", "35",               // CRF 35: ~40% faster encode + 3–5× smaller output → much faster Supabase upload
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
    );
    // extraArgs can override crf/bitrate (e.g. technical pack sets its own values)
    if (extraArgs.length) args.push(...extraArgs);
  }

  args.push("-movflags", "+faststart");
  if (metaArgs.length) args.push(...metaArgs);

  args.push(output);

  const ffmpegBin = binPath ?? await getFFmpegBin();
  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegBin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => {
      const chunk = String(d);
      stderr += chunk;
      if (onTick) {
        // Parse "time=HH:MM:SS.ms" from the -stats progress line
        const m = chunk.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (m) onTick(m[1]);
      }
    });
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

  // Pre-warm FFmpeg binary once — cold start (binary download) can take 10-30 s.
  // Sending a message lets users know something is happening, not a blank freeze.
  await onProgress?.(0, "Chargement de FFmpeg…");
  const ffmpegBin = await getFFmpegBin();
  await onProgress?.(1, "FFmpeg prêt — démarrage de l'encodage…");

  // ── Prepare all input temp-files (parallel for direct uploads) ─────────────
  type FileEntry = { fileName: string; tmpIn: string; ownsTmpIn: boolean };
  const fileEntries = await Promise.all(
    files.map(async (f, idx): Promise<FileEntry> => {
      const fileName = "tmpPath" in f ? f.name : (f as File).name;
      const origExt = extOf(fileName) || ".mp4";
      if ("tmpPath" in f) {
        return { fileName, tmpIn: f.tmpPath, ownsTmpIn: false };
      }
      await onProgress?.(2, `Écriture fichier ${idx + 1}/${files.length}…`);
      const tmpIn = path.join(dir, `__in__${Date.now()}_${idx}${origExt}`);
      await fs.writeFile(tmpIn, Buffer.from(await (f as File).arrayBuffer()));
      return { fileName, tmpIn, ownsTmpIn: true };
    })
  );

  // ── Flatten all (file × copy) into one pool so every copy of every file
  // runs concurrently — total time ≈ slowest single copy, not SUM. ───────────
  type Task = { fileName: string; tmpIn: string; fileIndex: number; copyIndex: number };
  const allTasks: Task[] = fileEntries.flatMap(({ fileName, tmpIn }, idx) =>
    Array.from({ length: count }, (_, i) => ({
      fileName, tmpIn, fileIndex: idx + 1, copyIndex: i + 1,
    }))
  );

  // ── CPU-aware concurrency and thread allocation ───────────────────────────
  // Give each parallel task its own core(s).  When the task count exceeds the
  // CPU count we cap concurrency at ncpus and let the OS schedule; threads per
  // process stay at 1 to avoid cross-task contention.
  const ncpus = Math.max(1, os.cpus().length);
  // 1 task per CPU core — avoids over-subscription on single-core servers where
  // running 2 competing CPU-bound encodes would double the time per copy.
  const CONCURRENCY  = Math.min(allTasks.length, ncpus);
  const threadsPerTask = CONCURRENCY > 0
    ? Math.max(1, Math.floor(ncpus / CONCURRENCY))
    : 1;

  await withConcurrency(allTasks, CONCURRENCY, async ({ fileName, tmpIn, fileIndex, copyIndex }) => {
    const startPct = Math.min(99, Math.round((doneCopies / totalCopies) * 100));
    await onProgress?.(startPct, `Encodage ${doneCopies + 1}/${totalCopies}…`);

    const outName = videoOutName({
      channel,
      date: stamp,
      fileIndex,
      copyIndex,
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
          // eq — brightness ±6%, contrast ±6%, saturation ±6%, gamma ±4%
          const b  = clamp(Number((-0.06 + Math.random() * 0.12).toFixed(3)), LIMITS.brightness.min, LIMITS.brightness.max);
          const ct = clamp(Number((0.94 + Math.random() * 0.12).toFixed(3)),  LIMITS.contrast.min,   LIMITS.contrast.max);
          const st = clamp(Number((0.94 + Math.random() * 0.12).toFixed(3)),  LIMITS.saturation.min, LIMITS.saturation.max);
          const gm = clamp(Number((0.96 + Math.random() * 0.08).toFixed(3)),  0.1, 3.0);
          vfParts.push(`eq=brightness=${b}:contrast=${ct}:saturation=${st}:gamma=${gm}`);
          // Hue ±8° — subtle color shift
          const hue = clamp(Number((Math.random() * 16 - 8).toFixed(2)), -30, 30);
          vfParts.push(`hue=h=${hue}`);
          // Color channel mixing 0.5–2% cross-channel
          const rr = (0.97 + Math.random() * 0.04).toFixed(3);
          const gg = (0.97 + Math.random() * 0.04).toFixed(3);
          const bb = (0.97 + Math.random() * 0.04).toFixed(3);
          const cx = (0.005 + Math.random() * 0.015).toFixed(3);
          vfParts.push(`colorchannelmixer=rr=${rr}:rg=${cx}:rb=${cx}:gg=${gg}:gr=${cx}:gb=${cx}:bb=${bb}:bg=${cx}:br=${cx}`);
          // Unsharp (light sharpening)
          vfParts.push("unsharp=lx=3:ly=3:la=0.4:cx=3:cy=3:ca=0.4");
          // Luma noise temporal — 2–5 (subtle grain)
          const ns = 2 + Math.floor(Math.random() * 4);  // 2–5
          vfParts.push(`noise=c0s=${ns}:c0f=t`);
          // NOTE: double-resize removed (was slow and barely effective)
        }

        if (packs.includes("motion")) {
          // ── Digital zoom with correct sub-region crop ──────────────────────────
          // Previous code had a bug: crop=iw:ih:x=(in_w-out_w)*off evaluated to x=0
          // because in_w==out_w after scale, so no crop happened and the video was
          // output at zoom× the original resolution.
          //
          // Correct approach: crop a sub-region (iw/zoom × ih/zoom) from the original
          // at a random position, then scale that region back up to fill original size.
          // This is true "digital zoom" — different frame content shown in each copy.
          const zoom = clamp(1.10 + Math.random() * 0.08, LIMITS.zoom.min, LIMITS.zoom.max); // 1.10–1.18×
          const zf = zoom.toFixed(6);
          // Max safe start offset: must ensure crop region stays within frame bounds
          const maxOff = (1 - 1 / zoom);  // e.g., 0.091 at zoom=1.10, 0.153 at zoom=1.18
          const offx = (Math.random() * maxOff).toFixed(6);
          const offy = (Math.random() * maxOff).toFixed(6);
          // crop: take (iw/zoom × ih/zoom) from position (iw*offx, ih*offy)
          // scale: bring the sub-region back to full original dimensions — fast_bilinear for speed
          vfParts.push(`crop=iw/${zf}:ih/${zf}:x=iw*${offx}:y=ih*${offy}`);
          vfParts.push(`scale=iw*${zf}:ih*${zf}:flags=fast_bilinear`);
          // Speed ±5–8% — temporal shift makes fixed-timestamp frame comparisons see different content
          const side = Math.random() > 0.5 ? 1 : -1;
          const deviation = 0.05 + Math.random() * 0.03;  // 5–8%
          const sp = clamp(1.0 + side * deviation, LIMITS.speed.min, LIMITS.speed.max);
          vfParts.push(`setpts=${(1 / sp).toFixed(6)}*PTS`);
          afParts.push(`atempo=${sp.toFixed(4)}`);
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
        if (noi.enabled && noi.value > 0) {
          // c0s = luma-channel noise only; ~3× faster than alls (all channels).
          // Luma noise is the most visible component in YUV; t = temporal (per-frame).
          vfParts.push(`noise=c0s=${Math.max(0, Math.round(noi.value))}:c0f=t`);
        }

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
          const zf = z.toFixed(6);
          // BUG FIX: old code used crop=iw:ih which evaluated x=(in_w-out_w)/2=0 (no crop at all).
          // Correct: scale up/down, then crop-back only when zoomed IN to restore original dimensions.
          vfParts.push(`scale=iw*${zf}:ih*${zf}:flags=fast_bilinear`);
          if (z > 1.0) {
            // After scale up: iw = W*z, ih = H*z. Crop center region back to W×H.
            vfParts.push(`crop=iw/${zf}:ih/${zf}:x=(iw-iw/${zf})/2:y=(ih-ih/${zf})/2`);
          }
          // z < 1: video is smaller, kept as-is — final scale=trunc normalises dimensions
        }

        const pxs = get("pixelshift", 0, 0, 0, 20);
        if (pxs.enabled && pxs.value >= 1) {
          const p = Math.round(pxs.value);
          // CRASH BUG FIX: old code used crop=iw:ih:p:p which reads p+iw pixels from an
          // iw-wide buffer → buffer overread → segfault → exit code null → VID-004.
          // Correct: crop sub-region (removing p from top/left), pad to restore original size.
          vfParts.push(`crop=iw-${p}:ih-${p}:${p}:${p}`);
          vfParts.push(`pad=in_w+${p}:in_h+${p}:0:0:color=black`);
        }

        const rot = get("rotation_deg", 0, 0, -15, 15);
        if (rot.enabled && Math.abs(rot.value) > 0.001) {
          const r = (rot.value * Math.PI) / 180;
          // PERF FIX: without ow=iw:oh=ih, FFmpeg computes the full rotated bounding box
          // (~40% more pixels for 15° rotation) — slower AND changes output dimensions.
          // ow=iw:oh=ih crops the rotated frame to original size (black fill on corners).
          vfParts.push(`rotate=${r.toFixed(6)}:c=black@1.0:ow=iw:oh=ih`);
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
      await runFFmpegSafe(
        tmpIn, outPath, vfParts, afParts, extraArgs, metaArgs,
        // Live progress tick: update message with encoded time so users see activity
        (elapsed) => void onProgress?.(
          Math.min(99, Math.round((doneCopies / totalCopies) * 100)),
          `Encodage ${doneCopies + 1}/${totalCopies}… (${elapsed})`,
        ),
        ffmpegBin,
        threadsPerTask,
      );
      outputPaths.push(outPath);
      doneCopies++;
      await onProgress?.(
        Math.min(99, Math.round((doneCopies / totalCopies) * 100)),
        `Encodage ${doneCopies}/${totalCopies} terminé`,
      );
  });

  // ── Clean up temp input files ─────────────────────────────────────────────
  for (const { tmpIn, ownsTmpIn } of fileEntries) {
    if (ownsTmpIn) await fs.unlink(tmpIn).catch(() => {});
  }

  return { channel, outputPaths };
}
