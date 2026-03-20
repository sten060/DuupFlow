"use server";

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";
import { checkUsage, incrementUsage } from "@/lib/usage";

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
async function processImage(buf: Buffer, ext: string, outPath: string, meta: sharp.WriteableMetadata): Promise<void> {
  // Step 1 — Lens-like Gaussian blur (σ 0.3–0.7, randomised per image)
  const blurSigma = 0.3 + Math.random() * 0.4;

  const { data, info } = await sharp(buf, { failOn: "none" })
    .blur(blurSigma)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Step 2 — Sensor noise: Gaussian approximation via sum of two uniforms (CLT)
  // Skips the alpha channel to preserve transparency in PNGs.
  const noiseStrength = 2 + Math.random() * 2.5;  // σ ≈ 2–4.5
  const hasAlpha = info.channels === 4;
  for (let i = 0; i < data.length; i++) {
    if (hasAlpha && (i + 1) % 4 === 0) continue;  // skip alpha
    const n = Math.round((Math.random() + Math.random() - 1) * noiseStrength * 2);
    data[i] = Math.max(0, Math.min(255, data[i] + n));
  }

  // Step 3–5 — ISP: sharpen + color modulation + encode
  const sharpened = sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .sharpen({
      sigma: 0.5 + Math.random() * 0.5,
      m1: 0.4 + Math.random() * 0.7,
      m2: 0.3,
    })
    .modulate({
      brightness: 0.99 + Math.random() * 0.02,      // ±1%
      saturation: 0.97 + Math.random() * 0.06,      // ±3%
      hue: Math.round(Math.random() * 6 - 3),       // ±3°
    })
    .withMetadata(meta);

  const isJpeg = [".jpg", ".jpeg"].includes(ext);
  if (isJpeg) {
    const quality = 82 + Math.floor(Math.random() * 12);  // 82–94
    await sharpened.jpeg({ quality, mozjpeg: false }).toFile(outPath);
  } else {
    await sharpened.toFile(outPath);
  }
}

/* ─────────────────────────────────────────────
 * MASK — Efface TOUTES les métadonnées IA,
 * applique un pipeline pixel anti-fingerprint,
 * et réinjecte une identité humaine réaliste.
 * ───────────────────────────────────────────── */
export async function maskAiMetadata(formData: FormData): Promise<{ ok: boolean; count: number; files: string[]; error?: string; limitReached?: boolean; current?: number; limit?: number }> {
  const files = formData.getAll("files") as File[];
  console.log(`[ai-detection] maskAiMetadata called — ${files.length} file(s)`);

  if (!files.length) return { ok: false, count: 0, files: [], error: "[AI-001] Aucun fichier reçu." };

  // ── Usage check (Solo plan limits) ────────────────────────────────────────
  const imageFiles = files.filter((f) => IMAGE_EXTS.includes(extOf(f.name)));
  const usageCheck = await checkUsage("ai_signatures", imageFiles.length);
  if (!usageCheck.allowed) {
    return {
      ok: false,
      count: 0,
      files: [],
      error: usageCheck.message ?? "Limite de modifications signature IA atteinte.",
      limitReached: true,
      current: usageCheck.current,
      limit: usageCheck.limit,
    };
  }

  let dir: string;
  try {
    ({ dir } = await getOutDirForCurrentUser());
  } catch (e: any) {
    console.error("[ai-detection] getOutDirForCurrentUser failed:", e?.message);
    return { ok: false, count: 0, files: [], error: "[AI-002] Erreur répertoire utilisateur." };
  }
  await fs.mkdir(dir, { recursive: true });

  const stamp = todayStamp();
  let count = 0;
  const outFiles: string[] = [];

  // Filter unsupported files early
  const validFiles = files.filter((f) => SUPPORTED_EXTS.includes(extOf(f.name)));

  type Task = { f: File };
  const tasks: Task[] = validFiles.map((f) => ({ f }));

  await withConcurrency(tasks, MAX_CONCURRENCY, async ({ f }) => {
    const ext = extOf(f.name);
    console.log(`[ai-detection] processing: ${f.name} (${f.size} bytes)`);

    let buf: Buffer;
    try {
      buf = Buffer.from(await f.arrayBuffer());
    } catch (e: any) {
      console.error(`[ai-detection] buffer read failed for ${f.name}:`, e?.message);
      return;
    }

    const outName = `DuupFlow_${stamp}_nomask_${randHex(3)}${ext}`;
    const outPath = path.join(dir, outName);

    if (IMAGE_EXTS.includes(ext)) {
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

      try {
        await Promise.race([
          processImage(buf, ext, outPath, meta),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 45_000)),
        ]);
        console.log(`[ai-detection] image OK: ${outName}`);
      } catch (e: any) {
        console.warn(`[ai-detection] processImage failed for ${f.name} (${e?.message}), fallback to strip-only`);
        // Fallback: at minimum strip all metadata + basic re-encode
        try {
          await sharp(buf, { failOn: "none" }).withMetadata(meta).toFile(outPath);
        } catch (fe: any) {
          console.error(`[ai-detection] fallback failed: ${fe?.message}`);
          return;
        }
      }
    } else {
      // Videos: simple copy (exiftool not available at runtime)
      try {
        await fs.writeFile(outPath, buf);
        console.log(`[ai-detection] video copy OK: ${outName}`);
      } catch (e: any) {
        console.error(`[ai-detection] video write failed for ${f.name}:`, e?.message);
        return;
      }
    }

    outFiles.push(outName);
    count++;
  });

  console.log(`[ai-detection] done — ${count}/${files.length} file(s) processed`);

  // ── Increment usage after successful processing ────────────────────────────
  if (count > 0 && usageCheck.userId && usageCheck.plan === "solo") {
    incrementUsage(usageCheck.userId, "ai_signatures", count).catch(console.error);
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
