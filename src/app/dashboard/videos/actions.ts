"use server";

import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { redirect } from "next/navigation";
import { getOutDirForCurrentUserRSC } from "@/app/dashboard/utils";

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
function zenoPrefix(channel: Channel) {
  return `${channelCaps(channel)}_DuupFlow_`;
}
function zenoOutName(opts: {
  channel: Channel;
  date: string;
  fileIndex: number; // 1..N
  copyIndex: number; // 1..count
  origName: string;  // suffixe lisible
  runTag: string;    // pour casser le cache
}) {
  const { channel, date, fileIndex, copyIndex, origName, runTag } = opts;
  const base = safeBase(origName);
  return `${channelCaps(channel)}_DuupFlow_${date}_vid${fileIndex}_c${String(
    copyIndex
  ).padStart(2, "0")}_r${runTag}__${base}.mp4`;
}
function filterFinals(names: string[]) {
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
const clamp = (v:number, a:number, b:number) => Math.min(b, Math.max(a, v));

/* -------- bornes serveur (doivent être alignées avec l’UI) -------- */
const LIMITS: Record<string, {min:number; max:number}> = {
  // Visuel
  brightness: { min:-1.0, max: 1.0 },
  contrast:   { min: 0.0, max: 3.0 },
  saturation: { min: 0.0, max: 3.0 },
  gamma:      { min: 0.1, max: 3.0 },
  hue_rad:    { min:-Math.PI, max: Math.PI },
  vignette:   { min: 0.0, max: Math.PI },
  noise:      { min: 0,   max: 64 },
  lens_k:     { min:-1.0, max: 1.0 },
  unsharp:    { min: 0.0, max: 5.0 },

  // Mouvement
  speed:         { min: 0.5,  max: 2.0 },      // borne atempo
  zoom:          { min: 0.5,  max: 2.0 },
  pixelshift:    { min: 0,    max: 200 },
  rotation_deg:  { min:-45,   max: 45 },
  fps:           { min: 5,    max: 120 },

  // Techniques
  border_px:     { min: 0,    max: 500 },
  vbitrate:      { min: 200,  max: 50000 },    // kbit/s
  gop:           { min: 1,    max: 1000 },
  cut_start:     { min: 0,    max: 36000 },
  cut_end:       { min: 0,    max: 36000 },

  // Audio
  volume_db:     { min:-30,   max: 30 },
  afreq_hz:      { min: 20,   max: 20000 },
  abitrate_k:    { min: 32,   max: 512 },
};

/* ------------------ FFmpeg wrapper (ordre correct) ------------------ */

async function runFFmpegSafe(
  input: string,
  output: string,
  vfParts: string[],
  afParts: string[] = [],
  extraArgs: string[] = []
) {
  // -i AVANT les options de sortie ; le nom de sortie EN DERNIER
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error", "-i", input];

  if (vfParts.length) args.push("-vf", vfParts.join(","));
  if (afParts.length) args.push("-af", afParts.join(","));

  args.push(
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-c:a", "aac",
    "-b:a", "128k",
  );

  if (extraArgs.length) args.push(...extraArgs);

  args.push(output);

  await new Promise<void>((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += String(d)));
    p.on("close", (code) => {
      if (code === 0) return resolve();
      console.error("FFmpeg error:", stderr);
      reject(new Error(`FFmpeg failed (${code})\n${stderr}`));
    });
  });
}

/* =========================================================
   Action principale : duplication (Simple + Advanced OK)
   ========================================================= */

export async function duplicateVideos(formData: FormData) {
  const channel = (formData.get("channel") as Channel) ?? "simple";
  const mode = (formData.get("mode") as string) ?? "simple";
  const count = Math.max(1, Number(formData.get("count") || 1));
  const files = (formData.getAll("files") as unknown as File[]).filter(Boolean);
  const runTag = Math.random().toString(36).slice(2, 6);

  const { dir } = await getOutDirForCurrentUserRSC();
  await fs.mkdir(dir, { recursive: true });

  const stamp = todayStamp();

  // paramètres UI
  const singlesRaw = (formData.get("singles") as string) || "{}";
  const rangesRaw = (formData.get("advancedRanges") as string) || "{}";
  const singles = JSON.parse(singlesRaw || "{}");
  const ranges = JSON.parse(rangesRaw || "{}");

  let fileIndex = 0;
  for (const f of files) {
    fileIndex += 1;

    // buffer input temporaire (chemin sûr, extension d’origine)
    const origExt = extOf(f.name) || ".mp4";
    const tmpIn = path.join(
      dir,
      `__in__${Date.now()}_${Math.random().toString(36).slice(2)}${origExt}`
    );
    await fs.writeFile(tmpIn, Buffer.from(await f.arrayBuffer()));

    for (let c = 1; c <= count; c++) {
      const outName = zenoOutName({
        channel,
        date: stamp,
        fileIndex,
        copyIndex: c,
        origName: f.name,
        runTag,
      });
      const outPath = path.join(dir, outName);

      const vfParts: string[] = [];
      const afParts: string[] = [];
      const extraArgs: string[] = [];

      if (mode === "simple") {
        /* ----------- MODE SIMPLE (borné) ----------- */
        const packs = String(formData.get("packs") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        // VISUAL
        if (packs.includes("visual")) {
          // Valeurs subtiles mais suffisantes pour affecter le hash perceptuel
          const b  = clamp(Number((-0.10 + Math.random()*0.16).toFixed(3)), LIMITS.brightness.min, LIMITS.brightness.max);
          const ct = clamp(Number((0.87 + Math.random()*0.26).toFixed(3)),  LIMITS.contrast.min,   LIMITS.contrast.max);
          const st = clamp(Number((0.86 + Math.random()*0.28).toFixed(3)),  LIMITS.saturation.min, LIMITS.saturation.max);
          const gm = clamp(Number((0.88 + Math.random()*0.24).toFixed(3)),  0.1, 3.0);
          vfParts.push(`eq=brightness=${b}:contrast=${ct}:saturation=${st}:gamma=${gm}`);

          // Teinte légère (très subtile visuellement)
          const hue = clamp(Number((Math.random()*0.28 - 0.14).toFixed(3)), -1, 1);
          vfParts.push(`hue=h=${hue}`);

          // Netteté douce + grain léger
          vfParts.push("unsharp=lx=3:ly=3:la=0.8:cx=3:cy=3:ca=0.8");
          vfParts.push("noise=alls=10:allf=t+u");

          // Vignette très légère (bords imperceptibles)
          const ang = clamp(Number((0.04 + Math.random()*0.05).toFixed(3)), 0, LIMITS.vignette.max);
          vfParts.push(`vignette=angle=${ang}:mode=forward`);

          // Légère correction optique (déformation invisible)
          const k1 = clamp(Number((Math.random()*0.28 - 0.14).toFixed(5)), -0.14, 0.14);
          const k2 = -k1/2;
          vfParts.push(`lenscorrection=k1=${k1.toFixed(5)}:k2=${k2.toFixed(5)}`);
        }

        // MOTION
        if (packs.includes("motion")) {
          const zoom = clamp(1.04 + Math.random()*0.31, LIMITS.zoom.min, LIMITS.zoom.max);
          vfParts.push(`scale=iw*${zoom.toFixed(3)}:ih*${zoom.toFixed(3)}`);
          const offx = (Math.random() * 0.5).toFixed(4);
          const offy = (Math.random() * 0.5).toFixed(4);
          vfParts.push(`crop=iw:ih:x=(in_w-out_w)*${offx}:y=(in_h-out_h)*${offy}`);

          const shift = (Math.random() * 0.02).toFixed(4);
          vfParts.push(`scale=iw*(1+${shift}):ih*(1+${shift}),crop=iw:ih`);

          // Force speed away from neutral: always ±7-14% deviation from 1.0
          const side = Math.random() > 0.5 ? 1 : -1;
          const deviation = 0.07 + Math.random()*0.07;
          const sp = clamp(1.0 + side * deviation, LIMITS.speed.min, LIMITS.speed.max);
          vfParts.push(`setpts=${(1 / sp).toFixed(4)}*PTS`);
          afParts.push(`atempo=${sp.toFixed(3)}`);
        }

        // TECHNICAL
        if (packs.includes("technical")) {
          // CRF forces different DCT quantization tables per copy
          const crf = 14 + Math.floor(Math.random()*15);
          extraArgs.push("-crf", String(crf));
          const vbit = clamp(3000 + Math.floor(Math.random()*19001), LIMITS.vbitrate.min, LIMITS.vbitrate.max);
          extraArgs.push("-b:v", `${vbit}k`);
          const gop = clamp(30 + Math.floor(Math.random()*471), LIMITS.gop.min, LIMITS.gop.max);
          extraArgs.push("-g", String(gop));
          const profiles = ["baseline", "main", "high"];
          const levels = ["5.0", "5.1", "5.2", "6.0"];
          const prof = profiles[Math.floor(Math.random()*profiles.length)];
          const lvl  = levels[Math.floor(Math.random()*levels.length)];
          extraArgs.push("-profile:v", prof, "-level:v", lvl);
          const fpsPool = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
          const fps = fpsPool[Math.floor(Math.random()*fpsPool.length)];
          extraArgs.push("-r", String(fps));
        }

        // Filtres "singles"
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
          const padTop = horiz || (!horiz && !lat) ? pad : 0;
          const padBottom = horiz || (!horiz && !lat) ? pad : 0;
          const padLeft = lat || (!horiz && !lat) ? pad : 0;
          const padRight = lat || (!horiz && !lat) ? pad : 0;
          vfParts.push(`pad=iw*(1+${padLeft}+${padRight}):ih*(1+${padTop}+${padBottom}):iw*${padLeft}:ih*${padTop}:color=black`);
        }

        vfParts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");

      } else {
  // ----------- MODE ADVANCED -----------

  // 1) Helpers placés tout en haut du bloc (portée OK)
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const get = (
    key: string,
    defMin: number,
    defMax: number,
    lo: number,
    hi: number
  ) => {
    const r = ranges?.[key] ?? {};
    const enabled = !!r.enabled;
    let min = Number(r.min ?? defMin);
    let max = Number(r.max ?? defMax);
    if (min > max) [min, max] = [max, min];
    let value = enabled ? min + Math.random() * (max - min) : NaN;
    if (enabled) value = clamp(value, lo, hi);
    return { enabled, value };
  };

  // 2) Visuel (plages *sûres* FFmpeg)
  // eq: brightness [-1..1], contrast [0..3], saturation [0..3], gamma [0.1..3]
  const sat = get("saturation", 1.0, 1.0, 0.0, 3.0);
  const con = get("contrast",   1.0, 1.0, 0.0, 3.0);
  const bri = get("brightness", 0.0, 0.0, -1.0, 1.0);
  const gam = get("gamma",      1.0, 1.0,  0.1, 3.0);

  if (sat.enabled || con.enabled || bri.enabled || gam.enabled) {
    const s = Number.isFinite(sat.value) ? sat.value : 1.0;
    const c = Number.isFinite(con.value) ? con.value : 1.0;
    const b = Number.isFinite(bri.value) ? bri.value : 0.0;
    const g = Number.isFinite(gam.value) ? gam.value : 1.0;
    // ⚠️ pour eq, les paramètres sont séparés par ":" (pas de virgules)
    vfParts.push(`eq=brightness=${b.toFixed(3)}:contrast=${c.toFixed(3)}:saturation=${s.toFixed(3)}:gamma=${g.toFixed(3)}`);
  }

  // hue (radians) borné pour rester lisible [-1..1]
  const hue = get("hue_rad", 0, 0, -1.0, 1.0);
  if (hue.enabled) vfParts.push(`hue=h=${hue.value.toFixed(3)}`);

  // vignette angle [0..1.5]
  const vig = get("vignette", 0, 0, 0.0, 1.5);
  if (vig.enabled) vfParts.push(`vignette=angle=${vig.value.toFixed(3)}:mode=forward`);

  // bruit 0..64
  const noi = get("noise", 0, 0, 0, 64);
  if (noi.enabled && noi.value > 0)
    vfParts.push(`noise=alls=${Math.max(0, Math.round(noi.value))}:allf=t+u`);

  // correction optique k1/k2 dans [-0.3..0.3]
  const lens = get("lens_k", 0, 0, -0.3, 0.3);
  if (lens.enabled && Math.abs(lens.value) >= 0.0005) {
    const k1 = lens.value;
    const k2 = -k1 / 2;
    vfParts.push(`lenscorrection=k1=${k1.toFixed(5)}:k2=${k2.toFixed(5)}`);
  }

  // unsharp doux [0..1]
  const un = get("unsharp", 0, 0, 0.0, 1.0);
  if (un.enabled && un.value > 0) {
    const a = 0.8 * un.value;
    vfParts.push(`unsharp=lx=3:ly=3:la=${a.toFixed(2)}:cx=3:cy=3:ca=${a.toFixed(2)}`);
  }

  // 3) Mouvement
  // vitesse 0.5..2.0 (pour rester compatible atempo)
  const spd = get("speed", 1.0, 1.0, 0.5, 2.0);
  if (spd.enabled && spd.value !== 1.0) {
    const s = spd.value;
    vfParts.push(`setpts=${(1 / s).toFixed(4)}*PTS`);
    afParts.push(`atempo=${s.toFixed(3)}`);
  }

  // zoom 0.8..1.5
  const zm = get("zoom", 1.0, 1.0, 0.8, 1.5);
  if (zm.enabled && zm.value !== 1.0) {
    const z = zm.value;
    vfParts.push(`scale=iw*${z.toFixed(3)}:ih*${z.toFixed(3)}`);
    vfParts.push(`crop=iw:ih:x=(in_w-out_w)/2:y=(in_h-out_h)/2`);
  }

  // pixel shift 0..20
  const pxs = get("pixelshift", 0, 0, 0, 20);
  if (pxs.enabled && pxs.value >= 1) {
    const p = Math.round(pxs.value);
    vfParts.push(`crop=iw:ih:${p}:${p}`);
    vfParts.push(`pad=iw+${p}:ih+${p}:${p}:${p}:color=black`);
  }

  // rotation (°) -15..15
  const rot = get("rotation_deg", 0, 0, -15, 15);
  if (rot.enabled && Math.abs(rot.value) > 0.001) {
    const r = (rot.value * Math.PI) / 180;
    vfParts.push(`rotate=${r.toFixed(6)}:c=black@1.0`);
  }

  // fps 10..60
  const fr = get("fps", 0, 0, 10, 60);
  if (fr.enabled) extraArgs.push("-r", String(Math.round(fr.value)));

  // 4) Techniques
  // Dimensions en % -30..+30 (même valeur W/H pour la copie)
  const dimW = ranges?.dim_w?.enabled ? clamp(Number(ranges.dim_w.min), -30, 30) : 0;
  const dimH = ranges?.dim_h?.enabled ? clamp(Number(ranges.dim_h.min), -30, 30) : 0;
  if (dimW || dimH) {
    const fx = 1 + dimW / 100;
    const fy = 1 + dimH / 100;
    vfParts.push(`scale=iw*${fx.toFixed(6)}:ih*${fy.toFixed(6)}:flags=bicubic`);
  }

  // bordure 0..200 px
  const padPx = get("border_px", 0, 0, 0, 200);
  if (padPx.enabled && padPx.value > 0) {
    const p = Math.round(padPx.value);
    vfParts.push(`pad=iw+${2 * p}:ih+${2 * p}:${p}:${p}:color=black`);
  }

  // vbitrate 500..50000 kb/s, gop 10..300
  const vbr = get("vbitrate", 0, 0, 500, 50000);
  if (vbr.enabled) extraArgs.push("-b:v", `${Math.round(vbr.value)}k`);
  const gop = get("gop", 0, 0, 10, 300);
  if (gop.enabled) extraArgs.push("-g", String(Math.round(gop.value)));

  // cut (ss / to) ; on force to >= ss + 0.05 si ss existe
  const cStart = get("cut_start", 0, 0, 0, Number.MAX_SAFE_INTEGER);
  const cEnd   = get("cut_end",   0, 0, 0, Number.MAX_SAFE_INTEGER);
  if (cStart.enabled && cStart.value > 0) extraArgs.push("-ss", cStart.value.toFixed(3));
  if (cEnd.enabled && cEnd.value > 0) {
    const to = !cStart.enabled ? cEnd.value : Math.max(cStart.value + 0.05, cEnd.value);
    extraArgs.push("-to", to.toFixed(3));
  }

  // 5) Audio
  const vol = get("volume_db", 0, 0, -30, 30);
  if (vol.enabled && vol.value !== 0) afParts.push(`volume=${vol.value.toFixed(2)}dB`);

  const wf = get("afreq_hz", 0, 0, 20, 16000);
if (wf.enabled && wf.value) {
  const hz = Math.round(Math.abs(wf.value));
  if (hz < 500) {
    // bass boost
    afParts.push(`bass=g=5:f=${hz}`);
  } else if (hz > 4000) {
    // treble boost
    afParts.push(`treble=g=5:f=${hz}`);
  } else {
    // midrange tweak fallback (plus neutre)
    afParts.push(`equalizer=f=${hz}:width_type=h:width=200:g=3`);
  }
}

  const abr = get("abitrate_k", 0, 0, 32, 320);
  if (abr.enabled) extraArgs.push("-b:a", `${Math.round(abr.value)}k`);
  
// --- Toggles "flip" (vertical) et "reverse" (miroir horizontal) ---
const flipToggle = Boolean(ranges?.flip?.enabled);
const reverseToggle = Boolean(ranges?.reverse?.enabled);

if (flipToggle)     vfParts.push("vflip"); // vertical
if (reverseToggle)  vfParts.push("hflip"); // miroir horizontal

  // termine par un scale pair pour libx264
  vfParts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
}

      await runFFmpegSafe(tmpIn, outPath, vfParts, afParts, extraArgs);
    }

    await fs.unlink(tmpIn).catch(() => {});
  }

  redirect(`/dashboard/videos/${channel}?ok=1`);
}

/* ------------------ Nettoyage par canal ------------------ */

export async function clearVideosSimple() {
  const { dir } = await getOutDirForCurrentUserRSC();
  const names = await fs.readdir(dir).catch(() => []);
  const finalNames = filterFinals(names).filter((n) =>
    n.startsWith(zenoPrefix("simple"))
  );
  await Promise.all(finalNames.map((n) => fs.unlink(path.join(dir, n)).catch(() => {})));
  redirect("/dashboard/videos/simple?ok=1");
}

export async function clearVideosAdvanced() {
  const { dir } = await getOutDirForCurrentUserRSC();
  const names = await fs.readdir(dir).catch(() => []);
  const finalNames = filterFinals(names).filter((n) =>
    n.startsWith(zenoPrefix("advanced"))
  );
  await Promise.all(finalNames.map((n) => fs.unlink(path.join(dir, n)).catch(() => {})));
  redirect("/dashboard/videos/advanced?ok=1");
}

/* ------------------ Listing par canal ------------------ */

export async function listOutVideosSimple(): Promise<string[]> {
  const { dir, userId } = await getOutDirForCurrentUserRSC();
  const finals = filterFinals(await fs.readdir(dir));
  const files = finals.filter((n) => n.startsWith(zenoPrefix("simple")));
  return files.map((n) => `/out/${userId}/${encodeURIComponent(path.basename(n))}`);
}

export async function listOutVideosAdvanced(): Promise<string[]> {
  const { dir, userId } = await getOutDirForCurrentUserRSC();
  const finals = filterFinals(await fs.readdir(dir));
  const files = finals.filter((n) => n.startsWith(zenoPrefix("advanced")));
  return files.map((n) => `/out/${userId}/${encodeURIComponent(path.basename(n))}`);
}