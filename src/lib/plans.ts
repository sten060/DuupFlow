export const PLAN_LIMITS = {
  solo: {
    images: 300,
    videos: 200,
    ai_signatures: 100,
    members: 0,
  },
  pro: {
    images: Infinity,
    videos: Infinity,
    ai_signatures: Infinity,
    members: 3,
  },
} as const;

export type PlanType = "solo" | "pro";

export function getPlanLimits(plan: string | null) {
  if (plan === "solo") return PLAN_LIMITS.solo;
  if (plan === "pro") return PLAN_LIMITS.pro;
  return null;
}
