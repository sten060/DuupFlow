// Image compression pipeline — shared by the dashboard compressor SSE route
// (/api/compress-sse) and the public API (/api/v1/compress). Extracted verbatim
// so both paths compress identically.
import sharp from "sharp";

export type CompressLevel = "light" | "balanced" | "strong";

// Per-level tuning. JPEG/WebP quality + optional max dimension for downscale.
// Video CRF: higher = smaller file (libx264 sane range ~18–32).
export const LEVELS: Record<CompressLevel, { jpegQ: number; webpQ: number; maxDim: number; crf: number }> = {
  light:    { jpegQ: 82, webpQ: 82, maxDim: 0,    crf: 25 },
  balanced: { jpegQ: 72, webpQ: 72, maxDim: 2560, crf: 28 },
  strong:   { jpegQ: 60, webpQ: 60, maxDim: 1920, crf: 32 },
};

/* ============== image compression (sharp) ============== */
export async function compressImage(
  srcBuf: Buffer,
  ext: string,
  level: CompressLevel,
): Promise<{ data: Buffer; outExt: string }> {
  const cfg = LEVELS[level];
  const meta = await sharp(srcBuf, { failOn: "none" }).metadata();
  let img = sharp(srcBuf, { failOn: "none" }).rotate(); // honour EXIF orientation

  // Optional downscale: only shrink, never upscale.
  if (cfg.maxDim > 0) {
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (Math.max(w, h) > cfg.maxDim) {
      img = img.resize(cfg.maxDim, cfg.maxDim, { fit: "inside", withoutEnlargement: true });
    }
  }

  const lower = ext.toLowerCase();
  if (lower === ".png") {
    // Keep PNG (preserve transparency) but recompress hard with a palette.
    return {
      data: await img.png({ compressionLevel: 9, palette: true, quality: cfg.jpegQ, effort: 7 }).toBuffer(),
      outExt: ".png",
    };
  }
  if (lower === ".webp") {
    return { data: await img.webp({ quality: cfg.webpQ }).toBuffer(), outExt: ".webp" };
  }
  // JPEG / JPG / anything else → mozjpeg for the best size/quality ratio.
  return {
    data: await img.jpeg({ quality: cfg.jpegQ, mozjpeg: true, progressive: true }).toBuffer(),
    outExt: ".jpg",
  };
}
