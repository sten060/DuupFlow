// GET /api/studio/generate/[jobId] — polling de l'avancement d'un job.
// Retourne le StudioJobSnapshot : reels terminés, total, done, failed.

import { NextResponse } from "next/server";
import { getJobSnapshot } from "@/lib/studio/jobs";

export const runtime = "nodejs";
// Le snapshot évolue à chaque poll — jamais de cache.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { jobId: string } }
) {
  const snapshot = getJobSnapshot(params.jobId);
  if (!snapshot) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}
