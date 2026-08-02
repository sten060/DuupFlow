// /api/ai-editor/material
//   POST   (multipart: projectId, file, desc?)  → ajoute + analyse + persiste
//   PATCH  (JSON: projectId, materialId, desc)   → met à jour la description
//   DELETE (JSON: projectId, materialId)         → retire le fichier

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { analyzeMaterial } from "@/lib/ai-editor/analyze";
import { addMaterial, updateMaterialDesc, removeMaterial } from "@/lib/ai-editor/store";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_BYTES = 300 * 1024 * 1024;

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

  const kind: "video" | "image" = file.type.startsWith("image") ? "image" : "video";
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_amat_"));
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] || (kind === "image" ? ".jpg" : ".mp4");
  const tmp = path.join(dir, `mat${ext}`);
  try {
    await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));
    const analysis = await analyzeMaterial(tmp, file.type).catch(() => null);
    const material = await addMaterial(user.id, projectId, { srcPath: tmp, ext, name: file.name, kind, desc, analysis });
    if (!material) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
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
