// /api/ai-editor/material
//   POST   (multipart: projectId, file, desc?)  → ajoute + analyse + persiste
//   PATCH  (JSON: projectId, materialId, desc)   → met à jour la description
//   DELETE (JSON: projectId, materialId)         → retire le fichier

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { updateMaterialDesc, removeMaterial } from "@/lib/ai-editor/store";
import { ingestMaterialFile, materialKind, MATERIAL_MAX_BYTES } from "@/lib/ai-editor/material-ingest";
import { editorScopeForUser } from "@/lib/ai-editor/scope";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_BYTES = MATERIAL_MAX_BYTES;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  return user;
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  // Rangement des projets : le créateur actif (workspaces) ou le user — voir scope.ts.
  const { storeKey: sk } = await editorScopeForUser(user.id, req);

  const form = await req.formData().catch(() => null);
  const projectId = String(form?.get("projectId") || "");
  const desc = String(form?.get("desc") || "");
  const file = form?.get("file");
  if (!projectId) return NextResponse.json({ error: "Projet manquant." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Fichier trop lourd (max 300 Mo)." }, { status: 413 });

  const kind = materialKind(file.type, file.name);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_amat_"));
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] || (kind === "image" ? ".jpg" : kind === "audio" ? ".mp3" : ".mp4");
  const tmp = path.join(dir, `mat${ext}`);
  try {
    await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));
    // Même porte d'entrée que le MCP (add_material) : limites, analyse, SDR.
    const r = await ingestMaterialFile({ storeKey: sk, projectId, tmpPath: tmp, fileName: file.name, mimeType: file.type, desc });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ material: r.material });
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
  // Rangement des projets : le créateur actif (workspaces) ou le user — voir scope.ts.
  const { storeKey: sk } = await editorScopeForUser(user.id, req);
  const body = await req.json().catch(() => null);
  const { projectId, materialId, desc } = body || {};
  if (!projectId || !materialId) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  const ok = await updateMaterialDesc(sk, String(projectId), String(materialId), String(desc ?? ""));
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Introuvable." }, { status: 404 });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  // Rangement des projets : le créateur actif (workspaces) ou le user — voir scope.ts.
  const { storeKey: sk, ctx: wsCtx } = await editorScopeForUser(user.id, req);
  // Rôle VA : il produit et télécharge, mais ne supprime rien.
  if (wsCtx.enabled && wsCtx.role === "va") return NextResponse.json({ error: "Ton rôle (VA) ne permet pas de supprimer." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const { projectId, materialId } = body || {};
  if (!projectId || !materialId) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  const ok = await removeMaterial(sk, String(projectId), String(materialId));
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Introuvable." }, { status: 404 });
}
