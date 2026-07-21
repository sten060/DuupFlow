// POST /api/studio/upload — upload RÉEL d'une vidéo brute, en local.
// Écrit le fichier dans .studio-local/uploads, le probe avec ffmpeg et
// détecte son format (Talking/Action). Aucun cloud, aucune auth (local only).
// TODO: brancher — Supabase Storage + auth + quotas quand on sortira du local.

import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { UPLOADS_DIR, ensureStudioDirs } from "@/lib/studio/local-store";
import {
  detectFormat,
  formatDuration,
  probeVideo,
} from "@/lib/studio/pipeline";
import { analyzeUploadedFootage, footageCachePath } from "@/lib/studio/footage";
import type { UploadedVideo } from "@/lib/studio/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALLOWED_EXT = new Set([".mp4", ".mov", ".m4v", ".webm"]);
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 Mo — large pour du local

export async function POST(req: Request) {
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
      { error: `Format non supporté (${ext || "sans extension"}) — mp4, mov, m4v ou webm` },
      { status: 415 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Fichier trop lourd (max 500 Mo)" },
      { status: 413 }
    );
  }

  await ensureStudioDirs();

  // Nom stocké généré par nous (jamais le nom utilisateur) → pas de traversal.
  const id = `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const storedPath = path.join(UPLOADS_DIR, id);
  await fs.writeFile(storedPath, Buffer.from(await file.arrayBuffer()));

  try {
    const probe = await probeVideo(storedPath);
    const format = await detectFormat(storedPath, probe);

    // Analyse POUSSÉE (comprendre toute la vidéo + son déroulé) — best-effort,
    // mise en cache à côté du fichier pour réutilisation au montage.
    try {
      const analysis = await analyzeUploadedFootage(storedPath, probe.durationSec);
      if (analysis) {
        await fs.writeFile(footageCachePath(storedPath), JSON.stringify(analysis), "utf8");
        console.log(
          `[studio] analyse rush « ${file.name} » : ${analysis.context.slice(0, 70)} ` +
            `· narratif=${analysis.hasNarrative} · ${analysis.segments.length} segment(s)`
        );
      }
    } catch (e) {
      console.warn("[studio] analyse poussée ignorée :", e instanceof Error ? e.message : e);
    }

    const video: UploadedVideo = {
      id,
      name: file.name,
      format,
      durationLabel: formatDuration(probe.durationSec),
      sizeMo: Math.max(1, Math.round(file.size / 1_000_000)),
    };
    return NextResponse.json(video);
  } catch (e) {
    // Probe échoué → le fichier n'est pas une vidéo exploitable : on nettoie.
    await fs.unlink(storedPath).catch(() => {});
    const msg = e instanceof Error ? e.message : "Vidéo illisible";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
