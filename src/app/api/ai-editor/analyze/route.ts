// POST /api/ai-editor/analyze
// Référence (multipart "file" OU JSON { url }) → analyse (keyframes + transcript
// + rythme + méta) + recette virale (best-effort, studio) → CRÉE et PERSISTE un
// projet (réf copiée + analyse) → renvoie { projectId, analysis }.

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { analyzeReferenceVideo, probeDurationSec } from "@/lib/ai-editor/analyze";
import { downloadReference } from "@/lib/ai-editor/download";
import { createProject, saveReference, getProject, updateReferenceAnalysis, referenceAbsPath } from "@/lib/ai-editor/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 300 * 1024 * 1024; // 300 Mo
const REF_MAX_SEC = 120; // référence : 2 min max (+3 s de grâce pour l'arrondi)

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";

  // ── Mode RÉ-ANALYSE : { projectId, reanalyze:true } → régénère le profil de la
  //    référence DÉJÀ stockée (sans ré-upload). Sert à « débloquer » un profil figé
  //    à l'import (ex. avant l'ajout de la couche compréhension Gemini). ───────────
  if (contentType.includes("application/json")) {
    const peek = await req.clone().json().catch(() => null);
    if (peek?.reanalyze === true) {
      const projectId = typeof peek?.projectId === "string" ? peek.projectId.trim() : "";
      const project = projectId ? await getProject(user.id, projectId) : null;
      if (!project?.reference) return NextResponse.json({ error: "Aucune référence à ré-analyser." }, { status: 404 });
      const refPath = referenceAbsPath(user.id, projectId, project.reference.storedName);
      try {
        const analysis = await analyzeReferenceVideo(refPath);
        await updateReferenceAnalysis(user.id, projectId, analysis);
        return NextResponse.json({ projectId, analysis });
      } catch (e) {
        console.error("[ai-editor/analyze] ré-analyse échouée:", e);
        return NextResponse.json({ error: `Ré-analyse échouée : ${(e as Error)?.message?.slice(0, 160) ?? "inconnue"}` }, { status: 500 });
      }
    }
  }

  // ── Résolution de la source → fichier temporaire à analyser ─────────────────
  let srcPath: string;
  let ext = ".mp4";
  let source: "file" | "url" = "file";
  let label = "";
  let cleanupDir: string | null = null;
  // projectId fourni = REMPLACER la référence d'un projet existant (la matière et
  // les variantes sont conservées). Absent = nouveau projet.
  let replaceProjectId = "";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "Lien manquant." }, { status: 400 });
    replaceProjectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    const dl = await downloadReference(url);
    if ("error" in dl) return NextResponse.json({ error: dl.error }, { status: 400 });
    srcPath = dl.path; cleanupDir = dl.dir; source = "url"; label = url; ext = ".mp4";
  } else {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    replaceProjectId = String(form?.get("projectId") || "");
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
    // Garde de durée : une référence short-form fait < 2 min. On rejette AVANT
    // l'analyse (Gemini + transcription) — inutile et coûteux au-delà.
    const refDur = await probeDurationSec(srcPath).catch(() => 0);
    if (refDur > REF_MAX_SEC + 3) {
      return NextResponse.json({ error: `Référence trop longue (${Math.round(refDur)} s). Maximum 2 min.` }, { status: 413 });
    }

    const analysis = await analyzeReferenceVideo(srcPath);

    // Persistance : soit on remplace la réf d'un projet existant (matière gardée),
    // soit on crée un nouveau projet. (Pas de recette serveur : le Claude du user
    // lit les keyframes lui-même via le MCP.)
    let pid = "";
    if (replaceProjectId && (await getProject(user.id, replaceProjectId))) {
      pid = replaceProjectId;
    } else {
      pid = (await createProject(user.id)).id;
    }
    await saveReference(user.id, pid, { srcPath, ext, source, label, analysis });

    return NextResponse.json({ projectId: pid, analysis });
  } catch (e) {
    console.error("[ai-editor/analyze] échec:", e);
    return NextResponse.json({ error: `Analyse échouée : ${(e as Error)?.message?.slice(0, 160) ?? "inconnue"}` }, { status: 500 });
  } finally {
    if (cleanupDir) await fs.rm(cleanupDir, { recursive: true, force: true }).catch(() => {});
  }
}
