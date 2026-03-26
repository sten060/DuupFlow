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
    const kernelB = kernels[Math.floor(Math.random() * kernels.length)];

    // CROP ASYMÉTRIQUE FORCÉ : grand L+T, petit R+B → décalage net 4–10% du contenu
    // Réduit depuis 8–20% pour un recadrage plus subtil tout en restant détectable
    const bigPct  = 0.02 + Math.random() * 0.03;  // 2–5% côté grand
    const smallPct = Math.random() * 0.01;          // 0–1% côté petit
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
      .resize(baseW, baseH, { fit: "fill", kernel: kernelA })
      .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
      .resize(baseW, baseH, { fit: "fill", kernel: kernelB });
  }

  if (flags.visuals) {
    // ── 1. HSL global — très subtil, imperceptible à l'œil mais détectable par les métriques
    // Brightness ±1% max pour éviter l'effet "éclairci/assombri" visible
    const bDir = Math.random() < 0.5 ? -1 : 1;
    const brightness = 1.0 + bDir * (0.005 + Math.random() * 0.008);  // ±0.5–1.3%
    // Saturation légère — change les métriques chroma sans altérer les couleurs perceptiblement
    const sDir = Math.random() < 0.5 ? -1 : 1;
    const saturation = 1.0 + sDir * (0.01 + Math.random() * 0.02);    // ±1–3%
    // Gamma très proche de 1.0 — évite tout effet de luminosité global visible
    const gammaFinal = 1.0 + Math.random() * 0.015;                    // 1.00–1.015
    // Hue minime — légère rotation de teinte imperceptible
    const hue = (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * 2); // 0 ou ±1°
    img = img.modulate({ brightness, saturation, hue }).gamma(gammaFinal);
    // Contraste très léger
    const cDir = Math.random() < 0.5 ? -1 : 1;
    const contrast = 1.0 + cDir * (0.01 + Math.random() * 0.015);     // ±1–2.5%
    img = img.linear(contrast, 0);

    // ── 3. Gradient de luminosité directionnel → SSIM (terme luminance locale par bloc 8×8)
    // Principe : un changement uniforme (brightness global) préserve σxy (covariance SSIM).
    // Un gradient spatial crée des µ différents dans chaque bloc 8×8 → SSIM chute réellement.
    // Visuellement : ressemble à un angle d'éclairage différent (naturel, pas un artefact).
    const gSize = 8; // 8×8 points de contrôle → gradient smooth sans blocs visibles
    const gradBuf = Buffer.alloc(gSize * gSize);
    // Direction aléatoire (angle quelconque) + amplitude 8-16%
    const gradAngle = Math.random() * Math.PI * 2;
    const gradDx = Math.cos(gradAngle);
    const gradDy = Math.sin(gradAngle);
    const gradAmp = 0.005 + Math.random() * 0.008;  // 0.5–1.3% de variation lumineuse
    for (let gy = 0; gy < gSize; gy++) {
      for (let gx = 0; gx < gSize; gx++) {
        const nx = (gx / (gSize - 1)) * 2 - 1; // -1 à +1
        const ny = (gy / (gSize - 1)) * 2 - 1;
        const t = gradDx * nx + gradDy * ny;     // projection sur l'axe du gradient
        // Centre à 235 (≈0.92 en multiply) → effet "éclairage directionnel" léger, pas assombrissement global
        gradBuf[gy * gSize + gx] = Math.max(0, Math.min(255, Math.round(248 * (1 + t * gradAmp))));
      }
    }
    const gradPng = await sharp(gradBuf, { raw: { width: gSize, height: gSize, channels: 1 } })
      .resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.cubic })
      .png()
      .toBuffer();
    img = img.composite([{ input: gradPng, blend: "multiply" } as sharp.OverlayOptions]).removeAlpha();

    // ── 4. Zoom 3–4% → pHash + dHash + Grille spatiale + Profils projection
    const zoomFactor = 1.030 + Math.random() * 0.010;  // 3.0–4.0%
    const zW = clampDim(Math.round(baseW * zoomFactor));
    const zH = clampDim(Math.round(baseH * zoomFactor));
    // Crop asymétrique pour maximiser la diversité spatiale
    const cropLeft = Math.floor(Math.random() * (zW - baseW));
    const cropTop  = Math.floor(Math.random() * (zH - baseH));
    img = img
      .resize(zW, zH, { fit: "fill", kernel: sharp.kernel.cubic })
      .extract({ left: cropLeft, top: cropTop, width: baseW, height: baseH });

    // Sharpen supprimé : sigma 1-2 sur 1000px = sigma 0.06-0.13 à l'échelle 64×64
    // → complètement moyenné, invisible aux métriques MAIS visible à l'œil → supprimé
  }

  if (flags.fundamentals) {
    // Teinte asymétrique ±3–8° → Chroma Cb/Cr
    const tintHue = Math.floor(1 + Math.random() * 4) * (Math.random() < 0.5 ? 1 : -1); // ±1–4°
    img = img.modulate({ hue: tintHue });
  }

  const lower = ext.toLowerCase();
  const now = new Date();
  const artistChoices = ["DuupFlow", "Studio", "Duplicator", "ContentEngine", "MediaFlow", "PixelVault"];
  const artist = flags.fundamentals
    ? artistChoices[Math.floor(Math.random() * artistChoices.length)]
    : "DuupFlow";

  // DPI : pool élargi pour maximiser les écarts entre duplications
  const dpiPool = flags.fundamentals ? [72, 96, 120, 150, 180, 240, 300] : [72];
  const dpi = dpiPool[Math.floor(Math.random() * dpiPool.length)];

  // Niveau d'enrichissement EXIF — tiré aléatoirement à chaque duplication.
  // 0 = aucun EXIF (0 octets), 1 = minimal (~300B), 2 = massif (~1500B via ImageDescription longue)
  // Sharp/libexif ignore les tags XP* → seul ImageDescription est garanti d'être écrit.
  // → exifRatio entre deux dups: 0 (niveau 0 vs 2) → pénalité maximale de 40pt
  const exifLevel = flags.fundamentals ? Math.floor(Math.random() * 3) : 1;

  let exifMeta: sharp.WriteableMetadata;

  if (exifLevel === 0) {
    // Aucun EXIF — exif buffer = 0 octets
    exifMeta = { density: dpi };
  } else {
    const ifd0: Record<string, string> = {
      Software: `DuupFlow/${randHex(2)}`,
      Artist: artist,
      Copyright: `DuupFlow ${now.getFullYear()}`,
    };

    if (exifLevel >= 1) {
      const makes  = ["Apple", "Samsung", "Google", "Xiaomi", "Sony", "OnePlus"];
      const models = ["iPhone 15", "Galaxy S24", "Pixel 8", "Redmi 13", "Xperia 5", "Nord 4"];
      const idx = Math.floor(Math.random() * makes.length);
      const hh = String(Math.floor(Math.random() * 24)).padStart(2, "0");
      const mm = String(Math.floor(Math.random() * 60)).padStart(2, "0");
      const ss = String(Math.floor(Math.random() * 60)).padStart(2, "0");
      const mo = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
      const dd = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
      Object.assign(ifd0, {
        Make:             makes[idx],
        Model:            models[idx],
        DateTime:         `${now.getFullYear()}:${mo}:${dd} ${hh}:${mm}:${ss}`,
        ImageDescription: `Photo ${randHex(3)}`,
      });
    }

    if (exifLevel >= 2) {
      // ImageDescription longue (~1200 chars) — seul champ EXIF garanti d'être écrit par sharp/libexif.
      // Crée un écart massif de taille EXIF entre niveau 0 (0B) et niveau 2 (~1500B).
      const chunks = Array.from({ length: 48 }, () => randHex(8));
      ifd0.ImageDescription = `${artist} :: ${now.toISOString()} :: ref=${randHex(8)} :: sig=${chunks.join("-")}`;
    }

    exifMeta = { density: dpi, exif: { IFD0: ifd0 } };
  }

  // Chroma subsampling : 4:2:0 ou 4:1:1 aléatoirement quand fundamentals actif
  // → change la distribution Cb/Cr et la taille fichier
  const chromaOptions: Array<"4:2:0" | "4:4:4"> = ["4:2:0", "4:2:0", "4:4:4"]; // 2/3 → 4:2:0
  const chroma = flags.fundamentals
    ? chromaOptions[Math.floor(Math.random() * chromaOptions.length)]
    : "4:4:4";
  const progressive = flags.fundamentals ? Math.random() < 0.5 : false;

  // Qualité 20–85 (plage très large) → écart de taille fichier maximal entre duplications
  const quality = flags.fundamentals ? (20 + Math.floor(Math.random() * 65)) : 88;

  if (lower === ".webp") {
    return {
      data: await img.withMetadata(exifMeta).webp({ quality, smartSubsample: true }).toBuffer(),
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
