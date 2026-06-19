import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { PLAN_LIMITS } from "./plans";

export type UsageType = "images" | "videos" | "ai_signatures";

/**
 * Free plan: the monthly quota window is anchored on the user's `period_start`
 * (their free "subscription" / first-usage date). Returns the start of the
 * current month-window when at least one monthly anniversary has elapsed since
 * `periodStart` — i.e. the counters are stale and should be reset to 0 — or
 * null when we're still inside the same window.
 */
function rolledPeriodStart(periodStart: Date, now: Date): Date | null {
  if (isNaN(periodStart.getTime())) return null;
  let cur = new Date(periodStart);
  let rolled = false;
  // Advance whole months from the anchor until the next step would pass `now`.
  while (true) {
    const next = new Date(cur);
    next.setMonth(next.getMonth() + 1);
    if (next.getTime() > now.getTime()) break;
    cur = next;
    rolled = true;
  }
  return rolled ? cur : null;
}

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
  const t = await getServerT();
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
      message: t("errors.quota.notAuthenticated"),
    };
  }

  const admin = createAdminClient();

  // Fetch profile — handle guest users (inherit host plan)
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, has_paid, is_guest, host_user_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      allowed: false,
      userId: user.id,
      plan: null,
      current: 0,
      limit: 0,
      message: t("errors.quota.profileNotFound"),
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

  // Legacy data normalization:
  //  - has_paid + plan null  → treat as 'pro' (early users without plan column)
  //  - !has_paid + plan null → treat as 'free' (default tier going forward)
  if (!effectivePlan) {
    effectivePlan = profile.has_paid ? "pro" : "free";
  }

  // Pro → unlimited
  if (effectivePlan === "pro") {
    return {
      allowed: true,
      userId: user.id,
      plan: effectivePlan,
      current: 0,
      limit: Infinity,
    };
  }

  // Solo / Free → check monthly limits via PLAN_LIMITS
  const planLimits =
    effectivePlan === "solo" ? PLAN_LIMITS.solo : PLAN_LIMITS.free;
  const limit = planLimits[type === "images" ? "images" : type === "videos" ? "videos" : "ai_signatures"];
  const column = `${type}_count` as const;

  const { data: usage } = await admin
    .from("usage_tracking")
    .select("images_count, videos_count, ai_signatures_count, period_start")
    .eq("user_id", user.id)
    .single();

  let current = (usage as any)?.[column] ?? 0;

  // Free plan: reset the monthly counters once a new period has begun, anchored
  // on the user's period_start (their free "subscription" date). Solo/Pro reset
  // via Stripe billing cycles, so the lazy calendar reset is scoped to Free.
  if (effectivePlan === "free" && (usage as any)?.period_start) {
    const newStart = rolledPeriodStart(new Date((usage as any).period_start), new Date());
    if (newStart) {
      current = 0;
      await admin
        .from("usage_tracking")
        .update({
          images_count: 0,
          videos_count: 0,
          ai_signatures_count: 0,
          period_start: newStart.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }
  }

  if (current + requestedCount > limit) {
    const labels: Record<UsageType, string> = {
      images: t("errors.quota.labelImages"),
      videos: t("errors.quota.labelVideos"),
      ai_signatures: t("errors.quota.labelAiSignatures"),
    };
    const upgradeHint =
      effectivePlan === "free"
        ? t("errors.quota.upgradeHintFree")
        : t("errors.quota.upgradeHintSolo");
    return {
      allowed: false,
      userId: user.id,
      plan: effectivePlan,
      current,
      limit,
      message: t("errors.quota.limitReached", {
        current,
        limit,
        label: labels[type],
        hint: upgradeHint,
      }),
    };
  }

  return {
    allowed: true,
    userId: user.id,
    plan: effectivePlan,
    current,
    limit,
  };
}

/** Map UsageType → usage_events.kind (analytics event log). */
const USAGE_EVENT_KIND: Record<UsageType, string> = {
  images: "image_duplication",
  videos: "video_duplication",
  ai_signatures: "ai_signature",
};

/**
 * Atomically increments the monthly counter AND writes one event row to
 * `usage_events` so analytics views can reconstruct per-action history.
 *
 * Safe to call fire-and-forget. The event insert is best-effort — if it
 * fails (e.g. table missing on an old environment), we log and continue;
 * counter update is the authoritative one for quota enforcement.
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

  // Event log for analytics — one row per call with qty = count.
  // Failures here MUST NOT break the quota enforcement above.
  try {
    await admin.from("usage_events").insert({
      user_id: userId,
      kind: USAGE_EVENT_KIND[type],
      qty: count,
      source: "live",
    });
  } catch (err) {
    console.error("[usage] usage_events insert failed:", err);
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
