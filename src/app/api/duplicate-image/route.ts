// src/app/api/duplicate-image/route.ts
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import JSZip from "jszip";
import { getOutDirForCurrentUser, cleanupOldFiles } from "@/app/dashboard/utils";
import { checkUsage, incrementUsage } from "@/lib/usage";

export const maxDuration = 60;

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

/* ============== pipeline ============== */
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
    const kernels = [
      sharp.kernel.nearest,
      sharp.kernel.cubic,
      sharp.kernel.mitchell,
      sharp.kernel.lanczos2,
      sharp.kernel.lanczos3,
    ] as const;
    const kernelA = kernels[Math.floor(Math.random() * kernels.length)];

    const mMax = Math.floor(Math.min(baseW, baseH) * 0.07); // 7% per side (was 2%) — bigger crop offset
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
      .resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.cubic });
  }

  if (flags.visuals) {
    // 1. Recomb cross-canal → Moments couleurs (96%) + Chroma Cb/Cr (85%)
    //    Mélange subtil entre canaux RGB = change distributions stat de chaque canal
    const d = () => 0.990 + Math.random() * 0.020; // 0.990–1.010 diagonal
    const x = () => (Math.random() - 0.5) * 0.030; // ±1.5% cross-canal
    img = img.recomb([
      [d(), x(), x()],
      [x(), d(), x()],
      [x(), x(), d()],
    ]);

    // 2. Ajustements globaux → Luminance, Chroma, RGB histogram
    const brightness = 0.967 + Math.random() * 0.066;  // ±3.3%
    const saturation = 0.958 + Math.random() * 0.084;  // ±4.2%
    const gamma      = 0.974 + Math.random() * 0.052;  // ±2.6%
    const hue        = Math.floor((Math.random() - 0.5) * 16); // ±8°
    img = img.modulate({ brightness, saturation, hue }).gamma(gamma);

    const contrast = 0.970 + Math.random() * 0.060;    // ±3%
    img = img.linear(contrast, 0);

    // 3. Grain texture → Gradients/magnitude (96%)
    const grainSize = 512;
    const grainBuf = Buffer.alloc(grainSize * grainSize);
    for (let k = 0; k < grainBuf.length; k++) {
      grainBuf[k] = 128 + Math.floor((Math.random() - 0.5) * 60);
    }
    const grainPng = await sharp(grainBuf, { raw: { width: grainSize, height: grainSize, channels: 1 } })
      .blur(0.3)
      .resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();
    img = img.composite([{ input: grainPng, blend: "overlay", opacity: 0.08 }]).removeAlpha();

    // 4. Micro-zoom → pHash (88%) + dHash (89%) + Grille spatiale
    //    1–2.5% de zoom imperceptible mais décale tous les DCT coefficients
    const zoomFactor = 1.010 + Math.random() * 0.015; // 1.010–1.025
    const zW = clampDim(Math.round(baseW * zoomFactor));
    const zH = clampDim(Math.round(baseH * zoomFactor));
    const cropLeft = Math.floor((zW - baseW) / 2);
    const cropTop  = Math.floor((zH - baseH) / 2);
    img = img
      .resize(zW, zH, { fit: "fill", kernel: sharp.kernel.cubic })
      .extract({ left: cropLeft, top: cropTop, width: baseW, height: baseH });

    // 5. Sharpen → dHash/contours + Gradients
    const sigma = 1.2 + Math.random() * 1.3; // 1.2–2.5
    img = img.sharpen({ sigma });
  }

  if (flags.fundamentals) {
    const tintHue = Math.floor((Math.random() - 0.5) * 6); // ±3°
    if (tintHue !== 0) img = img.modulate({ hue: tintHue });
    const lightBlur = 0.3 + Math.random() * 0.4; // 0.3–0.7
    img = img.blur(lightBlur);
  }

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

  if (lower === ".webp") {
    const quality = flags.fundamentals ? (76 + Math.floor(Math.random() * 12)) : 88; // 76–88 (was 88–95)
    return {
      data: await img.withMetadata(exifMeta).webp({ quality, smartSubsample: true }).toBuffer(),
      outExt: ".webp",
    };
  }

  const chroma = flags.fundamentals ? (Math.random() < 0.5 ? "4:2:0" : "4:4:4") : "4:4:4";
  const progressive = flags.fundamentals ? Math.random() < 0.5 : false;
  const quality = flags.fundamentals ? (76 + Math.floor(Math.random() * 12)) : 88; // 76–88 (was 88–95)

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

/* ============== handler ============== */
export async function POST(req: Request) {
  void cleanupOldFiles(2 * 60 * 60 * 1000);
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const imageFile = files.find((f) => f.type?.startsWith("image/"));
    if (!imageFile) {
      return Response.json({ ok: false, error: "Aucune image reçue.", code: "IMG-001" }, { status: 400 });
    }

    const count = Math.max(1, Number(form.get("count") ?? 1));

    // ── Usage check (Solo plan limits) ──────────────────────────────────────
    const usageCheck = await checkUsage("images", count);
    if (!usageCheck.allowed) {
      return Response.json(
        {
          ok: false,
          error: usageCheck.message ?? "Limite de duplications atteinte.",
          code: "IMG-LIMIT",
          limitReached: true,
          current: usageCheck.current,
          limit: usageCheck.limit,
        },
        { status: 429 }
      );
    }

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

    const fallbackDir = path.join(os.tmpdir(), "duupflow", "local");
    const outDirPromise = Promise.race([
      getOutDirForCurrentUser().then((r) => r.dir),
      new Promise<string>((resolve) => setTimeout(() => resolve(fallbackDir), 2000)),
    ]);

    const results: { filename: string; data: Buffer; outExt: string }[] = [];
    for (let idx = 0; idx < count; idx++) {
      const rand = `${ts}${randHex(4)}`;
      const { data, outExt } = await processImage(buf, ext, flags);
      const filename = `DuupFlow_${y}${m}${d}_dup${idx + 1}_${rand}${outExt}`;

      outDirPromise.then(async (outDir) => {
        await fs.mkdir(outDir, { recursive: true }).catch(() => {});
        fs.writeFile(path.join(outDir, filename), data).catch(() => {});
      });

      results.push({ filename, data, outExt });
    }

    // ── Increment usage after successful generation ──────────────────────────
    if (usageCheck.userId) {
      await incrementUsage(usageCheck.userId, "images", count).catch(console.error);
    }

    if (results.length === 1) {
      return new Response(results[0].data, {
        headers: {
          "Content-Type": getMimeType(results[0].outExt),
          "Content-Disposition": `attachment; filename="${results[0].filename}"`,
        },
      });
    }

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
    return Response.json({ ok: false, error: e?.message || "Erreur API", code: "IMG-002" }, { status: 500 });
  }
}
