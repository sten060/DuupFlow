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
    const bigPct  = 0.01 + Math.random() * 0.02;  // 1–3%
    const smallPct = Math.random() * 0.005;          // 0–0.5%
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
  }

  if (flags.visuals) {
    // ── Brightness ±8–18%
    const bDir = Math.random() < 0.5 ? -1 : 1;
    const brightness = 1.0 + bDir * (0.08 + Math.random() * 0.10);
    // ── Saturation ±10–25%
    const sDir = Math.random() < 0.5 ? -1 : 1;
    const saturation = 1.0 + sDir * (0.10 + Math.random() * 0.15);
    // ── Hue ±10–25°
    const hue = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.floor(Math.random() * 16));
    img = img.modulate({ brightness, saturation, hue });

    // ── Gamma 1.15–1.40
    const gamma = 1.15 + Math.random() * 0.25;
    img = img.gamma(gamma);

    // ── Gradient directionnel 4–10% amplitude, centre 245/255
    const gSize = 8;
    const gradBuf = Buffer.alloc(gSize * gSize);
    const gradAngle = Math.random() * Math.PI * 2;
    const gradDx = Math.cos(gradAngle);
    const gradDy = Math.sin(gradAngle);
    const gradAmp = 0.04 + Math.random() * 0.06;
    for (let gy = 0; gy < gSize; gy++) {
      for (let gx = 0; gx < gSize; gx++) {
        const nx = (gx / (gSize - 1)) * 2 - 1;
        const ny = (gy / (gSize - 1)) * 2 - 1;
        const t = gradDx * nx + gradDy * ny;
        gradBuf[gy * gSize + gx] = Math.max(0, Math.min(255, Math.round(245 * (1 + t * gradAmp))));
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

  {
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
  void cleanupOldFiles(2 * 60 * 60 * 1000);

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
            const { data, outExt } = await processImage(buf, ext, flags);
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
        send({ error: true, msg: e?.message || "Erreur traitement image", code: "IMG-002" });
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
