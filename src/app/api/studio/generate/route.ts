// POST /api/studio/generate — lance un job de génération LOCAL (ffmpeg).
// Body : { videos: UploadedVideo[], variantsPerVideo: number }
// Répond immédiatement { jobId, total } ; le client poll ensuite
// GET /api/studio/generate/[jobId].
// TODO: brancher — auth + crédits réels + queue de workers pour la prod.

import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { MAX_RAW_VIDEOS, MAX_VARIANTS, MIN_VARIANTS } from "@/lib/mock-data";
import { startGenerationJob } from "@/lib/studio/jobs";
import { UPLOADS_DIR, isSafeStoredName } from "@/lib/studio/local-store";
import type { UploadedVideo, ViralRecipe } from "@/lib/studio/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    videos?: UploadedVideo[];
    variantsPerVideo?: number;
    recipes?: ViralRecipe[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const videos = Array.isArray(body.videos) ? body.videos : [];
  const variantsPerVideo = Number(body.variantsPerVideo);
  // Recettes des références analysées (peut être vide → génération normale).
  const recipes = Array.isArray(body.recipes) ? body.recipes : [];

  // Garde-fou SERVEUR : une recette sans mesures (layout) vient d'une analyse
  // d'ancienne version encore en mémoire dans un onglet pas rechargé —
  // générer avec donnerait un rendu par défaut silencieusement faux.
  // (Le client a le même garde-fou, mais un vieux bundle ne l'a pas.)
  if (recipes.some((r) => !r?.layout)) {
    return NextResponse.json(
      {
        error:
          "Référence analysée par une ancienne version de l'outil — recharge la page (Cmd+Shift+R), supprime les références (✕) et re-colle-les avant de générer.",
      },
      { status: 400 }
    );
  }

  if (videos.length === 0 || videos.length > MAX_RAW_VIDEOS) {
    return NextResponse.json(
      { error: `Entre 1 et ${MAX_RAW_VIDEOS} vidéos requises` },
      { status: 400 }
    );
  }
  if (
    !Number.isInteger(variantsPerVideo) ||
    variantsPerVideo < MIN_VARIANTS ||
    variantsPerVideo > MAX_VARIANTS
  ) {
    return NextResponse.json(
      { error: `variantsPerVideo doit être entre ${MIN_VARIANTS} et ${MAX_VARIANTS}` },
      { status: 400 }
    );
  }

  // Chaque vidéo doit être un upload existant à nous (id sûr + présent).
  for (const video of videos) {
    if (!video?.id || !isSafeStoredName(video.id)) {
      return NextResponse.json({ error: "Id de vidéo invalide" }, { status: 400 });
    }
    try {
      await fs.access(path.join(UPLOADS_DIR, video.id));
    } catch {
      return NextResponse.json(
        { error: `Vidéo introuvable : ${video.name ?? video.id}` },
        { status: 404 }
      );
    }
  }

  // Origine du serveur — Remotion (OffthreadVideo) lit la vidéo de base via
  // la route /api/studio/media, il lui faut une URL http locale complète.
  const origin = new URL(req.url).origin;

  const snapshot = startGenerationJob(videos, variantsPerVideo, recipes, origin);
  return NextResponse.json({ jobId: snapshot.jobId, total: snapshot.total });
}
