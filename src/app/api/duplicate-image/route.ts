// src/app/api/duplicate-image/route.ts
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import JSZip from "jszip";
import { getOutDirForCurrentUser, cleanupOldFiles } from "@/app/dashboard/utils";

export const maxDuration = 30; // 30s hard limit on Vercel/Railway

/* ============== helpers ============== */
const randHex = (n = 2) => crypto.randomBytes(n).toString("hex");
const toBool = (v: FormDataEntryValue | null) =>
  v !== null && String(v) !== "false" && String(v) !== "0";
const clampDim = (n: number) => Math.max(32, Math.min(16000, Math.round(n)));

function getMimeType(ext: string): string {
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

/* ============== flags ============== */
type Flags = { semi: boolean; fundamentals: boolean; visuals: boolean; reverse: boolean };

/* ============== pipeline — returns Buffer ============== */
async function processImage(buffer: Buffer, ext: string, flags: Flags): Promise<Buffer> {
  const decoded = await sharp(buffer, { failOn: "none" }).toBuffer({ resolveWithObject: true });
  let img = sharp(decoded.data, { failOn: "none" });

  if (flags.reverse) {
    img = img.flop();
  }

  const baseW = clampDim(decoded.info.width  ?? 1024);
  const baseH = clampDim(decoded.info.height ?? 1024);

  /* =========================================================
   * 🧠 BLOC 1 — SEMI-VISUELS
   * ========================================================= */
  if (flags.semi) {
    const kernels = [
      sharp.kernel.nearest,
      sharp.kernel.cubic,
      sharp.kernel.mitchell,
      sharp.kernel.lanczos2,
      sharp.kernel.lanczos3,
    ] as const;
    const kernelA = kernels[Math.floor(Math.random() * kernels.length)];

    const mMax = Math.floor(Math.min(baseW, baseH) * 0.02);
    const L = Math.floor(Math.random() * (mMax + 1));
    const T = Math.floor(Math.random() * (mMax + 1));
    const R = Math.floor(Math.random() * (mMax + 1));
    const B = Math.floor(Math.random() * (mMax + 1));
    const rawCropW = clampDim(baseW - (L + R));
    const rawCropH = clampDim(baseH - (T + B));
    const safeLeft   = Math.max(0, Math.min(L, baseW - 16));
    const safeTop    = Math.max(0, Math.min(T, baseH - 16));
    const safeWidth  = Math.max(16, Math.min(rawCropW, baseW - safeLeft));
    const safeHeight = Math.max(16, Math.min(rawCropH, baseH - safeTop));

    img = img
      .resize(baseW, baseH, { fit: "fill", kernel: kernelA })
      .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
      .resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.lanczos3 });
  }

  /* =========================================================
   * 🎨 BLOC 2 — VISUELS
   * ========================================================= */
  if (flags.visuals) {
    const brightness = 0.80 + Math.random() * 0.40;
    const saturation = 0.80 + Math.random() * 0.40;
    const gamma = 1.0 + Math.random() * 1.5;
    const hue = Math.floor((Math.random() - 0.5) * 6);

    img = img.modulate({ brightness, saturation, hue }).gamma(gamma);

    const contrast = 0.85 + Math.random() * 0.30;
    img = img.linear(contrast, 0);

    const sigma = 0.6 + Math.random() * 0.4;
    img = img.sharpen({ sigma });

    if (Math.random() < 0.5) img = img.blur(0.3);
  }

  /* =========================================================
   * 🧱 BLOC 3 — FONDAMENTAUX (métadonnées + qualité)
   * ========================================================= */
  const lower = ext.toLowerCase();
  const now = new Date();
  const artistChoices = ["DuupFlow", "Studio", "Duplicator", "ContentEngine"];
  const artist = flags.fundamentals
    ? artistChoices[Math.floor(Math.random() * artistChoices.length)]
    : "DuupFlow";
  const dpi = flags.fundamentals ? [72, 96, 150, 300][Math.floor(Math.random() * 4)] : 72;

  const exifMeta: sharp.WriteableMetadata = {
    density: dpi,
    exif: {
      IFD0: {
        Software: `DuupFlow/${randHex(2)}`,
        Artist: artist,
        Copyright: `DuupFlow ${now.getFullYear()}`,
      },
    },
  };

  if (lower === ".png") {
    const compressionLevel = flags.fundamentals ? (5 + Math.floor(Math.random() * 3)) : 6;
    return img.withMetadata(exifMeta).png({ compressionLevel, adaptiveFiltering: true }).toBuffer();
  } else if (lower === ".webp") {
    const quality = flags.fundamentals ? (88 + Math.floor(Math.random() * 7)) : 92;
    return img.withMetadata(exifMeta).webp({ quality, smartSubsample: true }).toBuffer();
  } else {
    const chroma = flags.fundamentals ? (Math.random() < 0.5 ? "4:2:0" : "4:4:4") : "4:4:4";
    const progressive = flags.fundamentals ? Math.random() < 0.5 : false;
    const quality = flags.fundamentals ? (88 + Math.floor(Math.random() * 7)) : 92;

    // NOTE: mozjpeg/trellisQuantisation removed — they are 10-100× slower with
    // no meaningful benefit for duplicate-detection evasion.
    return img.withMetadata(exifMeta).jpeg({
      quality,
      progressive,
      chromaSubsampling: chroma as "4:2:0" | "4:4:4",
      optimiseCoding: true,
    }).toBuffer();
  }
}

/* ============== handler ============== */
export async function POST(req: Request) {
  void cleanupOldFiles(2 * 60 * 60 * 1000);
  try {
    const { dir: outDir } = await getOutDirForCurrentUser();
    await fs.mkdir(outDir, { recursive: true });

    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const imageFile = files.find((f) => f.type?.startsWith("image/"));
    if (!imageFile) {
      return Response.json({ ok: false, error: "Aucune image reçue." }, { status: 400 });
    }

    const count = Math.max(1, Number(form.get("count") ?? 1));
    const flags: Flags = {
      fundamentals: toBool(form.get("fundamentals")),
      visuals: toBool(form.get("visuals")),
      semi: toBool(form.get("semivisuals")) || toBool(form.get("semi")),
      reverse: toBool(form.get("reverse")),
    };

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const ts = Date.now();

    const buf = Buffer.from(await imageFile.arrayBuffer());
    const dotIdx = imageFile.name.lastIndexOf(".");
    const ext = (dotIdx >= 0 ? imageFile.name.slice(dotIdx) : ".jpg").toLowerCase();

    // Process copies sequentially (one at a time — Railway has limited CPU)
    const results: { filename: string; data: Buffer }[] = [];
    for (let idx = 0; idx < count; idx++) {
      const rand = `${ts}${randHex(4)}`;
      const filename = `DuupFlow_${y}${m}${d}_dup${idx + 1}_${rand}${ext}`;
      const data = await processImage(buf, ext, flags);

      // Save to disk (best-effort — don't fail the response if disk write fails)
      fs.writeFile(path.join(outDir, filename), data).catch(() => {});

      results.push({ filename, data });
    }

    // Return binary immediately so the client can trigger download right away
    if (results.length === 1) {
      return new Response(results[0].data, {
        headers: {
          "Content-Type": getMimeType(ext),
          "Content-Disposition": `attachment; filename="${results[0].filename}"`,
        },
      });
    }

    // Multiple copies → zip (images are already compressed, use STORE to avoid wasting CPU)
    const zip = new JSZip();
    for (const { filename, data } of results) {
      zip.file(filename, data);
    }
    const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
    const zipName = `DuupFlow_${y}${m}${d}_x${count}_${ts}.zip`;

    return new Response(zipBuf, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
      },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Erreur API" }, { status: 500 });
  }
}
