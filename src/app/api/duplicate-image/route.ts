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
    // Un seul kernel lanczos3 pour le resize-back → pas de double resampling
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

    // Pas de premier resize — l'image est déjà à baseW×baseH après le scale initial
    img = img
      .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
      .resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.lanczos3 });
  }

  if (flags.visuals) {
    // Pack visuel volontairement vide : toute modification pixel (brightness, contrast, gradient,
    // zoom) était perceptible à l'œil sur des images avec des couleurs saturées ou des tons clairs.
    // La différenciation se fait uniquement via le crop (semi) et les métadonnées (fundamentals).
  }

  // Hue shift supprimé : modulate({hue}) même à ±0.5° provoque une teinte jaune/orange
  // très visible sur les tons chauds (peau, cheveux blonds = ~15–30° HSL).
  // La différenciation chroma se fait via le chroma subsampling 4:2:0 / 4:4:4 et la qualité JPEG.

  const lower = ext.toLowerCase();
  const now = new Date();
  const artistChoices = ["DuupFlow", "Studio", "Duplicator", "ContentEngine", "MediaFlow", "PixelVault"];
  const artist = flags.fundamentals
    ? artistChoices[Math.floor(Math.random() * artistChoices.length)]
    : "DuupFlow";

  // DPI : pool très élargi avec extrêmes → écarts massifs entre duplications
  const dpiPool = flags.fundamentals ? [60, 72, 96, 120, 150, 180, 240, 300, 600] : [72];
  const dpi = dpiPool[Math.floor(Math.random() * dpiPool.length)];

  // Niveau d'enrichissement EXIF — 1 ou 2 uniquement (jamais 0 pour maximiser les écarts).
  // 1 = minimal (~400B), 2 = massif (~4000B via ImageDescription très longue)
  // → exifRatio entre deux dups: ex. 400B vs 4000B → ratio 0.10 → pénalité ~54pt
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
    const yr = now.getFullYear() - Math.floor(Math.random() * 3); // year varies ±3
    Object.assign(ifd0, {
      Make:             makes[idx],
      Model:            models[idx],
      DateTime:         `${yr}:${mo}:${dd} ${hh}:${mm}:${ss}`,
      ImageDescription: `Photo ${randHex(6)} - ${artist}`,
    });

    if (exifLevel >= 2) {
      // ImageDescription très longue (~3500 chars) — seul champ EXIF garanti écrit par sharp/libexif.
      // Crée un écart massif entre niveau 1 (~400B) et niveau 2 (~4000B).
      // Entre deux dups: ratio ≈ 0.10 → pénalité EXIF ~54pt (sur 60pt max)
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

  // Chroma : toujours 4:4:4 — le 4:2:0 crée un cast chaud visible sur les tons peau/cheveux
  // La différenciation se fait uniquement via EXIF, DPI, progressive, taille fichier
  const chroma: "4:4:4" = "4:4:4";
  const progressive = flags.fundamentals ? Math.random() < 0.5 : false;

  // Qualité 88–92 → artefacts JPEG imperceptibles, variation de taille fichier suffisante
  // Qualité 75 crée des artefacts DCT visibles sur cheveux et peau même à qualité "acceptable"
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
