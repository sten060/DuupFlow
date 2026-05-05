import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { redirect } from "next/navigation";
import AbonnementClient from "./AbonnementClient";

export const dynamic = "force-dynamic";

function resolvePlanFromPrice(priceId: string, unitAmount: number | null): "solo" | "pro" | null {
  // 1. Match by env var (most precise)
  if (priceId && process.env.STRIPE_PRICE_ID_SOLO && priceId === process.env.STRIPE_PRICE_ID_SOLO) return "solo";
  if (priceId && process.env.STRIPE_PRICE_ID_PRO && priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  if (priceId && process.env.STRIPE_PRICE_ID && priceId === process.env.STRIPE_PRICE_ID) return "pro";
  // 2. Fallback by price amount (39€ = solo, 99€ = pro)
  if (unitAmount === 3900) return "solo";
  if (unitAmount === 9900) return "pro";
  return null;
}

export default async function AbonnementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_customer_id, stripe_subscription_id, subscription_period_start, is_guest, has_paid")
    .eq("id", user.id)
    .single();

  if (profile?.is_guest) redirect("/dashboard/settings");

  // Default to "free" when profile has no plan set (new tier rollout).
  // Legacy users with has_paid + null plan are treated as "pro" elsewhere
  // (src/lib/usage.ts). Stripe sync below will overwrite if needed.
  let plan = (profile?.plan as "free" | "solo" | "pro" | null) ?? "free";
  let stripeCustomerId = profile?.stripe_customer_id ?? null;
  const subscriptionPeriodStart = profile?.subscription_period_start ?? null;
  let cancelAtPeriodEnd = false;
  let cancelAt: number | null = null;

  // Sync plan & customer_id from Stripe (fixes wrong plan in DB)
  if (profile?.stripe_subscription_id || stripeCustomerId || profile?.has_paid) {
    try {
      // Resolve Stripe customer ID if missing
      if (!stripeCustomerId && user.email) {
        const customers = await getStripe().customers.list({ email: user.email, limit: 1 });
        const found = customers.data[0];
        if (found) {
          stripeCustomerId = found.id;
          await admin.from("profiles").update({ stripe_customer_id: found.id }).eq("id", user.id);
        }
      }

      // Fetch ALL active subscriptions for this customer to detect duplicates
      // Also include "active" subs with cancel_at_period_end=true (they are still active)
      let allActiveSubs: import("stripe").default.Subscription[] = [];
      if (stripeCustomerId) {
        const list = await getStripe().subscriptions.list({
          customer: stripeCustomerId,
          status: "active",
          limit: 10,
          expand: ["data.items.data.price"],
        });
        allActiveSubs = list.data;
      } else if (profile?.stripe_subscription_id) {
        // Fallback: retrieve the known subscription directly
        const sub = await getStripe().subscriptions.retrieve(
          profile.stripe_subscription_id,
          { expand: ["items.data.price"] }
        );
        if (sub.status === "active" || sub.status === "trialing") {
          allActiveSubs = [sub];
        }
      }

      let sub: import("stripe").default.Subscription | null = null;

      if (allActiveSubs.length > 1) {
        // Multiple active subscriptions — keep the best plan (Pro > Solo) and cancel the rest
        const planRank = (s: import("stripe").default.Subscription) => {
          const priceId = s.items.data[0]?.price?.id ?? "";
          const amount = s.items.data[0]?.price?.unit_amount ?? 0;
          if (resolvePlanFromPrice(priceId, amount) === "pro") return 1;
          return 0;
        };
        // Sort: best plan first, then most recently created
        allActiveSubs.sort((a, b) => {
          const rankDiff = planRank(b) - planRank(a);
          if (rankDiff !== 0) return rankDiff;
          return b.created - a.created;
        });
        sub = allActiveSubs[0];
        // Cancel all others
        for (const dupe of allActiveSubs.slice(1)) {
          await getStripe().subscriptions.cancel(dupe.id).catch(console.error);
        }
      } else {
        sub = allActiveSubs[0] ?? null;
      }

      if (sub && (sub.status === "active" || sub.status === "trialing")) {
        const price = sub.items.data[0]?.price;
        const priceId = price?.id ?? "";
        const unitAmount = price?.unit_amount ?? null;
        const stripePlan = resolvePlanFromPrice(priceId, unitAmount);
        const stripeCustomer = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id ?? null;

        // Read cancellation-at-period-end state
        cancelAtPeriodEnd = sub.cancel_at_period_end;
        cancelAt = sub.cancel_at ?? null;

        const updates: Record<string, unknown> = {};
        if (stripePlan && stripePlan !== plan) { updates.plan = stripePlan; plan = stripePlan; }
        if (stripeCustomer && stripeCustomer !== stripeCustomerId) { updates.stripe_customer_id = stripeCustomer; stripeCustomerId = stripeCustomer; }
        if (sub.id !== profile?.stripe_subscription_id) { updates.stripe_subscription_id = sub.id; }
        // Restore has_paid if a valid active subscription exists (e.g. after erroneous churn)
        if (!profile?.has_paid) updates.has_paid = true;
        if (Object.keys(updates).length > 0) {
          await admin.from("profiles").update(updates).eq("id", user.id);
        }
      }
    } catch {
      // Stripe unreachable – use DB values
    }
  }

  // Show portal buttons if customer exists OR if user has an active paid plan
  const hasStripePortal = !!stripeCustomerId || !!profile?.has_paid;
  const subscriptionPeriodStart2 = subscriptionPeriodStart;

  let usage: { images: number; videos: number; ai_signatures: number } | null = null;
  if (plan) {
    const { data: usageRow } = await admin
      .from("usage_tracking")
      .select("images_count, videos_count, ai_signatures_count")
      .eq("user_id", user.id)
      .single();

    usage = {
      images: usageRow?.images_count ?? 0,
      videos: usageRow?.videos_count ?? 0,
      ai_signatures: usageRow?.ai_signatures_count ?? 0,
    };
  }

  return (
    <AbonnementClient
      plan={plan}
      usage={usage}
      hasStripePortal={hasStripePortal}
      subscriptionPeriodStart={subscriptionPeriodStart2}
      cancelAtPeriodEnd={cancelAtPeriodEnd}
      cancelAt={cancelAt}
    />
  );
}
