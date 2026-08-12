// /api/ai-editor/material
//   POST   (multipart: projectId, file, desc?)  → ajoute + analyse + persiste
//   PATCH  (JSON: projectId, materialId, desc)   → met à jour la description
//   DELETE (JSON: projectId, materialId)         → retire le fichier

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { analyzeMaterial, probeDurationSec } from "@/lib/ai-editor/analyze";
import { prepareSdrProxy } from "@/lib/ai-editor/render";
import { addMaterial, updateMaterialDesc, removeMaterial, updateMaterialAnalysis, materialAbsPath } from "@/lib/ai-editor/store";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_BYTES = 300 * 1024 * 1024;
// Plafonds de durée (grâce de 3 s pour l'arrondi) : vidéo 2 min, audio seul 4 min.
const MAT_VIDEO_MAX_SEC = 120;
const MAT_AUDIO_MAX_SEC = 240;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  return user;
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const projectId = String(form?.get("projectId") || "");
  const desc = String(form?.get("desc") || "");
  const file = form?.get("file");
  if (!projectId) return NextResponse.json({ error: "Projet manquant." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Fichier trop lourd (max 300 Mo)." }, { status: 413 });

  const kind: "video" | "image" | "audio" =
    file.type.startsWith("image") ? "image"
    : file.type.startsWith("audio") || /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(file.name) ? "audio"
    : "video";
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_amat_"));
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] || (kind === "image" ? ".jpg" : kind === "audio" ? ".mp3" : ".mp4");
  const tmp = path.join(dir, `mat${ext}`);
  try {
    await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));

    // Garde de durée (vidéo 2 min, audio 4 min) — AVANT toute analyse coûteuse.
    if (kind !== "image") {
      const dur = await probeDurationSec(tmp).catch(() => 0);
      const cap = kind === "audio" ? MAT_AUDIO_MAX_SEC : MAT_VIDEO_MAX_SEC;
      if (dur > cap + 3) {
        const mm = Math.floor(cap / 60);
        return NextResponse.json({ error: `Fichier trop long (${Math.round(dur)} s). Maximum ${mm} min pour ${kind === "audio" ? "un audio" : "une vidéo"}.` }, { status: 413 });
      }
    }

    if (kind === "image") {
      // Image : analyse rapide (vignette/dims) → inline, comme avant.
      const analysis = await analyzeMaterial(tmp, file.type).catch((e) => { console.error("[ai-editor/material] analyse image KO:", (e as Error)?.message); return null; });
      const material = await addMaterial(user.id, projectId, { srcPath: tmp, ext, name: file.name, kind, desc, analysis, status: analysis ? "ready" : "failed" });
      if (!material) return NextResponse.json({ error: "Projet introuvable ou copie échouée." }, { status: 500 });
      return NextResponse.json({ material });
    }

    // Audio / vidéo : analyse LONGUE (transcription, beats, drops). On persiste TOUT
    // DE SUITE (status "analyzing") pour que list_material le voie immédiatement, puis
    // on analyse en tâche de fond et on met à jour le statut → plus de fichier « qui
    // n'existe pas » puis apparaît, et plus d'id qui change.
    const material = await addMaterial(user.id, projectId, { srcPath: tmp, ext, name: file.name, kind, desc, analysis: null, status: "analyzing" });
    if (!material) return NextResponse.json({ error: "Projet introuvable ou copie échouée." }, { status: 500 });
    const absPath = materialAbsPath(user.id, projectId, material.storedName); // fichier déjà persisté
    void (async () => {
      try {
        const analysis = await analyzeMaterial(absPath, file.type);
        await updateMaterialAnalysis(user.id, projectId, material.id, analysis, "ready");
        console.log(`[ai-editor/material] analyse terminée : ${file.name} (id ${material.id})`);
        // Rush HDR (iPhone) → version SDR préparée MAINTENANT, pendant que le user
        // fait autre chose. Sans ça, la conversion (plusieurs minutes sur de la 4K)
        // se paie au premier montage, Claude attendant devant. Best-effort : le
        // rendu sait la refaire si elle manque.
        if (kind === "video") await prepareSdrProxy(absPath);
      } catch (e) {
        console.error(`[ai-editor/material] analyse échouée : ${file.name} (id ${material.id})`, e);
        await updateMaterialAnalysis(user.id, projectId, material.id, null, "failed");
      }
    })().catch((e) => console.error(`[ai-editor/material] tâche de fond en échec dur : ${file.name}`, e)); // garde ultime : jamais d'unhandled rejection
    return NextResponse.json({ material });
  } catch (e) {
    console.error("[ai-editor/material] POST échec:", e);
    return NextResponse.json({ error: `Ajout échoué : ${(e as Error)?.message?.slice(0, 160) ?? "inconnue"}` }, { status: 500 });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const { projectId, materialId, desc } = body || {};
  if (!projectId || !materialId) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  const ok = await updateMaterialDesc(user.id, String(projectId), String(materialId), String(desc ?? ""));
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Introuvable." }, { status: 404 });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const { projectId, materialId } = body || {};
  if (!projectId || !materialId) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  const ok = await removeMaterial(user.id, String(projectId), String(materialId));
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Introuvable." }, { status: 404 });
}
