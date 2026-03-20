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

  let plan = (profile?.plan as "solo" | "pro" | null) ?? null;
  let stripeCustomerId = profile?.stripe_customer_id ?? null;
  const subscriptionPeriodStart = profile?.subscription_period_start ?? null;

  // Sync plan & customer_id from Stripe (fixes wrong plan in DB)
  if (profile?.stripe_subscription_id || stripeCustomerId || profile?.has_paid) {
    try {
      let sub: import("stripe").default.Subscription | null = null;

      if (profile?.stripe_subscription_id) {
        sub = await getStripe().subscriptions.retrieve(
          profile.stripe_subscription_id,
          { expand: ["items.data.price"] }
        );
      } else {
        // No subscription ID in DB – try to find by customer or by email
        let customerId = stripeCustomerId;
        if (!customerId && user.email) {
          const customers = await getStripe().customers.list({ email: user.email, limit: 1 });
          const found = customers.data[0];
          if (found) {
            customerId = found.id;
            stripeCustomerId = found.id;
            await admin.from("profiles").update({ stripe_customer_id: found.id }).eq("id", user.id);
          }
        }
        if (customerId) {
          const list = await getStripe().subscriptions.list({
            customer: customerId,
            status: "active",
            limit: 1,
            expand: ["data.items.data.price"],
          });
          sub = list.data[0] ?? null;
          if (sub) {
            await admin.from("profiles").update({ stripe_subscription_id: sub.id }).eq("id", user.id);
          }
        }
      }

      if (sub && (sub.status === "active" || sub.status === "trialing")) {
        const price = sub.items.data[0]?.price;
        const priceId = price?.id ?? "";
        const unitAmount = price?.unit_amount ?? null;
        const stripePlan = resolvePlanFromPrice(priceId, unitAmount);
        const stripeCustomer = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id ?? null;

        const updates: Record<string, unknown> = {};
        if (stripePlan && stripePlan !== plan) { updates.plan = stripePlan; plan = stripePlan; }
        if (stripeCustomer && stripeCustomer !== stripeCustomerId) { updates.stripe_customer_id = stripeCustomer; stripeCustomerId = stripeCustomer; }
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
    />
  );
}
