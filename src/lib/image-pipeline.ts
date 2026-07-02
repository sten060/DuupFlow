// Image duplication pipeline — shared by the dashboard SSE route
// (/api/duplicate-image-sse) and the public API (/api/v1/images/duplicate).
// Extracted verbatim from the SSE route so both paths produce identical copies.
import sharp from "sharp";
import crypto from "crypto";
import { pickLocation } from "@/lib/locations";

export const randHex = (n = 2) => crypto.randomBytes(n).toString("hex");
const clampDim = (n: number) => Math.max(32, Math.min(16000, Math.round(n)));

export type Flags = { semi: boolean; fundamentals: boolean; visuals: boolean; reverse: boolean };

export async function processImage(
  buffer: Buffer,
  ext: string,
  flags: Flags,
  opts?: { country?: string; iphoneMeta?: boolean },
): Promise<{ data: Buffer; outExt: string }> {
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  let img = sharp(buffer, { failOn: "none" });

  if (flags.reverse) {
    img = img.flop();
  }

  // Preserve original resolution — no downscale cap.
  // 4K stays 4K, 1080p stays 1080p. Only clamp to Sharp's safety limit (16000px).
  const rawW = meta.width  ?? 1024;
  const rawH = meta.height ?? 1024;
  const baseW = clampDim(rawW);
  const baseH = clampDim(rawH);

  if (flags.semi) {
    const bigPct  = 0.03 + Math.random() * 0.04;  // 3–7%
    const smallPct = Math.random() * 0.01;           // 0–1%
    const dim = Math.min(baseW, baseH);
    const L = Math.floor(dim * bigPct);
    const T = Math.floor(dim * bigPct);
    const R = Math.floor(dim * smallPct);
    const B = Math.floor(dim * smallPct);
    const rawCropW = clampDim(baseW - (L + R));
    const rawCropH = clampDim(baseH - (T + B));
    const safeLeft   = Math.max(0, Math.min(L, baseW - 16));
    const safeTop    = Math.max(0, Math.min(T, baseH - 16));
    const safeWidth  = Math.max(16, Math.min(rawCropW, baseW - safeLeft));
    const safeHeight = Math.max(16, Math.min(rawCropH, baseH - safeTop));

    img = img
      .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
      .resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.lanczos3 });

    // Légère netteté aléatoire — fait chuter les gradients et le SSIM
    const sigma  = 0.4 + Math.random() * 0.6;   // 0.4–1.0
    const flat   = 0.5 + Math.random() * 1.0;   // 0.5–1.5
    const jagged = 0.3 + Math.random() * 0.7;   // 0.3–1.0
    img = img.sharpen(sigma, flat, jagged);
  }

  if (flags.visuals) {
    // ── Brightness ±3%
    const bDir = Math.random() < 0.5 ? -1 : 1;
    const brightness = 1.0 + bDir * (0.01 + Math.random() * 0.02);
    // ── Saturation ±5%
    const sDir = Math.random() < 0.5 ? -1 : 1;
    const saturation = 1.0 + sDir * (0.02 + Math.random() * 0.03);
    // ── Hue ±3°
    const hue = (Math.random() < 0.5 ? -1 : 1) * Math.floor(1 + Math.random() * 3);
    img = img.modulate({ brightness, saturation, hue });

    // ── Gamma ±3% (1.00–1.03)
    const gamma = 1.00 + Math.random() * 0.03;
    img = img.gamma(gamma);

    // ── Unsharp très doux
    img = img.sharpen(0.5, 0.5, 0.5);
  }

  const lower = ext.toLowerCase();
  const now = new Date();
  const artistChoices = ["DuupFlow", "Studio", "Duplicator", "ContentEngine", "MediaFlow", "PixelVault"];
  const artist = flags.fundamentals
    ? artistChoices[Math.floor(Math.random() * artistChoices.length)]
    : "DuupFlow";

  const dpiPool = flags.fundamentals ? [60, 72, 96, 120, 150, 180, 240, 300, 600] : [72];
  const dpi = dpiPool[Math.floor(Math.random() * dpiPool.length)];

  const exifLevel = flags.fundamentals ? (Math.random() < 0.5 ? 1 : 2) : 1;

  let exifMeta: sharp.WriteableMetadata;

  if (opts?.iphoneMeta) {
    // ── iPhone-realistic EXIF metadata ──────────────────────────────────
    const iphoneModels = [
      { make: "Apple", model: "iPhone 16 Pro Max", software: "18.3.2" },
      { make: "Apple", model: "iPhone 16 Pro", software: "18.3.1" },
      { make: "Apple", model: "iPhone 15 Pro Max", software: "18.2.1" },
      { make: "Apple", model: "iPhone 15 Pro", software: "18.2" },
    ];
    const iphoneLens = [
      { focal: "6.86", focalEq: "24", aperture: "1.78", model: "iPhone 16 Pro Max back triple camera 6.86mm f/1.78" },
      { focal: "2.22", focalEq: "13", aperture: "2.2", model: "iPhone 16 Pro back triple camera 2.22mm f/2.2" },
      { focal: "9.0", focalEq: "77", aperture: "2.8", model: "iPhone 16 Pro back triple camera 9mm f/2.8" },
    ];
    const dev = iphoneModels[Math.floor(Math.random() * iphoneModels.length)];
    const lens = iphoneLens[Math.floor(Math.random() * iphoneLens.length)];
    const daysAgo = Math.floor(Math.random() * 30);
    const d = new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000));
    const pad = (n: number) => String(n).padStart(2, "0");
    const dtStr = `${d.getFullYear()}:${pad(d.getMonth()+1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const subsec = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    const tzH = Math.floor(Math.random() * 12) + 1;
    const offsetTime = `+${pad(tzH)}:00`;
    const iso = Math.floor(Math.random() * 4) * 200 + 50;   // 50, 250, 450, 650
    const exposure = `1/${100 + Math.floor(Math.random() * 9900)}`;
    const shutterSpeed = (6 + Math.random() * 8).toFixed(4);

    // Resolve GPS from a real city in the chosen country (or fall back to
    // France if user picked nothing). Coords are signed: positive = N/E,
    // negative = S/W — must match the GPS*Ref tags below.
    const loc = pickLocation(opts?.country) ?? pickLocation("FR")!;
    const latAbs = Math.abs(loc.lat).toFixed(6);
    const lonAbs = Math.abs(loc.lon).toFixed(6);
    const altStr = Math.abs(loc.alt).toFixed(1);
    const altRef = loc.alt >= 0 ? "0" : "1"; // 0 = above sea level, 1 = below

    const ifd0: Record<string, string> = {
      Make: dev.make, Model: dev.model, Software: dev.software,
      DateTime: dtStr,
    };
    const exifIfd: Record<string, string> = {
      LensModel: lens.model,
      LensMake: "Apple",
      FocalLength: lens.focal,
      FocalLengthIn35mmFilm: lens.focalEq,
      FNumber: lens.aperture,
      ApertureValue: lens.aperture,
      ISOSpeedRatings: String(iso),
      ExposureTime: exposure,
      ShutterSpeedValue: shutterSpeed,
      ExposureBiasValue: "0",
      ExposureProgram: "2",       // Normal program
      MeteringMode: "5",          // Pattern
      Flash: "16",                // No flash
      WhiteBalance: "0",          // Auto
      SceneCaptureType: "0",      // Standard
      DateTimeOriginal: dtStr,
      DateTimeDigitized: dtStr,
      SubSecTime: subsec,
      SubSecTimeOriginal: subsec,
      SubSecTimeDigitized: subsec,
      OffsetTime: offsetTime,
      OffsetTimeOriginal: offsetTime,
      OffsetTimeDigitized: offsetTime,
      ColorSpace: "65535",        // Uncalibrated (Display P3)
    };
    const gps: Record<string, string> = {
      GPSLatitudeRef: loc.latRef,
      GPSLatitude: latAbs,
      GPSLongitudeRef: loc.lonRef,
      GPSLongitude: lonAbs,
      GPSAltitudeRef: altRef,
      GPSAltitude: altStr,
      GPSSpeedRef: "K",
      GPSSpeed: (Math.random() * 5).toFixed(2),
      GPSImgDirectionRef: "T",
      GPSImgDirection: (Math.random() * 360).toFixed(2),
      GPSDestBearingRef: "T",
      GPSDestBearing: (Math.random() * 360).toFixed(2),
      GPSHPositioningError: (3 + Math.random() * 10).toFixed(6),
    };
    // Sub-location & geocoded place name — what real iPhone photos carry in
    // IPTC tags. sharp can't write IPTC, so we stash them in IFD0 alongside
    // the rest. Better than nothing for fingerprinting/exif scanners.
    ifd0.ImageDescription = `${loc.city}, ${loc.country}`;
    exifMeta = { density: dpi, exif: { IFD0: ifd0, IFD3: gps } as any };
    // Note: sharp's EXIF support is limited; we set what we can via IFD0.
    // For a complete iPhone EXIF profile, IFD0 covers Make/Model/Software/DateTime.
    Object.assign((exifMeta.exif as any).IFD0, exifIfd);
  } else {
    // ── Standard random metadata ──────────────────────────────────────
    const ifd0: Record<string, string> = {
      Software: `DuupFlow/${randHex(4)}-v${1 + Math.floor(Math.random() * 9)}.${Math.floor(Math.random() * 10)}`,
      Artist: artist,
      Copyright: `DuupFlow ${now.getFullYear()} - ${randHex(4)}`,
    };

    const makes  = ["Apple", "Samsung", "Google", "Xiaomi", "Sony", "OnePlus", "Huawei", "OPPO"];
    const models = ["iPhone 15 Pro", "Galaxy S24 Ultra", "Pixel 9", "Redmi 14", "Xperia 5 V", "Nord 4", "P60 Pro", "Find X7"];
    const idx = Math.floor(Math.random() * makes.length);
    const hh = String(Math.floor(Math.random() * 24)).padStart(2, "0");
    const mm = String(Math.floor(Math.random() * 60)).padStart(2, "0");
    const ss = String(Math.floor(Math.random() * 60)).padStart(2, "0");
    const mo = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
    const dd = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
    const yr = now.getFullYear() - Math.floor(Math.random() * 3);
    Object.assign(ifd0, {
      Make:             makes[idx],
      Model:            models[idx],
      DateTime:         `${yr}:${mo}:${dd} ${hh}:${mm}:${ss}`,
      ImageDescription: `Photo ${randHex(6)} - ${artist}`,
    });

    if (exifLevel >= 2) {
      const chunks = Array.from({ length: 120 }, () => randHex(8));
      ifd0.ImageDescription = [
        `${artist} :: ${now.toISOString()}`,
        `ref=${randHex(12)}`,
        `session=${randHex(16)}`,
        `device=${makes[idx]} ${models[idx]}`,
        `sig=${chunks.join("-")}`,
        `checksum=${randHex(32)}`,
      ].join(" :: ");
    }

    exifMeta = { density: dpi, exif: { IFD0: ifd0 } };
  }

  const chroma: "4:4:4" = "4:4:4";
  const progressive = flags.fundamentals ? Math.random() < 0.5 : false;
  const quality = flags.fundamentals ? (88 + Math.floor(Math.random() * 4)) : 90;

  if (lower === ".webp") {
    return {
      data: await img.withMetadata(exifMeta).webp({ quality, smartSubsample: false }).toBuffer(),
      outExt: ".webp",
    };
  }

  if (lower === ".png") {
    img = img.flatten({ background: { r: 255, g: 255, b: 255 } });
  }

  return {
    data: await img.withMetadata(exifMeta).jpeg({
      quality,
      progressive,
      chromaSubsampling: chroma as "4:2:0" | "4:4:4",
    }).toBuffer(),
    outExt: ".jpeg",
  };
}
