/**
 * Per-plan monthly quotas.
 *
 * The "free" tier covers users without a paid subscription. They get a small
 * allowance for the regular duplication features (images / videos) but no
 * AI signature credits. AI variation is metered separately via the token
 * system (src/lib/tokens.ts) and not affected by these quotas.
 */
export const PLAN_LIMITS = {
  free: {
    images: 20,
    videos: 10,
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
} as const;

export type PlanType = "free" | "starter" | "solo" | "pro";

/** Tier ordering, lowest → highest. Used to tell upgrades from downgrades. */
export const PLAN_ORDER = ["free", "starter", "solo", "pro"] as const;

export function planRank(plan: string | null | undefined): number {
  const i = PLAN_ORDER.indexOf((plan ?? "free") as (typeof PLAN_ORDER)[number]);
  return i === -1 ? 0 : i;
}

export function getPlanLimits(plan: string | null) {
  if (plan === "starter") return PLAN_LIMITS.starter;
  if (plan === "solo") return PLAN_LIMITS.solo;
  if (plan === "pro") return PLAN_LIMITS.pro;
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
