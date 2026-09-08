// GET /api/trial-credits → crédits d'essai restants pour l'utilisateur connecté.
//
// Une seule source pour toutes les surfaces qui les affichent (carte de
// démarrage, page duplication, Éditeur IA) : le compte fait foi côté serveur,
// jamais côté client.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { effectivePlanForUser } from "@/lib/usage";
import { etatCredits } from "@/lib/trial-credits";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ restants: 0, total: 0, dansLaFenetre: false, plan: null });

  const plan = await effectivePlanForUser(user.id);
  const etat = await etatCredits(user.id, plan);
  return NextResponse.json({ ...etat, plan });
}
