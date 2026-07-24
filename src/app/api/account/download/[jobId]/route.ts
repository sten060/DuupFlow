// GET /api/account/download/[jobId] — poll de l'avancement d'un download (voie 2).
// Réponse : AccountDownloadSnapshot (done, results[] avec uploadedId prêt à
// brancher sur la duplication / l'envoi Drive). 404 si job inconnu.

import { NextResponse } from "next/server";
import { getDownloadSnapshot } from "@/lib/account/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { jobId: string } }) {
  const snap = getDownloadSnapshot(params.jobId);
  if (!snap) {
    return NextResponse.json({ error: "Job de téléchargement introuvable (expiré ?)" }, { status: 404 });
  }
  return NextResponse.json(snap);
}
