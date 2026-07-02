// AI-signature masking pipeline for the public API (/api/v1/ai-detection).
//
// NOTE: this mirrors the image pipeline in
// src/app/dashboard/ai-detection/actions.ts. It is duplicated (not imported)
// because that file is a "use server" module — Next only allows async server
// actions to be exported from it, so its helpers can't be shared directly.
// Keep the two in sync if the masking algorithm changes. (Tech-debt: extract a
// shared pipeline the action also consumes.)

import sharp from "sharp";
import crypto from "crypto";

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

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const toExifDate = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** Build a fresh fake-human identity (randomised per image). */
function buildHumanMeta(): sharp.WriteableMetadata {
  const cam = pick(HUMAN_CAMERAS);
  const software = pick(HUMAN_SOFTWARE);
  const artist = pick(HUMAN_NAMES);
  const daysAgo = Math.floor(Math.random() * 180);
  const hoursAgo = Math.floor(Math.random() * 24);
  const photoDate = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000);
  const exifDate = toExifDate(photoDate);
  return {
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
}

/**
 * Anti-fingerprint pixel pipeline: blur → sensor noise → ISP sharpen → colour
 * modulation → re-encode + fake human EXIF. Breaks AI-detection fingerprints in
 * pixels, DCT coefficients and metadata. Output keeps the original format +
 * resolution and is never heavier than the source.
 */
async function processImage(buf: Buffer, ext: string, meta: sharp.WriteableMetadata): Promise<{ data: Buffer; outExt: string }> {
  const blurSigma = 0.3 + Math.random() * 0.4;
  const { data: blurred, info } = await sharp(buf, { failOn: "none" }).blur(blurSigma).raw().toBuffer({ resolveWithObject: true });
  const hasAlpha = info.channels === 4;

  const sharpenParams = { sigma: 0.5 + Math.random() * 0.5, m1: 0.4 + Math.random() * 0.7, m2: 0.3 };
  const modParams = {
    brightness: 0.99 + Math.random() * 0.02,
    saturation: 0.97 + Math.random() * 0.06,
    hue: Math.round(Math.random() * 6 - 3),
  };

  const withNoise = (strength: number): Buffer => {
    const d = Buffer.from(blurred);
    for (let i = 0; i < d.length; i++) {
      if (hasAlpha && (i + 1) % 4 === 0) continue;
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

  const baseNoise = 2 + Math.random() * 2.5;
  const isJpeg = ext === ".jpg" || ext === ".jpeg";
  const isWebp = ext === ".webp";

  if (isJpeg || isWebp) {
    const d = withNoise(baseNoise);
    const enc = (q: number) =>
      isJpeg ? pipeline(d).jpeg({ quality: q, mozjpeg: true }).toBuffer() : pipeline(d).webp({ quality: q }).toBuffer();
    let out = await enc(92);
    for (const q of [88, 85, 82]) {
      if (out.length <= buf.length) break;
      out = await enc(q);
    }
    return { data: out, outExt: ext };
  }

  const encPng = (d: Buffer) => pipeline(d).png({ compressionLevel: 9 }).toBuffer();
  let out = await encPng(withNoise(1));
  for (const strength of [0.5, 0.25, 0]) {
    if (out.length <= buf.length) break;
    out = await encPng(withNoise(strength));
  }
  return { data: out, outExt: ext };
}

/**
 * Public entry point: mask the AI signature of one image. Builds a fake human
 * identity, runs the anti-fingerprint pipeline (45 s cap), and falls back to a
 * metadata-strip-only pass if the pixel pipeline fails.
 */
export async function maskAiImage(buf: Buffer, ext: string): Promise<{ data: Buffer; outExt: string }> {
  const meta = buildHumanMeta();
  try {
    return await Promise.race([
      processImage(buf, ext, meta),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 45_000)),
    ]);
  } catch {
    const pipe = sharp(buf, { failOn: "none" }).withMetadata(meta);
    if (ext === ".jpg" || ext === ".jpeg") return { data: await pipe.jpeg({ quality: 92, mozjpeg: true }).toBuffer(), outExt: ext };
    if (ext === ".webp") return { data: await pipe.webp({ quality: 92 }).toBuffer(), outExt: ext };
    return { data: await pipe.png({ compressionLevel: 9 }).toBuffer(), outExt: ext };
  }
}
