"use server";

import path from "path";
import os from "os";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import { spawn } from "child_process";
import { getFFmpegBin, scrubMovVendorId } from "@/app/dashboard/videos/processVideos";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";
import { checkUsage, incrementUsage } from "@/lib/usage";
import { runImageOp } from "@/lib/imageProcessingLimiter";
import { getServerT } from "@/lib/i18n/server";
import { buildHumanMeta } from "@/lib/ai-identity";
import { prepareCounterWatermark, resolveWatermarkOverlay, type PreparedWatermark } from "@/app/dashboard/videos/watermark";
import { buildOverlayFilterComplex, type VideoOverlay } from "@/app/dashboard/videos/overlays";

/* ── constants ── */
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];

/**
 * Retire les métadonnées IA d'une vidéo par REMUX (aucun ré-encodage → qualité
 * et poids identiques au bit près).
 *
 * En reconstruisant le conteneur, ffmpeg :
 *   • jette le manifeste **C2PA / Content Credentials** — la signature de
 *     provenance qu'embarquent les vidéos IA (Sora, Veo, Runway, Kling, Pika…),
 *     stockée dans une boîte dédiée que le remux ne recopie pas ;
 *   • supprime toutes les métadonnées (`-map_metadata -1`) : date de création,
 *     logiciel, atomes propriétaires, XMP, commentaires ;
 *   • ne garde que les pistes vidéo + audio → les éventuelles pistes de données
 *     (timed metadata de provenance) sont abandonnées.
 * On efface enfin le `vendor_id=FFMP` que le muxer MOV réinjecte (empreinte
 * « traité par ffmpeg »).
 */
/**
 * Nom du fichier produit : « DF » suivi du nom d'origine.
 *
 * L'ancien schéma écrivait `DuupFlow_20260903_nomask_a3f9.png` : le nom du
 * produit ET le mot « nomask » DANS le fichier livré — exactement ce qu'on
 * cherche à ne pas laisser traîner.
 *
 * Le nom vient d'un upload : on ne garde donc que le nom de base (jamais un
 * chemin), on retire ce qui n'a rien à faire dans un nom de fichier, et on
 * ajoute un suffixe court UNIQUEMENT en cas de collision — sinon deux fichiers
 * homonymes du même lot s'écraseraient l'un l'autre.
 */
async function outputName(dir: string, original: string, outExt: string): Promise<string> {
  const base = path
    .basename(original)                       // coupe tout chemin (../ inclus)
    .replace(/\.[^.]*$/, "")                  // retire l'extension d'origine
    .replace(/[^\p{L}\p{N} ._-]/gu, "")       // caractères de nom de fichier sains
    .trim()
    .slice(0, 80) || "video";
  let name = `DF${base}${outExt}`;
  for (let i = 2; i <= 99; i++) {
    try {
      await fs.access(path.join(dir, name));
      name = `DF${base}-${i}${outExt}`;       // déjà pris → on décale
    } catch {
      return name;                             // libre
    }
  }
  return `DF${base}-${randHex(2)}${outExt}`;
}

async function probeVideo(input: string, bin: string): Promise<{ durationSec: number; width: number; height: number }> {
  const out = await new Promise<string>((resolve) => {
    const p = spawn(bin, ["-hide_banner", "-i", input], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += String(d)));
    p.on("close", () => resolve(err));
    p.on("error", () => resolve(""));
  });
  const dur = out.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
  const dim = out.match(/,\s*(\d{2,5})x(\d{2,5})[\s,]/);
  let width = dim ? +dim[1] : 0;
  let height = dim ? +dim[2] : 0;
  // Rotation du conteneur : un téléphone filme à l'horizontale et note « tourne
  // de 90° » dans le fichier. Les dimensions annoncées sont donc à l'envers de
  // celles que ffmpeg décode — sans ça, le scale écrase une vidéo verticale
  // dans un cadre horizontal.
  const rot = out.match(/rotation of\s*(-?\d+(?:\.\d+)?)\s*degrees/i);
  if (rot && Math.abs(Math.round(parseFloat(rot[1]))) % 180 === 90 && width > 0 && height > 0) {
    [width, height] = [height, width];
  }
  return {
    durationSec: dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]) : 0,
    width,
    height,
  };
}

/**
 * Nettoie une vidéo : métadonnées effacées ET pixels ré-encodés avec un
 * contre-watermark.
 *
 * ── Ce qui a changé, et pourquoi ────────────────────────────────────────────
 * Ce module se contentait d'un REMUX (`-c copy`) : il reconstruisait le
 * conteneur sans jamais toucher au film. Mesuré : le flux vidéo ET le flux
 * audio ressortaient identiques au bit près (même MD5 qu'à l'entrée). Tout ce
 * que le générateur avait laissé DANS l'image ou DANS le son repartait donc
 * intact — or c'est précisément là que les plateformes regardent pour la vidéo.
 *
 * Désormais : ré-encodage complet avec une forme aléatoire, en mouvement, à
 * 0,2–1 % d'opacité (invisible à l'œil, cf. prepareCounterWatermark). Chaque
 * sortie est donc unique au niveau pixel.
 *
 * ⚠️ À ne pas se raconter : ça ne RETIRE pas un filigrane de provenance type
 * SynthID, conçu pour survivre au ré-encodage. Ça change les pixels, ça ne
 * neutralise pas un marquage robuste.
 *
 * On garde les acquis du remux : `-map_metadata -1` (donc C2PA/JUMBF, XMP,
 * dates, atomes propriétaires), pistes de données abandonnées, vendor_id purgé.
 * Et on plafonne le débit au débit source → jamais plus lourd que l'original.
 */
async function cleanVideo(
  input: string,
  output: string,
  ext: string,
  wmPrep: PreparedWatermark | null,
): Promise<void> {
  const bin = await getFFmpegBin();
  const isMp4 = ext === ".mp4" || ext === ".mov" || ext === ".m4v";

  const { durationSec, width, height } = await probeVideo(input, bin);
  const srcBytes = await fs.stat(input).then((st) => st.size).catch(() => 0);
  const srcKbps = durationSec > 0 && srcBytes > 0 ? Math.round((srcBytes * 8) / durationSec / 1000) : 0;

  // Résolu ICI, une fois la largeur connue : la taille du calque est un % de la
  // largeur de l'image. Résolu par vidéo → forme, couleur, taille, vitesse et
  // opacité différentes à chaque fichier.
  const overlay: VideoOverlay | null = wmPrep ? resolveWatermarkOverlay(wmPrep, width) : null;

  const args = [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", input,
    "-max_muxing_queue_size", "1024",
  ];

  if (overlay) {
    // Dimensions paires exigées par yuv420p ; on garde la résolution source.
    const base = ["format=yuv420p"];
    if (width > 0 && height > 0) base.push(`scale=${width - (width % 2)}:${height - (height % 2)}`);
    args.push("-filter_complex", buildOverlayFilterComplex(base, [overlay]), "-map", "[vout]", "-map", "0:a:0?");
  } else {
    args.push("-map", "0:v:0", "-map", "0:a:0?", "-vf", "format=yuv420p");
  }

  args.push(
    "-map_metadata", "-1",
    "-map_chapters", "-1",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
  );
  // Jamais plus lourd que la source : plafond VBV calé sur son propre débit.
  if (srcKbps > 0) {
    const cap = Math.min(60000, Math.max(800, Math.round(srcKbps * 0.9)));
    args.push("-maxrate", `${cap}k`, "-bufsize", `${cap * 2}k`);
  }
  if (isMp4) args.push("-movflags", "+faststart");
  args.push("-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact");
  // Le muxer réécrit un `encoder` par piste : on y met le nom du codec, comme un
  // appareil réel — surtout pas « Lavc libx264 ».
  args.push("-metadata:s:v:0", "encoder=H.264", "-metadata:s:v:0", "vendor_id=");
  args.push(output);

  await new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += String(d)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err || `ffmpeg exit ${code}`))));
  });

  if (isMp4) await scrubMovVendorId(output);
}
const SUPPORTED_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS];

// Max concurrent sharp workers — avoids memory spikes with many large images
const MAX_CONCURRENCY = 5;

function randHex(n = 2) {
  return crypto.randomBytes(n).toString("hex");
}

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/* ── Simple concurrency limiter ── */
async function withConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    })
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * processImage
 *
 * Simulates the full pipeline of a smartphone screenshot:
 *   1. Slight Gaussian blur → mimics lens averaging / screen pixel diffusion
 *   2. Per-pixel Gaussian noise → mimics camera sensor noise
 *   3. ISP sharpening → mimics on-device image processing
 *   4. Subtle color modulation → display-to-sensor color space drift
 *   5. JPEG re-encode at randomised quality → new DCT quantization table
 *   6. Fake human EXIF metadata injection
 *
 * Combined, these break AI-detection fingerprints embedded in pixel patterns,
 * DCT coefficients, and metadata — reproducing what happens when you take a
 * phone screenshot of an AI image and post it.
 * ───────────────────────────────────────────────────────────────────────────── */
async function processImage(buf: Buffer, ext: string, meta: sharp.WriteableMetadata | null): Promise<{ data: Buffer; outExt: string }> {
  // Step 1 — Lens-like Gaussian blur (σ 0.3–0.7, randomised per image)
  const blurSigma = 0.3 + Math.random() * 0.4;

  const { data: blurred, info } = await sharp(buf, { failOn: "none" })
    .blur(blurSigma)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hasAlpha = info.channels === 4;

  // ISP params fixed once so re-encode attempts reproduce the same look.
  const sharpenParams = { sigma: 0.5 + Math.random() * 0.5, m1: 0.4 + Math.random() * 0.7, m2: 0.3 };
  const modParams = {
    brightness: 0.99 + Math.random() * 0.02,  // ±1%
    saturation: 0.97 + Math.random() * 0.06,  // ±3%
    hue: Math.round(Math.random() * 6 - 3),   // ±3°
  };

  // Sensor noise applied to a fresh copy of the blurred pixels at a given strength.
  const withNoise = (strength: number): Buffer => {
    const d = Buffer.from(blurred);
    for (let i = 0; i < d.length; i++) {
      if (hasAlpha && (i + 1) % 4 === 0) continue;  // skip alpha
      const n = Math.round((Math.random() + Math.random() - 1) * strength * 2);
      d[i] = Math.max(0, Math.min(255, d[i] + n));
    }
    return d;
  };

  const base = (d: Buffer) =>
    sharp(d, { raw: { width: info.width, height: info.height, channels: info.channels } })
      .sharpen(sharpenParams)
      .modulate(modParams);
  const pipeline = (d: Buffer) => (meta ? base(d).withMetadata(meta) : base(d));

  const baseNoise = 2 + Math.random() * 2.5;  // σ ≈ 2–4.5
  const isJpeg = ext === ".jpg" || ext === ".jpeg";
  const isWebp = ext === ".webp";

  // Output ALWAYS keeps the original format + resolution, stays visually lossless,
  // and is never heavier than the source.
  if (isJpeg || isWebp) {
    // Lossy formats: full noise, step quality down (floor 82) until <= source.
    const d = withNoise(baseNoise);
    const enc = (q: number) =>
      isJpeg
        ? pipeline(d).jpeg({ quality: q, mozjpeg: true }).toBuffer()
        : pipeline(d).webp({ quality: q }).toBuffer();
    let out = await enc(92);
    for (const q of [88, 85, 82]) {
      if (out.length <= buf.length) break;
      out = await enc(q);
    }
    return { data: out, outExt: ext };
  }

  // PNG: prioritise a LIGHT file (product decision) — a lossless codec can't
  // compress noise, so we start with light noise and step it down to zero until
  // the output is no heavier than the source. Anti-detection on PNG then relies on
  // blur + sharpen + colour modulation + fake metadata (noise is minimal by design,
  // and `baseNoise` above intentionally only drives the lossy JPEG/WebP path).
  const encPng = (d: Buffer) => pipeline(d).png({ compressionLevel: 9, effort: 10 }).toBuffer();
  let out = await encPng(withNoise(1));
  for (const strength of [0.5, 0.25, 0]) {
    if (out.length <= buf.length) break;
    out = await encPng(withNoise(strength));
  }
  // Filet : le bruit rend un PNG moins compressible, si bien qu'une capture
  // d'écran pouvait ressortir PLUS LOURDE que l'original. On repasse alors sans
  // retouche de pixels — les métadonnées sont quand même effacées.
  if (out.length > buf.length) {
    const cleanPipe = sharp(buf, { failOn: "none" });
    const clean = await (meta ? cleanPipe.withMetadata(meta) : cleanPipe).png({ compressionLevel: 9, effort: 10 }).toBuffer();
    if (clean.length < out.length) out = clean;
  }
  return { data: out, outExt: ext };
}

/* ─────────────────────────────────────────────
 * MASK — Efface TOUTES les métadonnées IA,
 * applique un pipeline pixel anti-fingerprint,
 * et réinjecte une identité humaine réaliste.
 * ───────────────────────────────────────────── */
export async function maskAiMetadata(uploads: { uploadId: string; name: string }[]): Promise<{ ok: boolean; count: number; files: string[]; error?: string; limitReached?: boolean; current?: number; limit?: number }> {
  const t = await getServerT();
  // Files are streamed to disk via /api/upload-direct first (RAM-safe), then
  // processed here by id — no large in-memory multipart payload.
  const items = (uploads ?? []).filter((u) => u && typeof u.uploadId === "string" && typeof u.name === "string");
  console.log(`[ai-detection] maskAiMetadata called — ${items.length} file(s)`);

  if (!items.length) return { ok: false, count: 0, files: [], error: `[AI-001] ${t("errors.aiDetection.noFile")}` };

  // ── Usage check (Solo plan limits) ────────────────────────────────────────
  const imageFiles = items.filter((u) => IMAGE_EXTS.includes(extOf(u.name)));
  const usageCheck = await checkUsage("ai_signatures", imageFiles.length);

  let effectiveImageFiles = imageFiles;
  let isPartial = false;

  // Apply partial-fulfillment / hard-block for any quota'd plan (Solo + Free).
  // Pro is unlimited and never lands here. Free has a 0 ai_signatures quota
  // so this branch effectively hard-blocks Free users (which is correct —
  // the page is also gated by /dashboard/ai-detection/page.tsx server view).
  if (!usageCheck.allowed && usageCheck.plan && usageCheck.plan !== "pro") {
    const remaining = usageCheck.limit - usageCheck.current;
    if (remaining <= 0) {
      return {
        ok: false,
        count: 0,
        files: [],
        error: usageCheck.message ?? t("errors.aiDetection.signatureLimitReached"),
        limitReached: true,
        current: usageCheck.current,
        limit: usageCheck.limit,
      };
    }
    // Partial: process only remaining allowed files
    effectiveImageFiles = imageFiles.slice(0, remaining);
    isPartial = true;
  }

  let dir: string;
  try {
    ({ dir } = await getOutDirForCurrentUser());
  } catch (e: any) {
    console.error("[ai-detection] getOutDirForCurrentUser failed:", e?.message);
    return { ok: false, count: 0, files: [], error: `[AI-002] ${t("errors.aiDetection.userDirError")}` };
  }
  await fs.mkdir(dir, { recursive: true });

  let count = 0;
  const outFiles: string[] = [];

  // Filter unsupported files early — images capped by remaining quota, videos pass through
  const VALID_PREFIX = path.join(os.tmpdir(), "duup_direct_");
  const validImageFiles = effectiveImageFiles;
  const validVideoFiles = items.filter((u) => VIDEO_EXTS.includes(extOf(u.name)));
  const validFiles = [...validImageFiles, ...validVideoFiles];

  type Task = { u: { uploadId: string; name: string } };
  const tasks: Task[] = validFiles.map((u) => ({ u }));

  // Contre-watermark : les 8 formes sont rasterisées UNE fois pour tout le lot,
  // puis chaque vidéo en tire une au sort (forme, couleur, taille, vitesse,
  // opacité 0,2–1 %). Rien à préparer s'il n'y a pas de vidéo dans le lot.
  const wmPrep: PreparedWatermark | null = validVideoFiles.length
    ? await prepareCounterWatermark(dir).catch((e) => {
        console.warn("[ai-detection] contre-watermark indisponible:", (e as Error)?.message);
        return null;
      })
    : null;

  await withConcurrency(tasks, MAX_CONCURRENCY, async ({ u }) => {
    const ext = extOf(u.name);
    console.log(`[ai-detection] processing: ${u.name}`);

    // Validate the upload id (path-traversal guard) + locate the streamed temp file.
    if (!/^duup_direct_[\w.-]+$/.test(u.uploadId)) {
      console.error(`[ai-detection] invalid uploadId: ${u.uploadId}`);
      return;
    }
    const tmpPath = path.join(os.tmpdir(), u.uploadId);
    if (!tmpPath.startsWith(VALID_PREFIX)) return;

    try {
      if (IMAGE_EXTS.includes(ext)) {
        // Images need their bytes in memory for sharp — bounded by runImageOp.
        let buf: Buffer;
        try {
          buf = await fs.readFile(tmpPath);
        } catch (e: any) {
          console.error(`[ai-detection] read failed for ${u.name}:`, e?.message);
          return;
        }

        // Identité humaine cohérente (cf. src/lib/ai-identity.ts) : boîtier +
        // objectif + bloc d'exposition complet sur du JPEG, RIEN d'inventé sur
        // les formats où un appareil photo n'a rien à faire (PNG, WebP).
        const meta = buildHumanMeta(ext) as sharp.WriteableMetadata | null;

        let result: { data: Buffer; outExt: string };
        try {
          // ONE global slot covers both the main pass and the fallback, so a timed-out
          // (but still-running) libvips pipeline can't be joined by a second pipeline
          // under a fresh slot — keeps the OOM cap honest.
          result = await runImageOp(async () => {
            try {
              return await Promise.race([
                processImage(buf, ext, meta),
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 45_000)),
              ]);
            } catch (inner: any) {
              console.warn(`[ai-detection] processImage failed for ${u.name} (${inner?.message}), fallback to strip-only`);
              const raw = sharp(buf, { failOn: "none" });
    const pipe = meta ? raw.withMetadata(meta) : raw;
              if (ext === ".jpg" || ext === ".jpeg")
                return { data: await pipe.jpeg({ quality: 92, mozjpeg: true }).toBuffer(), outExt: ext };
              if (ext === ".webp")
                return { data: await pipe.webp({ quality: 92 }).toBuffer(), outExt: ext };
              return { data: await pipe.png({ compressionLevel: 9 }).toBuffer(), outExt: ext };
            }
          });
        } catch (e: any) {
          console.error(`[ai-detection] image failed for ${u.name}: ${e?.message}`);
          return;
        }

        const outName = await outputName(dir, u.name, result.outExt);
        try {
          await fs.writeFile(path.join(dir, outName), result.data);
        } catch (e: any) {
          console.error(`[ai-detection] image write failed for ${u.name}:`, e?.message);
          return;
        }
        console.log(`[ai-detection] image OK: ${outName}`);
        outFiles.push(outName);
        count++;
      } else {
        // Vidéos : métadonnées effacées (C2PA/JUMBF, XMP, dates, atomes) ET
        // pixels ré-encodés avec le contre-watermark. Repli sur une copie brute
        // si ffmpeg échoue (mieux vaut livrer que planter — c'est loggé).
        const outName = await outputName(dir, u.name, ext);
        const outPath = path.join(dir, outName);
        try {
          await cleanVideo(tmpPath, outPath, ext, wmPrep);
          console.log(`[ai-detection] video cleaned OK: ${outName}${wmPrep ? " (contre-watermark)" : ""}`);
        } catch (e: any) {
          console.error(`[ai-detection] video clean failed for ${u.name}, fallback copy:`, e?.message);
          try {
            await fs.copyFile(tmpPath, outPath);
          } catch (e2: any) {
            console.error(`[ai-detection] video copy fallback failed for ${u.name}:`, e2?.message);
            return;
          }
        }
        outFiles.push(outName);
        count++;
      }
    } finally {
      // Always drop the uploaded source temp (lives in os.tmpdir()).
      await fs.unlink(tmpPath).catch(() => {});
    }
  });

  // Les formes rasterisées du contre-watermark ne servent plus.
  if (wmPrep) for (const f of wmPrep.tempFiles) await fs.unlink(f).catch(() => {});

  console.log(`[ai-detection] done — ${count}/${items.length} file(s) processed`);

  // ── Increment usage after successful processing ────────────────────────────
  const imageCount = outFiles.filter((f) => IMAGE_EXTS.some((e) => f.toLowerCase().endsWith(e))).length;
  // Count usage for any quota'd plan (Solo + Free). Pro is unlimited.
  if (imageCount > 0 && usageCheck.userId && usageCheck.plan !== "pro") {
    await incrementUsage(usageCheck.userId, "ai_signatures", imageCount).catch(console.error);
  }

  if (isPartial) {
    const skipped = imageFiles.length - effectiveImageFiles.length;
    return {
      ok: true,
      count,
      files: outFiles,
      limitReached: true,
      current: usageCheck.limit,
      limit: usageCheck.limit,
      error: t("errors.aiDetection.partialLimit", {
        count,
        skipped,
        fileS: count > 1 ? "s" : "",
        processedS: count > 1 ? "s" : "",
        imageS: skipped > 1 ? "s" : "",
        cancelledS: skipped > 1 ? "s" : "",
      }),
    };
  }

  return { ok: true, count, files: outFiles };
}

/* ─────────────────────────────────────────────
 * DELETE — Supprime les fichiers d'une session
 * ───────────────────────────────────────────── */
export async function deleteAiFiles(fileNames: string[]): Promise<{ ok: boolean; deleted: number }> {
  const { dir } = await getOutDirForCurrentUser();
  let deleted = 0;

  for (const name of fileNames) {
    if (name.includes("/") || name.includes("\\") || name.includes("..")) continue;
    try {
      await fs.unlink(path.join(dir, name));
      deleted++;
    } catch {
      /* already gone */
    }
  }

  return { ok: true, deleted };
}
