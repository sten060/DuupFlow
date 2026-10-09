/**
 * Per-plan monthly quotas.
 *
 * The "free" tier covers users without a paid subscription. It produces
 * NOTHING: the user can explore the whole app, but every production action is
 * locked behind a plan (see src/lib/free-plan.ts). Its quotas are therefore 0 —
 * a second safety net behind the explicit plan gate in every route.
 */
export const PLAN_LIMITS = {
  free: {
    images: 0,
    videos: 0,
    ai_signatures: 0,
    members: 0,
  },
  starter: {
    images: 150,
    videos: 100,
    ai_signatures: 80,
    members: 0,
  },
  solo: {
    images: 400,
    videos: 300,
    ai_signatures: 200,
    members: 0,
  },
  pro: {
    images: Infinity,
    videos: Infinity,
    ai_signatures: Infinity,
    members: 3,
  },
  // Agence : tout ce que Pro débloque + 10 sièges invités.
  agency: {
    images: Infinity,
    videos: Infinity,
    ai_signatures: Infinity,
    members: 10,
  },
} as const;

export type PlanType = "free" | "starter" | "solo" | "pro" | "agency";
export type PaidPlan = "starter" | "solo" | "pro" | "agency";

/** Tier ordering, lowest → highest. Used to tell upgrades from downgrades. */
export const PLAN_ORDER = ["free", "starter", "solo", "pro", "agency"] as const;

/** Tous les plans payants qu'un abonnement Stripe peut porter — Starter
 *  inclus : il n'est plus VENDU mais ses abonnés actuels restent actifs. */
export const PAID_PLANS: readonly PaidPlan[] = ["starter", "solo", "pro", "agency"];

/** Plans proposés à un NOUVEL abonnement (pricing, checkout, modale d'upgrade).
 *  Starter (19 €) est retiré de la vente : seuls ses abonnés actuels le gardent. */
export const SELLABLE_PLANS: readonly PaidPlan[] = ["solo", "pro", "agency"];

export function isPaidPlan(plan: unknown): plan is PaidPlan {
  return typeof plan === "string" && (PAID_PLANS as readonly string[]).includes(plan);
}

export function isSellablePlan(plan: unknown): plan is PaidPlan {
  return typeof plan === "string" && (SELLABLE_PLANS as readonly string[]).includes(plan);
}

/** Pro OU Agence : quotas illimités, API, invitations d'équipe, et c'est le
 *  plan que l'hôte transmet à ses invités. Toute fonctionnalité « Pro » doit
 *  passer par ici plutôt que par `plan === "pro"`. */
export function hasProFeatures(plan: string | null | undefined): plan is "pro" | "agency" {
  return plan === "pro" || plan === "agency";
}

/** Nombre de sièges invités inclus dans le plan (0 = ne peut pas inviter). */
export function teamSeatsForPlan(plan: string | null | undefined): number {
  return plan === "agency" ? PLAN_LIMITS.agency.members : plan === "pro" ? PLAN_LIMITS.pro.members : 0;
}

/** Nombre de workspaces (un par créateur / créatrice) inclus dans le plan.
 *  0 = pas de workspaces (Solo, Starter, Free : l'app fonctionne sans). */
export const PLAN_WORKSPACES: Record<string, number> = { pro: 2, agency: 15 };

export function workspacesForPlan(plan: string | null | undefined): number {
  return PLAN_WORKSPACES[plan ?? ""] ?? 0;
}

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "Free",
  starter: "Starter",
  solo: "Solo",
  pro: "Pro",
  agency: "Agence",
};

export function planRank(plan: string | null | undefined): number {
  const i = PLAN_ORDER.indexOf((plan ?? "free") as (typeof PLAN_ORDER)[number]);
  return i === -1 ? 0 : i;
}

export function getPlanLimits(plan: string | null) {
  if (plan === "starter") return PLAN_LIMITS.starter;
  if (plan === "solo") return PLAN_LIMITS.solo;
  if (plan === "pro") return PLAN_LIMITS.pro;
  if (plan === "agency") return PLAN_LIMITS.agency;
  // Default — including null / undefined / unknown — is the free tier.
  return PLAN_LIMITS.free;
}

/**
 * Max output resolution (long edge, px) for duplicated / AI-edited videos,
 * per plan. Starter is capped at 1080p: a 4K source comes out in 1080p, while
 * anything already ≤1080p keeps its native resolution (720p stays 720p).
 * Other plans have no cap (Infinity = keep source resolution).
 */
export const PLAN_MAX_VIDEO_HEIGHT: Record<string, number> = {
  starter: 1080,
};

export function maxVideoHeightForPlan(plan: string | null | undefined): number {
  return PLAN_MAX_VIDEO_HEIGHT[plan ?? ""] ?? Infinity;
}
