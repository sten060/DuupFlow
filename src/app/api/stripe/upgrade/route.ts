import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";
import { planRank } from "@/lib/plans";

export const dynamic = "force-dynamic";

const PRICE_ENV: Record<"starter" | "solo" | "pro", string | undefined> = {
  starter: process.env.STRIPE_PRICE_ID_STARTER,
  solo: process.env.STRIPE_PRICE_ID_SOLO,
  pro: process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID,
};

export async function POST(request: Request) {
  const t = await getServerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
  }

  // Target plan (defaults to "pro" to preserve the original Solo→Pro behaviour
  // for callers that POST without a body).
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const target: "starter" | "solo" | "pro" =
    body?.plan === "starter" ? "starter" : body?.plan === "solo" ? "solo" : "pro";

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id, plan")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json(
      { error: t("errors.billing.noActiveSubscription") },
      { status: 400 }
    );
  }

  // This route only moves UP the tiers (prorated + immediately invoiced).
  // A same-or-lower target must go through /api/stripe/downgrade.
  if (planRank(target) <= planRank(profile.plan)) {
    return NextResponse.json(
      { error: t("errors.billing.alreadyOnPro") },
      { status: 400 }
    );
  }

  const targetPriceId = PRICE_ENV[target];
  if (!targetPriceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_ID_${target.toUpperCase()} non configuré.` },
      { status: 500 }
    );
  }

  // Retrieve the current subscription to get the item ID
  const sub = await getStripe().subscriptions.retrieve(
    profile.stripe_subscription_id,
    { expand: ["items.data"] }
  );

  const itemId = sub.items.data[0]?.id;
  if (!itemId) {
    return NextResponse.json(
      { error: t("errors.billing.subscriptionItemNotFound") },
      { status: 500 }
    );
  }

  // Update the existing subscription price — no new subscription created
  // "always_invoice" forces Stripe to immediately charge the prorated difference
  // instead of deferring it to the next billing cycle
  await getStripe().subscriptions.update(profile.stripe_subscription_id, {
    items: [{ id: itemId, price: targetPriceId }],
    proration_behavior: "always_invoice",
    metadata: { plan: target },
  });

  // Update DB immediately (webhook customer.subscription.updated will also fire)
  await admin
    .from("profiles")
    .update({ plan: target })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
