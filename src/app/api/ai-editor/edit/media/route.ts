// GET /api/ai-editor/edit/media?projectId=…&materialId=…
// Sert un fichier de MATIÈRE au lecteur d'aperçu de l'éditeur manuel.
// Pour une vidéo, on sert le proxy SDR/allégé s'il existe (fabriqué à l'upload) :
// plus léger ET fidèle aux couleurs du rendu (un original HDR s'affiche faux).
// Auth : uniquement les fichiers du user connecté (chemin construit depuis son id).
//
// Contrairement à la route variante (mp4 courts), une matière peut peser 300 Mo :
// on lit UNIQUEMENT la plage demandée (Range) — jamais le fichier entier en RAM.

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getProject, materialAbsPath } from "@/lib/ai-editor/store";
import { existingViewingProxy } from "@/lib/ai-editor/render";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg", ".flac": "audio/flac",
};

// Taille max servie d'un coup sans Range (les lecteurs envoient toujours des
// Range sur la vidéo ; ce plafond ne concerne que les images/audios).
const CHUNK_MAX = 8 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId") || "";
  const materialId = req.nextUrl.searchParams.get("materialId") || "";
  if (!projectId || !materialId) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });

  const project = await getProject(user.id, projectId);
  const material = project?.materials.find((m) => m.id === materialId);
  if (!material) return NextResponse.json({ error: "Matière introuvable." }, { status: 404 });

  const original = materialAbsPath(user.id, projectId, material.storedName);
  // Garde path-traversal (storedName vient du store, mais on verrouille quand même).
  const materialDir = path.dirname(original);
  if (!path.resolve(original).startsWith(path.resolve(materialDir))) {
    return NextResponse.json({ error: "Chemin invalide." }, { status: 400 });
  }
  // Vidéo → proxy de visionnage si déjà fabriqué (jamais fabriqué à la demande).
  const served = material.kind === "video" ? await existingViewingProxy(original) : original;

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try { stat = await fs.stat(served); } catch { return NextResponse.json({ error: "Fichier absent." }, { status: 404 }); }
  const total = stat.size;
  const type = MIME[path.extname(served).toLowerCase()] ?? "application/octet-stream";

  // Plage demandée (lecture/seek vidéo). Sans Range : le début du fichier,
  // plafonné — le navigateur revient chercher la suite en 206.
  const m = req.headers.get("range")?.match(/bytes=(\d+)-(\d*)/);
  const start = m ? Math.min(parseInt(m[1], 10) || 0, total - 1) : 0;
  const end = m?.[2] ? Math.min(parseInt(m[2], 10), total - 1) : Math.min(start + CHUNK_MAX - 1, total - 1);

  const fh = await fs.open(served, "r");
  try {
    const len = end - start + 1;
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, start);
    const partial = m != null || end < total - 1;
    return new NextResponse(new Uint8Array(buf), {
      status: partial ? 206 : 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(len),
        "Accept-Ranges": "bytes",
        ...(partial ? { "Content-Range": `bytes ${start}-${end}/${total}` } : {}),
        // Immuable côté user : une matière remplacée change d'id.
        "Cache-Control": "private, max-age=86400, immutable",
      },
    });
  } finally {
    await fh.close().catch(() => {});
  }
}
