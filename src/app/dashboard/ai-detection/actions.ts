"use server";

import path from "path";
import os from "os";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";
import { checkUsage, incrementUsage } from "@/lib/usage";
import { runImageOp } from "@/lib/imageProcessingLimiter";
import { getServerT } from "@/lib/i18n/server";

/* ── constants ── */
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];
const SUPPORTED_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS];

// Max concurrent sharp workers — avoids memory spikes with many large images
const MAX_CONCURRENCY = 5;

const HUMAN_CAMERAS = [
  { make: "Canon", model: "EOS R6 Mark II" },
  { make: "Sony", model: "A7 IV" },
  { make: "Nikon", model: "Z8" },
  { make: "Fujifilm", model: "X-T5" },
  { make: "Apple", model: "iPhone 15 Pro" },
  { make: "Google", model: "Pixel 8 Pro" },
  { make: "Samsung", model: "Galaxy S24 Ultra" },
];

const HUMAN_SOFTWARE = [
  "Adobe Lightroom 7.2",
  "Adobe Photoshop 25.4",
  "Capture One 23",
  "DaVinci Resolve 19",
  "Final Cut Pro 11.6",
  "Luminar Neo 1.18",
  "Snapseed 2.21",
];

const HUMAN_NAMES = [
  "Alex Martin", "Sophie Renaud", "Jordan Lee", "Emma Dubois",
  "Lucas Bernard", "Camille Thomas", "Noah Petit", "Léa Moreau",
  "Antoine Durand", "Manon Lefebvre", "Hugo Blanc", "Chloé Simon",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randHex(n = 2) {
  return crypto.randomBytes(n).toString("hex");
}

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function toExifDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
async function processImage(buf: Buffer, ext: string, meta: sharp.WriteableMetadata): Promise<{ data: Buffer; outExt: string }> {
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

  const pipeline = (d: Buffer) =>
    sharp(d, { raw: { width: info.width, height: info.height, channels: info.channels } })
      .sharpen(sharpenParams)
      .modulate(modParams)
      .withMetadata(meta);

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
  const encPng = (d: Buffer) => pipeline(d).png({ compressionLevel: 9 }).toBuffer();
  let out = await encPng(withNoise(1));
  for (const strength of [0.5, 0.25, 0]) {
    if (out.length <= buf.length) break;
    out = await encPng(withNoise(strength));
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

  const stamp = todayStamp();
  let count = 0;
  const outFiles: string[] = [];

  // Filter unsupported files early — images capped by remaining quota, videos pass through
  const VALID_PREFIX = path.join(os.tmpdir(), "duup_direct_");
  const validImageFiles = effectiveImageFiles;
  const validVideoFiles = items.filter((u) => VIDEO_EXTS.includes(extOf(u.name)));
  const validFiles = [...validImageFiles, ...validVideoFiles];

  type Task = { u: { uploadId: string; name: string } };
  const tasks: Task[] = validFiles.map((u) => ({ u }));

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

        // Build fake human identity (randomised per image)
        const cam = pick(HUMAN_CAMERAS);
        const software = pick(HUMAN_SOFTWARE);
        const artist = pick(HUMAN_NAMES);
        const randomDaysAgo = Math.floor(Math.random() * 180);
        const randomHoursAgo = Math.floor(Math.random() * 24);
        const photoDate = new Date(Date.now() - randomDaysAgo * 86400000 - randomHoursAgo * 3600000);
        const exifDate = toExifDate(photoDate);

        const meta: sharp.WriteableMetadata = {
          icc: "sRGB IEC61966-2.1",
          exif: {
            IFD0: {
              Make: cam.make,
              Model: cam.model,
              Software: software,
              Artist: artist,
              Copyright: `© ${photoDate.getFullYear()} ${artist}`,
              DateTime: exifDate,
              DateTimeOriginal: exifDate,
              DateTimeDigitized: exifDate,
            },
          },
        };

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
              const pipe = sharp(buf, { failOn: "none" }).withMetadata(meta);
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

        const outName = `DuupFlow_${stamp}_nomask_${randHex(3)}${result.outExt}`;
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
        // Videos: zero-RAM byte copy on disk — quality and size preserved exactly.
        const outName = `DuupFlow_${stamp}_nomask_${randHex(3)}${ext}`;
        try {
          await fs.copyFile(tmpPath, path.join(dir, outName));
          console.log(`[ai-detection] video copy OK: ${outName}`);
        } catch (e: any) {
          console.error(`[ai-detection] video copy failed for ${u.name}:`, e?.message);
          return;
        }
        outFiles.push(outName);
        count++;
      }
    } finally {
      // Always drop the uploaded source temp (lives in os.tmpdir()).
      await fs.unlink(tmpPath).catch(() => {});
    }
  });

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
