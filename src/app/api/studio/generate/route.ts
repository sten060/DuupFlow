// POST /api/studio/generate — nouveau modèle "N contenus → 1 reel + variantes".
// Body : { assets: UploadedVideo[], variantCount: number, recipes: ViralRecipe[] }
// On assemble les contenus (vidéos + images) en UNE source 9:16, puis on lance
// le pipeline existant (captions/montage/variantes) sur cette source combinée.
// Répond { jobId, total } ; le client poll GET /api/studio/generate/[jobId].

import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { MAX_VARIANTS, MIN_VARIANTS } from "@/lib/mock-data";
import { startGenerationJob } from "@/lib/studio/jobs";
import { assembleAssets } from "@/lib/studio/assemble";
import { analyzeUploadedFootage, footageCachePath } from "@/lib/studio/footage";
import { UPLOADS_DIR, isSafeStoredName } from "@/lib/studio/local-store";
import { detectFormat, formatDuration, probeVideo } from "@/lib/studio/pipeline";
import type { UploadedVideo, ViralRecipe } from "@/lib/studio/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ASSETS = 8;

export async function POST(req: Request) {
  let body: {
    assets?: UploadedVideo[];
    variantCount?: number;
    recipes?: ViralRecipe[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const assets = Array.isArray(body.assets) ? body.assets : [];
  const variantCount = Number(body.variantCount);
  const recipes = Array.isArray(body.recipes) ? body.recipes : [];

  // Garde-fou : recette sans mesures (layout) = analyse d'ancienne version.
  if (recipes.some((r) => !r?.layout)) {
    return NextResponse.json(
      {
        error:
          "Référence analysée par une ancienne version de l'outil — recharge la page (Cmd+Shift+R), supprime les références (✕) et re-colle-les avant de générer.",
      },
      { status: 400 }
    );
  }

  if (assets.length === 0 || assets.length > MAX_ASSETS) {
    return NextResponse.json(
      { error: `Entre 1 et ${MAX_ASSETS} contenus requis` },
      { status: 400 }
    );
  }
  if (!Number.isInteger(variantCount) || variantCount < MIN_VARIANTS || variantCount > MAX_VARIANTS) {
    return NextResponse.json(
      { error: `variantCount doit être entre ${MIN_VARIANTS} et ${MAX_VARIANTS}` },
      { status: 400 }
    );
  }

  // Chaque contenu doit être un upload existant à nous (id sûr + présent).
  for (const a of assets) {
    if (!a?.id || !isSafeStoredName(a.id)) {
      return NextResponse.json({ error: "Id de contenu invalide" }, { status: 400 });
    }
    try {
      await fs.access(path.join(UPLOADS_DIR, a.id));
    } catch {
      return NextResponse.json(
        { error: `Contenu introuvable : ${a.name ?? a.id}` },
        { status: 404 }
      );
    }
  }

  // ── Assemblage : N contenus → 1 source combinée 9:16 ──────────────────────
  let combinedId: string | null;
  try {
    combinedId = await assembleAssets(assets);
  } catch (e) {
    return NextResponse.json(
      { error: `Assemblage des contenus échoué : ${e instanceof Error ? e.message : e}` },
      { status: 500 }
    );
  }
  if (!combinedId) {
    return NextResponse.json({ error: "Assemblage impossible (contenus illisibles ?)" }, { status: 500 });
  }

  const combinedPath = path.join(UPLOADS_DIR, combinedId);
  const probe = await probeVideo(combinedPath);
  const format = await detectFormat(combinedPath, probe);

  // Analyse poussée de la source combinée (le montage comprend l'ensemble).
  try {
    const analysis = await analyzeUploadedFootage(combinedPath, probe.durationSec);
    if (analysis) await fs.writeFile(footageCachePath(combinedPath), JSON.stringify(analysis), "utf8");
  } catch {
    /* best-effort */
  }

  const combined: UploadedVideo = {
    id: combinedId,
    name: assets.length === 1 ? assets[0].name : `${assets.length} contenus assemblés`,
    format,
    durationLabel: formatDuration(probe.durationSec),
    sizeMo: 1,
  };

  const origin = new URL(req.url).origin;
  // 1 seule "vidéo" (la source combinée) × variantCount → 1 reel + variantes.
  const snapshot = startGenerationJob([combined], variantCount, recipes, origin);
  return NextResponse.json({ jobId: snapshot.jobId, total: snapshot.total });
}
