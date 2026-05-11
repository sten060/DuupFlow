import os from "os";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

// Guard: only alphanumeric, dash, underscore, dot, space — prevents path traversal
function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._\- ]/g, "_").slice(0, 200);
}

const HEIC_RE = /\.(heic|heif)$/i;

// HEIC magic-byte detection — covers files mislabeled by the browser
// (e.g. uploaded as application/octet-stream). The HEIC/HEIF brand
// identifier ("ftyp" + heic/heix/mif1/msf1/heim/heis/hevc/...) sits
// in bytes 4-12 of the container.
function looksLikeHeic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.slice(4, 8).toString("ascii") !== "ftyp") return false;
  const brand = buf.slice(8, 12).toString("ascii");
  return /^(heic|heix|heim|heis|hevc|hevx|mif1|msf1|avif)$/.test(brand);
}

/**
 * Convert a HEIC/HEIF buffer to JPEG using libheif-js (via heic-convert).
 *
 * Why server-side and not heic2any in the browser:
 *  • heic2any drops the ICC profile and mishandles the Display P3 → sRGB
 *    transform → output JPEG looks brighter / more saturated than the
 *    iPhone original.
 *  • heic-convert (Node) uses a newer libheif-js build, preserves EXIF
 *    and the embedded color profile, and tone-maps HDR gain maps cleanly.
 *  • libheif-js bundles libde265 in WASM, so no Railway system deps.
 */
async function convertHeicBufferToJpeg(buf: Buffer): Promise<Buffer> {
  // Dynamic import — heic-convert pulls a ~3 MB WASM blob; we only want
  // it loaded when we actually have a HEIC to process.
  const { default: convert } = await import("heic-convert");
  const out = await convert({
    buffer: buf,
    format: "JPEG",
    quality: 0.95, // near-lossless; sharp re-encodes downstream anyway
  });
  return Buffer.from(out);
}

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!req.body) {
    return NextResponse.json({ error: "Corps de la requête manquant" }, { status: 400 });
  }

  const rawFileName = safeName(req.nextUrl.searchParams.get("fileName") || "upload.bin");

  try {
    // Use arrayBuffer() instead of Readable.fromWeb() — avoids the Node.js
    // TransformStream bug (controller[kState].transformAlgorithm is not a function)
    // that crashes under concurrent parallel uploads.
    let buffer = Buffer.from(await req.arrayBuffer());
    console.log(`[upload-direct] received ${buffer.length} bytes for "${rawFileName}"`);
    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "Fichier reçu vide (0 octet) — vérifiez la taille du fichier ou la connexion." },
        { status: 400 }
      );
    }

    // HEIC → JPEG conversion (server-side, preserves color profile)
    let finalName = rawFileName;
    if (HEIC_RE.test(rawFileName) || looksLikeHeic(buffer)) {
      const t0 = Date.now();
      try {
        buffer = await convertHeicBufferToJpeg(buffer);
        finalName = rawFileName.replace(HEIC_RE, "") + ".jpg";
        console.log(`[upload-direct] HEIC→JPEG done for "${rawFileName}" in ${Date.now() - t0}ms (${buffer.length} bytes)`);
      } catch (heicErr: any) {
        console.error(`[upload-direct] HEIC conversion failed for "${rawFileName}":`, heicErr?.message);
        return NextResponse.json(
          { error: `Impossible de décoder le HEIC "${rawFileName}" — convertissez-le en JPEG manuellement.` },
          { status: 422 }
        );
      }
    }

    const ext = path.extname(finalName) || ".bin";
    const uploadId = `duup_direct_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const tmpPath = path.join(os.tmpdir(), uploadId);
    await fs.writeFile(tmpPath, buffer);
    return NextResponse.json({ uploadId, name: finalName });
  } catch (e: any) {
    return NextResponse.json({ error: `Erreur écriture : ${e.message}` }, { status: 500 });
  }
}
