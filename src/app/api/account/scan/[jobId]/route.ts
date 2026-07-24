// GET /api/account/scan/[jobId] — poll de l'avancement d'un scan.
// Réponse : AccountScanSnapshot (status "scraping" | "ready" | "error",
// videos[] classées quand prêt). 404 si le job est inconnu (expiré/purgé).

import { NextResponse } from "next/server";
import { getScanSnapshot } from "@/lib/account/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { jobId: string } }) {
  const snap = getScanSnapshot(params.jobId);
  if (!snap) {
    return NextResponse.json({ error: "Job de scan introuvable (expiré ?)" }, { status: 404 });
  }
  return NextResponse.json(snap);
}
