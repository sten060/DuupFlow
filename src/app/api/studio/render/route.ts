// POST /api/studio/render — re-rend un reel à partir d'un plan de montage ÉDITÉ
// (envoyé par l'éditeur du navigateur). Réutilise exactement le même moteur que
// la génération initiale : le plan édité est la seule source de vérité.

import path from "path";
import { renderCaptionsWithRemotion } from "@/lib/studio/remotion-render";
import { OUTPUTS_DIR } from "@/lib/studio/local-store";
import type { ReelPlan } from "@/lib/studio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: Request) {
  let plan: ReelPlan;
  try {
    plan = (await req.json()) as ReelPlan;
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!plan?.videoUrl || !plan.durationSec) {
    return Response.json({ error: "Plan incomplet" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  // Le renderer a besoin d'une URL http absolue ; le plan porte une URL relative.
  const videoUrl = plan.videoUrl.startsWith("http")
    ? plan.videoUrl
    : `${origin}${plan.videoUrl}`;

  const outName = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`;
  const outputPath = path.join(OUTPUTS_DIR, outName);

  try {
    const ok = await renderCaptionsWithRemotion({
      videoUrl,
      durationSec: plan.durationSec,
      hook: plan.hook,
      reveals: plan.reveals,
      shots: plan.shots,
      segments: plan.segments,
      revealAtSec: plan.revealAtSec,
      captionMode: plan.captionMode,
      layout: plan.layout,
      accentColor: plan.accentColor,
      uppercase: plan.uppercase,
      outputPath,
    });
    if (!ok) {
      return Response.json({ error: "Rendu échoué" }, { status: 500 });
    }
    return Response.json({ url: `/api/studio/media/${outName}` });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur de rendu" },
      { status: 500 }
    );
  }
}
