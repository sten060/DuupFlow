import { NextResponse } from "next/server";
import { effectivePlanForUser } from "@/lib/usage";
import { createClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/server";
import { isFreePlan, planRequiredBody, type LockedModule } from "@/lib/free-plan";

/**
 * Verrou SERVEUR du plan gratuit (voir src/lib/free-plan.ts).
 *
 * À appeler en tête de chaque route qui PRODUIT quelque chose, juste après
 * l'authentification :
 *
 *     const locked = await requirePaidPlan(user.id, "video_duplication");
 *     if (locked) return locked;
 *
 * Renvoie une réponse 402 { code: "plan_required", module } si le plan
 * EFFECTIF (invité → plan de l'hôte, impayé → free) est le plan gratuit,
 * sinon null. Le client intercepte ce 402 et ouvre la fenêtre « plan requis ».
 */
export async function requirePaidPlan(
  userId: string,
  module: LockedModule,
): Promise<NextResponse | null> {
  if (!(await isUserOnFreePlan(userId))) return null;
  const locale = await getServerLocale();
  return NextResponse.json(planRequiredBody(module, locale), { status: 402 });
}

/** Même règle, en booléen — pour les server actions et les outils MCP. */
export async function isUserOnFreePlan(userId: string): Promise<boolean> {
  return isFreePlan(await effectivePlanForUser(userId));
}

/**
 * Pour les SERVER ACTIONS (pas de Request) : le user connecté est-il bloqué ?
 * Non connecté → bloqué aussi. Renvoie le message à afficher, ou null.
 */
export async function planLockMessageForCurrentUser(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const locale = await getServerLocale();
  if (!user || (await isUserOnFreePlan(user.id))) {
    return planRequiredBody("generic", locale).error;
  }
  return null;
}
