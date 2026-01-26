"use server";

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import { exiftool } from "exiftool-vendored";
import { execa } from "execa";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import os from "os";
import { getOutDirForCurrentUser, getOutDirForCurrentUserRSC } from "./utils";
import type { OverlayOptions } from "sharp";

// --- exposer userId à la page vidéos (RSC) ---
export async function currentUserOutInfo() {
  return await getOutDirForCurrentUserRSC(); // { dir, userId }
}

// Suffixe aléatoire déjà utilisé
const randSuffix = () => crypto.randomBytes(2).toString("hex");

// Détecte l'erreur spéciale lancée par next/navigation.redirect()
function isNextRedirect(e: unknown): boolean {
  return !!(
    e &&
    typeof e === "object" &&
    "digest" in (e as any) &&
    String((e as any).digest).startsWith("NEXT_REDIRECT")
  );
}

/* ============================================
 *               VIDÉO — variations
 * ============================================ */
function rnd(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function coin(p = 0.5) {
  return Math.random() < p;
}

function randomVideoParams(i: number, filters: string[] = [], stealthMode: boolean = false) {
  // Mode STEALTH: modifications beaucoup plus agressives pour passer sous 50% de similarité
  const intensity = stealthMode ? 3.0 : 1.0;

  const brightness = +rnd(-0.03 * intensity, 0.03 * intensity).toFixed(3);
  const contrast   = +rnd(0.97 / intensity, 1.03 * intensity).toFixed(3);
  const sat        = +rnd(0.95 / intensity, 1.05 * intensity).toFixed(3);
  const hue        = +rnd(-0.05 * intensity, 0.05 * intensity).toFixed(3);
  const noiseLevel = Math.floor(rnd(stealthMode ? 5 : 1, stealthMode ? 15 : 5));
  const shiftX = coin() ? (stealthMode ? Math.floor(rnd(2, 6)) : 1) : 0;
  const shiftY = shiftX ? 0 : (stealthMode ? Math.floor(rnd(2, 6)) : 1);
  const speed = +rnd(stealthMode ? 0.97 : 0.985, stealthMode ? 1.03 : 1.015).toFixed(3);
  const volDb = +rnd(-2.0 * intensity, 2.0 * intensity).toFixed(2);

  // Rotation aléatoire très légère (invisible mais change le hash)
  const rotate = stealthMode ? +rnd(-0.5, 0.5).toFixed(3) : 0;

  // Flip horizontal aléatoire en mode stealth
  const flipH = stealthMode && coin(0.3);

  let vfParts: string[] = ["scale=trunc(iw/2)*2:trunc(ih/2)*2"];
  let afParts: string[] = [];
  let extraParams: string[] = [];

  // En mode STEALTH, appliquer TOUS les filtres automatiquement
  const activeFilters = stealthMode ?
    ["crop", "noise", "eq", "hue", "unsharp", "volume", "speed", "bitrate", "gop", "fps", "profile", "denoise", "sharpen"] :
    filters;

  // === Application des filtres ===
  if (activeFilters.includes("crop") || stealthMode) {
    vfParts.push(`crop=in_w-${shiftX}:in_h-${shiftY}:${shiftX}:${shiftY},pad=iw+${shiftX}:ih+${shiftY}:${shiftX}:${shiftY}:color=black`);
  }

  if (activeFilters.includes("noise") || stealthMode) {
    vfParts.push(`noise=alls=${noiseLevel}:allf=t+u`);
  }

  if (activeFilters.includes("eq") || stealthMode) {
    vfParts.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${sat}`);
  }

  if (activeFilters.includes("hue") || stealthMode) {
    vfParts.push(`hue=h=${hue}*PI:s=${sat}`);
  }

  if (activeFilters.includes("unsharp") || stealthMode) {
    const unsharpIntensity = stealthMode ? +rnd(0.5, 1.2).toFixed(2) : 0.8;
    vfParts.push(`unsharp=lx=3:ly=3:la=${unsharpIntensity}:cx=3:cy=3:ca=${unsharpIntensity}`);
  }

  // Denoise léger (change le hash sans dégrader)
  if (activeFilters.includes("denoise") || stealthMode) {
    const denoiseStr = stealthMode ? +rnd(1, 3).toFixed(1) : 1.5;
    vfParts.push(`hqdn3d=${denoiseStr}:${denoiseStr}:${denoiseStr}:${denoiseStr}`);
  }

  // Rotation très légère (invisible à l'œil)
  if (stealthMode && Math.abs(rotate) > 0.1) {
    vfParts.push(`rotate=${rotate}*PI/180:fillcolor=black`);
  }

  // Flip horizontal
  if (flipH) {
    vfParts.push("hflip");
  }

  // Scale léger pour changer la résolution
  if (stealthMode) {
    const scaleRatio = +rnd(0.98, 1.02).toFixed(4);
    vfParts.push(`scale=iw*${scaleRatio}:ih*${scaleRatio}`);
  }

  if (activeFilters.includes("volume") || stealthMode) {
    afParts.push(`volume=${volDb}dB`);
  }

  if (activeFilters.includes("speed") || stealthMode) {
    afParts.push(`atempo=${speed}`);
  }

  // Audio: ajout de filtres audio supplémentaires
  if (stealthMode) {
    // Bass/Treble légèrement modifiés
    const bass = +rnd(-2, 2).toFixed(1);
    const treble = +rnd(-2, 2).toFixed(1);
    afParts.push(`bass=g=${bass},treble=g=${treble}`);
  }

  // === Paramètres d'encodage ===
  if (activeFilters.includes("bitrate") || stealthMode) {
    const br = stealthMode ?
      Math.floor(rnd(800, 3000)) : // Variation plus large en stealth
      Math.floor(rnd(100, 2000));
    extraParams.push("-b:v", `${br}k`);
  }

  if (activeFilters.includes("gop") || stealthMode) {
    const gop = stealthMode ?
      Math.floor(rnd(30, 250)) : // Variation beaucoup plus large
      Math.floor(rnd(50, 100));
    extraParams.push("-g", `${gop}`);
  }

  if (activeFilters.includes("fps") || stealthMode) {
    const fps = stealthMode ?
      +(rnd(23.5, 30.5).toFixed(3)) : // Variation plus large
      +(rnd(24.1, 25.9).toFixed(3));
    vfParts.push(`fps=${fps}`);
  }

  if (activeFilters.includes("profile") || stealthMode) {
    const profiles = ["baseline", "main", "high", "high10"];
    const levels = ["3.0", "3.1", "4.0", "4.1", "4.2", "5.0", "5.1", "5.2"];
    const profile = profiles[Math.floor(Math.random() * profiles.length)];
    const level = levels[Math.floor(Math.random() * levels.length)];
    extraParams.push("-profile:v", profile, "-level", level);
  }

  // Pixel format aléatoire en mode stealth
  if (stealthMode) {
    const pixFmts = ["yuv420p", "yuv422p", "yuv444p", "yuvj420p"];
    const pixFmt = pixFmts[Math.floor(Math.random() * pixFmts.length)];
    extraParams.push("-pix_fmt", pixFmt);
  }

  // CRF variable pour changer la compression
  if (stealthMode) {
    const crf = Math.floor(rnd(20, 26));
    extraParams.push("-crf", String(crf));
  } else {
    extraParams.push("-crf", "23");
  }

  // ============= NOUVELLES TRANSFORMATIONS STEALTH (invisibles mais changent le hash) =============
  if (stealthMode) {
    // 1. Paramètres x264 avancés (changent complètement l'encodage interne)
    const x264Params: string[] = [];

    // Motion estimation method (différentes méthodes de recherche de mouvement)
    const meMethods = ["dia", "hex", "umh", "esa", "tesa"];
    x264Params.push(`me=${meMethods[Math.floor(Math.random() * meMethods.length)]}`);

    // Subpixel motion estimation quality (1-11, change la précision)
    const subme = Math.floor(rnd(6, 11));
    x264Params.push(`subme=${subme}`);

    // Reference frames (1-16, change la structure de prédiction)
    const refs = Math.floor(rnd(2, 8));
    x264Params.push(`ref=${refs}`);

    // B-frames (0-16, change l'ordre des frames)
    const bframes = Math.floor(rnd(2, 8));
    x264Params.push(`bframes=${bframes}`);

    // Weighted prediction for B-frames
    const weightb = coin() ? "1" : "0";
    x264Params.push(`weightb=${weightb}`);

    // Trellis quantization (0-2, change la quantification)
    const trellis = Math.floor(rnd(0, 2));
    x264Params.push(`trellis=${trellis}`);

    // Deblocking filter (change l'apparence des blocks, mais imperceptible)
    const deblock = `${Math.floor(rnd(-3, 3))}:${Math.floor(rnd(-3, 3))}`;
    x264Params.push(`deblock=${deblock}`);

    // Adaptive quantization mode (change la distribution de bitrate)
    const aqMode = Math.floor(rnd(0, 3));
    x264Params.push(`aq-mode=${aqMode}`);

    // Adaptive quantization strength
    const aqStrength = +rnd(0.6, 1.4).toFixed(2);
    x264Params.push(`aq-strength=${aqStrength}`);

    // Psychovisual rate-distortion (change l'optimisation perceptuelle)
    const psyRd = `${rnd(0.5, 2.0).toFixed(2)}:${rnd(0.0, 2.0).toFixed(2)}`;
    x264Params.push(`psy-rd=${psyRd}`);

    // CABAC entropy encoding (true/false change complètement l'encodage)
    const cabac = coin() ? "1" : "0";
    x264Params.push(`cabac=${cabac}`);

    // Direct MV prediction mode
    const directModes = ["none", "spatial", "temporal", "auto"];
    x264Params.push(`direct=${directModes[Math.floor(Math.random() * directModes.length)]}`);

    // Mixed references
    const mixedRefs = coin() ? "1" : "0";
    x264Params.push(`mixed-refs=${mixedRefs}`);

    // 8x8 DCT transform
    const dct8x8 = coin() ? "1" : "0";
    x264Params.push(`8x8dct=${dct8x8}`);

    extraParams.push("-x264-params", x264Params.join(":"));

    // 2. Color space metadata (invisible mais change les métadonnées du fichier)
    const colorPrimaries = ["bt709", "bt470m", "bt470bg", "smpte170m", "smpte240m", "film", "bt2020"];
    const colorTrc = ["bt709", "gamma22", "gamma28", "smpte170m", "smpte240m", "linear", "iec61966-2-1"];
    const colorSpace = ["bt709", "fcc", "bt470bg", "smpte170m", "smpte240m", "bt2020nc"];

    extraParams.push(
      "-color_primaries", colorPrimaries[Math.floor(Math.random() * colorPrimaries.length)],
      "-color_trc", colorTrc[Math.floor(Math.random() * colorTrc.length)],
      "-colorspace", colorSpace[Math.floor(Math.random() * colorSpace.length)]
    );

    // 3. Filtres visuels ultra-subtils (imperceptibles mais changent le hash)

    // Dithering imperceptible (bruit au niveau du LSB)
    if (coin(0.7)) {
      const ditherType = coin() ? "ordered" : "random";
      vfParts.push(`dither=${ditherType}`);
    }

    // Limiter (clamp les valeurs de pixels, change légèrement les extrêmes)
    if (coin(0.6)) {
      const limMin = Math.floor(rnd(16, 20));
      const limMax = Math.floor(rnd(235, 240));
      vfParts.push(`limiter=min=${limMin}:max=${limMax}`);
    }

    // LUT sur YUV (lookup table imperceptible)
    if (coin(0.5)) {
      const lutyuv = `y=val:u=val:v=val`;
      vfParts.push(`lutyuv=${lutyuv}`);
    }

    // Deflicker (remove flickering, change temporal consistency)
    if (coin(0.4)) {
      vfParts.push("deflicker=mode=am:size=5");
    }

    // Removegrain (spatial denoise très léger)
    if (coin(0.5)) {
      const rgMode = Math.floor(rnd(1, 24));
      vfParts.push(`removegrain=m0=${rgMode}`);
    }

    // ColorSpace filter (conversion aller-retour qui change les coefficients)
    if (coin(0.6)) {
      const csFrom = coin() ? "bt709" : "bt601";
      const csTo = coin() ? "bt709" : "bt601";
      if (csFrom !== csTo) {
        vfParts.push(`colorspace=all=${csTo}:iall=${csFrom}`);
      }
    }

    // 4. Manipulations audio invisibles

    // Audio resampling (change la fréquence d'échantillonnage)
    const audioSampleRates = [32000, 44100, 48000];
    const targetSampleRate = audioSampleRates[Math.floor(Math.random() * audioSampleRates.length)];
    afParts.push(`aresample=${targetSampleRate}`);

    // Audio bit depth dithering
    if (coin(0.5)) {
      afParts.push("aformat=sample_fmts=s16");
    }

    // High-pass / Low-pass filters (imperceptibles mais changent l'audio)
    if (coin(0.4)) {
      const hpFreq = Math.floor(rnd(15, 25)); // Enlève les ultra-basses (inaudible)
      afParts.push(`highpass=f=${hpFreq}`);
    }

    if (coin(0.4)) {
      const lpFreq = Math.floor(rnd(18000, 20000)); // Enlève les ultra-hautes (inaudible)
      afParts.push(`lowpass=f=${lpFreq}`);
    }

    // Compressor audio (change la dynamique de manière imperceptible)
    if (coin(0.3)) {
      afParts.push("acompressor=threshold=0.001:ratio=2:attack=20:release=250");
    }

    // 5. Métadonnées supplémentaires aléatoires
    const randomMeta = crypto.randomBytes(16).toString("hex");
    extraParams.push(
      "-metadata", `encoder=ContentDup_${randomMeta.substring(0, 8)}`,
      "-metadata", `creation_time=${new Date().toISOString()}`,
      "-metadata", `description=Processed video ${i}`,
      "-metadata", `copyright=Generated content ${randomMeta.substring(8, 16)}`
    );

    // 6. Movflags (change la structure du container)
    const movflags = coin() ? "+faststart" : "+frag_keyframe";
    extraParams.push("-movflags", movflags);
  }

  // === Résultats ===
  const vf = `${vfParts.join(",")},setpts=${(1/speed).toFixed(6)}*PTS`;
  const af = afParts.join(",");

  const metaTitle = `Duplicate_${i}_${crypto.randomBytes(4).toString("hex")}`;
  const metaComment = `Generated by ContentDuplicator v2.0 (n=${i}, mode=${stealthMode ? 'stealth' : 'normal'})`;

  return { vf, af, metaTitle, metaComment, extraParams };
}

// --- VIDEO: duplication avec variations légères ---
async function getSourceFps(filePath: string): Promise<number | null> {
  try {
    const { execa } = await import("execa");
    const { stdout } = await execa("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=avg_frame_rate",
      "-of", "default=nw=1:nk=1",
      filePath,
    ]);
    // ffprobe renvoie par ex "30000/1001" ou "25/1"
    const [numStr, denStr] = stdout.trim().split("/");
    const num = Number(numStr);
    const den = Number(denStr || 1);
    if (!num || !den) return null;
    return num / den;
  } catch {
    return null;
  }
}

async function processVideo(
  buffer: Buffer,
  outPath: string,
  i: number,
  ext: string,
  selectedFilters: string[] = [],
  stealthMode: boolean = false
) {

  // 1bis) Récupère le nom du fichier de sortie (sans l'extension)
const originalName = path.parse(outPath).name;


  // 1) Ext de sortie
  const safeExt = (ext || "mp4").toLowerCase();

  // 2) IMPORTANT : génère les fichiers temporaires dans le MÊME dossier que le fichier final
  const baseDir = path.dirname(outPath);
  const base = path.join(baseDir, `${originalName}_copy${i}`);
  const tmpIn  = `${base}_in.${safeExt}`;
  const tmpOut = `${base}_out.${safeExt}`;

  // 3) On écrit la vidéo originale dans un fichier temporaire
  await fs.writeFile(tmpIn, buffer);

// 4) Params aléatoires (filters + metadata) avec mode stealth
const { vf, af, metaTitle, metaComment, extraParams } = randomVideoParams(i, selectedFilters, stealthMode);

// 5) FFmpeg — construire les args proprement
const args: string[] = [
  "-y",
  "-i", tmpIn,
  "-vf", vf,
];

// n'ajouter -af que si on a des filtres audio
if (af && af.trim().length > 0) {
  args.push("-af", af);
}

// ajouter les extraParams (bitrate, gop, profile, etc.)
args.push(...extraParams);

args.push(
  "-c:v", "libx264",
  "-preset", "veryfast",
  // CRF est maintenant dans extraParams
  "-c:a", "aac",
  "-b:a", "128k",
  "-metadata", `title=${metaTitle}`,
  "-metadata", `comment=${metaComment}`,
  tmpOut,
);

// lancer FFmpeg (avec logs explicites si ça échoue)
try {
  await execa("ffmpeg", args);
} catch (e: any) {
  console.error("[ffmpeg] failed:", e?.shortMessage || e?.message);
  if (e?.stderr) console.error("[ffmpeg] stderr:", e.stderr);
  if (e?.stdout) console.error("[ffmpeg] stdout:", e.stdout);
  throw e; // on remonte l'erreur pour la voir en dev
}

  // 6) Déplace proprement + nettoie les temporaires
  await fs.copyFile(tmpOut, outPath);
  await fs.unlink(tmpIn).catch(() => {});
  await fs.unlink(tmpOut).catch(() => {});
}

// --- IMAGE: variations pixels + métadonnées (Width/Height/EXIF/qualité) ---
async function processImage(
  buffer: Buffer,
  outPath: string,
  i: number,
  opts: { fundamentals: boolean; visuals: boolean } = { fundamentals: true, visuals: true }
) {
  // 1) Métadonnées d’origine (pour connaître la taille)
  const meta = await sharp(buffer).metadata();
  const baseW = meta.width  || 0;
  const baseH = meta.height || 0;

  // 2) Variation légère des dimensions (FONDAMENTAUX)
  const scale = opts.fundamentals ? (0.992 + Math.random() * 0.016) : 1; // 0.992–1.008 sinon 1
  const newW  = Math.max(16, Math.round(baseW * scale));
  const newH  = Math.max(16, Math.round(baseH * scale));

  // 3) Variations visuelles (VISUELS)
  const brightness = opts.visuals ? (0.97 + Math.random() * 0.06) : 1.0;
  const saturation = opts.visuals ? (0.97 + Math.random() * 0.06) : 1.0;
  const gamma      = opts.visuals ? (1.00 + Math.random() * 0.03) : 1.0;

  // 4) Pipeline image — impose EXACTEMENT newW x newH (évite tout mismatch)
  let pipeline = sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(newW, newH, { fit: "fill" })
    .modulate({ brightness, saturation })
    .gamma(gamma);

  // 5) Bruit minuscule (VISUELS uniquement)
  if (opts.visuals) {
    const seedW = 32, seedH = 32;
    const seed = Buffer.allocUnsafe(seedW * seedH);
    for (let k = 0; k < seed.length; k++) seed[k] = Math.floor(Math.random() * 4);

    const noisePng = await sharp(seed, { raw: { width: seedW, height: seedH, channels: 1 } })
      .resize(newW, newH, { fit: "fill" })
      .blur(0.4)
      .png()
      .toBuffer();

 const overlay: OverlayOptions & { opacity?: number } = {
  input: noisePng,
  blend: "overlay",
  opacity: 0.05,
};

pipeline = pipeline.composite([overlay]).removeAlpha();
}

  // 6) Recompression (FONDAMENTAUX)
  const lower = outPath.toLowerCase();
  if (lower.endsWith(".png")) {
    const level = opts.fundamentals ? (5 + Math.floor(Math.random() * 5)) : 6;
    await pipeline.png({ compressionLevel: level }).toFile(outPath);
  } else if (lower.endsWith(".webp")) {
    const q = opts.fundamentals ? (80 + Math.floor(Math.random() * 15)) : 90;
    await pipeline.webp({ quality: q }).toFile(outPath);
  } else {
    const q = opts.fundamentals ? (84 + Math.floor(Math.random() * 12)) : 90;
    await pipeline.jpeg({
      quality: q,
      mozjpeg: true,
      chromaSubsampling: "4:2:0",
    }).toFile(outPath);
  }

  // 7) Métadonnées EXIF (FONDAMENTAUX)
  if (opts.fundamentals) {
    const now = new Date();
    const exifDate =
      `${now.getFullYear()}:` +
      `${String(now.getMonth()+1).padStart(2,"0")}:` +
      `${String(now.getDate()).padStart(2,"0")} ` +
      `${String(now.getHours()).padStart(2,"0")}:` +
      `${String(now.getMinutes()).padStart(2,"0")}:` +
      `${String(now.getSeconds()).padStart(2,"0")}`;

    try {
      await exiftool.write(
        outPath,
        {
          AllDates: exifDate,
          Software: "ContentDuplicator",
          XPTitle:   `Duplicate_${i}`,
          XPComment: `scale=${scale.toFixed(4)}; b=${brightness.toFixed(3)}; s=${saturation.toFixed(3)}; g=${gamma.toFixed(3)}`
        },
        ["-overwrite_original"]
      );
    } catch {
      // ok si le format ne supporte pas l’écriture
    }
  }
}

// ============ ACTIONS ============
export async function duplicate(formData: FormData) {
  

  const file = formData.get("file") as File | null;
  const count = Math.max(1, Number(formData.get("count") ?? 1));
  if (!file) return;
  const { dir } = await getOutDirForCurrentUser();

  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName = file.name.replace(/\.[^.]+$/, "") || "file";
  const ext = (file.name.split(".").pop() || "png").toLowerCase();

  const mime = file.type || "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/") || ["mp4", "mov", "mkv", "webm"].includes(ext);

  for (let i = 1; i <= count; i++) {
    const outName = `${baseName}_${i}_${randSuffix()}.${ext}`;
    const { dir } = await getOutDirForCurrentUser();
    const outPath = path.join(dir, outName);


    if (isImage) {
      await processImage(buffer, outPath, i);
    } else if (isVideo) {
      await processVideo(buffer, outPath, i, ext);
    } else {
      // fallback: simple copie (octet ajouté pour différencier)
      const changed = Buffer.concat([buffer, Buffer.from([i & 0xff])]);
      await fs.writeFile(outPath, changed);
    }
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Remplace l'ancien header de clearOut par celui-ci :
export async function clearOut(formData?: FormData) {
  "use server";

  const raw = formData?.get("scope");
  const scope =
    raw === "images" || raw === "videos" ? (raw as "images" | "videos") : undefined;

  // chaque utilisateur a son propre dossier
  const base = await getOutDirForCurrentUser();
  const dir = scope ? path.join(base.dir, scope) : base.dir;

  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [] as any[]);
  await Promise.all(
    entries
      .filter((e: any) => e.isFile?.())
      .map((e: any) => fs.rm(path.join(dir, e.name)).catch(() => {}))
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/images");
  revalidatePath("/dashboard/videos");
}

export async function listOut(): Promise<string[]> {
  try {
    const { dir, userId } = await getOutDirForCurrentUserRSC();
    const names = await fs.readdir(dir);
    const finals = names.filter(
      (n) =>
        !n.startsWith(".") &&
        !n.startsWith("__in__") &&
        !n.endsWith(".part") &&
        !n.startsWith("__progress_")
    );

    return finals.map((n) => `/out/${userId}/${encodeURIComponent(n)}`);
  } catch {
    return [];
  }
}

/* ---------- Helpers pour filtrer par type ---------- */
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

function extOf(name: string) {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
}

export async function listOutImages(): Promise<string[]> {
  const { dir, userId } = await getOutDirForCurrentUserRSC();
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  return names
    .filter((n) => IMAGE_EXTS.includes(extOf(n)))
    .map((n) => `/out/${userId}/${encodeURIComponent(n)}`);
}

export async function listOutVideos(): Promise<string[]> {
  const { dir, userId } = await getOutDirForCurrentUserRSC();
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  return names
    .filter((n) => VIDEO_EXTS.includes(extOf(n)))
    .map((n) => `/out/${userId}/${encodeURIComponent(n)}`);
}

/* ---------- Duplication vidéo ---------- */
export async function duplicateVideos(formData: FormData) {
  "use server";

  // ---- lecture données du formulaire ----
  const filesAll = formData.getAll("files") as File[];
  if (!filesAll || filesAll.length === 0) throw new Error("Aucun fichier vidéo reçu.");
  const files = filesAll.slice(0, 25);

  const count = Math.max(1, Number(formData.get("count") ?? 1));
  const selectedFilters = formData.getAll("filters") as string[];
  const stealthMode = formData.get("stealthMode") === "true";

  // ---- dossier de sortie utilisateur ----
  const { dir: outDir } = await getOutDirForCurrentUser();

  // ---- PROGRESSION (même logique que les images) ----
  const jobId = crypto.randomUUID();
  const progressPath = path.join(outDir, `__progress_${jobId}.json`);

  async function writeProgress(percent: number, msg: string) {
    try {
      await fs.writeFile(
        progressPath,
        JSON.stringify({ percent, msg, at: Date.now() })
      );
    } catch {}
  }

  const total = files.length * count;
  let done = 0;

  // on crée le fichier de progression tout de suite (0%)
  await writeProgress(0, "Préparation...");

  // ---- duplication ----
  for (const f of files) {
    if (!f.type?.startsWith("video/")) continue;

    const buffer = Buffer.from(await f.arrayBuffer());
    const dot = f.name.lastIndexOf(".");
    const ext = dot >= 0 ? f.name.slice(dot) : ".mp4";
    const baseName = dot >= 0 ? f.name.slice(0, dot) : f.name;
    const cleanBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "");

    for (let i = 1; i <= count; i++) {
      const name = `${cleanBase}_${i}_${crypto.randomBytes(2).toString("hex")}${ext}`;
      const outPath = path.join(outDir, name);

      // message en cours
      await writeProgress(
        Math.min(99, Math.round((done / total) * 100)),
        `Encodage ${done + 1}/${total}…`
      );

      await processVideo(
        buffer,
        outPath,
        i,
        ext.replace(".", ""),
        selectedFilters
      );

      done++;
      await writeProgress(
        Math.min(99, Math.round((done / total) * 100)),
        `Encodage ${done}/${total}…`
      );
    }
  }

  // fin : 100% + nettoyage du fichier de progression
  await writeProgress(100, "Terminé ✔");
  setTimeout(() => fs.unlink(progressPath).catch(() => {}), 1500);

  // revalide & reste sur /dashboard/videos (avec jobId pour la barre)
  revalidatePath("/dashboard/videos");
  redirect(`/dashboard/videos?ok=1&job=${jobId}`);
}
/* ----------- Duplication vidéos (multi-fichiers) ----------- */
export async function duplicateImages(formData: FormData) {
  "use server";

  // fichiers (drag&drop → name="files")
  const filesAll = formData.getAll("files") as File[];
  if (!filesAll || filesAll.length === 0) {
    throw new Error("Aucune image reçue.");
  }
  if (filesAll.length > 25) {
    throw new Error("Vous pouvez envoyer 25 fichiers maximum.");
  }
  const files = filesAll.slice(0, 25);

  // options (cases à cocher)
  const fundamentals =
    formData.get("fundamentals") !== null ||
    (formData.getAll("filters") as string[]).includes("fundamentals");

  const visuals =
    formData.get("visuals") !== null ||
    (formData.getAll("filters") as string[]).includes("visuals");

    const count = Math.max(1, Number(formData.get("count") ?? 1));
    const { dir: outDir } = await getOutDirForCurrentUser();

  for (const f of files) {
    if (!f.type?.startsWith("image/")) continue;

    const buffer = Buffer.from(await f.arrayBuffer());
    const dot = f.name.lastIndexOf(".");
    const ext = dot >= 0 ? f.name.slice(dot) : ".png";
    const baseName = dot >= 0 ? f.name.slice(0, dot) : f.name;
    const cleanBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "");

    for (let i = 1; i <= count; i++) {
      const name = `${cleanBase}_${i}_${randSuffix()}${ext}`;
      const outPath = path.join(outDir, name);
      await processImage(buffer, outPath, i, { fundamentals, visuals });
    }
  }

  revalidatePath("/dashboard/images");
  redirect("/dashboard/images?ok=1");
}

/* ========= Détecteur de contenu similaire (précis) ========= */

type Hash64 = bigint;

/** aHash 8x8 (64 bits) */
async function imageAHash64(buf: Buffer): Promise<Hash64> {
  const s = (await import("sharp")).default;
  const arr = await s(buf).grayscale().resize(8, 8, { fit: "fill" }).raw().toBuffer(); // 64
  let sum = 0;
  for (let i = 0; i < 64; i++) sum += arr[i];
  const avg = sum / 64;
  let bits = 0n;
  for (let i = 0; i < 64; i++) {
    bits <<= 1n;
    if (arr[i] >= avg) bits |= 1n;
  }
  return bits;
}

/** pHash 64 bits (DCT 32x32 -> 8x8) */
async function imagePHash64(buf: Buffer): Promise<Hash64> {
  const s = (await import("sharp")).default;
  const N = 32;
  const raw = await s(buf).grayscale().resize(N, N, { fit: "fill" }).raw().toBuffer();

  // DCT 8x8 (basse fréquence)
  const block: number[] = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let x = 0; x < N; x++) {
        const cx = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
        for (let y = 0; y < N; y++) {
          const cy = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
          sum += raw[x * N + y] * cx * cy;
        }
      }
      block.push(sum);
    }
  }
  // médiane (on ignore DC pour le seuil)
  const vals = block.slice();
  const median = vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)];

  let bits = 0n;
  for (let i = 0; i < 64; i++) {
    bits <<= 1n;
    if (block[i] > median) bits |= 1n;
  }
  return bits;
}

function hamming64(a: Hash64, b: Hash64): number {
  let x = a ^ b;
  let c = 0;
  while (x !== 0n) {         // <— IMPORTANT: comparer à 0n
    x &= (x - 1n);
    c++;
  }
  return c;
}

function similarityFromHamming(h: number): number {
  // 64 bits → 0..64
  return Math.max(0, Math.min(100, Math.round((1 - h / 64) * 100)));
}

/** extrait une frame à t secondes (PNG) */
async function extractFrame(videoPath: string, t: number): Promise<Buffer> {
  const tmp = path.join(path.dirname(videoPath), `__frame_${t}_${crypto.randomBytes(2).toString("hex")}.png`);
  await execa("ffmpeg", ["-y", "-ss", String(t), "-i", videoPath, "-frames:v", "1", "-vf", "scale=256:-2", tmp]);
  const buf = await fs.readFile(tmp);
  await fs.unlink(tmp).catch(() => {});
  return buf;
}

/** pHash par frame (signature) */
async function videoPHashSignature(buf: Buffer): Promise<Hash64[]> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sim-"));
  const src = path.join(dir, `in_${crypto.randomBytes(2).toString("hex")}.mp4`);
  await fs.writeFile(src, buf);

  // durée
  let duration = 1;
  try {
    const { stdout } = await execa("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1",
      src,
    ]);
    duration = Math.max(1, Math.floor(Number(stdout.trim()) || 1));
  } catch {}

  // 8 points (≈ 5%, 15%, …, 85%, 95%)
  const pts = Array.from({ length: 8 }, (_, i) =>
    Math.max(1, Math.floor(((i + 1) / 9) * duration))
  );

  const sig: Hash64[] = [];
  for (const t of pts) {
    const frame = await extractFrame(src, t);
    sig.push(await imagePHash64(frame));
  }
  await fs.rm(dir, { recursive: true, force: true });
  return sig;
}

/** distance médiane entre 2 signatures vidéo */
function medianHamming(sigA: Hash64[], sigB: Hash64[]): number {
  const m = Math.min(sigA.length, sigB.length);
  const dists = Array.from({ length: m }, (_, i) => hamming64(sigA[i], sigB[i]));
  dists.sort((a, b) => a - b);
  return dists[Math.floor(m / 2)];
}

//** Action: compare deux contenus et redirige avec ?score=xx (précis + META) */
export async function compareSimilarity(formData: FormData) {
  "use server";

  const a = formData.get("fileA") as File | null;
  const b = formData.get("fileB") as File | null;
  if (!a || !b) {
    return redirect(
      "/dashboard/similarity?err=" + encodeURIComponent("Deux fichiers sont requis.")
    );
  }

  const bufA = Buffer.from(await a.arrayBuffer());
  const bufB = Buffer.from(await b.arrayBuffer());

  // 0) Raccourci : fichiers strictement identiques (octet à octet) → 100.00 %
  if (bufA.length === bufB.length) {
    const [ha, hb] = await Promise.all([
      crypto.createHash("sha256").update(bufA).digest("hex"),
      crypto.createHash("sha256").update(bufB).digest("hex"),
    ]);
    if (ha === hb) {
      return redirect("/dashboard/similarity?score=100.00");
    }
  }

  const typeA = (a.type || "").split("/")[0]; // "image" | "video"
  const typeB = (b.type || "").split("/")[0];

  try {
    let score = 0;

    if (typeA === "image" && typeB === "image") {
      // --- VISUEL (hash)
      const [pA, pB, aA, aB] = await Promise.all([
        imagePHash64(bufA), imagePHash64(bufB),
        imageAHash64(bufA), imageAHash64(bufB),
      ]);
      const pSim  = similarityFromHamming(hamming64(pA, pB)); // %
      const aSim  = similarityFromHamming(hamming64(aA, aB)); // %

      // --- META (EXIF/ICC/taille/soft…)
      const dir   = await fs.mkdtemp(path.join(os.tmpdir(), "meta-"));
      const aPath = path.join(dir, `a_${randSuffix()}`);
      const bPath = path.join(dir, `b_${randSuffix()}`);
      await fs.writeFile(aPath, bufA);
      await fs.writeFile(bPath, bufB);
      const [mA, mB] = await Promise.all([
        imageMetaSignature(aPath),
        imageMetaSignature(bPath),
      ]);
      await fs.rm(dir, { recursive: true, force: true });
      const metaSim = metaSimilarity(mA, mB); // %

      // Pondération images (somme = 1.00)
      const W = { p: 0.70, a: 0.20, meta: 0.10 };
      score = pSim * W.p + aSim * W.a + metaSim * W.meta;

    } else if (typeA === "video" && typeB === "video") {
      // --- VISUEL (signature pHash multi-frames)
      const [sigA, sigB] = await Promise.all([
        videoPHashSignature(bufA),
        videoPHashSignature(bufB),
      ]);
      const h         = medianHamming(sigA, sigB);
      const framesSim = similarityFromHamming(h); // %

      // --- META (codec/profile/level/fps/bitrate…)
      const vdir = await fs.mkdtemp(path.join(os.tmpdir(), "vmeta-"));
      const va   = path.join(vdir, `a_${randSuffix()}.mp4`);
      const vb   = path.join(vdir, `b_${randSuffix()}.mp4`);
      await fs.writeFile(va, bufA);
      await fs.writeFile(vb, bufB);
      const [mvA, mvB] = await Promise.all([
        videoMetaSignature(va),
        videoMetaSignature(vb),
      ]);
      await fs.rm(vdir, { recursive: true, force: true });
      const metaSimV = metaSimilarity(mvA, mvB); // %

      // Pondération vidéos (somme = 1.00)
      const WV = { frames: 0.90, meta: 0.10 };
      score = framesSim * WV.frames + metaSimV * WV.meta;

    } else {
      return redirect(
        "/dashboard/similarity?err=" +
          encodeURIComponent("Compare image↔image ou vidéo↔vidéo.")
      );
    }

    // 2 décimales (ex: 54.30)
    return redirect(`/dashboard/similarity?score=${score.toFixed(2)}`);

  } catch (e: any) {
    // ⬇️ très important : laisser passer les redirects Next.js
    if (isNextRedirect(e)) throw e;
    return redirect(
      "/dashboard/similarity?err=" +
        encodeURIComponent(e?.message || "Erreur comparaison")
    );
  }
}

/* ===================== META HELPERS ===================== */

type MetaDict = Record<string, string | number | boolean | null | undefined>;

function pctSimilarity(a: number, b: number, tolerance: number): number {
  // 100% si égal, décroît linéairement jusqu’à 0% à tolérance
  const d = Math.abs(a - b);
  if (d <= 0) return 100;
  if (d >= tolerance) return 0;
  return Math.max(0, 100 * (1 - d / tolerance));
}

/** Normalise et garde uniquement les clés utiles pour comparer des images */
async function imageMetaSignature(tmpPath: string): Promise<MetaDict> {
  try {
    const m = await exiftool.read(tmpPath as any);

    const out: MetaDict = {
      FileType: m.FileType,
      MIMEType: m.MIMEType,
      Make: m.Make,
      Model: m.Model,
      Orientation: m.Orientation,
      Software: m.Software,
      ColorSpace: m.ColorSpace || m.ICCProfileName,
      XResolution: Number(m.XResolution) || null,
      YResolution: Number(m.YResolution) || null,
      BitsPerSample: Number((m as any).BitsPerSample) || null,
      // largeurs/hauteurs “visibles”
      ImageWidth: Number(m.ImageWidth) || null,
      ImageHeight: Number(m.ImageHeight) || null,
      // dates écrites par tes “filtres fondamentaux”
      CreateDate: (m as any).CreateDate || (m as any).DateTimeOriginal || null,
    };
    return out;
  } catch {
    return {};
  }
}

/** Récupère un “profil” vidéo pertinent via ffprobe */
async function videoMetaSignature(tmpPath: string): Promise<MetaDict> {
  try {
    const { stdout } = await execa("ffprobe", [
      "-v","error",
      "-select_streams","v:0",
      "-show_entries",
      "stream=codec_name,profile,level,pix_fmt,color_range,color_space,color_transfer,width,height,bit_rate,avg_frame_rate:format=bit_rate,duration",
      "-of","json",
      tmpPath,
    ]);
    const j = JSON.parse(stdout);
    const s = j.streams?.[0] || {};
    const f = j.format || {};
    // fps num/den
    let fps = 0;
    if (typeof s.avg_frame_rate === "string" && s.avg_frame_rate.includes("/")) {
      const [n, d] = s.avg_frame_rate.split("/").map(Number);
      if (n && d) fps = n / d;
    }
    const out: MetaDict = {
      codec: s.codec_name,
      profile: s.profile,
      level: typeof s.level === "number" ? s.level : null,
      pix_fmt: s.pix_fmt,
      color_range: s.color_range,
      color_space: s.color_space,
      color_transfer: s.color_transfer,
      width: s.width,
      height: s.height,
      bit_rate_stream: typeof s.bit_rate === "number" ? s.bit_rate : null,
      bit_rate_container: typeof f.bit_rate === "number" ? f.bit_rate : null,
      fps,
      duration: typeof f.duration === "string" ? Number(f.duration) : null,
    };
    return out;
  } catch {
    return {};
  }
}

/** Compare deux dictionnaires de meta → 0..100 */
function metaSimilarity(a: MetaDict, b: MetaDict): number {
  // Règles : exact match pour les strings importantes,
  // tolérance pour nombres (fps, bitrates, dimensions…)
  let score = 0;
  let wsum = 0;

  const add = (val: number, w: number) => { score += val * w; wsum += w; };

  // Images / Vidéos communs
  if (a.FileType !== undefined || b.FileType !== undefined)
    add(a.FileType === b.FileType ? 100 : 0, 3);

  if (a.MIMEType !== undefined || b.MIMEType !== undefined)
    add(a.MIMEType === b.MIMEType ? 100 : 0, 3);

  if (a.Software !== undefined || b.Software !== undefined)
    add(a.Software === b.Software ? 100 : 0, 2);

  if (a.ColorSpace !== undefined || b.ColorSpace !== undefined)
    add(a.ColorSpace === b.ColorSpace ? 100 : 0, 3);

  // Dimensions (tolérance 2 px)
  if (typeof a.ImageWidth === "number" && typeof b.ImageWidth === "number")
    add(pctSimilarity(a.ImageWidth, b.ImageWidth, 2), 4);
  if (typeof a.ImageHeight === "number" && typeof b.ImageHeight === "number")
    add(pctSimilarity(a.ImageHeight, b.ImageHeight, 2), 4);

  // Résolution/DPI (tolérance 10)
  if (typeof a.XResolution === "number" && typeof b.XResolution === "number")
    add(pctSimilarity(a.XResolution, b.XResolution, 10), 2);
  if (typeof a.YResolution === "number" && typeof b.YResolution === "number")
    add(pctSimilarity(a.YResolution, b.YResolution, 10), 2);

  // Vidéo spécifiques
  if (a.codec !== undefined || b.codec !== undefined) add(a.codec === b.codec ? 100 : 0, 6);
  if (a.profile !== undefined || b.profile !== undefined) add(a.profile === b.profile ? 100 : 0, 4);
  if (typeof a.level === "number" && typeof b.level === "number") add(pctSimilarity(a.level, b.level, 1), 3);
  if (a.pix_fmt !== undefined || b.pix_fmt !== undefined) add(a.pix_fmt === b.pix_fmt ? 100 : 0, 3);

  if (typeof a.fps === "number" && typeof b.fps === "number")
    add(pctSimilarity(a.fps, b.fps, 0.3), 5); // ~0.3 i/s de tolérance

  if (typeof a.width === "number" && typeof b.width === "number")
    add(pctSimilarity(a.width, b.width, 2), 4);
  if (typeof a.height === "number" && typeof b.height === "number")
    add(pctSimilarity(a.height, b.height, 2), 4);

  // bitrates : tolérance 10%
  const brA = (a.bit_rate_stream as number) || (a.bit_rate_container as number) || null;
  const brB = (b.bit_rate_stream as number) || (b.bit_rate_container as number) || null;
  if (typeof brA === "number" && typeof brB === "number") {
    const tol = 0.10 * Math.max(brA, brB);
    add(pctSimilarity(brA, brB, tol), 4);
  }

  if (!wsum) return 0;
  return +(score / wsum).toFixed(2);
}