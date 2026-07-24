// POST /api/account/download — télécharge (voie 2) les vidéos cochées d'un scan.
// Body JSON : { scanJobId: string, ids: string[] }  (ids = ScoredVideo.id)
// Réponse : snapshot initial du job de download → poll GET .../download/[jobId].
//
// On repart du SNAPSHOT de scan (URLs fraîches du scrape) plutôt que de faire
// confiance à des URLs venues du client : le serveur reste la source de vérité,
// et le download suit le scrape de près (piège n°3 : expiration des URLs CDN).

import { NextResponse } from "next/server";
import { getScanSnapshot, startDownloadJob } from "@/lib/account/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { scanJobId?: string; ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const scanJobId = (body.scanJobId || "").trim();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!scanJobId || ids.length === 0) {
    return NextResponse.json({ error: "scanJobId et ids requis" }, { status: 400 });
  }

  const scan = getScanSnapshot(scanJobId);
  if (!scan) {
    return NextResponse.json(
      { error: "Scan introuvable (expiré ?) — relance un scan avant de télécharger." },
      { status: 404 }
    );
  }
  if (scan.status !== "ready") {
    return NextResponse.json({ error: "Le scan n'est pas encore prêt" }, { status: 409 });
  }

  // Garde-fou de COÛT : on ne télécharge jamais plus que le nombre demandé au
  // scan (chaque vidéo TikTok = 1 run Apify facturé). Le cap est imposé ici,
  // côté serveur, pas seulement dans l'UI.
  if (ids.length > scan.topCount) {
    return NextResponse.json(
      { error: `Maximum ${scan.topCount} vidéo(s) pour ce scan (nombre choisi au départ).` },
      { status: 400 }
    );
  }

  const wanted = new Set(ids);
  const selected = scan.videos.filter((v) => wanted.has(v.id));
  if (selected.length === 0) {
    return NextResponse.json({ error: "Aucune vidéo correspondante dans ce scan" }, { status: 400 });
  }

  const snap = startDownloadJob(scan.target, selected);
  return NextResponse.json(snap);
}
