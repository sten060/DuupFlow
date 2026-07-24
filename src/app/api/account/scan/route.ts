// POST /api/account/scan — lance le scan d'un compte (IG/TikTok).
// Body JSON : { url: string, windowDays?: number, topCount: number }
// Réponse : snapshot initial { jobId, status:"scraping", ... } → le client poll
// ensuite GET /api/account/scan/[jobId].
//
// FACTURATION : un SEUL débit, ici, au lancement. Le prix couvre le scrape ET la
// récupération des N vidéos demandées — l'utilisateur paie une fois, qu'il
// télécharge ensuite ou non. Si le scan échoue (compte privé/restreint/
// introuvable), le job rembourse intégralement (cf. lib/account/jobs).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordTransaction, grantWelcomeBonusIfDue } from "@/lib/tokens-server";
import { scrapeCostCents } from "@/lib/tokens";
import { parseAccountUrl } from "@/lib/account/types";
import { startScanJob } from "@/lib/account/jobs";

export const runtime = "nodejs";
export const maxDuration = 300; // le scrape peut prendre quelques minutes

export async function POST(req: Request) {
  let body: { url?: string; windowDays?: number; topCount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "Lien de compte requis" }, { status: 400 });

  // Fenêtre bornée 1-365 j (défaut 30). Plus la fenêtre est large, plus le scan coûte.
  const windowDays = Math.min(365, Math.max(1, Math.round(body.windowDays ?? 30)));

  // Nombre de vidéos voulues — OBLIGATOIRE côté produit (l'UI l'impose toujours).
  // Borné 1-20 : au-delà, le téléchargement TikTok devient très long/coûteux.
  if (body.topCount === undefined || body.topCount === null) {
    return NextResponse.json({ error: "Nombre de vidéos à récupérer requis" }, { status: 400 });
  }
  const topCount = Math.min(20, Math.max(1, Math.round(body.topCount)));

  // Lien invalide → on refuse AVANT de débiter quoi que ce soit.
  const target = parseAccountUrl(url);
  if (!target) {
    return NextResponse.json(
      { error: "Lien de compte invalide (colle une URL Instagram ou TikTok, ou @pseudo)." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Garantit le bonus de bienvenue avant tout débit (idempotent, 1× par user).
  await grantWelcomeBonusIfDue(user.id);

  // Prix identique à celui affiché dans l'UI avant le clic (même fonction).
  const costCents = scrapeCostCents({ windowDays, count: topCount, platform: target.platform });

  const debit = await recordTransaction({
    userId: user.id,
    deltaCents: -costCents,
    reason: "scrape_account",
    metadata: { platform: target.platform, handle: target.handle, windowDays, topCount },
  });
  if (!debit.ok) {
    return NextResponse.json(
      {
        error: "Solde de tokens insuffisant",
        code: "insufficient_balance",
        costCents,
        balanceCents: debit.balanceCents,
      },
      { status: 402 },
    );
  }

  // Le job rembourse lui-même si le scrape échoue.
  const result = startScanJob(url, windowDays, topCount, {
    userId: user.id,
    costCents,
  });
  if ("error" in result) {
    // Ne devrait plus arriver (lien déjà validé) — on rembourse par sécurité.
    await recordTransaction({
      userId: user.id,
      deltaCents: costCents,
      reason: "scrape_refund",
      metadata: { why: "invalid_target" },
    });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ...result, costCents, balanceCents: debit.balanceCents });
}
