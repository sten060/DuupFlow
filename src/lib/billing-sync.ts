/**
 * Server-side self-healing sync for Stripe subscription state.
 *
 * The Stripe webhook (`src/app/api/stripe/webhook/route.ts`) is the primary
 * mechanism for tracking payment status. This module covers the edge
 * cases where a webhook is missed (Stripe outage, retry exhaustion,
 * users that were already `past_due` BEFORE the feature was deployed):
 *
 *  • Called fire-and-forget from the dashboard layout on each visit.
 *  • Throttled per user via `profiles.last_stripe_sync_at` — only one
 *    Stripe API call per user every 6 hours.
 *  • Bidirectional: pauses on `past_due` / `unpaid`, resumes on `active`.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const SYNC_TTL_MS = 6 * 60 * 60 * 1000; // 6 h

/**
 * Pause the user to Free and remember their original plan.
 * Idempotent — won't overwrite an existing `paused_plan` snapshot.
 */
async function pauseUserForOverduePayment(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, payment_overdue, paused_plan")
    .eq("id", userId)
    .single();
  if (!profile) return;
  if (profile.payment_overdue && profile.paused_plan) return;

  const currentPlan = (profile.plan as string | null) ?? null;
  const snapshot = currentPlan && currentPlan !== "free" ? currentPlan : null;

  await admin
    .from("profiles")
    .update({
      payment_overdue: true,
      paused_plan: snapshot ?? profile.paused_plan ?? null,
      payment_overdue_since: new Date().toISOString(),
      plan: "free",
      has_paid: false,
    })
    .eq("id", userId);
}

/**
 * Restore the user's original plan after a payment recovery.
 */
async function resumeUserFromOverdue(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("payment_overdue, paused_plan")
    .eq("id", userId)
    .single();
  if (!profile?.payment_overdue) return;

  const restored = (profile.paused_plan as string | null) ?? null;
  await admin
    .from("profiles")
    .update({
      payment_overdue: false,
      paused_plan: null,
      payment_overdue_since: null,
      ...(restored ? { plan: restored, has_paid: true } : {}),
    })
    .eq("id", userId);
}

/**
 * Lazy sync — call from server components. Cheap when fresh, fetches
 * Stripe at most once per 6 h per user.
 *
 * `bypassCache: true` forces a re-fetch (used after a payment portal
 * return so the popup clears immediately).
 */
export async function syncStripeStateIfStale(
  userId: string,
  opts: { bypassCache?: boolean } = {},
): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) return;

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_subscription_id, last_stripe_sync_at")
      .eq("id", userId)
      .single();
    if (!profile?.stripe_subscription_id) return;

    // Throttle: skip if we synced this user recently.
    if (!opts.bypassCache && profile.last_stripe_sync_at) {
      const age = Date.now() - new Date(profile.last_stripe_sync_at).getTime();
      if (age < SYNC_TTL_MS) return;
    }

    const sub = await getStripe().subscriptions.retrieve(
      profile.stripe_subscription_id,
    );
    const status = sub.status;

    if (status === "past_due" || status === "unpaid") {
      await pauseUserForOverduePayment(userId);
    } else if (status === "active" || status === "trialing") {
      await resumeUserFromOverdue(userId);
    }
    // canceled / incomplete / incomplete_expired → leave existing webhook
    // handlers do their thing (`customer.subscription.deleted`).

    await admin
      .from("profiles")
      .update({ last_stripe_sync_at: new Date().toISOString() })
      .eq("id", userId);
  } catch (err) {
    // Never throw from a lazy sync — silently log and move on.
    console.error("[billing-sync] failed:", (err as any)?.message ?? err);
  }
}
