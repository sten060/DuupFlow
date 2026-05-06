"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordTransaction } from "@/lib/tokens-server";
import { CENTS_PER_TOKEN } from "@/lib/tokens";

/**
 * Marks the current user's onboarding tour as completed.
 * Called when the user finishes or skips the multi-step tour shown
 * on first dashboard visit.
 *
 * Idempotent: setting `onboarded_at` again just bumps the timestamp,
 * which is harmless (tour won't reopen since the column is non-null).
 */
export async function markOnboardingDone(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
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
