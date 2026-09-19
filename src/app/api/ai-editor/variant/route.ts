// GET /api/ai-editor/variant?projectId=…&id=…[&dl=1]
// Sert le mp4 d'une variante (aperçu inline, ou téléchargement avec dl=1).
// Auth : ne sert QUE les fichiers du user connecté (chemin construit depuis son id).

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getProject, projectPaths, removeVariant } from "@/lib/ai-editor/store";
import { cleanFileName } from "@/lib/ai-editor/file-name";

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

  // Le fichier téléchargé porte le nom AFFICHÉ dans la galerie — même règle que
  // l'archive zip et l'envoi Drive (accents et espaces conservés, seuls les
  // caractères interdits d'un nom de fichier sont retirés). Sans label (vieilles
  // variantes) → « variante-N », N étant la position affichée dans la galerie —
  // jamais l'identifiant technique, illisible pour le user.
  const idx = project!.variants.findIndex((v) => v.id === id);
  const base = cleanFileName(variant.label || "") || `variante-${idx + 1}`;
  const safeName = `${base}.mp4`;
  // filename* (UTF-8) porte le vrai nom ; filename reste un repli ASCII pour les
  // vieux clients qui ignorent la forme encodée.
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  const disposition = `${download ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
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
        "Cache-Control": "private, max-age=86400, immutable",
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
      // Immuable : un rendu produit un nouvel id, jamais un nouveau contenu sous
      // le même. Sans ça, l'aperçu au survol re-téléchargeait le fichier entier
      // dès que 60 s s'étaient écoulées — de la bande passante Railway pure.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}

// DELETE /api/ai-editor/variant  (JSON { projectId, id }) → supprime une variante.
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const projectId = String(body?.projectId || "");
  const id = String(body?.id || "");
  if (!projectId || !id) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });

  const ok = await removeVariant(user.id, projectId, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Variante introuvable." }, { status: 404 });
}
