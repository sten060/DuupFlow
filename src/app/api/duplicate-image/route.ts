// src/app/api/duplicate-image/route.ts
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";

/* ============== helpers ============== */
const randHex = (n = 2) => crypto.randomBytes(n).toString("hex");
const toBool = (v: FormDataEntryValue | null) =>
  v !== null && String(v) !== "false" && String(v) !== "0";
const clampDim = (n: number) => Math.max(32, Math.min(16000, Math.round(n)));

/* ============== flags ============== */
type Flags = { semi: boolean; fundamentals: boolean; visuals: boolean; reverse: boolean };

/* ============== pipeline ============== */
async function processImage(
  buffer: Buffer,
  outPath: string,
  copyIdx: number,
  flags: Flags
) {
  // décodage sûr + meta initiales
  const decoded = await sharp(buffer, { failOn: "none" }).toBuffer({ resolveWithObject: true });
let img = sharp(decoded.data, { failOn: "none" });

// 👉 Reverse (miroir horizontal) si demandé
if (flags.reverse) {
  img = img.flop(); // flop = miroir horizontal (flip = vertical)
}

// taille de base de travail
const baseW = clampDim(decoded.info.width  ?? 1024);
const baseH = clampDim(decoded.info.height ?? 1024);

  /* =========================================================
   * 🧠 BLOC 1 — SEMI-VISUELS (avec léger zoom)
   *   - Kernel randomisé
   *   - Micro-crop sécurisé
   *   - Double resample énergique (0.8–1.2 / 0.85–1.15)
   *   - LÉGER ZOOM final (1.05–1.10x)
   *   - [#1] Overlay bruit très faible (1.5–2.5 %)
   *   - [#5] Micro-jitter sub-pixel (±0.35 px)
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

    const semiW = baseW;
    const semiH = baseH;
    const mMax = Math.floor(Math.min(semiW, semiH) * 0.02);
    const L = Math.floor(Math.random() * (mMax + 1));
    const T = Math.floor(Math.random() * (mMax + 1));
    const R = Math.floor(Math.random() * (mMax + 1));
    const B = Math.floor(Math.random() * (mMax + 1));
    const rawCropW = clampDim(semiW - (L + R));
    const rawCropH = clampDim(semiH - (T + B));
    const safeLeft   = Math.max(0, Math.min(L, semiW - 16));
    const safeTop    = Math.max(0, Math.min(T, semiH - 16));
    const safeWidth  = Math.max(16, Math.min(rawCropW, semiW - safeLeft));
    const safeHeight = Math.max(16, Math.min(rawCropH, semiH - safeTop));

    img = img
      .resize(semiW, semiH, { fit: "fill", kernel: kernelA })
      .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight });

    const cur = await img.metadata();
    const cw = clampDim(cur.width  ?? semiW);
    const ch = clampDim(cur.height ?? semiH);

    // Single high-quality resize back to original dimensions to avoid multi-pass degradation
    img = img.resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.lanczos3 });

    // === [#5] Micro-jitter sub-pixel (à appliquer en DERNIER du bloc 1)
// But : décale l'image de ±0.6 px pour casser l'alignement exact des détecteurs.
// Effet visuel : nul / imperceptible.
{
  // amplitude très légère mais suffisante pour les perceptual-hash
  const jx = (Math.random() - 0.5) * 1.2;   // −0.6 .. +0.6 px
  const jy = (Math.random() - 0.5) * 1.2;   // −0.6 .. +0.6 px

  
img = img.affine(
  [[1, 0], [0, 1]], // matrice identité (translation pure)
  {
    // @ts-ignore
    translate: [jx, jy],
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    interpolate: "bicubic",
  }
);
}
  }

  /* =========================================================
   * 🎨 BLOC 3 — VISUELS (légers)
   *   - Luminosité / Saturation / Contraste (±20%)
   *   - Gamma 1.0–2.5
   *   - Hue shift / Tint légers
   *   - Micro-sharpen / Local contrast / Micro-blur
   *   - [#2] Détail “unsharp” très léger
   * ========================================================= */
  if (flags.visuals) {
    const brightness = 0.80 + Math.random() * 0.40; // ±20 %
    const saturation = 0.80 + Math.random() * 0.40;
    const gamma = 1.0 + Math.random() * 1.5;        // 1.0..2.5
    const hue = Math.floor((Math.random() - 0.5) * 6); // −3..+3

    img = img.modulate({ brightness, saturation, hue }).gamma(gamma);

    const contrast = 0.85 + Math.random() * 0.30; // ±15–20 %
    img = img.linear(contrast, 0);

    const vib = 1.00 + Math.random() * 0.06; // vibrance douce
    img = img.modulate({ saturation: vib });

    // micro-sharpen / local contrast
    const sigma = 0.6 + Math.random() * 0.4; // 0.6..1.0
    img = img.sharpen(sigma, 0.7, 0.7);

    // [#2] unsharp-like addition très légère (2e passe très faible)
    img = img.sharpen(0.8, 0.3, 0.3);

    // micro-blur optionnel
    if (Math.random() < 0.5) img = img.blur(0.3);
  }

  /* =========================================================
   * 🧱 BLOC 2 — FONDAMENTAUX (non visuels)
   *   - Qualité / chroma / progressif
   *   - ICC sRGB + density
   *   - EXIF + XMP + commentaires internes
   * ========================================================= */
  const lower = outPath.toLowerCase();
  const now = new Date();
  const artistChoices = ["DuupFlow", "Studio", "Duplicator", "ContentEngine"];
  const artist = flags.fundamentals
    ? artistChoices[Math.floor(Math.random() * artistChoices.length)]
    : "DuupFlow";
  const dpi = flags.fundamentals ? [72, 96, 150, 300][Math.floor(Math.random() * 4)] : 72;

  const exifMeta: sharp.WriteableMetadata = {
    icc: "sRGB IEC61966-2.1",
    density: dpi,
    exif: {
      IFD0: {
        Software: `DuupFlow/${randHex(2)}`,
        Artist: artist,
        Copyright: `DuupFlow ${now.getFullYear()}`,
      },
    },
  };

  if (lower.endsWith(".png")) {
    // Never use palette mode — it degrades photos to 256 colors
    const compressionLevel = flags.fundamentals ? (5 + Math.floor(Math.random() * 3)) : 6; // 5–7, vary for uniqueness
    await img.withMetadata(exifMeta).png({ compressionLevel, adaptiveFiltering: true }).toFile(outPath);
  } else if (lower.endsWith(".webp")) {
    const quality = flags.fundamentals ? (88 + Math.floor(Math.random() * 7)) : 92; // 88–94, high quality
    const effort  = flags.fundamentals ? (4 + Math.floor(Math.random() * 3)) : 4;
    await img.withMetadata(exifMeta).webp({ quality, effort, smartSubsample: true }).toFile(outPath);
  } else {
    const chroma = flags.fundamentals ? (Math.random() < 0.5 ? "4:2:0" : "4:4:4") : "4:4:4";
    const progressive = flags.fundamentals ? Math.random() < 0.5 : false;
    const quality = flags.fundamentals ? (88 + Math.floor(Math.random() * 7)) : 92; // 88–94, high quality

    await img.withMetadata(exifMeta).jpeg({
      quality,
      progressive,
      chromaSubsampling: chroma as "4:2:0" | "4:4:4",
      mozjpeg: true,
      optimiseCoding: true,
      trellisQuantisation: flags.fundamentals,
      overshootDeringing: true,
      quantizationTable: flags.fundamentals ? (1 + Math.floor(Math.random() * 3)) : 0,
    }).toFile(outPath);
  }
}

/* ============== handler ============== */
export async function POST(req: Request) {
  try {
    const { dir: outDir } = await getOutDirForCurrentUser();
    await fs.mkdir(outDir, { recursive: true });

    const form = await req.formData();
    const files = form.getAll("files") as File[];
    if (!files.length) {
      return NextResponse.json({ ok: false, error: "Aucune image reçue." }, { status: 400 });
    }

    const count = Math.max(1, Number(form.get("count") ?? 1));
    const flags: Flags = {
  fundamentals: toBool(form.get("fundamentals")),
  visuals: toBool(form.get("visuals")),
  semi: toBool(form.get("semivisuals")) || toBool(form.get("semi")),
  reverse: toBool(form.get("reverse")),  // 👈 AJOUT
};

    const brand = Math.random() < 0.5 ? "DuupFlow" : "DuupFlow";
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");

    for (const f of files) {
      if (!f.type?.startsWith("image/")) continue;

      const buf = Buffer.from(await f.arrayBuffer());
      const dot = f.name.lastIndexOf(".");
      const ext = (dot >= 0 ? f.name.slice(dot) : ".jpg").toLowerCase();

      for (let i = 1; i <= count; i++) {
        const rand = String(Math.floor(Math.random() * 90) + 10);
        const name = `${brand}_${y}${m}${d}_dup${i}_${rand}${ext}`;
        const outPath = path.join(outDir, name);
        await processImage(buf, outPath, i, flags);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erreur API" }, { status: 500 });
  }
}