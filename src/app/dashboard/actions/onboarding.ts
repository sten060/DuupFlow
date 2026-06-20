"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordTransaction } from "@/lib/tokens-server";
import { CENTS_PER_TOKEN } from "@/lib/tokens";

/**
 * Areas of the self-paced onboarding. Each one is shown exactly once:
 *   • "overview"        — the app overview card on the dashboard home
 *   • module keys       — the short coach shown the first time a module opens
 *
 * Whitelisted so a stray client call can never write arbitrary JSON keys.
 */
const ONBOARDING_AREAS = [
  "overview",
  "images",
  "videos",
  "videos-simple",
  "videos-advanced",
  "similarity",
  "generate",
  "ai-detection",
] as const;

/**
 * Mark one onboarding area as seen so it never auto-shows again.
 *
 * Merges the single key into profiles.onboarding_progress (read-modify-write
 * so other keys are preserved). Best-effort and idempotent — a failed write
 * just means the area may show once more; the UI never blocks on it.
 */
export async function markOnboardingSeen(area: string): Promise<void> {
  if (!ONBOARDING_AREAS.includes(area as (typeof ONBOARDING_AREAS)[number])) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("profiles")
    .select("onboarding_progress")
    .eq("id", user.id)
    .single();

  const current =
    (row?.onboarding_progress as Record<string, boolean> | null) ?? {};
  if (current[area] === true) return; // already seen — skip the write

  await admin
    .from("profiles")
    .update({ onboarding_progress: { ...current, [area]: true } })
    .eq("id", user.id);
}

/**
 * Acknowledge the one-shot AI Variation launch announcement.
 *
 * Triggers exactly once per existing user (`variation_ia_announced_at IS NULL`)
 * — credits launch-bonus tokens then marks the column to prevent re-show.
 *
 * Bonus per plan:
 *   • Solo  → 3 tokens
 *   • Pro / legacy → 5 tokens
 *   • Free  → 0 (Free is a new-tier; existing users were Solo/Pro at launch)
 */
export async function acknowledgeVariationAnnouncement(): Promise<{
  credited: boolean;
  bonusTokens: number;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { credited: false, bonusTokens: 0 };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, has_paid, variation_ia_announced_at")
    .eq("id", user.id)
    .single();

  // Already acknowledged → no-op (idempotent against double-clicks / race).
  if (!profile || profile.variation_ia_announced_at != null) {
    return { credited: false, bonusTokens: 0 };
  }

  // Resolve effective plan (legacy users with has_paid + null plan = pro).
  const effectivePlan = profile.plan ?? (profile.has_paid ? "pro" : "free");
  const bonusTokens = effectivePlan === "solo" ? 3 : effectivePlan === "free" ? 0 : 5;
  const bonusCents = bonusTokens * CENTS_PER_TOKEN;

  if (bonusCents > 0) {
    await recordTransaction({
      userId: user.id,
      deltaCents: bonusCents,
      reason: "variation_ia_launch",
      metadata: { plan: effectivePlan, tokens: bonusTokens },
    });
  }

  await admin
    .from("profiles")
    .update({ variation_ia_announced_at: new Date().toISOString() })
    .eq("id", user.id);

  return { credited: bonusCents > 0, bonusTokens };
}
