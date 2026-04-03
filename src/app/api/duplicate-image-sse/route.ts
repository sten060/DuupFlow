// SSE-based image duplication — mirrors duplicate-video/route.ts pattern.
// Processes each image/copy server-side and emits fileReady events so the
// client can show files as they finish and the stop button works correctly.
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import { getOutDirForCurrentUser, cleanupOldFiles } from "@/app/dashboard/utils";
import { checkUsage, incrementUsage } from "@/lib/usage";

export const maxDuration = 300;

/* ============== helpers ============== */
const randHex = (n = 2) => crypto.randomBytes(n).toString("hex");
const toBool = (v: FormDataEntryValue | null) =>
  v !== null && String(v) !== "false" && String(v) !== "0";
const clampDim = (n: number) => Math.max(32, Math.min(16000, Math.round(n)));

/* ============== flags ============== */
type Flags = { semi: boolean; fundamentals: boolean; visuals: boolean; reverse: boolean };

/* ============== image processing pipeline ============== */
async function processImage(
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

  const MAX_DIM = 3000;
  const rawW = meta.width  ?? 1024;
  const rawH = meta.height ?? 1024;
  const scale = Math.min(1, MAX_DIM / Math.max(rawW, rawH));
  const baseW = clampDim(Math.round(rawW * scale));
  const baseH = clampDim(Math.round(rawH * scale));

  if (scale < 1) {
    img = img.resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.lanczos3 });
  }

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
    // ── Brightness ±4–10%
    const bDir = Math.random() < 0.5 ? -1 : 1;
    const brightness = 1.0 + bDir * (0.04 + Math.random() * 0.06);
    // ── Saturation ±5–15%
    const sDir = Math.random() < 0.5 ? -1 : 1;
    const saturation = 1.0 + sDir * (0.05 + Math.random() * 0.10);
    // ── Hue ±4–12°
    const hue = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.floor(Math.random() * 9));
    img = img.modulate({ brightness, saturation, hue });

    // ── Gamma 1.10–1.20
    const gamma = 1.10 + Math.random() * 0.10;
    img = img.gamma(gamma);

    // ── Gradient directionnel 2–6% amplitude
    const gSize = 8;
    const gradBuf = Buffer.alloc(gSize * gSize);
    const gradAngle = Math.random() * Math.PI * 2;
    const gradDx = Math.cos(gradAngle);
    const gradDy = Math.sin(gradAngle);
    const gradAmp = 0.02 + Math.random() * 0.04;
    for (let gy = 0; gy < gSize; gy++) {
      for (let gx = 0; gx < gSize; gx++) {
        const nx = (gx / (gSize - 1)) * 2 - 1;
        const ny = (gy / (gSize - 1)) * 2 - 1;
        const t = gradDx * nx + gradDy * ny;
        gradBuf[gy * gSize + gx] = Math.max(0, Math.min(255, Math.round(250 * (1 + t * gradAmp))));
      }
    }
    const gradPng = await sharp(gradBuf, { raw: { width: gSize, height: gSize, channels: 1 } })
      .resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.cubic })
      .png()
      .toBuffer();
    img = img.composite([{ input: gradPng, blend: "multiply" } as sharp.OverlayOptions]).removeAlpha();
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
    const lat = (43 + Math.random() * 6).toFixed(6);
    const lon = (-1 + Math.random() * 8).toFixed(6);
    const alt = (10 + Math.random() * 300).toFixed(1);
    const locationName = opts?.country || "France";

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
      GPSLatitudeRef: "N",
      GPSLatitude: lat,
      GPSLongitudeRef: "E",
      GPSLongitude: lon,
      GPSAltitudeRef: "0",
      GPSAltitude: alt,
      GPSSpeedRef: "K",
      GPSSpeed: (Math.random() * 5).toFixed(2),
      GPSImgDirectionRef: "T",
      GPSImgDirection: (Math.random() * 360).toFixed(2),
      GPSDestBearingRef: "T",
      GPSDestBearing: (Math.random() * 360).toFixed(2),
      GPSHPositioningError: (3 + Math.random() * 10).toFixed(6),
    };
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

/* ============== SSE handler ============== */
export async function POST(req: Request) {
  void cleanupOldFiles(1 * 60 * 60 * 1000);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Formulaire invalide" }, { status: 400 });
  }

  const directUploadIds = form.getAll("directUploadIds") as string[];
  const fileNames       = form.getAll("fileNames")       as string[];
  const count           = Math.max(1, Number(form.get("count") ?? 1));
  const flags: Flags    = {
    fundamentals: toBool(form.get("fundamentals")),
    visuals:      toBool(form.get("visuals")),
    semi:         toBool(form.get("semivisuals")) || toBool(form.get("semi")),
    reverse:      toBool(form.get("reverse")),
  };
  const userCountry  = (form.get("country") as string) || "";
  const useIphoneMeta = toBool(form.get("iphoneMeta"));

  if (directUploadIds.length === 0) {
    return Response.json({ error: "Aucune image reçue." }, { status: 400 });
  }

  // Usage check — must be called before ReadableStream constructor so cookies are accessible
  const totalImages = directUploadIds.length * count;
  const usageCheck = await checkUsage("images", totalImages);
  if (!usageCheck.allowed) {
    return Response.json(
      {
        error: usageCheck.message ?? "Limite de duplications atteinte.",
        code: "IMG-LIMIT",
        limitReached: true,
        current: usageCheck.current,
        limit: usageCheck.limit,
      },
      { status: 429 }
    );
  }

  // Resolve user dir before creating ReadableStream (cookies still readable here)
  let dir: string;
  let userId: string;
  try {
    ({ dir, userId } = await getOutDirForCurrentUser());
  } catch (e: any) {
    return Response.json({ error: e?.message || "Erreur authentification" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const VALID_PREFIX = path.join(os.tmpdir(), "duup_direct_");

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  let generationSucceeded = false;
  let processedOk = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };

      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch {}
      }, 20_000);

      try {
        const totalTasks = directUploadIds.length * count;
        let done = 0;

        for (let i = 0; i < directUploadIds.length; i++) {
          const uploadId = directUploadIds[i];

          // Security: validate ID format to prevent path traversal
          if (!/^duup_direct_[\w.-]+$/.test(uploadId)) {
            send({ error: true, msg: `ID invalide : ${uploadId}` });
            continue;
          }
          const tmpPath = path.join(os.tmpdir(), uploadId);
          if (!tmpPath.startsWith(VALID_PREFIX)) {
            send({ error: true, msg: "Chemin invalide." });
            continue;
          }

          const fileName = fileNames[i] ?? uploadId;
          const ext = path.extname(fileName).toLowerCase() || ".jpg";

          let buf: Buffer;
          try {
            buf = await fs.readFile(tmpPath);
          } catch {
            send({ error: true, msg: `Impossible de lire le fichier : ${fileName}` });
            continue;
          }

          for (let c = 0; c < count; c++) {
            const rand = randHex(4);
            const { data, outExt } = await processImage(buf, ext, flags, { country: userCountry || undefined, iphoneMeta: useIphoneMeta });
            const outName = `DuupFlow_${stamp}_img${i + 1}_c${c + 1}_${Date.now()}${rand}${outExt}`;
            const outPath = path.join(dir, outName);

            await fs.mkdir(dir, { recursive: true }).catch(() => {});
            await fs.writeFile(outPath, data);

            done++;
            processedOk++;
            const pct = Math.round((done / totalTasks) * 100);
            const url = `/api/out/${userId}/${outName}`;

            send({
              percent: pct,
              msg: `${done}/${totalTasks} image(s) traitée(s)…`,
              fileReady: { name: outName, url },
            });
          }

          // Clean up temp input file after all copies of this image are done
          await fs.unlink(tmpPath).catch(() => {});
        }

        generationSucceeded = true;
        send({ percent: 100, msg: "Terminé ✔", done: true, processedOk });
      } catch (e: any) {
        console.error("[duplicate-image] error:", e?.message);
        send({ error: true, msg: "[IMG-002] Une erreur est survenue pendant le traitement. Contactez le support.", code: "IMG-002" });
      } finally {
        clearInterval(keepalive);
        if (generationSucceeded && usageCheck.userId) {
          incrementUsage(usageCheck.userId, "images", processedOk).catch(console.error);
        }
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
