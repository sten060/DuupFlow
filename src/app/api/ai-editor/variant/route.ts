// GET /api/ai-editor/variant?projectId=…&id=…[&dl=1]
// Sert le mp4 d'une variante (aperçu inline, ou téléchargement avec dl=1).
// Auth : ne sert QUE les fichiers du user connecté (chemin construit depuis son id).

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getProject, projectPaths } from "@/lib/ai-editor/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  const download = req.nextUrl.searchParams.get("dl") === "1";
  if (!projectId || !id) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });

  const project = await getProject(user.id, projectId);
  const variant = project?.variants.find((v) => v.id === id);
  if (!variant) return NextResponse.json({ error: "Variante introuvable." }, { status: 404 });

  const filePath = path.join(projectPaths(user.id, projectId).variantsDir, variant.storedName);
  // Garde-fou path-traversal : storedName vient du store (rid()+".mp4"), mais on
  // vérifie que le chemin résolu reste bien dans le dossier variants.
  if (!filePath.startsWith(projectPaths(user.id, projectId).variantsDir)) {
    return NextResponse.json({ error: "Chemin invalide." }, { status: 400 });
  }

  let buf: Buffer;
  try { buf = await fs.readFile(filePath); } catch { return NextResponse.json({ error: "Fichier absent." }, { status: 404 }); }

  const safeName = (variant.label ? variant.label.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40) : `variante_${id}`) + ".mp4";
  const disposition = `${download ? "attachment" : "inline"}; filename="${safeName}"`;
  const total = buf.length;

  // Support des requêtes Range (206) → lecture + seek robustes (Safari inclus).
  const range = req.headers.get("range");
  const m = range?.match(/bytes=(\d+)-(\d*)/);
  if (m) {
    const start = Math.min(parseInt(m[1], 10) || 0, total - 1);
    const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
    const chunk = buf.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunk.length),
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=60",
    },
  });
}
