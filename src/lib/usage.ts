import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "./plans";

export type UsageType = "images" | "videos" | "ai_signatures";

export interface UsageCheck {
  allowed: boolean;
  userId: string | null;
  plan: string | null;
  current: number;
  limit: number;
  message?: string;
}

/**
 * Checks whether the current authenticated user is allowed to perform
 * `requestedCount` operations of the given type.
 * - Pro plan → always allowed (unlimited)
 * - Solo plan → check against monthly limits
 * - No plan / unauthenticated → denied
 */
export async function checkUsage(
  type: UsageType,
  requestedCount = 1
): Promise<UsageCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      allowed: false,
      userId: null,
      plan: null,
      current: 0,
      limit: 0,
      message: "Non authentifié.",
    };
  }

  const admin = createAdminClient();

  // Fetch profile — handle guest users (inherit host plan)
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, has_paid, is_guest, host_user_id")
    .eq("id", user.id)
    .single();

  if (!profile?.has_paid && !profile?.is_guest) {
    return {
      allowed: false,
      userId: user.id,
      plan: null,
      current: 0,
      limit: 0,
      message: "Abonnement requis.",
    };
  }

  // Guests inherit host plan
  let effectivePlan = profile.plan as string | null;
  if (profile.is_guest && profile.host_user_id) {
    const { data: hostProfile } = await admin
      .from("profiles")
      .select("plan")
      .eq("id", profile.host_user_id)
      .single();
    effectivePlan = hostProfile?.plan ?? effectivePlan;
  }

  // Fallback: if has_paid but plan is null, treat as 'pro' (legacy users)
  if (!effectivePlan && profile.has_paid) {
    effectivePlan = "pro";
  }

  // Pro → unlimited
  if (effectivePlan !== "solo") {
    return {
      allowed: true,
      userId: user.id,
      plan: effectivePlan,
      current: 0,
      limit: Infinity,
    };
  }

  // Solo → check limits
  const limit = PLAN_LIMITS.solo[type === "images" ? "images" : type === "videos" ? "videos" : "ai_signatures"];
  const column = `${type}_count` as const;

  const { data: usage } = await admin
    .from("usage_tracking")
    .select("images_count, videos_count, ai_signatures_count")
    .eq("user_id", user.id)
    .single();

  const current = (usage as any)?.[column] ?? 0;

  if (current + requestedCount > limit) {
    const labels: Record<UsageType, string> = {
      images: "duplications images",
      videos: "duplications vidéos",
      ai_signatures: "modifications signature IA",
    };
    return {
      allowed: false,
      userId: user.id,
      plan: "solo",
      current,
      limit,
      message: `Limite atteinte (${current}/${limit} ${labels[type]} ce mois). Attends la date d'anniversaire de ton abonnement ou passe au plan Pro.`,
    };
  }

  return {
    allowed: true,
    userId: user.id,
    plan: "solo",
    current,
    limit,
  };
}

/**
 * Atomically increments the usage counter for a given user.
 * Safe to call fire-and-forget.
 */
export async function incrementUsage(
  userId: string,
  type: UsageType,
  count = 1
): Promise<void> {
  const admin = createAdminClient();
  const column = `${type}_count` as const;

  const { data: existing } = await admin
    .from("usage_tracking")
    .select("images_count, videos_count, ai_signatures_count")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await admin
      .from("usage_tracking")
      .update({
        [column]: ((existing as any)[column] as number) + count,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await admin.from("usage_tracking").insert({
      user_id: userId,
      [column]: count,
      period_start: new Date().toISOString(),
    });
  }
}

/**
 * Resets all usage counters for a user (called on invoice renewal).
 */
export async function resetUsage(userId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("usage_tracking")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await admin.from("usage_tracking").update({
      images_count: 0,
      videos_count: 0,
      ai_signatures_count: 0,
      period_start: now,
      updated_at: now,
    }).eq("user_id", userId);
  }
  // If no row exists yet, nothing to reset
}
