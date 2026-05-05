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
    images: 40,
    videos: 20,
    ai_signatures: 0,
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

export type PlanType = "free" | "solo" | "pro";

export function getPlanLimits(plan: string | null) {
  if (plan === "solo") return PLAN_LIMITS.solo;
  if (plan === "pro") return PLAN_LIMITS.pro;
  // Default — including null / undefined / unknown — is the free tier.
  return PLAN_LIMITS.free;
}
