// Shared video duplication logic — no "use server", importable from both server actions and API routes
import fs from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import zlib from "zlib";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";
import { pickLocation } from "@/lib/locations";
import { pickAppleShotProfile } from "@/lib/metadata/apple-devices";
import {
  prepareWatermark,
  prepareSimpleWatermark,
  resolveWatermarkOverlay,
  type PreparedWatermark,
} from "@/app/dashboard/videos/watermark";
import {
  buildOverlayFilterComplex,
  type VideoOverlay,
} from "@/app/dashboard/videos/overlays";
import {
  prepareAssets,
  resolveSnowOverlay,
  resolveFlashFilter,
  type PreparedAssets,
} from "@/app/dashboard/videos/assets";

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
  width: number;         // source pixel width (0 if unknown) — used by "Mouvement poussé"
  height: number;        // source pixel height (0 if unknown)
  fps: number;           // source frame rate (0 if unknown) — needed by zoompan
  audioRate: number;     // source audio sample rate in Hz (0 if none/unknown) — needed by pitch shift
  // Codec RÉELLEMENT présent dans la source ("hevc", "h264", …). Indispensable
  // dès qu'on copie le flux au lieu de le ré-encoder : sans lui on écrivait
  // `encoder=HEVC` sur une piste avc1 recopiée telle quelle.
  codecName: string;
};
async function probeColorInfo(input: string, binPath: string): Promise<ColorInfo> {
  const defaults: ColorInfo = { isHDR: false, colorSpace: "unknown", colorTransfer: "unknown", colorPrimaries: "unknown", pixFmt: "unknown", width: 0, height: 0, fps: 0, audioRate: 0, codecName: "unknown" };
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

      // Resolution + fps (used by "Mouvement poussé"). Parsed from the same
      // Video: line — the resolution is the first NxN token; the codec tag
      // (e.g. "0x31637661") can't match because it has <2 digits before the "x".
      const vline = stderr.match(/Stream #\d+:\d+.*?: Video:[^\n]*/);
      if (vline) {
        const cn = vline[0].match(/Video:\s*([\w.]+)/);
        if (cn) info.codecName = cn[1].toLowerCase();
        const dim = vline[0].match(/(\d{2,5})x(\d{2,5})/);
        if (dim) { info.width = parseInt(dim[1], 10); info.height = parseInt(dim[2], 10); }
        const f = vline[0].match(/(\d+(?:\.\d+)?)\s*fps/);
        if (f) info.fps = parseFloat(f[1]);

        // ── Rotation du conteneur : les dimensions DÉCODÉES ne sont pas celles
        // écrites sur la ligne « Video: » ────────────────────────────────────
        // Un téléphone filme à l'horizontale et note « tourne de 90° » dans un
        // coin du fichier. La ligne Video: annonce donc 3840x2160 alors que
        // ffmpeg décode 2160x3840 (portrait) en appliquant la rotation.
        //
        // Sans ce correctif, tout ce qui se cale sur ces dimensions les force à
        // l'envers : `scale=3840:2160` écrase une image portrait dans un cadre
        // paysage, et le zoompan des mouvements progressifs dessine sur une
        // toile paysage. Résultat : la copie sortait « en format grand » alors
        // que l'originale est verticale.
        //
        // La rotation apparaît en side data, quelques lignes SOUS la ligne
        // Video: — d'où la fenêtre de recherche à partir de sa position.
        const apres = stderr.slice(vline.index ?? 0, (vline.index ?? 0) + 600);
        const rot = apres.match(/rotation of\s*(-?\d+(?:\.\d+)?)\s*degrees/i);
        if (rot) {
          const deg = Math.abs(Math.round(parseFloat(rot[1]))) % 180;
          if (deg === 90 && info.width > 0 && info.height > 0) {
            const w = info.width;
            info.width = info.height;
            info.height = w;
          }
        }
      }
      // Audio sample rate (used by the pitch shift). e.g. "Audio: aac ..., 48000 Hz, ..."
      const aline = stderr.match(/Stream #\d+:\d+.*?: Audio:[^\n]*/);
      if (aline) {
        const ar = aline[0].match(/(\d{4,6})\s*Hz/);
        if (ar) info.audioRate = parseInt(ar[1], 10);
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
// ⚠️ Le nom du produit ne doit JAMAIS apparaître dans le nom de fichier : la
// plateforme voit ce nom à l'upload, et « DuupFlow » dans chaque fichier
// regroupait tous les clients sous une même signature évidente.
// Ce préfixe sert aussi à retrouver nos fichiers côté serveur — d'où un nom
// neutre conservé pour le filtrage interne (cf. filterFinals).
export function videoPrefix(channel: Channel) {
  return `${channelCaps(channel)}_`;
}
function videoOutName(opts: {
  channel: Channel;
  date: string;
  fileIndex: number;
  copyIndex: number;
  copyTag: string; // tag aléatoire unique par copie — ne contient pas le nom original
}) {
  const { channel, date, fileIndex, copyIndex, copyTag } = opts;
  return `${channelCaps(channel)}_${date}_vid${fileIndex}_c${String(
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
/* ---- Métadonnées iPhone réalistes ("Priorité d'algorithme") ----
   Appareil ET objectif viennent d'un profil unique et cohérent
   (lib/metadata/apple-devices), partagé avec la duplication d'images.
   L'ancienne paire de listes indépendantes (IPHONE_MODELS / IPHONE_LENS)
   pouvait accorder un modèle à l'objectif d'un AUTRE iPhone. */

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

  // encoder / encoded_by — uniquement hors mode iPhone (un iPhone n'écrit NI
  // l'un NI l'autre au niveau conteneur : vérifié sur un fichier .MOV réel).
  // On n'écrit qu'`encoded_by` : poser aussi `encoder` créait la contradiction
  // "encoded_by=Shotcut" + "encoder=Lavf62…" dans le même fichier.
  if (!opts?.iphoneMeta && (allOn || ctrl?.encoder?.enabled)) {
    const enc = ctrl?.encoder?.value || pickRandom(VIDEO_ENCODERS);
    args.push("-metadata", `encoded_by=${enc}`);
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

  // `uid` : VOLONTAIREMENT PLUS ÉCRIT.
  // Aucun appareil ni éditeur réel n'écrit ce tag. Sa simple PRÉSENCE (même avec
  // une valeur aléatoire) suffisait à regrouper tous les fichiers sortis d'ici :
  // il n'y a rien à randomiser quand c'est la clé elle-même qui trahit.
  // Le contrôle `meta_uid` du mode avancé est donc désormais sans effet.

  // Location — resolved once and reused below (so country/ city / GPS all match).
  const loc = opts?.country ? pickLocation(opts.country) : null;
  // ⚠️ Le tag `location` lisible ("Paris, France") n'existe PAS sur un fichier
  // iPhone : l'appareil n'écrit QUE com.apple.quicktime.location.ISO6709.
  // En mode iPhone on s'abstient donc ; ailleurs il reste plausible (certains
  // éditeurs l'écrivent).
  if (loc && !opts?.iphoneMeta) {
    args.push("-metadata", `location=${loc.city}, ${loc.country}`);
  }

  // iPhone metadata: overlay Apple QuickTime tags ON TOP of base metadata.
  // FFmpeg processes args in order — later -metadata flags override earlier ones.
  if (opts?.iphoneMeta) {
    // Appareil tiré au sort À CHAQUE COPIE — volontaire : les copies d'un même
    // lot sont diffusées séparément et doivent rester des fichiers INDÉPENDANTS.
    // Leur donner un appareil commun créerait justement le lien entre elles.
    // Ce qui doit être cohérent, c'est l'INTÉRIEUR d'un fichier (modèle ↔ objectif
    // ↔ focale ↔ date), pas les fichiers entre eux.
    const device = pickAppleShotProfile();
    const secsAgo = Math.floor(Math.random() * 86400 * 30);
    const iphoneDate = new Date(Date.now() - secsAgo * 1000);
    const iphoneIso = iphoneDate.toISOString().slice(0, 19) + "Z";
    const tzOffsetH = 1 + Math.floor(Math.random() * 3);
    const pad = (n: number) => String(n).padStart(2, "0");
    // ⚠️ La date LOCALE doit être l'heure UTC DÉCALÉE DU MÊME offset qu'on affiche.
    // Bug corrigé : on prenait getHours() (fuseau du SERVEUR) et on y collait un
    // offset TIRÉ AU HASARD → creation_time=17:24Z annoncé comme 19:24+0100, soit
    // une heure d'écart impossible. Un vrai iPhone est toujours exact
    // (19:48:30Z ↔ 16:48:30-0300). C'est une incohérence arithmétique triviale
    // à détecter automatiquement.
    const localMs = iphoneDate.getTime() + tzOffsetH * 3600_000;
    const l = new Date(localMs);
    const localDate =
      `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}` +
      `T${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}:${pad(l.getUTCSeconds())}` +
      `+${pad(tzOffsetH)}00`;
    // GPS comes from the city resolved earlier for this country.
    // No country picked → no GPS injected (matches the user's "Aucun pays" intent).
    const gpsIso6709 = loc?.iso6709;
    const locationAccuracy = (5 + Math.random() * 20).toFixed(6);
    const sigChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let sig = "";
    for (let i = 0; i < 36; i++) sig += sigChars[Math.floor(Math.random() * sigChars.length)];
    // Prevent ffmpeg from writing its own "Lavf..." encoder tag into the container
    args.push("-fflags", "+bitexact");
    // Override container brand to match iPhone (qt, not isom)
    args.push(
      "-metadata", `major_brand=qt  `,
      "-metadata", `minor_version=0`,
      "-metadata", `compatible_brands=qt  `,
      "-metadata", `creation_time=${iphoneIso}`,
    );
    // Location + GPS only if user specified a (resolvable) country.
    // Apple's QuickTime location atom holds the ISO6709 string itself —
    // not the country name, contrary to what older code did.
    if (loc) {
      args.push(
        "-metadata", `com.apple.quicktime.location.accuracy.horizontal=${locationAccuracy}`,
        "-metadata", `com.apple.quicktime.location.ISO6709=${gpsIso6709}`,
      );
    }
    args.push(
      // Atomes QuickTime — exactement ceux d'un .MOV iPhone réel, pas plus.
      // PAS de `encoder`/`encoded_by` ici : un iPhone n'en écrit aucun au niveau
      // conteneur (les poser recréait la contradiction avec la piste FFmpeg).
      "-metadata", `com.apple.quicktime.full-frame-rate-playback-intent=0`,
      "-metadata", `com.apple.quicktime.make=${device.make}`,
      "-metadata", `com.apple.quicktime.model=${device.model}`,
      "-metadata", `com.apple.quicktime.software=${device.software}`,
      "-metadata", `com.apple.quicktime.creationdate=${localDate}`,
      // `com.apple.photos.originating.signature` VOLONTAIREMENT ABSENT : ce tag
      // marque un export depuis l'app Photos, pas une capture caméra — il est
      // absent du .MOV iPhone de référence. Le poser sur un fichier qui prétend
      // sortir de l'appareil est une incohérence de plus.
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

// ── Global encode-slot limiter ──────────────────────────────────────────────
// MAX_CONCURRENT_ENCODES caps ffmpeg PER request. Without a cross-request cap, N
// simultaneous duplications each spawn up to that many → N× the load → the box
// thrashes (uploads + encodes crawl). This module-level semaphore caps the TOTAL
// concurrent ffmpeg across ALL jobs on this server process; extra encodes wait
// their turn instead of piling on.
const GLOBAL_MAX_ENCODES = Math.max(1, parseInt(process.env.MAX_CONCURRENT_ENCODES ?? "2", 10));
let _activeEncodes = 0;
const _encodeWaiters: Array<() => void> = [];
async function acquireEncodeSlot(): Promise<void> {
  if (_activeEncodes < GLOBAL_MAX_ENCODES) { _activeEncodes++; return; }
  await new Promise<void>((resolve) => _encodeWaiters.push(resolve)); // slot handed over on release
}
function releaseEncodeSlot(): void {
  const next = _encodeWaiters.shift();
  if (next) next();        // hand our slot straight to the next waiter (count unchanged)
  else _activeEncodes--;   // nobody waiting → free the slot
}

// Run up to `concurrency` async tasks simultaneously.
// Returns the list of errors from failed tasks (successful tasks still run).
async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  signal?: AbortSignal,
): Promise<Error[]> {
  const queue = [...items];
  const errors: Error[] = [];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      if (signal?.aborted) break; // Stop requested → stop pulling new copies
      try {
        await fn(queue.shift()!);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        // "stopped" = deliberate Stop (logged once at the job level) — stay quiet.
        if (e.message !== "stopped") console.error("[withConcurrency] task failed, continuing:", e.message);
        errors.push(e);
      }
    }
  });
  await Promise.all(workers);
  return errors;
}

// ── Effacement du vendor 'FFMP' laissé par le muxer MOV ─────────────────────
// Le muxer MOV de FFmpeg écrit littéralement "FFMP" comme identifiant de vendeur
// dans la piste vidéo, et AUCUNE option en ligne de commande ne permet de s'y
// opposer (vérifié sur ffmpeg 4.4 comme sur v62). Un appareil réel y met quatre
// octets nuls. Sur un fichier qui prétend sortir d'un iPhone, c'est la dernière
// trace qui le contredit — on la remplace donc après coup.
//
// Sûreté : on ne lit QUE le début du fichier (moov est en tête grâce à
// +faststart) et on ne remplace que dans les limites de l'atome moov — jamais
// dans les données vidéo. On n'ouvre jamais le fichier entier en mémoire :
// une 4K de plusieurs centaines de Mo ferait sauter le process.
export async function scrubMovVendorId(file: string): Promise<void> {
  const HEAD = 4 * 1024 * 1024; // moov tient largement là-dedans avec +faststart
  let fh: import("fs/promises").FileHandle | null = null;
  try {
    fh = await fs.open(file, "r+");
    const { size } = await fh.stat();
    const len = Math.min(HEAD, size);
    const head = Buffer.alloc(len);
    await fh.read(head, 0, len, 0);

    const moov = head.indexOf("moov");
    if (moov < 4) return;                       // pas de moov en tête → on s'abstient
    const boxSize = head.readUInt32BE(moov - 4); // taille de l'atome, tag inclus
    const moovEnd = Math.min(len, moov - 4 + (boxSize > 0 ? boxSize : len));

    for (let i = moov; i !== -1 && i < moovEnd; ) {
      const at = head.indexOf("FFMP", i);
      if (at === -1 || at >= moovEnd) break;
      await fh.write(Buffer.alloc(4), 0, 4, at); // 4 octets nuls, comme un vrai appareil
      i = at + 4;
    }
  } catch {
    /* best-effort : un échec ici ne doit jamais faire échouer la duplication */
  } finally {
    await fh?.close().catch(() => {});
  }
}

/**
 * Options de SORTIE qui exigent un vrai ré-encodage vidéo. Deux raisons de
 * figurer ici, et il ne faut pas les confondre :
 *
 *  · FFmpeg REFUSE l'option avec `-c:v copy` (-profile:v, -level:v, -crf,
 *    -b:v, -maxrate, -bufsize, -g) → « Error setting option profile ».
 *  · FFmpeg ACCEPTE l'option mais elle ne fait RIEN sur un flux copié
 *    (-r, -ss, -t) → le réglage utilisateur disparaît en silence.
 *
 * Ce second groupe est le plus dangereux : rien n'échoue, le fichier sort, et
 * le réglage demandé n'a jamais été appliqué. Mesuré sur un rush iPhone
 * (images-clés toutes les 0,93 s) : un « cut » de 0,20 s en flux copié
 * retirait 0,93 s d'image et laissait 0,73 s de désynchronisation son/image,
 * parce qu'un flux copié ne peut démarrer que sur une image-clé.
 *
 * ⚠️ Liste UNIQUE, partagée par ffmpegTier() et par le mode avancé : quand les
 * deux divergeaient, un réglage pouvait forcer l'encodage d'un côté et pas de
 * l'autre.
 */
const VIDEO_ENCODE_ARGS = [
  "-crf", "-b:v", "-maxrate", "-bufsize", "-profile:v", "-level:v", "-g",
  "-r",   // cadence : ignorée en silence par `-c:v copy`
  "-ss", "-t", // découpe : cale sur l'image-clé et désynchronise en `-c:v copy`
];
export function needsVideoEncodeArgs(extraArgs: string[]): boolean {
  return extraArgs.some((a) => VIDEO_ENCODE_ARGS.includes(a));
}

/**
 * Quel régime FFmpeg va tourner, à partir des filtres/args déjà construits.
 * Quatre paliers :
 *  1. Aucun filtre → stream copy intégral (quasi instantané, aucun ré-encodage)
 *  2. Filtres audio seuls → piste vidéo copiée, audio ré-encodé (pas de décodage vidéo)
 *  3. Args de sortie seuls (ex. -ar) → vidéo copiée, audio ré-encodé avec ces args
 *  4. Le moindre filtre vidéo → ré-encodage complet
 * La moindre incrustation (watermark visible, asset) impose toujours un
 * ré-encodage vidéo complet, tout comme `forceEncode` (cf. l'incohérence
 * codec ↔ identité iPhone côté appelant).
 *
 * Exporté (via `fullEncodeNeeded`) pour que l'appelant sache AVANT de lancer
 * FFmpeg s'il consomme réellement du CPU — un stream copy n'a rien à faire dans
 * la file d'attente des encodages (cf. acquireEncodeSlot).
 */
function ffmpegTier(
  vfParts: string[],
  afParts: string[],
  extraArgs: string[],
  overlays: VideoOverlay[] = [],
  forceEncodeFlag = false,
) {
  const forceEncode   = overlays.length > 0 || forceEncodeFlag;
  const useStreamCopy = !forceEncode && vfParts.length === 0 && afParts.length === 0 && extraArgs.length === 0;
  const audioOnly     = !forceEncode && vfParts.length === 0 && afParts.length > 0  && extraArgs.length === 0;
  const videoCopy = !forceEncode && vfParts.length === 0 && !useStreamCopy && !audioOnly && !needsVideoEncodeArgs(extraArgs);
  return { useStreamCopy, audioOnly, videoCopy };
}

/** true = ré-encodage vidéo complet (le seul palier réellement coûteux en CPU). */
function fullEncodeNeeded(
  vfParts: string[],
  afParts: string[],
  extraArgs: string[],
  overlays: VideoOverlay[] = [],
  forceEncodeFlag = false,
): boolean {
  const t = ffmpegTier(vfParts, afParts, extraArgs, overlays, forceEncodeFlag);
  return !t.useStreamCopy && !t.audioOnly && !t.videoCopy;
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
  // Threads to allocate to this FFmpeg process (computed by caller from the vCPU budget).
  threads = 1,
  // Source bitrate (kbps). When > 0, the encode is VBV-capped to ~this value so the
  // output keeps the source's resolution & quality but is never heavier than it.
  srcBitrateKbps = 0,
  // Fired by the Stop button → SIGKILL the running ffmpeg child.
  signal?: AbortSignal,
  // true = encoder en HEVC/hvc1 (mode « priorité d'algorithme » : identité iPhone).
  // false = H.264/avc1, le comportement par défaut.
  hevc = false,
  // Incrustations à empiler (watermark visible, assets visuels) — posées via
  // filter_complex (movie=…). Non vide → encodage complet forcé, et le -vf est
  // remplacé par le filtergraph construit par buildOverlayFilterComplex().
  overlays: VideoOverlay[] = [],
  // Codec de la SOURCE ("hevc", "h264", …) — sert à ne pas mentir sur le tag
  // `encoder` quand le flux est recopié au lieu d'être ré-encodé.
  srcCodec = "unknown",
  // Force un ré-encodage complet même sans filtre (cf. incohérence codec ↔ iPhone).
  forceEncodeFlag = false,
) {
  const ffmpegBin = binPath ?? await getFFmpegBin();

  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
  if (onTick) args.push("-stats");
  args.push("-i", input);
  // -max_muxing_queue_size must come AFTER -i (output option, not input option)
  args.push("-max_muxing_queue_size", "1024");

  const { useStreamCopy, audioOnly, videoCopy } = ffmpegTier(vfParts, afParts, extraArgs, overlays, forceEncodeFlag);

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
    if (overlays.length) {
      // ── Incrustations : filtregraph avec sources image (movie=) + overlay ──
      // Les filtres vidéo classiques passent sur [0:v], puis chaque couche est
      // composée sur la précédente. L'ordre du tableau = l'ordre d'empilement.
      const fc = buildOverlayFilterComplex(vfParts, overlays);
      args.push("-filter_complex", fc, "-map", "[vout]", "-map", "0:a:0?");
    } else {
      // -map 0:v:0 : first video stream only (avoids crash on MP4s with embedded cover art)
      // -map 0:a:0?: first audio stream if present (prevents crash on no-audio inputs)
      args.push("-map", "0:v:0", "-map", "0:a:0?");
      if (vfParts.length) args.push("-vf", vfParts.join(","));
    }
    if (afParts.length) args.push("-af", afParts.join(","));
    // Codec : H.264/avc1 par défaut. En mode « priorité d'algorithme » (identité
    // iPhone), on encode en HEVC/hvc1 — un iPhone moderne filme en HEVC, et
    // annoncer "iPhone" sur un flux avc1 était une incohérence de plus.
    // Le tag hvc1 (et non hev1) est celui qu'Apple écrit et que iOS sait lire.
    if (hevc) {
      args.push(
        "-c:v", "libx265",
        "-tag:v", "hvc1",
        "-preset", "veryfast",
        "-x265-params", "log-level=none", // pas de bannière x265 dans stderr
        "-threads", String(threads),
        "-crf", "20",                // x265 CRF 20 ≈ x264 CRF 18 en qualité perçue
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
      );
    } else {
      args.push(
        "-c:v", "libx264",
        "-preset", "veryfast",       // veryfast: ~2–3× better compression than ultrafast → smaller files at the same quality, still fast
        "-threads", String(threads),  // caller allocates threads from the real vCPU budget
        "-crf", "18",                // CRF 18: visually matches the source
        "-pix_fmt", "yuv420p",       // Safety net — format=yuv420p in filter graph already converts
        "-c:a", "aac",
        "-b:a", "192k",
      );
    }
    // ── VBV cap = the source's own bitrate ──────────────────────────────────
    // Without this, CRF 18 on noisy / "Pixel Magique" content explodes to
    // ~400 Mbit/s → 1 GB+ files, full disk, OOM crash. Capping -maxrate to the
    // source's measured bitrate keeps the SAME resolution and visual quality as
    // the original while guaranteeing the copy is never heavier than the source.
    if (srcBitrateKbps > 0) {
      const cap = Math.min(60000, Math.max(800, Math.round(srcBitrateKbps * 0.9)));
      args.push("-maxrate", `${cap}k`, "-bufsize", `${cap * 2}k`);
    }
    // extraArgs can override crf (e.g. per-pack values); it no longer re-adds -maxrate.
    if (extraArgs.length) args.push(...extraArgs);
  }

  // use_metadata_tags: allows custom metadata keys (com.apple.quicktime.* etc.)
  // to be written into the MOV/MP4 container instead of being silently ignored.
  args.push("-movflags", "+faststart+use_metadata_tags");
  if (metaArgs.length) args.push(...metaArgs);

  // ── Effacement des traces FFmpeg — TOUJOURS, quel que soit le pack ─────────
  // Sans ça le fichier se contredit lui-même : il annonce "iPhone 15 Pro" (ou
  // "Shotcut") dans les tags, mais la piste vidéo porte `encoder=Lavc libx264`
  // et `vendor_id=FFMP`, et le conteneur `encoder=Lavf62…`. Un lecteur de moov
  // voit donc "tourné à l'iPhone" + "ré-encodé par FFmpeg" dans le MÊME fichier :
  // c'est la signature la plus facile à détecter pour une plateforme.
  //
  // `+bitexact` doit être en position SORTIE (après -i) pour agir sur le muxer —
  // placé avant -i, il ne fait rien. Vérifié à l'ffprobe.
  args.push("-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact");
  // Le muxer réécrit malgré tout un `encoder` par piste : on le remplace par la
  // valeur qu'un appareil réel y met (le nom du codec, pas celui de l'encodeur).
  // Le nom du codec, comme un appareil réel l'écrit (un vrai .MOV iPhone porte
  // « HEVC » sur sa piste vidéo) — surtout pas « Lavc libx264 ».
  //
  // ⚠️ Le tag doit décrire le flux RÉELLEMENT écrit. Quand on ré-encode, c'est
  // le codec choisi ; quand on recopie le flux, c'est celui de la SOURCE. On
  // écrivait `encoder=HEVC` dans les deux cas : sur une source H.264 recopiée,
  // le fichier annonçait donc « HEVC » sur une piste `avc1` — exactement le
  // genre de contradiction interne qu'on cherche à éliminer. Codec inconnu →
  // on n'écrit rien plutôt que d'inventer.
  const streamIsCopied = useStreamCopy || audioOnly || videoCopy;
  const encoderTag = streamIsCopied
    ? (srcCodec === "hevc" ? "HEVC" : srcCodec === "h264" ? "H.264" : "")
    : (hevc ? "HEVC" : "H.264");
  if (encoderTag) args.push("-metadata:s:v:0", `encoder=${encoderTag}`);
  // `vendor_id=FFMP` est écrit par le muxer FFmpeg et dit littéralement qui a
  // encodé le fichier. Le vider le supprime (un iPhone y met [0][0][0][0]).
  args.push("-metadata:s:v:0", "vendor_id=");

  if (output.endsWith(".mov")) args.push("-f", "mov");
  args.push(output);

  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegBin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error("FFmpeg timed out after 15 minutes"));
    }, 15 * 60 * 1000);
    // Stop button → kill the running encode and reject so the job halts.
    const onAbort = () => {
      try { p.kill("SIGKILL"); } catch {}
      reject(new Error("stopped"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    };
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
      cleanup();
      reject(new Error(`FFmpeg introuvable ou inaccessible : ${err.message}`));
    });
    p.on("close", (code) => {
      cleanup();
      if (code === 0) return resolve();
      // Stopped by the user → stay quiet (no stderr dump); the job logs one line.
      if (signal?.aborted) return reject(new Error("stopped"));
      console.error("[FFmpeg] stderr:", stderr);
      reject(new Error(`FFmpeg failed (${code})`));
    });
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/* =========================================================
   Core processing — returns channel for redirect URL
   ========================================================= */

/**
 * Tremblement « caméra à l'épaule » — option indépendante des packs.
 *
 * Deux oscillations de fréquences différentes (une par axe), avec une phase
 * tirée au sort : le mouvement ne se répète donc pas à l'identique et ne tombe
 * jamais en rythme avec l'image. L'amplitude est volontairement faible (±0,3 à
 * 0,6 % du cadre) : on veut la sensation de main levée, pas un caméscope pris
 * dans un tremblement de terre.
 *
 * Le zoom de base (~1,015×) sert UNIQUEMENT à dégager la marge nécessaire au
 * débattement — sans lui, la fenêtre toucherait le bord et ferait apparaître du
 * noir. Coût en image : ~3 % de surface, contre ~30 % pour un pack de mouvement.
 */
function buildShakeFilter(): string[] {
  const amp = 0.003 + Math.random() * 0.003;          // ±0,3 à 0,6 %
  const marge = 2 * amp + 0.002;
  const Z = (1 / (1 - marge)).toFixed(5);
  const mid = (marge / 2).toFixed(5);
  const fx = (3.2 + Math.random() * 2.6).toFixed(3);  // fréquences distinctes par
  const fy = (2.7 + Math.random() * 2.6).toFixed(3);  // axe → trajectoire non répétitive
  const phx = (Math.random() * 6.283).toFixed(3);
  const phy = (Math.random() * 6.283).toFixed(3);
  const a = amp.toFixed(5);
  return [
    `crop=iw/${Z}:ih/${Z}:x='in_w*(${mid}+${a}*sin(2*PI*${fx}*t+${phx}))':y='in_h*(${mid}+${a}*sin(2*PI*${fy}*t+${phy}))'`,
    `scale=iw*${Z}:ih*${Z}:flags=bicubic`,
  ];
}

/* ── Chorégraphie de caméra du pack « Mouvement avancé » ────────────────────
 * Une suite de MOMENTS tirés au sort, au lieu d'un mouvement continu :
 *   · zoom progressif vers un point (centre, gauche, droite, haut, bas…)
 *   · retour BRUTAL au cadrage normal
 *   · déplacement progressif d'un côté à l'autre
 *   · « pop » : zoom instantané, puis retour progressif au normal
 *
 * Tout est compilé en TROIS expressions (zoom, x, y) données à zoompan, qui les
 * réévalue à chaque image. On ne peut pas s'en passer : `crop` fige sa taille de
 * sortie à l'initialisation, donc un zoom qui varie dans le temps ne peut pas
 * s'écrire autrement.
 *
 * Le repère : `cx`/`cy` positionnent la fenêtre visible en fraction du cadre
 * (0 = collé à gauche/en haut, 0,5 = centré, 1 = collé à droite/en bas). En
 * passant par (iw-iw/zoom), la fenêtre reste dans l'image PAR CONSTRUCTION —
 * aucun bord noir possible, quel que soit le tirage.
 */

/** Les quatre natures de moment qui composent la chorégraphie. */
type Moment = "zoomVers" | "retourBrutal" | "deplacement" | "pop";

/** Un point d'ancrage de l'animation. `step: true` = changement instantané. */
type Key = { t: number; z: number; cx: number; cy: number; step: boolean };

/**
 * Les deux intensités du pack. Même chorégraphie, mêmes natures de moment :
 * seules les AMPLITUDES et les vitesses changent.
 *
 * · fort  = le réglage d'origine, celui qui creuse le plus l'écart entre copies ;
 * · doux  = pour qui ne veut pas abîmer son image. Les zooms montent deux fois
 *           moins haut, les glissements sont plus courts, les mouvements plus
 *           lents — et le « retour brutal » devient un retour RAPIDE (0,2 s) au
 *           lieu d'une coupe sèche, ce qui enlève l'à-coup sans enlever la
 *           rupture.
 */
type Bareme = {
  zoom: [number, number];      // zoom progressif
  pop: [number, number];       // bond instantané
  zoomPan: [number, number];   // zoom nécessaire au glissement
  panLoin: [number, number];   // cible du glissement, côté opposé
  panPres: [number, number];
  duree: [number, number];     // durée d'un mouvement progressif
  retourSec: number;           // 0 = coupe sèche ; > 0 = retour rapide en N s
};

const BAREMES: Record<"doux" | "fort", Bareme> = {
  fort: { zoom: [1.08, 1.22], pop: [1.20, 1.32], zoomPan: [1.10, 1.18], panLoin: [0.62, 0.80], panPres: [0.20, 0.38], duree: [1.1, 2.4], retourSec: 0 },
  doux: { zoom: [1.03, 1.10], pop: [1.07, 1.15], zoomPan: [1.04, 1.09], panLoin: [0.56, 0.66], panPres: [0.34, 0.44], duree: [1.6, 3.0], retourSec: 0.2 },
};

/** Points d'intérêt visés par les zooms — jamais collés au bord. */
const CIBLES: [number, number][] = [
  [0.5, 0.5], [0.30, 0.5], [0.70, 0.5], [0.5, 0.32], [0.5, 0.68],
  [0.32, 0.34], [0.68, 0.34], [0.32, 0.66], [0.68, 0.66],
];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Tire la suite de moments pour UNE copie. Deux copies n'ont donc ni les mêmes
 * mouvements, ni le même ordre, ni les mêmes points visés.
 */
function tirerMoments(duree: number, b: Bareme): Key[] {
  const keys: Key[] = [{ t: 0, z: 1, cx: 0.5, cy: 0.5, step: true }];
  let t = 0;
  let dernier = { z: 1, cx: 0.5, cy: 0.5 };
  // Budget d'ancrages PROPORTIONNEL à la durée.
  //
  // Il était fixe (14) : une vidéo de 60 s recevait donc autant d'ancrages
  // qu'une de 8 s. Comme un moment consomme 1 à 3 ancrages et dure ~1,5 s, la
  // chorégraphie couvrait la dizaine de premières secondes puis tenait la
  // dernière valeur jusqu'au bout — les effets « s'arrêtaient en milieu de
  // vidéo » (constaté en test sur une vraie vidéo).
  //
  // Un moment ≈ 1,2 s en moyenne et coûte au plus 3 ancrages, d'où la formule.
  // Le plafond dur (240) borne la taille de l'expression ; il n'est jamais
  // atteint sous la limite de 120 s imposée aux fichiers acceptés.
  const MAX_MOMENTS = Math.min(240, Math.max(12, Math.round(duree / 1.2) * 3));

  // Le rythme voulu est une ALTERNANCE : un mouvement lent, puis une rupture,
  // puis un mouvement lent… Tiré totalement au hasard, on obtenait parfois une
  // copie qui se contente d'un seul zoom lent sur 8 s — trop sage pour l'usage.
  // On démarre donc toujours par un mouvement progressif (la vidéo ne commence
  // jamais en plein zoom), et on impose qu'une rupture soit suivie d'un
  // mouvement lent.
  let derniereEtaitRupture = true;

  while (t < duree - 0.35 && keys.length < MAX_MOMENTS) {
    const progressifs: Moment[] = ["zoomVers", "deplacement"];
    const ruptures: Moment[] = ["retourBrutal", "pop"];
    const type: Moment = derniereEtaitRupture
      ? pick(progressifs)
      : Math.random() < 0.65
        ? pick(ruptures)
        : pick(progressifs);
    derniereEtaitRupture = type === "retourBrutal" || type === "pop";

    if (type === "zoomVers") {
      // Zoom progressif vers un point précis.
      const [cx, cy] = pick(CIBLES);
      const d = Math.min(rnd(b.duree[0], b.duree[1]), duree - t);
      t += d;
      dernier = { z: rnd(b.zoom[0], b.zoom[1]), cx, cy };
      keys.push({ t, ...dernier, step: false });

    } else if (type === "retourBrutal") {
      // D'un coup, on revient au cadrage normal — et on s'y pose un instant.
      if (dernier.z <= 1.001) continue; // déjà au normal : rien à couper
      const pause = Math.min(rnd(0.4, 1.2), duree - t);
      dernier = { z: 1, cx: 0.5, cy: 0.5 };
      if (b.retourSec > 0) {
        // Retour rapide (mode doux) : la rupture reste lisible, l'à-coup part.
        t = Math.min(duree, t + b.retourSec);
        keys.push({ t, ...dernier, step: false });
      } else {
        keys.push({ t, ...dernier, step: true });
      }
      t = Math.min(duree, t + pause);
      keys.push({ t, ...dernier, step: false });

    } else if (type === "deplacement") {
      // Glissement progressif d'un côté à l'autre. Il faut du zoom pour avoir
      // de la marge : sans lui, la fenêtre occupe tout le cadre et ne peut pas
      // se déplacer.
      const z = Math.max(dernier.z, rnd(b.zoomPan[0], b.zoomPan[1]));
      const versLaDroite = dernier.cx < 0.5 ? true : dernier.cx > 0.5 ? false : Math.random() < 0.5;
      const cx = versLaDroite ? rnd(b.panLoin[0], b.panLoin[1]) : rnd(b.panPres[0], b.panPres[1]);
      const cy = Math.min(0.78, Math.max(0.22, dernier.cy + rnd(-0.12, 0.12)));
      const d = Math.min(rnd(b.duree[0] * 0.9, b.duree[1] * 0.92), duree - t);
      t += d;
      dernier = { z, cx, cy };
      keys.push({ t, ...dernier, step: false });

    } else {
      // « Pop » : zoom instantané, on tient très peu, puis retour progressif.
      const [cx, cy] = pick(CIBLES);
      const zPop = rnd(b.pop[0], b.pop[1]);
      keys.push({ t, z: zPop, cx, cy, step: true });
      const tenue = Math.min(rnd(0.12, 0.35), Math.max(0, duree - t));
      t += tenue;
      keys.push({ t, z: zPop, cx, cy, step: false });
      const retour = Math.min(rnd(0.7, 1.5), duree - t);
      t += retour;
      dernier = { z: 1, cx: 0.5, cy: 0.5 };
      keys.push({ t, ...dernier, step: false });
    }
  }

  // Retour au cadrage neutre avant la fin : c'est ce qui rend le raccord de
  // boucle invisible (le cycle repart exactement là où il s'est arrêté).
  if (dernier.z > 1.001 || Math.abs(dernier.cx - 0.5) > 0.001 || Math.abs(dernier.cy - 0.5) > 0.001) {
    const retour = Math.min(0.9, Math.max(0.25, duree - t));
    t = Math.min(duree, t + retour);
    dernier = { z: 1, cx: 0.5, cy: 0.5 };
    keys.push({ t, ...dernier, step: false });
  }
  if (keys[keys.length - 1].t < duree) {
    keys.push({ t: duree, z: 1, cx: 0.5, cy: 0.5, step: false });
  }
  return keys;
}

/** Compile une suite de valeurs en expression FFmpeg imbriquée (sur `on`). */
function compiler(keys: Key[], valeur: (k: Key) => number, fps: number, variable: string): string {
  const f = (t: number) => Math.max(0, Math.round(t * fps));
  // On part de la dernière valeur, puis on empile les `if` à rebours.
  let expr = valeur(keys[keys.length - 1]).toFixed(5);
  for (let i = keys.length - 1; i >= 1; i--) {
    const k0 = keys[i - 1], k1 = keys[i];
    const f0 = f(k0.t), f1 = f(k1.t);
    const v0 = valeur(k0), v1 = valeur(k1);
    let seg: string;
    if (k1.step || f1 <= f0) {
      seg = v0.toFixed(5);                       // palier : on tient la valeur
    } else if (Math.abs(v1 - v0) < 1e-6) {
      seg = v0.toFixed(5);                       // rien ne change
    } else {
      seg = `${v0.toFixed(5)}+${(v1 - v0).toFixed(5)}*(${variable}-${f0})/${f1 - f0}`;
    }
    expr = `if(lt(${variable},${f1}),${seg},${expr})`;
  }
  return expr;
}

/**
 * Filtres de la chorégraphie, prêts à être ajoutés au -vf.
 * Renvoie [] si la durée ou les dimensions sont inconnues (rien plutôt qu'un
 * mouvement calculé sur des valeurs fausses).
 */
export function buildChoreography(
  durationSec: number,
  width: number,
  height: number,
  fps: number,
  intensite: "doux" | "fort" = "fort",
): string[] {
  if (!(durationSec > 0) || !(width > 1) || !(height > 1)) return [];
  const f = fps > 0 ? fps : 30;

  // ── Pourquoi une BOUCLE et pas une chorégraphie unique ────────────────────
  // Les expressions sont des `if` imbriqués : leur profondeur suit la durée de
  // la vidéo. Au-delà d'environ deux minutes, l'évaluateur de FFmpeg refuse la
  // formule (« Missing ')' or too many args ») — et la limite exacte n'est pas
  // documentée, donc s'en approcher est un pari.
  //
  // On compose donc un CYCLE d'au plus 24 s, rejoué en boucle avec `mod`. La
  // taille de la formule ne dépend plus de la durée du fichier, et une vidéo de
  // 8 s se comporte exactement comme avant (elle tient dans un seul cycle).
  // Le cycle commence et se termine au cadrage neutre : le raccord ne se voit
  // pas.
  // Durée du cycle tirée au sort : deux copies n'ont donc même pas la même
  // période de répétition, en plus de mouvements différents.
  const cycle = Math.min(durationSec, 18 + Math.random() * 8);
  const framesCycle = Math.max(1, Math.round(cycle * f));
  // `mod` n'a aucun effet tant que la vidéo tient dans un cycle.
  const variable = durationSec > cycle + 0.05 ? `mod(on,${framesCycle})` : "on";

  let keys = tirerMoments(cycle, BAREMES[intensite]);
  // On ne fusionne QUE les ancrages strictement identiques (même image ET mêmes
  // valeurs). Fusionner sur la seule image serait faux : une rupture tombe
  // volontairement sur la même image que la fin du mouvement progressif qui la
  // précède — l'un dit « on arrive à 1,15 », l'autre « et on retombe à 1 tout
  // de suite ». Supprimer le premier effaçait le mouvement progressif, et la
  // copie restait figée.
  keys = keys.filter((k, i) => {
    const n = keys[i + 1];
    if (!n) return true;
    return !(Math.round(k.t * f) === Math.round(n.t * f) && k.z === n.z && k.cx === n.cx && k.cy === n.cy);
  });
  if (keys.length < 2) return [];

  const z = compiler(keys, (k) => k.z, f, variable);
  const cx = compiler(keys, (k) => k.cx, f, variable);
  const cy = compiler(keys, (k) => k.cy, f, variable);

  return [
    `zoompan=z='max(1,${z})':x='(iw-iw/zoom)*(${cx})':y='(ih-ih/zoom)*(${cy})':d=1:s=${width}x${height}:fps=${f}`,
  ];
}

/** Forces (0–100) des quatre mouvements de caméra. 0 = mouvement désactivé. */
export type CameraForces = {
  prog_rotate: number;   // inclinaison progressive
  prog_zoom: number;     // zoom progressif (avant ou arrière)
  dyn_crop: number;      // recadrage qui dérive (pan)
  shake: number;         // tremblement type caméra à l'épaule
};

/**
 * Construit les filtres de MOUVEMENTS DE CAMÉRA qui évoluent dans le temps.
 *
 * Extrait du mode avancé (où ces mouvements sont pilotés par quatre curseurs)
 * pour être réutilisé par le pack « Mouvement avancé » du mode simple, qui tire
 * les mêmes forces au sort. Un seul moteur pour les deux : une correction ici
 * profite aux deux modes, et le mode simple hérite de bornes déjà éprouvées.
 *
 * Chaque force est bornée pour rester propre au maximum : le sujet ne sort
 * jamais du cadre et aucun coin noir n'apparaît. Renvoie [] si tout est à 0.
 */
export function buildCameraMoves(f: CameraForces, durationSec: number, color: ColorInfo): string[] {
  const DUR = durationSec > 0 ? durationSec : 0;
  const geoParts: string[] = [];

  if (DUR > 0) {
    // 1) Rotation progressive — slow lean 0 → ±θmax. A CONSTANT pre-scale hides
    //    the black corners; a time-varying angle cannot use rotw/roth (that would
    //    change the output size per frame and break the encoder).
    const fRot = f.prog_rotate;
    if (fRot > 0) {
      // Sweep -θmax → +θmax across the clip → tilt visible from the FIRST frame
      // (not a slow ramp from 0). Max |angle| = θmax ≤ 3° → subject never distorted.
      const theta = ((1.0 + 2.0 * (fRot / 100)) * Math.PI) / 180; // 1.0° → 3.0° each side
      const dir = Math.random() < 0.5 ? "-" : "";
      const P = Math.min(1.14, 1 + 2.0 * Math.sin(theta)).toFixed(5); // covers corners @ ≤3°, any aspect
      geoParts.push(`scale=iw*${P}:ih*${P}:flags=bicubic`);
      geoParts.push(`rotate=a='${dir}${theta.toFixed(6)}*(2*(t/${DUR.toFixed(3)})-1)':ow=iw:oh=ih:c=black`);
      geoParts.push(`crop=iw/${P}:ih/${P}:(iw-iw/${P})/2:(ih-ih/${P})/2`);
    }

    // 2) Zoom progressif — needs source W/H (+ fps) → zoompan. Skipped if the
    //    probe couldn't read them. z stays ≥ 1 by construction (no clamp needed).
    const fZoom = f.prog_zoom;
    if (fZoom > 0 && color.width > 1 && color.height > 1) {
      const zmax = 1.06 + 0.14 * (fZoom / 100); // 1.06 → 1.20
      const fps = color.fps > 0 ? color.fps : 30;
      const totf = Math.max(1, Math.round(DUR * fps) + 2); // +2 → on/totf < 1 always
      const dz = (zmax - 1).toFixed(5);
      const z = Math.random() < 0.5
        ? `1+${dz}*on/${totf}`                    // zoom in
        : `${zmax.toFixed(5)}-${dz}*on/${totf}`;  // zoom out (opens up)
      geoParts.push(
        `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${color.width}x${color.height}:fps=${fps}`
      );
    }

    // 3) Recadrage dynamique (pan) + Shake — one crop+scale, x/y animated.
    //    In-bounds BY CONSTRUCTION: a base zoom gives room, and the shake
    //    amplitude is capped to whatever room the pan leaves → no clamp and
    //    no commas in the expressions (avoids filtergraph-escaping bugs).
    const fPan = f.dyn_crop;
    const fShake = f.shake;
    if (fPan > 0 || fShake > 0) {
      const np = fPan / 100;
      const ns = fShake / 100;
      // Motion as fractions of the frame. The pan travel is much larger than
      // before so the drift is clearly visible; capped so the base zoom never
      // exceeds ~1.20 (subject stays framed). Shake reserves its swing first,
      // so both stay visible when combined.
      const shakeAmp0 = fShake > 0 ? 0.001 + 0.003 * ns : 0;        // ±0.1% → ±0.4% (gentler default)
      const CAP = 0.166;                                            // ⇒ base zoom ≤ ~1.20
      const shakeRoom = 2 * shakeAmp0;
      const panTravel = fPan > 0 ? Math.min(0.05 + 0.13 * np, Math.max(0, CAP - shakeRoom - 0.01)) : 0; // up to ~15%
      const avail = Math.min(panTravel + shakeRoom + 0.01, CAP);    // movement room (fraction of dim)
      const Z = 1 / (1 - avail);
      const Zf = Z.toFixed(5);
      const trav = panTravel;                                       // pan travel band
      const mid = avail / 2;
      const amp = Math.min(shakeAmp0, Math.max(0, (avail - trav) / 2)); // shake that still fits
      const tnorm = `(t/${DUR.toFixed(3)})`;
      const half = (trav / 2).toFixed(5);
      const dirX = Math.random() < 0.5 ? "-" : "+";
      const dirY = Math.random() < 0.5 ? "-" : "+";
      const fx = (3 + Math.random() * 3).toFixed(3);
      const fy = (3 + Math.random() * 3).toFixed(3);
      const phx = (Math.random() * 6.283).toFixed(3);
      const phy = (Math.random() * 6.283).toFixed(3);
      const shX = amp > 0 ? `+${amp.toFixed(5)}*sin(2*PI*${fx}*t+${phx})` : "";
      const shY = amp > 0 ? `+${amp.toFixed(5)}*sin(2*PI*${fy}*t+${phy})` : "";
      const xExpr = `in_w*(${mid.toFixed(5)}${dirX}${half}*(2*${tnorm}-1)${shX})`;
      const yExpr = `in_h*(${mid.toFixed(5)}${dirY}${half}*(2*${tnorm}-1)${shY})`;
      geoParts.push(`crop=iw/${Zf}:ih/${Zf}:x='${xExpr}':y='${yExpr}'`);
      geoParts.push(`scale=iw*${Zf}:ih*${Zf}:flags=bicubic`);
    }
  }
  return geoParts;
}

export type PreDownloadedFile = { name: string; tmpPath: string };

export async function processVideos(
  formData: FormData,
  onProgress?: (pct: number, msg: string) => Promise<void>,
  preResolvedDir?: string,
  preDownloadedFiles?: PreDownloadedFile[],
  onFileReady?: (outPath: string) => Promise<void>,
  signal?: AbortSignal,
): Promise<{ channel: string; outputPaths: string[]; skippedCount: number; rejectedFiles: string[]; stopped: boolean }> {
  const channel = (formData.get("channel") as Channel) ?? "simple";
  const mode = (formData.get("mode") as string) ?? "simple";
  const count = Math.max(1, Number(formData.get("count") || 1));
  // Per-plan output resolution cap (short edge, px). 0 = no cap. Set by the
  // duplicate-video route from the plan (Starter → 1080). A source whose short
  // edge exceeds this is downscaled to it (aspect kept, even dims); anything
  // already ≤ cap is untouched (720p stays 720p).
  const maxShortEdge = Math.max(0, Number(formData.get("maxShortEdge") || 0));
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

  // Watermark visible — rasterise forme(s)/logo une fois par job.
  //  · mode avancé : config détaillée (watermarkConfig)
  //  · mode simple : toggle `simpleWatermark` → TOUT aléatoire par copie
  // resolveWatermarkOverlay() choisit ensuite l'overlay PAR COPIE.
  const wmPrep: PreparedWatermark | null =
    mode === "advanced" ? await prepareWatermark(formData, dir)
    : mode === "simple" ? await prepareSimpleWatermark(formData, dir)
    : null;

  let totalCopies = files.length * count; // may be reduced after duration check
  let doneCopies = 0;
  const outputPaths: string[] = [];
  // temp → final renames, applied in one pass once the whole job is done so the
  // page's "Videos générées" list never shows partial results mid-encode.
  const renames: { temp: string; final: string }[] = [];

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

  // ── Server-side duration guard (120 s / 2 min max) + color probe — run in parallel ──
  const MAX_DURATION_S = 120;
  const durResults = await Promise.all(
    fileEntries.map(async (entry) => ({
      entry,
      dur: await probeVideoDuration(entry.tmpIn, ffmpegBin),
      color: await probeColorInfo(entry.tmpIn, ffmpegBin),
      sizeBytes: await fs.stat(entry.tmpIn).then((s) => s.size).catch(() => 0),
    }))
  );
  type ValidEntry = typeof fileEntries[number] & { color: ColorInfo; duration: number; bitrateKbps: number };
  const validEntries: ValidEntry[] = [];
  // Track filenames that get dropped at this stage so we can show the user
  // exactly WHICH videos failed (and let the remaining ones go through).
  // Without this the error message was a generic "Aucune vidéo valide"
  // even when only one file out of many was actually broken.
  const rejectedFiles: string[] = [];
  const reasonFor = (fileName: string, reason: "corrupted" | "too_long", info?: string) =>
    `"${fileName || "fichier sans nom"}"${reason === "corrupted" ? " (illisible)" : ` (${info})`}`;

  for (const { entry, dur, color, sizeBytes } of durResults) {
    const displayName = entry.fileName || path.basename(entry.tmpIn);
    // Source bitrate (kbps) = real file size ÷ duration. This is what we cap the
    // encode to, so a copy is never heavier than the original (0 = unknown → no cap).
    const srcKbps = dur > 0 && sizeBytes > 0 ? Math.round((sizeBytes * 8) / dur / 1000) : 0;
    if (dur <= 0) {
      const readable = await canFFmpegReadFile(entry.tmpIn, ffmpegBin);
      if (!readable) {
        console.warn(`[processVideos] rejected "${displayName}": probe=0 and 1-frame test failed`);
        await onProgress?.(2, `⚠ "${displayName}" est invalide ou corrompu — ignorée.`);
        rejectedFiles.push(reasonFor(displayName, "corrupted"));
        if (entry.ownsTmpIn) await fs.unlink(entry.tmpIn).catch(() => {});
      } else {
        console.log(`[processVideos] accepted "${displayName}": probe=0 but 1-frame test passed (likely HEVC)`);
        validEntries.push({ ...entry, color, duration: dur, bitrateKbps: srcKbps });
      }
    } else if (dur > MAX_DURATION_S) {
      await onProgress?.(2, `⚠ "${displayName}" dépasse ${MAX_DURATION_S}s (${Math.round(dur)}s) — ignorée.`);
      rejectedFiles.push(reasonFor(displayName, "too_long", `${Math.round(dur)}s > ${MAX_DURATION_S}s`));
      if (entry.ownsTmpIn) await fs.unlink(entry.tmpIn).catch(() => {});
    } else {
      validEntries.push({ ...entry, color, duration: dur, bitrateKbps: srcKbps });
    }
  }
  if (validEntries.length === 0) {
    // Surface the filename(s) so the user knows exactly which video(s) to fix.
    const list = rejectedFiles.length > 0 ? ` Fichier(s) rejeté(s) : ${rejectedFiles.join(", ")}.` : "";
    throw new Error(`Aucune vidéo valide à traiter — les fichiers sont corrompus ou dépassent ${MAX_DURATION_S}s.${list}`);
  }
  totalCopies = validEntries.length * count; // recount after filtering

  // Assets visuels (mode avancé) — flocons / flashs. La texture des flocons est
  // rasterisée UNE fois par job, aux dimensions de la première vidéo valide :
  // FFmpeg la redimensionne ensuite pour chaque copie, donc une source d'un
  // autre format ne casse rien. Préparé ICI et pas avec le watermark : il faut
  // les dimensions réelles, qui ne sont connues qu'après la sonde.
  const assetsPrep: PreparedAssets | null =
    mode === "advanced"
      ? await prepareAssets(formData, dir, validEntries[0].color.width, validEntries[0].color.height)
      : null;

  // ── Flatten all (file × copy) into one pool so every copy of every file
  // runs concurrently — total time ≈ slowest single copy, not SUM. ───────────
  type Task = { fileName: string; tmpIn: string; fileIndex: number; copyIndex: number; color: ColorInfo; duration: number; bitrateKbps: number };
  const allTasks: Task[] = validEntries.flatMap(({ fileName, tmpIn, color, duration, bitrateKbps }, idx) =>
    Array.from({ length: count }, (_, i) => ({
      fileName, tmpIn, fileIndex: idx + 1, copyIndex: i + 1, color, duration, bitrateKbps,
    }))
  );

  // ── CPU-aware concurrency ────────────────────────────────────────────────
  // os.cpus() on Railway returns the HOST core count (e.g. 32/48), NOT the
  // container's allocated vCPU — never size from it; use FFMPEG_VCPU. Per-job
  // concurrency is bounded by the GLOBAL cap, and the global semaphore above
  // bounds total ffmpeg across ALL jobs, so threads are sized from that cap →
  // total threads stay within the real vCPU even when several jobs run at once.
  const ncpus = Math.max(1, os.cpus().length);
  const VCPU = Math.max(1, parseInt(process.env.FFMPEG_VCPU ?? "8", 10));
  const CONCURRENCY = Math.min(allTasks.length, GLOBAL_MAX_ENCODES);
  const threadsPerTask = Math.max(1, Math.min(4, Math.floor(VCPU / GLOBAL_MAX_ENCODES)));
  console.log(`[processVideos] ncpus=${ncpus} GLOBAL_MAX=${GLOBAL_MAX_ENCODES} CONCURRENCY=${CONCURRENCY} threadsPerTask=${threadsPerTask} tasks=${allTasks.length}`);

  const taskErrors = await withConcurrency(allTasks, CONCURRENCY, async ({ fileName, tmpIn, fileIndex, copyIndex, color, duration: videoDuration, bitrateKbps }) => {
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
      // Encode into a hidden temp name; renamed to the final name only once the
      // WHOLE job finishes (filterFinals excludes the __progress_ prefix).
      const tempOutPath = path.join(dir, `__progress_${outName}`);

      const vfParts: string[] = [];
      const afParts: string[] = [];
      const extraArgs: string[] = [];
      // Overlay watermark de cette copie (simple OU avancé) — résolu ici pour que
      // les deux branches de mode + runFFmpegSafe le voient. null si désactivé.
      const wmOverlay = wmPrep ? resolveWatermarkOverlay(wmPrep, color.width) : undefined;
      // Assets visuels de cette copie. Vitesse de chute, oscillation, rythme des
      // flashs : tout est retiré au sort à chaque copie, donc deux copies n'ont
      // jamais exactement le même rendu.
      const snowOverlay = assetsPrep ? resolveSnowOverlay(assetsPrep, color.width, color.height) : null;
      const flashFilter = assetsPrep ? resolveFlashFilter(assetsPrep) : null;
      // Ordre d'empilement : les flocons d'abord, le watermark par-dessus (il
      // doit rester lisible, c'est une signature).
      const overlays: VideoOverlay[] = [];
      if (snowOverlay) overlays.push(snowOverlay);
      if (wmOverlay) overlays.push(wmOverlay);
      const packs = String(formData.get("packs") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (mode === "simple") {
        /* ----------- MODE SIMPLE ----------- */

        if (packs.includes("visual")) {
          // eq — brightness ±3%, contrast ±5%, saturation ±5%, gamma ±3%
          const b  = clamp(Number((-0.03 + Math.random() * 0.06).toFixed(3)), LIMITS.brightness.min, LIMITS.brightness.max);
          const ct = clamp(Number((0.975 + Math.random() * 0.05).toFixed(3)), LIMITS.contrast.min,   LIMITS.contrast.max);
          const st = clamp(Number((0.975 + Math.random() * 0.05).toFixed(3)), LIMITS.saturation.min, LIMITS.saturation.max);
          const gm = clamp(Number((0.97 + Math.random() * 0.06).toFixed(3)),  0.1, 3.0);
          vfParts.push(`eq=brightness=${b}:contrast=${ct}:saturation=${st}:gamma=${gm}`);
          // hue ±3°
          const hue = clamp(Math.round(-3 + Math.random() * 6), -180, 180);
          if (hue !== 0) vfParts.push(`hue=h=${hue}`);
          // unsharp très doux
          vfParts.push("unsharp=3:3:0.3:3:3:0.1");
        }

        // Pixel Magique — luma noise, imperceptible but changes every pixel hash
        if (packs.includes("pixel_magic")) {
          const ns = 2 + Math.floor(Math.random() * 3);  // 2–4 luma
          vfParts.push(`noise=c0s=${ns}:c0f=t`);
        }

        // ── Mouvement — un seul pack, deux intensités ───────────────────────────
        // « Doux » et « Fort » étaient deux packs séparés (Mouvement / Mouvement
        // poussé). Même mécanique dans les deux cas : on recadre dans l'image,
        // on ré-agrandit, et on décale la vitesse. Seule l'échelle change — d'où
        // la fusion en un pack à pastille.
        //
        // `motion_strong` reste reconnu : d'anciens réglages mémorisés ou des
        // modèles enregistrés peuvent encore le contenir, et ils doivent
        // continuer à donner le rendu « fort ».
        if (packs.includes("motion") || packs.includes("motion_strong")) {
          const fort = singles?.motionMode === "fort" || packs.includes("motion_strong");

          // ── Recadrage-zoom : on prélève une sous-région à un endroit tiré au
          // sort, puis on la ramène à la taille d'origine. C'est ce déplacement
          // du cadre qui rend deux copies non superposables.
          const zoom = fort
            ? clamp(1.22 + Math.random() * 0.14, LIMITS.zoom.min, LIMITS.zoom.max)  // 1,22–1,36×
            : clamp(1.10 + Math.random() * 0.08, LIMITS.zoom.min, LIMITS.zoom.max); // 1,10–1,18×
          const zf = zoom.toFixed(6);
          const maxOff = 1 - 1 / zoom;
          const offx = (Math.random() * maxOff).toFixed(6);
          const offy = (Math.random() * maxOff).toFixed(6);
          vfParts.push(`crop=iw/${zf}:ih/${zf}:x=iw*${offx}:y=ih*${offy}`);
          vfParts.push(`scale=iw*${zf}:ih*${zf}:flags=bicubic`);

          // Vitesse : ±1–3 % en doux (inaudible), ±4–8 % en fort. Au-delà, la
          // voix commence à s'entendre. L'audio suit le même facteur.
          const side = Math.random() > 0.5 ? 1 : -1;
          const deviation = fort ? 0.04 + Math.random() * 0.04 : 0.01 + Math.random() * 0.02;
          const sp = clamp(1.0 + side * deviation, LIMITS.speed.min, LIMITS.speed.max);
          vfParts.push(`setpts=${(1 / sp).toFixed(6)}*PTS`);
          afParts.push(`atempo=${sp.toFixed(4)}`);

          // Inclinaison fixe : réservée au mode fort. Elle déplace chaque pixel
          // sans donner l'impression d'une vidéo penchée.
          if (fort) {
            const deg = (0.6 + Math.random() * 0.9) * (Math.random() < 0.5 ? -1 : 1); // ±0,6–1,5°
            const rad = (deg * Math.PI) / 180;
            const P = Math.min(1.10, 1 + 2 * Math.abs(Math.sin(rad))).toFixed(5);
            vfParts.push(`scale=iw*${P}:ih*${P}:flags=bicubic`);
            vfParts.push(`rotate=a=${rad.toFixed(6)}:ow=iw:oh=ih:c=black`);
            vfParts.push(`crop=iw/${P}:ih/${P}:(iw-iw/${P})/2:(ih-ih/${P})/2`);
          }
        }

        // ── Mouvement avancé — la caméra BOUGE pendant la lecture ────────────────
        // Les deux autres packs déplacent l'image une fois pour toutes : le cadrage
        // est différent, mais il reste figé du début à la fin. Ici les mouvements
        // évoluent IMAGE PAR IMAGE (inclinaison qui dérive, zoom qui avance,
        // recadrage qui glisse, tremblement) — donc deux copies ne se ressemblent
        // à AUCUN instant, et pas seulement sur la première image.
        //
        // Même moteur que les 4 curseurs du mode avancé (buildCameraMoves), mais
        // les forces sont tirées au sort À CHAQUE COPIE. On garantit qu'au moins
        // deux mouvements sont actifs, sinon un tirage malchanceux donnerait une
        // copie presque immobile.
        if (packs.includes("motion_dynamic")) {
          // Une SUITE DE MOMENTS tirés au sort : zoom progressif vers un point,
          // retour brutal, glissement d'un côté à l'autre, « pop » de zoom suivi
          // d'un retour progressif. Rien de continu : c'est l'enchaînement de
          // ruptures et de mouvements lents qui fait qu'aucun instant de deux
          // copies ne se ressemble.
          //
          // Le tremblement N'EST PLUS ici : il est devenu une option à part
          // (cochable indépendamment des packs).
          // Intensité choisie sur la carte du pack (« Doux » / « Fort »).
          const intensite = singles?.motionDynamicMode === "doux" ? "doux" : "fort";
          const choreo = buildChoreography(videoDuration, color.width, color.height, color.fps, intensite);
          if (choreo.length) vfParts.unshift(...choreo);
        }

        if (packs.includes("metadata_technical")) {
          // Only apply encoding params when video is already being re-encoded
          // (visual or motion packs active). Otherwise just vary GOP/fps as
          // metadata-level changes — avoids full re-encode that alters visuals.
          if (vfParts.length > 0) {
            // CRF controls quality; lower = higher quality. 14–18 = visually lossless range.
            const crf = 14 + Math.floor(Math.random() * 5); // 14–18 (high quality preservation)
            extraArgs.push("-crf", String(crf));
            // Bitrate is now capped centrally to the SOURCE's own bitrate in
            // runFFmpegSafe — so a copy is never heavier than the original. This
            // replaces the old hard-coded 20–45 Mbps floor that bloated every file.
            // ⚠️ Profil/niveau dépendent du CODEC. "high" et "5.x" sont des
            // valeurs H.264 : passées à x265 (mode iPhone → HEVC) elles font
            // échouer l'encodeur (« Invalid or incompatible profile set: high »).
            if (!useIphoneMeta) {
              const profiles = ["high"]; // "high" profile preserves quality best on 1080p+
              const levels = ["5.0", "5.1", "5.2"];
              extraArgs.push("-profile:v", profiles[Math.floor(Math.random() * profiles.length)]);
              extraArgs.push("-level:v", levels[Math.floor(Math.random() * levels.length)]);
            } else {
              // HEVC 8 bits → "main" est le profil qu'un iPhone utilise.
              extraArgs.push("-profile:v", "main");
            }
          }
          const gop = clamp(30 + Math.floor(Math.random() * 471), LIMITS.gop.min, LIMITS.gop.max);
          extraArgs.push("-g", String(gop));
          // ── Cadence : variante PLAUSIBLE de celle de la source ───────────────
          // L'ancien pool tirait au hasard dans [23.976…60] sans regarder la
          // source : une vidéo 30 fps ressortait en 50 fps. Or 50 fps est une
          // cadence PAL que l'iPhone ne produit pas (il filme en 30 ou 60), et
          // passer de 30 à 50 duplique des images de façon visible.
          // On ne varie donc qu'à l'intérieur de la même famille de cadence.
          const src = color.fps > 0 ? color.fps : 30;
          const family: number[] =
            src >= 55 ? [59.94, 60]
            : src >= 48 ? [50]              // source réellement PAL 50 → on y reste
            : src >= 27 ? [29.97, 30]
            : src >= 24.5 ? [25]
            : [23.976, 24];
          extraArgs.push("-r", String(family[Math.floor(Math.random() * family.length)]));
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

        // Tremblement : option à part entière, indépendante des packs. Elle
        // s'applique donc aussi bien seule qu'en plus d'un pack de mouvement.
        if (singles?.shake) vfParts.unshift(...buildShakeFilter());

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

        // Per-plan resolution cap (Starter → 1080p short edge). Bites only when
        // the source short edge exceeds the cap; forces a re-encode so the
        // downscale can be applied. ≤ cap sources are left untouched.
        const capBites =
          maxShortEdge > 0 &&
          color.width > 0 &&
          color.height > 0 &&
          Math.min(color.width, color.height) > maxShortEdge;

        // When video will be re-encoded, ensure even dimensions (no resolution cap).
        // Le watermark force aussi un ré-encodage → préparer format/scale de base.
        if (vfParts.length > 0 || packs.includes("metadata_technical") || overlays.length > 0 || capBites) {
          // ── HDR → SDR conversion when source is BT.2020 / HLG / PQ ──────────
          // Without this, BT.2020 pixel data encoded as H.264 (BT.709) produces
          // a visible yellow/warm tint because of color matrix mismatch.
          if (color.isHDR) {
            const hdr = hdrToSdrFilters();
            vfParts.unshift(...hdr);
          } else {
            vfParts.unshift("format=yuv420p");
          }
          // ── Résolution de sortie = résolution EXACTE de la source ────────────
          // `trunc(iw/2)*2` garantissait seulement des dimensions PAIRES : après
          // un zoom/crop, une source 2160×3840 ressortait en 2158×3838 — aucune
          // caméra ne produit cette résolution, c'est un marqueur immédiat de
          // fichier retouché. On repasse donc explicitement aux dimensions
          // d'origine : l'image reste modifiée (l'empreinte change bien), mais le
          // format final reste un format standard.
          if (capBites) {
            // Plan cap (Starter → 1080p short edge): downscale keeping aspect
            // ratio, forcing even dimensions. Only reached when the source short
            // edge exceeds the cap — other plans never enter this branch.
            const shortEdge = Math.min(color.width, color.height);
            const ratio = maxShortEdge / shortEdge;
            let outW = Math.max(2, Math.round(color.width * ratio));
            let outH = Math.max(2, Math.round(color.height * ratio));
            outW -= outW % 2;
            outH -= outH % 2;
            vfParts.push(`scale=${outW}:${outH}:flags=lanczos`);
          } else if (color.width > 0 && color.height > 0) {
            // Output = source resolution (unchanged behaviour for all plans).
            vfParts.push(`scale=${color.width}:${color.height}:flags=lanczos`);
          } else {
            // Dimensions source inconnues → au moins garantir des dimensions paires.
            vfParts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos");
          }
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
        if (fr.enabled) {
          // L'utilisateur choisit une PLAGE ; on tirait une valeur brute dedans,
          // d'où des sorties à 43 fps — une cadence qui n'existe sur aucun
          // appareil. On aimante donc la valeur tirée sur la cadence standard
          // la plus proche : le réglage reste respecté, le résultat reste crédible.
          const STANDARD_FPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
          const snapped = STANDARD_FPS.reduce((best, c) =>
            Math.abs(c - fr.value) < Math.abs(best - fr.value) ? c : best
          );
          extraArgs.push("-r", String(snapped));
        }

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

        // Pitch shift (semitones) WITHOUT changing duration — one of the strongest
        // levers vs TikTok's audio fingerprint. asetrate raises pitch+tempo together,
        // aresample restores the sample rate, atempo restores the original duration.
        // Needs the source sample rate (from the probe); skipped if unknown / no audio.
        const pit = get("pitch", 0, 0, -6, 6);
        if (pit.enabled && color.audioRate > 0) {
          // A near-zero random pick is inaudible & useless — a symmetric range like
          // ±2.5 lands ~0 on some copies. Floor the magnitude at half the configured
          // max so EVERY copy is clearly shifted, keeping its sign + per-copy variety.
          const bound = Math.max(Math.abs(Number(ranges?.pitch?.min) || 0), Math.abs(Number(ranges?.pitch?.max) || 0));
          let semis = pit.value;
          const floor = bound * 0.5;
          if (Math.abs(semis) < floor) {
            const sign = semis < 0 ? -1 : semis > 0 ? 1 : (Math.random() < 0.5 ? -1 : 1);
            semis = sign * floor;
          }
          if (Math.abs(semis) >= 0.1) {
            const factor = Math.pow(2, semis / 12);
            afParts.push(`asetrate=${Math.round(color.audioRate * factor)}`);
            afParts.push(`aresample=${color.audioRate}`);
            afParts.push(`atempo=${(1 / factor).toFixed(6)}`);
          }
        }

        if (Boolean(ranges?.flip?.enabled))    vfParts.push("vflip");
        if (Boolean(ranges?.reverse?.enabled)) vfParts.push("hflip");

        // ── Mouvement poussé — mouvements de caméra pilotés par les 4 curseurs.
        // Le moteur vit dans buildCameraMoves() (partagé avec le pack
        // « Mouvement avancé » du mode simple).
        {
          const mpForce = (key: string): number => {
            const r = ranges?.[key];
            if (!r?.enabled) return 0;
            const v = Number(r.min);
            return Number.isFinite(v) ? _clamp(v, 0, 100) : 0;
          };
          const geoParts = buildCameraMoves(
            {
              prog_rotate: mpForce("prog_rotate"),
              prog_zoom: mpForce("prog_zoom"),
              dyn_crop: mpForce("dyn_crop"),
              shake: mpForce("shake"),
            },
            videoDuration,
            color,
          );
          // Les mouvements passent EN PREMIER (pixels propres), avant couleur/grain.
          if (geoParts.length) vfParts.unshift(...geoParts);
        }

        // Flashs : une impulsion de luminosité en fin de chaîne, donc APRÈS les
        // retouches du pack (sinon un pack « luminosité » écraserait le pic).
        if (flashFilter) vfParts.push(flashFilter);

        // Add scale helpers whenever a full video encode will happen.
        // video filters → full encode via libx264 (vfParts non-empty)
        // video encoder extraArgs (CRF/bitrate/profile/GOP) → full encode via libx264
        // Les extraArgs purement audio (-ar, -b:a) ne déclenchent PAS de ré-encodage
        // vidéo : ils passent par le palier videoCopy et n'ont pas besoin de scale.
        // La liste de référence est VIDEO_ENCODE_ARGS (partagée avec ffmpegTier) —
        // elle inclut désormais -r/-ss/-t, qui ne font rien sur un flux copié.
        const willFullEncode = vfParts.length > 0 || overlays.length > 0 || needsVideoEncodeArgs(extraArgs);
        if (willFullEncode) {
          // Same HDR→SDR logic as simple mode.
          if (color.isHDR) {
            const hdr = hdrToSdrFilters();
            vfParts.unshift(...hdr);
          } else {
            vfParts.unshift("format=yuv420p");
          }
          // Résolution de sortie = résolution EXACTE de la source (même règle
          // qu'en mode simple). Sans ça, zoom/bordure/rotation faisaient sortir
          // une source 2160×3840 en 2172×3852 — une résolution qu'aucun appareil
          // ne produit, donc un marqueur immédiat de fichier retouché.
          if (color.width > 0 && color.height > 0) {
            vfParts.push(`scale=${color.width}:${color.height}:flags=lanczos`);
          } else {
            vfParts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos");
          }
        }
      }

      // Métadonnées aléatoires — appliquées automatiquement.
      // Le mode AVANCÉ suit désormais EXACTEMENT le mode simple : tags aléatoires
      // (creation_time / encoded_by / brand / localisation) posés sur chaque copie
      // sans réglage utilisateur (controls=undefined → tout randomisé). En simple,
      // c'est piloté par le pack "metadata" (coché par défaut).
      const wantsMeta = mode === "simple"
        ? packs.includes("metadata") || useIphoneMeta
        : true;
      const metaArgs = wantsMeta
        ? getVideoMetadataArgs({
            country: userCountry || undefined,
            iphoneMeta: useIphoneMeta,
          })
        : [];
      // Stop requested mid-job → skip remaining copies (already-finished ones kept).
      if (signal?.aborted) return;
      // Acquire a GLOBAL encode slot so concurrent jobs never exceed the server's
      // ffmpeg budget (per-job concurrency alone wouldn't bound across jobs).
      //
      // ⚠ UNIQUEMENT pour un vrai ré-encodage. Le sémaphore borne le CPU ffmpeg ;
      // or un stream copy (pack « métadonnées » seul) coûte ~0,1 s et zéro calcul.
      // En le faisant passer par la file, une simple copie pouvait attendre
      // derrière deux ré-encodages 4K de plusieurs minutes — d'où des
      // duplications « métadonnées » interminables alors que la commande, elle,
      // est instantanée. Les copies court-circuitent donc la file.
      // ── Cohérence codec ↔ identité annoncée ──────────────────────────────
      // En « priorité d'algorithme » le fichier prétend sortir d'un iPhone, or
      // un iPhone moderne filme en HEVC. Si la source est du H.264 et qu'aucun
      // filtre ne déclenche de ré-encodage, on recopiait le flux tel quel : le
      // .MOV annonçait « iPhone » avec une piste `avc1`. On force donc un vrai
      // encodage HEVC dans ce seul cas (source déjà HEVC → rien à forcer, on
      // garde le chemin rapide).
      const forceEncodeForCodec = useIphoneMeta && color.codecName !== "hevc" && color.codecName !== "unknown";
      const needsSlot = fullEncodeNeeded(vfParts, afParts, extraArgs, overlays, forceEncodeForCodec);
      const ffStart = Date.now();
      if (needsSlot) await acquireEncodeSlot();
      const ffQueued = Date.now() - ffStart;
      try {
        await runFFmpegSafe(
          tmpIn, tempOutPath, vfParts, afParts, extraArgs, metaArgs,
          // Live progress tick: update message with encoded time so users see activity
          (elapsed) => void onProgress?.(
            Math.min(99, Math.round((doneCopies / totalCopies) * 100)),
            `Encodage ${doneCopies + 1}/${totalCopies}… (${elapsed})`,
          ),
          ffmpegBin,
          threadsPerTask,
          bitrateKbps,
          signal,
          // HEVC/hvc1 UNIQUEMENT en « priorité d'algorithme » : c'est le seul cas
          // où le fichier prétend sortir d'un iPhone. Sinon on reste en H.264/avc1.
          useIphoneMeta,
          overlays,
          color.codecName,
          forceEncodeForCodec,
        );
        // Dernière trace FFmpeg (vendor 'FFMP' du muxer MOV) — non supprimable
        // en ligne de commande, effacée ici sur le fichier produit.
        await scrubMovVendorId(tempOutPath);
        // Chronos par copie : sans ça, impossible de dire au vu des logs si une
        // duplication lente a attendu son tour, encodé, ou bloqué ailleurs.
        console.log(
          `[processVideos] copie ${fileIndex}/${copyIndex} — mode=${needsSlot ? "encode" : "copy"} ` +
          `attente=${ffQueued}ms ffmpeg=${Date.now() - ffStart - ffQueued}ms`,
        );
      } finally {
        if (needsSlot) releaseEncodeSlot();
      }
      outputPaths.push(outPath);
      renames.push({ temp: tempOutPath, final: outPath });
      doneCopies++;
      await onFileReady?.(outPath);
      await onProgress?.(
        Math.min(99, Math.round((doneCopies / totalCopies) * 100)),
        `Encodage ${doneCopies}/${totalCopies} terminé`,
      );
  }, signal);

  // Reveal all outputs at once: rename temp → final so the "Videos générées"
  // list only shows them once the ENTIRE job is done — never partial, mid-encode.
  for (const { temp, final } of renames) {
    await fs.rename(temp, final).catch(() => {});
  }

  // Nettoyage des PNG temporaires du watermark (formes rasterisées / logo) et
  // des textures d'assets (flocons).
  if (wmPrep) {
    for (const f of wmPrep.tempFiles) await fs.unlink(f).catch(() => {});
  }
  if (assetsPrep) {
    for (const f of assetsPrep.tempFiles) await fs.unlink(f).catch(() => {});
  }

  // ── Clean up temp input files ─────────────────────────────────────────────
  for (const { tmpIn, ownsTmpIn } of fileEntries) {
    if (ownsTmpIn) await fs.unlink(tmpIn).catch(() => {});
  }

  return { channel, outputPaths, skippedCount: taskErrors.length, rejectedFiles, stopped: !!signal?.aborted };
}
