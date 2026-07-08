// POST /api/studio/reference — analyse un reel de référence.
// Deux modes :
//   • JSON      { url }  → yt-dlp (+ cookies navigateur pour Instagram)
//   • multipart file     → l'user glisse le reel déjà téléchargé (increvable)
// Réponse : { recipe }. Recette mise en cache par URL.
// TODO: brancher — Apify à la place de yt-dlp pour la prod (fiabilité).

import os from "os";
import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import {
  analyzeReference,
  analyzeReferenceFile,
} from "@/lib/studio/references";

export const runtime = "nodejs";
export const maxDuration = 240;

const ALLOWED_EXT = new Set([".mp4", ".mov", ".m4v", ".webm"]);
const MAX_SIZE_BYTES = 300 * 1024 * 1024;

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  // ── Mode fichier (dépôt direct) ────────────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Formulaire illisible" }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: "Format non supporté (mp4, mov, m4v, webm)" },
        { status: 415 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Fichier trop lourd (max 300 Mo)" }, { status: 413 });
    }

    const tmp = path.join(
      os.tmpdir(),
      `duup_reffile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    );
    try {
      await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));
      const result = await analyzeReferenceFile(tmp);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 422 });
      }
      return NextResponse.json({ recipe: result.recipe });
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  }

  // ── Mode URL ───────────────────────────────────────────────────────────────
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }
  const url = (body.url || "").trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  const result = await analyzeReference(url);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ recipe: result.recipe });
}
