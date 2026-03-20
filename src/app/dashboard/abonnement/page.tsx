import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { redirect } from "next/navigation";
import AbonnementClient from "./AbonnementClient";

export const dynamic = "force-dynamic";

function resolvePlanFromPriceId(priceId: string): "solo" | "pro" | null {
  if (priceId && process.env.STRIPE_PRICE_ID_SOLO && priceId === process.env.STRIPE_PRICE_ID_SOLO) return "solo";
  if (priceId && process.env.STRIPE_PRICE_ID_PRO && priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  // Legacy fallback env var
  if (priceId && process.env.STRIPE_PRICE_ID && priceId === process.env.STRIPE_PRICE_ID) return "pro";
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

  // Sync plan from Stripe if user has a subscription (fixes wrong plan in DB)
  if (profile?.stripe_subscription_id) {
    try {
      const sub = await getStripe().subscriptions.retrieve(
        profile.stripe_subscription_id,
        { expand: ["items.data.price"] }
      );
      const priceId = sub.items.data[0]?.price?.id ?? "";
      const stripePlan = resolvePlanFromPriceId(priceId);
      const stripeCustomer = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id ?? null;

      // Update DB if plan or customer_id is wrong
      const needsUpdate =
        (stripePlan && stripePlan !== plan) ||
        (stripeCustomer && stripeCustomer !== stripeCustomerId);

      if (needsUpdate) {
        const updates: Record<string, unknown> = {};
        if (stripePlan && stripePlan !== plan) updates.plan = stripePlan;
        if (stripeCustomer && stripeCustomer !== stripeCustomerId) updates.stripe_customer_id = stripeCustomer;
        await admin.from("profiles").update(updates).eq("id", user.id);
        if (stripePlan) plan = stripePlan;
        if (stripeCustomer) stripeCustomerId = stripeCustomer;
      }
    } catch {
      // Stripe unreachable – use DB values
    }
  }

  const hasStripePortal = !!stripeCustomerId;
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
