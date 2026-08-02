// POST /api/ai-editor/analyze
// Référence (multipart "file" OU JSON { url }) → analyse (keyframes + transcript
// + rythme + méta) + recette virale (best-effort, studio) → CRÉE et PERSISTE un
// projet (réf copiée + analyse) → renvoie { projectId, analysis }.

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { analyzeReferenceVideo } from "@/lib/ai-editor/analyze";
import { downloadReference } from "@/lib/ai-editor/download";
import { createProject, saveReference } from "@/lib/ai-editor/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 300 * 1024 * 1024; // 300 Mo

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";

  // ── Résolution de la source → fichier temporaire à analyser ─────────────────
  let srcPath: string;
  let ext = ".mp4";
  let source: "file" | "url" = "file";
  let label = "";
  let cleanupDir: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "Lien manquant." }, { status: 400 });
    const dl = await downloadReference(url);
    if ("error" in dl) return NextResponse.json({ error: dl.error }, { status: 400 });
    srcPath = dl.path; cleanupDir = dl.dir; source = "url"; label = url; ext = ".mp4";
  } else {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Fichier de référence manquant." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Fichier trop lourd (max 300 Mo)." }, { status: 413 });
    cleanupDir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_aref_"));
    ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".mp4";
    srcPath = path.join(cleanupDir, `ref${ext}`);
    await fs.writeFile(srcPath, Buffer.from(await file.arrayBuffer()));
    source = "file"; label = file.name;
  }

  try {
    const analysis = await analyzeReferenceVideo(srcPath);

    // Persistance : nouveau projet + réf copiée + analyse. (Pas de recette
    // serveur : le Claude du user lit les keyframes lui-même via le MCP.)
    const project = await createProject(user.id);
    await saveReference(user.id, project.id, { srcPath, ext, source, label, analysis });

    return NextResponse.json({ projectId: project.id, analysis });
  } catch (e) {
    console.error("[ai-editor/analyze] échec:", e);
    return NextResponse.json({ error: `Analyse échouée : ${(e as Error)?.message?.slice(0, 160) ?? "inconnue"}` }, { status: 500 });
  } finally {
    if (cleanupDir) await fs.rm(cleanupDir, { recursive: true, force: true }).catch(() => {});
  }
}
