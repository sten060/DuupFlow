// GET /api/ai-editor/variant/zip?projectId=…&ids=a,b,c
// Zippe plusieurs variantes du user connecté et renvoie l'archive en flux (download).
// Auth : ne sert QUE les fichiers du user (chemins construits depuis son id).

import { NextRequest, NextResponse } from "next/server";
import fsSync from "fs";
import path from "path";
import { Readable } from "stream";
import archiver from "archiver";
import { createClient } from "@/lib/supabase/server";
import { getProject, projectPaths } from "@/lib/ai-editor/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId") || "";
  const ids = (req.nextUrl.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!projectId || !ids.length) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });

  const project = await getProject(user.id, projectId);
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const vd = projectPaths(user.id, projectId).variantsDir;
  const wanted = new Set(ids);
  // On garde l'ordre des variantes du projet, on filtre sur les ids demandés.
  const picked = project.variants.filter((v) => wanted.has(v.id));
  if (!picked.length) return NextResponse.json({ error: "Aucune variante valide." }, { status: 404 });

  const archive = archiver("zip", { zlib: { level: 0 } }); // mp4 déjà compressé → store (rapide)
  const used = new Set<string>();
  let added = 0;
  for (const v of picked) {
    const fp = path.join(vd, v.storedName);
    if (!fp.startsWith(vd)) continue; // garde path-traversal
    if (!fsSync.existsSync(fp)) continue; // fichier expiré/absent → on saute
    // Nom lisible + unique dans l'archive.
    const base = (v.label || `variante-${v.id}`).replace(/[^\w\-. À-ÿ]/g, "").trim() || `variante-${v.id}`;
    let name = `${base}.mp4`;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${base} (${n++}).mp4`;
    used.add(name.toLowerCase());
    archive.file(fp, { name });
    added++;
  }
  if (!added) return NextResponse.json({ error: "Fichiers introuvables (expirés ?)." }, { status: 404 });

  void archive.finalize(); // stream : ne pas await (le corps est consommé au fil de l'eau)

  const filename = `duupflow-variantes-${added}.zip`;
  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
