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

    // CROP ASYMÉTRIQUE FORCÉ : grand L+T, petit R+B → décalage net 8–18% du contenu
    // Sans asymétrie, un zoom centré préserve les gradients locaux → dHash/pHash insensibles
    // Avec 14% de décalage net à 32×32 (pHash) = 4.5px shift → 15–25 bits flippent
    const bigPct  = 0.08 + Math.random() * 0.12;  // 8–20% côté grand
    const smallPct = Math.random() * 0.03;          // 0–3% côté petit
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
    // ── 1. Per-channel linear asymétrique → Moments couleurs + Chroma + RGB
    // Canaux shifts indépendants (directions opposées) → change µ, σ, skewness par canal
    const rA = 1.010 + (Math.random() - 0.5) * 0.060;  // 0.980–1.040
    const gA = 0.975 + (Math.random() - 0.5) * 0.060;  // 0.945–1.005
    const bA = 1.000 + (Math.random() - 0.5) * 0.080;  // 0.960–1.040
    const rB = Math.round((Math.random() - 0.5) * 14);  // ±7 niveaux
    const gB = Math.round((Math.random() - 0.5) * 10);  // ±5
    const bB = Math.round((Math.random() - 0.5) * 18);  // ±9
    img = img.linear([rA, gA, bA], [rB, gB, bB]);

    // ── 2. HSL global + contrast → Luminance histo + Chroma + RGB
    const brightness = 0.930 + Math.random() * 0.140;  // ±7% (était ±3.5%)
    const saturation = 0.920 + Math.random() * 0.160;  // ±8% (était ±4.5%)
    const gamma      = 0.940 + Math.random() * 0.120;  // ±6% (était ±3.2%)
    const hue        = Math.floor((Math.random() - 0.5) * 20); // ±10°
    img = img.modulate({ brightness, saturation, hue }).gamma(gamma);
    const contrast = 0.930 + Math.random() * 0.140;    // ±7% (était ±3.5%)
    img = img.linear(contrast, 0);

    // ── 3. Vignette radiale subtile (3-6%) → Grille spatiale + Profils projection
    // Généré à 128×128 avec cubic upscale = dégradé lisse, pas de blocs visibles
    const vigSize = 128;
    const vigBuf = Buffer.alloc(vigSize * vigSize);
    const vcx = vigSize / 2, vcy = vigSize / 2;
    const vmaxR = Math.sqrt(vcx * vcx + vcy * vcy);
    const vigStrength = 0.030 + Math.random() * 0.030;  // 3–6% assombrissement coins
    for (let vy = 0; vy < vigSize; vy++) {
      for (let vx = 0; vx < vigSize; vx++) {
        const dist = Math.sqrt((vx - vcx) ** 2 + (vy - vcy) ** 2) / vmaxR;
        vigBuf[vy * vigSize + vx] = Math.round(255 * (1 - vigStrength * dist * dist));
      }
    }
    const vigPng = await sharp(vigBuf, { raw: { width: vigSize, height: vigSize, channels: 1 } })
      .resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.cubic })
      .png()
      .toBuffer();
    img = img.composite([{ input: vigPng, blend: "multiply" } as sharp.OverlayOptions]).removeAlpha();

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
    // Teinte asymétrique ±6° → Chroma Cb/Cr
    const tintHue = Math.floor(3 + Math.random() * 3) * (Math.random() < 0.5 ? 1 : -1); // ±3–6°
    img = img.modulate({ hue: tintHue });
    // Blur supprimé : trop visible sur les portraits
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
    const quality = flags.fundamentals ? (50 + Math.floor(Math.random() * 18)) : 88; // 50–68
    return {
      data: await img.withMetadata(exifMeta).webp({ quality, smartSubsample: true }).toBuffer(),
      outExt: ".webp",
    };
  }

  // 4:2:0 always quand fundamentals → affecte Chroma Cb/Cr significativement
  const chroma = flags.fundamentals ? "4:2:0" : "4:4:4";
  const progressive = flags.fundamentals ? Math.random() < 0.5 : false;
  // Qualité 50–68 quand fundamentals → artifacts blocs 8×8 → Gradients + MSE (était 65–80)
  const quality = flags.fundamentals ? (50 + Math.floor(Math.random() * 18)) : 88; // 50–68

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
