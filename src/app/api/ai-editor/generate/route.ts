// POST /api/ai-editor/generate
// Mode INTÉGRÉ de l'Éditeur IA : génère des variantes CÔTÉ SERVEUR (le user
// clique juste « Générer », aucune connexion). L'IA (Groq vision) compose les
// plans, le moteur de rendu les exécute.
//
// Garde-fou OBLIGATOIRE : c'est DuupFlow qui déclenche l'IA ici → chaque variante
// compte comme une « vidéo » dans le quota (réservé AVANT le rendu), sinon la
// génération n'a pas de frein.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reserveUsage, releaseUsage, logUsageEvent } from "@/lib/usage";
import { directVariants } from "@/lib/ai-editor/director";
import { getLatestProject } from "@/lib/ai-editor/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let projectId: string | undefined;
  let count = 2;
  try {
    const body = (await req.json().catch(() => ({}))) as { projectId?: string; count?: number };
    projectId = body.projectId;
    if (Number.isFinite(Number(body.count))) count = Number(body.count);
  } catch { /* corps optionnel */ }

  // À défaut de projectId explicite, on prend le dernier projet du user.
  if (!projectId) {
    const latest = await getLatestProject(user.id);
    if (!latest) return NextResponse.json({ error: "Aucun projet — analyse d'abord une référence." }, { status: 400 });
    projectId = latest.id;
  }

  count = Math.max(1, Math.min(3, Math.floor(count) || 2));

  // Garde-fou quota : chaque variante = une « vidéo ». Pro = illimité.
  // On RÉSERVE avant de générer (et pas « on contrôle puis on facture à la
  // fin ») : sinon deux générations lancées en même temps passent toutes les
  // deux le contrôle avec le même compteur. Le surplus est rendu juste après.
  const usage = await reserveUsage(user.id, "videos", count);
  if (!usage.allowed) {
    return NextResponse.json({ error: usage.message || "Quota atteint.", quota: true }, { status: 402 });
  }

  const res = await directVariants(user.id, projectId, count);
  if ("error" in res) {
    await releaseUsage(user.id, "videos", count).catch(() => {});
    return NextResponse.json({ error: res.error }, { status: 422 });
  }

  // Ne facture QUE les variantes réellement rendues.
  const unused = count - res.variants.length;
  if (unused > 0) await releaseUsage(user.id, "videos", unused).catch(() => {});
  if (res.variants.length) void logUsageEvent(user.id, "videos", res.variants.length);

  return NextResponse.json({ variants: res.variants, usedAI: res.usedAI });
}
