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

/** Probe video color properties to detect HDR (BT.2020 / HLG / PQ). */
type ColorInfo = {
  isHDR: boolean;
  colorSpace: string;   // e.g. "bt2020nc", "bt709", "unknown"
  colorTransfer: string; // e.g. "arib-std-b67" (HLG), "smpte2084" (PQ), "bt709"
  colorPrimaries: string; // e.g. "bt2020", "bt709"
  pixFmt: string;        // e.g. "yuv420p10le", "yuv420p"
};
async function probeColorInfo(input: string, binPath: string): Promise<ColorInfo> {
  const defaults: ColorInfo = { isHDR: false, colorSpace: "unknown", colorTransfer: "unknown", colorPrimaries: "unknown", pixFmt: "unknown" };
  return new Promise((resolve) => {
    let stderr = "";
    let settled = false;
    const done = (v: ColorInfo) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };

    const p = spawn(binPath, ["-hide_banner", "-i", input], { stdio: ["ignore", "ignore", "pipe"] });
    p.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    p.on("error", () => done(defaults));
    p.on("close", () => {
      // Parse color info from ffmpeg -i output, e.g.:
      // Stream #0:0: Video: hevc ... yuv420p10le(tv, bt2020nc/bt2020/arib-std-b67) ...
      const info = { ...defaults };

      // Extract pixel format — e.g. "yuv420p10le" or "yuv420p"
      const pfm = stderr.match(/Video:.*?\s(yuv\w+)/);
      if (pfm) info.pixFmt = pfm[1];

      // Extract color properties from parenthetical — e.g. "(tv, bt2020nc/bt2020/arib-std-b67)"
      // Use [^\/)]+  instead of \w+ because transfer names like "arib-std-b67" contain hyphens.
      const cm = stderr.match(/\((?:tv|pc|unknown),\s*([^\/)]+)\/([^\/)]+)\/([^)]+)\)/);
      if (cm) {
        info.colorSpace = cm[1].trim();     // bt2020nc, bt709, smpte170m, etc.
        info.colorPrimaries = cm[2].trim(); // bt2020, bt709, etc.
        info.colorTransfer = cm[3].trim();  // arib-std-b67 (HLG), smpte2084 (PQ), bt709, etc.
      }

      // Detect HDR: BT.2020 color space OR HLG/PQ transfer function OR 10-bit HEVC
      // (iPhone HEVC 10-bit without explicit color tags is almost always BT.2020 HLG)
      const is10bit = /10le|10be|p010/.test(info.pixFmt);
      const isHEVC = /hevc|h\.?265/i.test(stderr);
      info.isHDR = /bt2020/i.test(info.colorSpace) ||
                   /bt2020/i.test(info.colorPrimaries) ||
                   /arib-std-b67|smpte2084/i.test(info.colorTransfer) ||
                   (is10bit && isHEVC);  // 10-bit HEVC = HDR on iPhone

      console.log("[probeColorInfo]", input.split("/").pop(), JSON.stringify(info));
      done(info);
    });

    const timer = setTimeout(() => { p.kill("SIGKILL"); done(defaults); }, 8_000);
  });
}

/**
 * Build the HDR→SDR filter chain prefix.
 * Full pipeline: linearize → convert primaries → tone map → set BT.709 output.
 * The tonemap step compresses HDR luminance into SDR range (prevents overexposure).
 * Without it, HLG bright areas get clipped and the image looks washed out / yellow.
 *
 * The "No space left" errors seen earlier were caused by the Railway volume being
 * full at 5 GB, NOT by this pipeline — confirmed after resizing the volume.
 */
function hdrToSdrFilters(): string[] {
  return [
    "zscale=t=linear:npl=100",       // linearize HLG/PQ transfer function
    "format=gbrpf32le",               // 32-bit float for accurate tone mapping
    "zscale=p=bt709",                 // convert BT.2020 primaries → BT.709
    "tonemap=hable:desat=0",          // compress HDR luminance → SDR (no overexposure)
    "zscale=t=bt709:m=bt709:r=tv",   // set BT.709 transfer + matrix + limited range
    "format=yuv420p",                 // convert to 8-bit for H.264
  ];
}

/** Probe video duration (seconds) using ffmpeg -i.  Returns 0 if parsing fails. */
async function probeVideoDuration(input: string, binPath: string): Promise<number> {
  return new Promise((resolve) => {
    let stderr = "";
    let settled = false;
    const done = (val: number) => { if (!settled) { settled = true; clearTimeout(timer); resolve(val); } };

    // -probesize 100M lets FFmpeg read further into the file to find the moov atom
    // when it sits near the end (common for unfaststarted recordings, HEVC from TapRecord, etc.)
    const p = spawn(binPath, ["-probesize", "100M", "-i", input], { stdio: ["ignore", "ignore", "pipe"] });
    p.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    p.on("error", () => done(0));
    p.on("close", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
      done(!m ? 0 : parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]));
    });

    // Safety: kill the probe if it hangs for more than 8 seconds
    const timer = setTimeout(() => { p.kill("SIGKILL"); done(0); }, 8_000);
  });
}

/**
 * Quick sanity-check: try to decode 1 frame from the file.
 * Returns true if FFmpeg can read it (valid file, possibly HEVC or unusual profile
 * that probeVideoDuration couldn't parse), false if it's genuinely unreadable.
 */
async function canFFmpegReadFile(input: string, binPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => { if (!settled) { settled = true; clearTimeout(timer); resolve(ok); } };

    // Decode up to 1 frame, output to null — fast and codec-agnostic
    const p = spawn(binPath, ["-v", "error", "-i", input, "-vframes", "1", "-f", "null", "-"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    p.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    p.on("error", () => done(false));
    p.on("close", (code) => {
      // Accept if exit 0, or if stderr has no fatal error (some valid files exit 1 with warnings)
      const fatal = /Invalid data|moov atom not found|No such file|Permission denied/i.test(stderr);
      done(code === 0 || !fatal);
    });

    const timer = setTimeout(() => { p.kill("SIGKILL"); done(false); }, 12_000);
  });
}

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
  copyTag: string; // tag aléatoire unique par copie — ne contient pas le nom original
}) {
  const { channel, date, fileIndex, copyIndex, copyTag } = opts;
  return `${channelCaps(channel)}_DuupFlow_${date}_vid${fileIndex}_c${String(
    copyIndex
  ).padStart(2, "0")}_${copyTag}.mp4`;
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
  "Romain Perrin", "Lucie Bertrand", "Hugo Marchand", "Elisa Dupont",
  "Nathan Aubert", "Chloé Vidal", "Arthur Lemoine", "Pauline Guerin",
  "Samuel Roux", "Anaïs Collin", "Victor Legrand", "Justine Arnaud",
  "Tom Bourgeois", "Sarah Picard", "Mathieu Cordier", "Laura Benoit",
];
const VIDEO_ENCODERS = [
  "HandBrake 1.8.0", "HandBrake 1.7.3", "HandBrake 1.6.1",
  "DaVinci Resolve 19.1", "DaVinci Resolve 18.6", "DaVinci Resolve 17.4",
  "Adobe Premiere Pro 24.6", "Adobe Premiere Pro 23.5", "Adobe Premiere Pro 22.3",
  "Final Cut Pro 11.6", "Final Cut Pro 10.8", "Final Cut Pro 10.7",
  "CapCut Desktop 3.2", "CapCut Desktop 2.9", "iMovie 14.0", "iMovie 13.1",
  "Kdenlive 23.08", "Kdenlive 22.12", "Vegas Pro 22", "Vegas Pro 21",
  "Shotcut 23.11", "Shotcut 22.09", "Resolve 18.6", "Claquette 1.4",
  "OpenShot 3.1", "Lightworks 2023.1", "Filmora 13.0", "PowerDirector 22",
];
const VIDEO_COMMENTS = [
  "Export final", "Client review", "Draft v2", "Draft v3", "Social media cut",
  "Archive copy", "Timeline export", "Delivery package", "Version approuvée",
  "Montage court", "Réseaux sociaux", "Post-production", "Rendu final",
  "Version HD", "Review cut", "Web export", "Mobile cut", "Broadcast master",
  "Press copy", "Internal review", "Rough cut", "Fine cut", "Final delivery",
  "Approved version", "Quick edit", "Story cut", "Highlight reel",
];
const VIDEO_TITLES = [
  "Untitled Project", "My Video", "New Clip", "Export", "Final Cut",
  "Project Export", "Video Draft", "Timeline Export", "Master",
  "Clip HD", "Export HD", "Version finale", "Projet vidéo", "Brouillon",
  "Sequence 01", "Scene 01", "Rushes", "Montage", "Cut final",
  "Footage", "Story", "Reel", "Promo", "Teaser", "Highlights",
];
const VIDEO_GENRES = [
  "Documentary", "Short Film", "Vlog", "Tutorial", "Promotional",
  "Personal", "Entertainment", "Educational", "Social",
  "Commercial", "Corporate", "Lifestyle", "Travel", "Music Video",
  "Sports", "Fashion", "Food", "News", "Comedy", "Drama",
];
const VIDEO_SERVICE_NAMES = [
  "Personal Device", "Mobile Upload", "Desktop Export", "Cloud Backup",
  "Social Export", "Online Delivery", "Archive Service", "Media Server",
  "Home Studio", "Field Recorder", "Capture Card", "Screen Recorder",
];
const VIDEO_LOCATIONS = [
  "Paris, France", "Lyon, France", "Marseille, France", "Bordeaux, France",
  "Toulouse, France", "Nantes, France", "Lille, France", "Strasbourg, France",
  "London, UK", "Berlin, Germany", "Madrid, Spain", "Brussels, Belgium",
  "Montreal, Canada", "Geneva, Switzerland", "Amsterdam, Netherlands",
];
const VIDEO_BRANDS = ["isom", "mp42", "mp41", "avc1", "iso2"];
const VIDEO_COMPAT_BRANDS: Record<string, string> = {
  isom: "isomiso2avc1mp41",
  mp42: "mp42isomavc1",
  mp41: "mp41isomiso2avc1",
  avc1: "avc1isomavc1mp41",
  iso2: "iso2avc1mp41",
};
const VIDEO_LANGUAGES = ["und", "fra", "eng", "deu", "spa", "ita", "por", "nld"];
function randMetaHex(n = 8): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}
/* ---- iPhone-realistic metadata for "Priorité d'algorithme" mode ---- */
const IPHONE_MODELS = [
  { make: "Apple", model: "iPhone 17 Pro Max", software: "26.2" },
  { make: "Apple", model: "iPhone 17 Pro", software: "26.1" },
  { make: "Apple", model: "iPhone 17 Air", software: "26.1" },
  { make: "Apple", model: "iPhone 17", software: "26.0" },
  { make: "Apple", model: "iPhone 16 Pro Max", software: "18.4.1" },
  { make: "Apple", model: "iPhone 16 Pro", software: "18.3.2" },
  { make: "Apple", model: "iPhone 16", software: "18.3.1" },
  { make: "Apple", model: "iPhone 15 Pro Max", software: "18.2.1" },
  { make: "Apple", model: "iPhone 15 Pro", software: "18.2" },
  { make: "Apple", model: "iPhone 15", software: "18.1" },
];
const IPHONE_LENS = [
  { focal: "6.86", focalEq: "24", aperture: "1.78", lens: "iPhone 17 Pro Max back triple camera 6.86mm f/1.78" },
  { focal: "6.86", focalEq: "24", aperture: "1.78", lens: "iPhone 16 Pro Max back triple camera 6.86mm f/1.78" },
  { focal: "6.765", focalEq: "24", aperture: "1.78", lens: "iPhone 16 Pro back triple camera 6.765mm f/1.78" },
  { focal: "2.22", focalEq: "13", aperture: "2.2", lens: "iPhone 17 Pro back triple camera 2.22mm f/2.2" },
  { focal: "2.22", focalEq: "13", aperture: "2.2", lens: "iPhone 16 Pro back triple camera 2.22mm f/2.2" },
  { focal: "9.0", focalEq: "77", aperture: "2.8", lens: "iPhone 16 Pro back triple camera 9mm f/2.8" },
  { focal: "5.7", focalEq: "28", aperture: "1.6", lens: "iPhone 17 Pro Max back triple camera 5.7mm f/1.6" },
  { focal: "6.765", focalEq: "24", aperture: "1.78", lens: "iPhone 15 Pro back triple camera 6.765mm f/1.78" },
  { focal: "2.22", focalEq: "13", aperture: "2.2", lens: "iPhone 15 Pro back triple camera 2.22mm f/2.2" },
];

type MetaOpts = {
  country?: string;
  iphoneMeta?: boolean;
  // Advanced mode: individual controls (undefined = all enabled for simple mode)
  controls?: {
    creation_time?: { enabled: boolean; value?: string };
    encoder?: { enabled: boolean; value?: string };
    brand?: { enabled: boolean };
    uid?: { enabled: boolean };
  };
};

function getVideoMetadataArgs(opts?: MetaOpts): string[] {
  const ctrl = opts?.controls;
  const allOn = !ctrl; // simple mode: all metadata enabled when function is called

  const args: string[] = ["-map_metadata", "-1"];

  // creation_time
  if (allOn || ctrl?.creation_time?.enabled) {
    const customDate = ctrl?.creation_time?.value;
    if (customDate) {
      args.push("-metadata", `creation_time=${customDate}`);
    } else {
      const daysAgo = Math.floor(Math.random() * 365);
      const hoursAgo = Math.floor(Math.random() * 24);
      const minsAgo = Math.floor(Math.random() * 60);
      const d = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000 - minsAgo * 60000);
      args.push("-metadata", `creation_time=${d.toISOString().slice(0, 19)}Z`);
    }
  }

  // encoder / encoded_by
  if (allOn || ctrl?.encoder?.enabled) {
    const enc = ctrl?.encoder?.value || pickRandom(VIDEO_ENCODERS);
    args.push("-metadata", `encoder=${enc}`, "-metadata", `encoded_by=${enc}`);
  }

  // major_brand / minor_version / compatible_brands
  if (allOn || ctrl?.brand?.enabled) {
    const brand = pickRandom(VIDEO_BRANDS);
    args.push(
      "-metadata", `major_brand=${brand}`,
      "-metadata", `minor_version=${pickRandom([512, 0, 1, 2])}`,
      "-metadata", `compatible_brands=${VIDEO_COMPAT_BRANDS[brand]}`,
    );
  }

  // uid
  if (allOn || ctrl?.uid?.enabled) {
    const uid = `${randMetaHex(8)}-${randMetaHex(4)}-${randMetaHex(4)}-${randMetaHex(4)}-${randMetaHex(12)}`;
    args.push("-metadata:g", `uid=${uid}`);
  }

  // Location
  if (opts?.country) {
    args.push("-metadata", `location=${opts.country}`);
  }

  // iPhone metadata: overlay Apple QuickTime tags ON TOP of base metadata.
  // FFmpeg processes args in order — later -metadata flags override earlier ones.
  if (opts?.iphoneMeta) {
    const device = pickRandom(IPHONE_MODELS);
    const secsAgo = Math.floor(Math.random() * 86400 * 30);
    const iphoneDate = new Date(Date.now() - secsAgo * 1000);
    const iphoneIso = iphoneDate.toISOString().slice(0, 19) + "Z";
    const tzOffsetH = 1 + Math.floor(Math.random() * 3);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = `${iphoneDate.getFullYear()}-${pad(iphoneDate.getMonth()+1)}-${pad(iphoneDate.getDate())}T${pad(iphoneDate.getHours())}:${pad(iphoneDate.getMinutes())}:${pad(iphoneDate.getSeconds())}+${pad(tzOffsetH)}00`;
    const lat = (43 + Math.random() * 6).toFixed(4);
    const lon = (1 + Math.random() * 7).toFixed(4);
    const alt = (20 + Math.random() * 200).toFixed(3);
    const gpsIso6709 = `+${lat}+${lon.padStart(8, "0")}+${alt}/`;
    const locationAccuracy = (5 + Math.random() * 20).toFixed(6);
    const sigChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let sig = "";
    for (let i = 0; i < 36; i++) sig += sigChars[Math.floor(Math.random() * sigChars.length)];
    // Override container brand to match iPhone (qt, not isom)
    args.push(
      "-metadata", `major_brand=qt  `,
      "-metadata", `minor_version=0`,
      "-metadata", `compatible_brands=qt  `,
      "-metadata", `creation_time=${iphoneIso}`,
    );
    // Location + GPS only if user specified a country
    if (opts.country) {
      args.push(
        "-metadata", `location=${opts.country}`,
        "-metadata", `com.apple.quicktime.location.accuracy.horizontal=${locationAccuracy}`,
        "-metadata", `com.apple.quicktime.location.ISO6709=${gpsIso6709}`,
      );
    }
    args.push(
      // Apple QuickTime atoms
      "-metadata", `com.apple.quicktime.full-frame-rate-playback-intent=0`,
      "-metadata", `com.apple.quicktime.make=${device.make}`,
      "-metadata", `com.apple.quicktime.model=${device.model}`,
      "-metadata", `com.apple.quicktime.software=${device.software}`,
      "-metadata", `com.apple.quicktime.creationdate=${localDate}`,
      "-metadata", `com.apple.photos.originating.signature=${sig}`,
      // Stream handlers
      "-metadata:s:v:0", `handler_name=Core Media Video`,
      "-metadata:s:a:0", `handler_name=Core Media Audio`,
    );
  }

  return args;
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
// Returns the list of errors from failed tasks (successful tasks still run).
async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<Error[]> {
  const queue = [...items];
  const errors: Error[] = [];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      try {
        await fn(queue.shift()!);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error("[withConcurrency] task failed, continuing:", e.message);
        errors.push(e);
      }
    }
  });
  await Promise.all(workers);
  return errors;
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
  const ffmpegBin = binPath ?? await getFFmpegBin();

  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
  if (onTick) args.push("-stats");
  args.push("-i", input);
  // -max_muxing_queue_size must come AFTER -i (output option, not input option)
  args.push("-max_muxing_queue_size", "1024");

  // Four tiers:
  // 1. No filters at all → full stream copy (near-instant, no re-encode)
  // 2. Audio filters only → copy video track, encode audio (fast: no video decode)
  // 3. Extra output args only (e.g. -ar sample rate) → copy video, encode audio with args
  // 4. Any video filters → full encode
  const useStreamCopy = vfParts.length === 0 && afParts.length === 0 && extraArgs.length === 0;
  const audioOnly     = vfParts.length === 0 && afParts.length > 0  && extraArgs.length === 0;
  // videoCopy: only when extraArgs are audio-compatible output options (like -ar, -b:a).
  // Video encoder options (-profile:v, -crf, -b:v, -g, -level:v) require a real encode —
  // passing them with -c:v copy causes FFmpeg to reject them ("Error setting option profile").
  const hasVideoEncodeArgs = extraArgs.some((a) =>
    ["-crf", "-b:v", "-profile:v", "-level:v", "-g"].includes(a)
  );
  const videoCopy = vfParts.length === 0 && !useStreamCopy && !audioOnly && !hasVideoEncodeArgs;

  if (useStreamCopy) {
    args.push("-c", "copy");
  } else if (audioOnly) {
    args.push("-map", "0:v:0", "-map", "0:a:0?");
    args.push("-af", afParts.join(","));
    args.push("-c:v", "copy", "-c:a", "aac", "-b:a", "192k");
  } else if (videoCopy) {
    // Metadata-only pack: copy video stream pixel-perfect, re-encode audio only.
    // extraArgs may include -ar (sample rate) — applied as output options.
    args.push("-map", "0:v:0", "-map", "0:a:0?");
    if (afParts.length) args.push("-af", afParts.join(","));
    args.push("-c:v", "copy", "-c:a", "aac", "-b:a", "192k");
    if (extraArgs.length) args.push(...extraArgs);
  } else {
    // -map 0:v:0 : first video stream only (avoids crash on MP4s with embedded cover art)
    // -map 0:a:0?: first audio stream if present (prevents crash on no-audio inputs)
    args.push("-map", "0:v:0", "-map", "0:a:0?");
    if (vfParts.length) args.push("-vf", vfParts.join(","));
    if (afParts.length) args.push("-af", afParts.join(","));
    args.push(
      "-c:v", "libx264",
      "-preset", "ultrafast",      // ultrafast: prioritise encoding speed (3–5× faster than fast)
      "-threads", String(threads),  // caller allocates threads based on os.cpus()
      "-crf", "18",                // CRF 18: high visual quality, same speed with ultrafast preset
      "-pix_fmt", "yuv420p",       // Safety net — format=yuv420p in filter graph already converts
      "-c:a", "aac",
      "-b:a", "192k",
    );
    // extraArgs can override crf/bitrate (e.g. technical pack sets its own values)
    if (extraArgs.length) args.push(...extraArgs);
  }

  // use_metadata_tags: allows custom metadata keys (com.apple.quicktime.* etc.)
  // to be written into the MOV/MP4 container instead of being silently ignored.
  args.push("-movflags", "+faststart+use_metadata_tags");
  if (metaArgs.length) args.push(...metaArgs);

  if (output.endsWith(".mov")) args.push("-f", "mov");
  args.push(output);

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
      console.error("[FFmpeg] stderr:", stderr);
      reject(new Error(`FFmpeg failed (${code})`));
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
  preDownloadedFiles?: PreDownloadedFile[],
  onFileReady?: (outPath: string) => Promise<void>,
): Promise<{ channel: string; outputPaths: string[]; skippedCount: number }> {
  const channel = (formData.get("channel") as Channel) ?? "simple";
  const mode = (formData.get("mode") as string) ?? "simple";
  const count = Math.max(1, Number(formData.get("count") || 1));
  const uploadedFiles = (formData.getAll("files") as unknown as File[]).filter(Boolean);
  // Use pre-downloaded files when provided (bypasses Vercel body limit)
  const files: Array<File | PreDownloadedFile> = preDownloadedFiles ?? uploadedFiles;
  const { dir } = preResolvedDir
    ? { dir: preResolvedDir }
    : await getOutDirForCurrentUser();
  await fs.mkdir(dir, { recursive: true });

  const stamp = todayStamp();

  const singlesRaw = (formData.get("singles") as string) || "{}";
  const rangesRaw = (formData.get("advancedRanges") as string) || "{}";
  const userCountry = (formData.get("country") as string) || "";
  const useIphoneMeta = formData.get("iphoneMeta") === "1";
  let singles: Record<string, any> = {};
  let ranges:  Record<string, any> = {};
  try { singles = JSON.parse(singlesRaw); } catch { /* malformed — use defaults */ }
  try { ranges  = JSON.parse(rangesRaw);  } catch { /* malformed — use defaults */ }

  let totalCopies = files.length * count; // may be reduced after duration check
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

  // ── Server-side duration guard (50 s max) + color probe — run in parallel ──
  const MAX_DURATION_S = 50;
  const durResults = await Promise.all(
    fileEntries.map(async (entry) => ({
      entry,
      dur: await probeVideoDuration(entry.tmpIn, ffmpegBin),
      color: await probeColorInfo(entry.tmpIn, ffmpegBin),
    }))
  );
  type ValidEntry = typeof fileEntries[number] & { color: ColorInfo; duration: number };
  const validEntries: ValidEntry[] = [];
  for (const { entry, dur, color } of durResults) {
    if (dur <= 0) {
      const readable = await canFFmpegReadFile(entry.tmpIn, ffmpegBin);
      if (!readable) {
        console.warn(`[processVideos] rejected "${entry.fileName}": probe=0 and 1-frame test failed`);
        await onProgress?.(2, `⚠ "${entry.fileName}" est invalide ou corrompu — ignorée.`);
        if (entry.ownsTmpIn) await fs.unlink(entry.tmpIn).catch(() => {});
      } else {
        console.log(`[processVideos] accepted "${entry.fileName}": probe=0 but 1-frame test passed (likely HEVC)`);
        validEntries.push({ ...entry, color, duration: dur });
      }
    } else if (dur > MAX_DURATION_S) {
      await onProgress?.(2, `⚠ "${entry.fileName}" dépasse ${MAX_DURATION_S}s (${Math.round(dur)}s) — ignorée.`);
      if (entry.ownsTmpIn) await fs.unlink(entry.tmpIn).catch(() => {});
    } else {
      validEntries.push({ ...entry, color, duration: dur });
    }
  }
  if (validEntries.length === 0) {
    throw new Error(`Aucune vidéo valide : les fichiers sont corrompus ou dépassent la durée maximale de ${MAX_DURATION_S} secondes.`);
  }
  totalCopies = validEntries.length * count; // recount after filtering

  // ── Flatten all (file × copy) into one pool so every copy of every file
  // runs concurrently — total time ≈ slowest single copy, not SUM. ───────────
  type Task = { fileName: string; tmpIn: string; fileIndex: number; copyIndex: number; color: ColorInfo; duration: number };
  const allTasks: Task[] = validEntries.flatMap(({ fileName, tmpIn, color, duration }, idx) =>
    Array.from({ length: count }, (_, i) => ({
      fileName, tmpIn, fileIndex: idx + 1, copyIndex: i + 1, color, duration,
    }))
  );

  // ── CPU-aware concurrency ────────────────────────────────────────────────
  // IMPORTANT: os.cpus() on Railway returns the HOST machine's CPU count (e.g.
  // 32 or 64), NOT the container's allocated vCPU. Spawning that many FFmpeg
  // processes on 8 allocated vCPU causes each to run at 1/8 speed + OOM risk.
  // Fix: hard cap via env var MAX_CONCURRENT_ENCODES (default 8 for Railway
  // Hobby/Pro 8-vCPU; set to 24 if you upgrade to 24-vCPU replica).
  const ncpus = Math.max(1, os.cpus().length);
  const MAX_CONCURRENT = Math.min(
    ncpus,
    parseInt(process.env.MAX_CONCURRENT_ENCODES ?? "8", 10),
  );
  const CONCURRENCY = Math.min(allTasks.length, MAX_CONCURRENT);
  const threadsPerTask = 1;
  // Check for zscale availability (needed for HDR→SDR tone mapping)
  console.log(`[processVideos] ncpus=${ncpus} MAX_CONCURRENT=${MAX_CONCURRENT} CONCURRENCY=${CONCURRENCY} tasks=${allTasks.length}`);

  const taskErrors = await withConcurrency(allTasks, CONCURRENCY, async ({ fileName, tmpIn, fileIndex, copyIndex, color, duration: videoDuration }) => {
    const startPct = Math.min(99, Math.round((doneCopies / totalCopies) * 100));
    await onProgress?.(startPct, `Encodage ${doneCopies + 1}/${totalCopies}…`);

    // copyTag unique par copie : 8 chars base-36 aléatoires → ex. "x4k9mz2q"
    const copyTag = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
    let outName = videoOutName({
      channel,
      date: stamp,
      fileIndex,
      copyIndex,
      copyTag,
    });
      if (useIphoneMeta) outName = outName.replace(/\.mp4$/, ".mov");
      const outPath = path.join(dir, outName);

      const vfParts: string[] = [];
      const afParts: string[] = [];
      const extraArgs: string[] = [];
      const packs = String(formData.get("packs") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (mode === "simple") {
        /* ----------- MODE SIMPLE ----------- */

        if (packs.includes("visual")) {
          // eq — brightness ±5%, contrast ±10%, saturation ±10%, gamma ±7%
          const b  = clamp(Number((-0.05 + Math.random() * 0.10).toFixed(3)), LIMITS.brightness.min, LIMITS.brightness.max);
          const ct = clamp(Number((0.95 + Math.random() * 0.10).toFixed(3)),  LIMITS.contrast.min,   LIMITS.contrast.max);
          const st = clamp(Number((0.90 + Math.random() * 0.20).toFixed(3)),  LIMITS.saturation.min, LIMITS.saturation.max);
          const gm = clamp(Number((0.93 + Math.random() * 0.14).toFixed(3)),  0.1, 3.0);
          vfParts.push(`eq=brightness=${b}:contrast=${ct}:saturation=${st}:gamma=${gm}`);
          // noise moved to "pixel_magic" standalone toggle
        }

        // Pixel Magique — luma noise, imperceptible but changes every pixel hash
        if (packs.includes("pixel_magic")) {
          const ns = 2 + Math.floor(Math.random() * 3);  // 2–4 luma
          vfParts.push(`noise=c0s=${ns}:c0f=t`);
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
          // scale: bring the sub-region back to full original dimensions — bicubic: good quality/speed ratio
          vfParts.push(`crop=iw/${zf}:ih/${zf}:x=iw*${offx}:y=ih*${offy}`);
          vfParts.push(`scale=iw*${zf}:ih*${zf}:flags=bicubic`);

          // lenscorrection removed: most expensive filter (~50% of encode time), geometric
          // remapping recalculates every pixel with bilinear interpolation per frame.

          // Speed ±1–3% — invisible to the viewer, sufficient to shift the file fingerprint
          const side = Math.random() > 0.5 ? 1 : -1;
          const deviation = 0.01 + Math.random() * 0.02;  // 1–3%
          const sp = clamp(1.0 + side * deviation, LIMITS.speed.min, LIMITS.speed.max);
          vfParts.push(`setpts=${(1 / sp).toFixed(6)}*PTS`);
          afParts.push(`atempo=${sp.toFixed(4)}`);

          // tblend removed: expensive (sequential frame decode), negligible uniquification value
        }

        if (packs.includes("metadata_technical")) {
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

        if (packs.includes("audio")) {
          // Volume ±3–6 dB — shifts waveform amplitude, changes audio fingerprint
          const dbShift = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 3);
          afParts.push(`volume=${dbShift.toFixed(2)}dB`);
          // Random audio bitrate — changes audio compression artifact pattern
          const abitratePool = [96, 128, 160, 192, 256];
          extraArgs.push("-b:a", `${abitratePool[Math.floor(Math.random() * abitratePool.length)]}k`);
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
          // c=black (opaque) — black@0 would be alpha=0 which H.264 encodes as bright green
          vfParts.push(`rotate=${rad.toFixed(6)}:c=black:ow=rotw(iw):oh=roth(ih),scale=iw*1.04:ih*1.04,crop=in_w:in_h:(ow-in_w)/2:(oh-in_h)/2`);
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

        // ── CRF variation — only when video is already being re-encoded ──────────
        // Adding CRF without video filters would force a full encode and change visuals.
        if (vfParts.length > 0 && !packs.includes("metadata_technical")) {
          extraArgs.push("-crf", String(15 + Math.floor(Math.random() * 6)));
        }

        // When video will be re-encoded, ensure even dimensions and cap at 1920px.
        if (vfParts.length > 0 || packs.includes("metadata_technical")) {
          // ── HDR → SDR conversion when source is BT.2020 / HLG / PQ ──────────
          // Without this, BT.2020 pixel data encoded as H.264 (BT.709) produces
          // a visible yellow/warm tint because of color matrix mismatch.
          if (color.isHDR) {
            const hdr = hdrToSdrFilters();
            vfParts.unshift(...hdr);
          } else {
            vfParts.unshift("format=yuv420p");
          }
          // Ensure even dimensions after all filters (pad/rotation can produce odd dims).
          // No resolution cap — preserve original quality (1080p stays 1080p, 4K stays 4K).
          vfParts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos");
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

        // Cut start/end: trim seconds from the beginning and/or end of the video.
        // Values = seconds to TRIM (not absolute positions).
        // cut_start 0.05–0.10 → skip random 0.05–0.10s from beginning
        // cut_end 0.05–0.10 → remove random 0.05–0.10s from the end
        const cStart = get("cut_start", 0, 0, 0, Number.MAX_SAFE_INTEGER);
        const cEnd   = get("cut_end",   0, 0, 0, Number.MAX_SAFE_INTEGER);
        const trimStart = cStart.enabled && cStart.value > 0 ? cStart.value : 0;
        const trimEnd   = cEnd.enabled && cEnd.value > 0 ? cEnd.value : 0;
        if (trimStart > 0) {
          extraArgs.push("-ss", trimStart.toFixed(3));
        }
        if (trimEnd > 0 && videoDuration > 0) {
          // -to = absolute end position = duration - end_trim (adjusted for start trim)
          const endPos = Math.max(0.1, videoDuration - trimEnd - trimStart);
          extraArgs.push("-t", endPos.toFixed(3));
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

        // Add scale helpers whenever a full video encode will happen.
        // video filters → full encode via libx264 (vfParts non-empty)
        // video encoder extraArgs (CRF/bitrate/profile/GOP) → full encode via libx264
        // Audio-only / stream-copy extraArgs (-ar, -b:a, -ss, -to) do NOT trigger a full
        // video encode, so they don't need scale and go through the videoCopy tier instead.
        const willFullEncode = vfParts.length > 0 || extraArgs.some((a) =>
          ["-crf", "-b:v", "-profile:v", "-level:v", "-g"].includes(a)
        );
        if (willFullEncode) {
          // Same HDR→SDR logic as simple mode.
          if (color.isHDR) {
            const hdr = hdrToSdrFilters();
            vfParts.unshift(...hdr);
          } else {
            vfParts.unshift("format=yuv420p");
          }
          // No resolution cap — preserve original quality.
          vfParts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos");
        }
      }

      // Metadata only injected if explicitly requested
      // Without it: original metadata is preserved (only filename changes)
      const advMetaEnabled = mode === "advanced" && (
        ranges?.meta_creation_time?.enabled ||
        ranges?.meta_encoder?.enabled ||
        ranges?.meta_brand?.enabled ||
        ranges?.meta_uid?.enabled ||
        useIphoneMeta
      );
      const wantsMeta = mode === "simple"
        ? packs.includes("metadata") || useIphoneMeta
        : advMetaEnabled;
      const metaArgs = wantsMeta
        ? getVideoMetadataArgs({
            country: userCountry || undefined,
            iphoneMeta: useIphoneMeta,
            controls: mode === "advanced" ? {
              creation_time: ranges?.meta_creation_time ?? { enabled: false },
              encoder: ranges?.meta_encoder ?? { enabled: false },
              brand: ranges?.meta_brand ?? { enabled: false },
              uid: ranges?.meta_uid ?? { enabled: false },
            } : undefined,
          })
        : [];
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
      await onFileReady?.(outPath);
      await onProgress?.(
        Math.min(99, Math.round((doneCopies / totalCopies) * 100)),
        `Encodage ${doneCopies}/${totalCopies} terminé`,
      );
  });

  // ── Clean up temp input files ─────────────────────────────────────────────
  for (const { tmpIn, ownsTmpIn } of fileEntries) {
    if (ownsTmpIn) await fs.unlink(tmpIn).catch(() => {});
  }

  return { channel, outputPaths, skippedCount: taskErrors.length };
}
