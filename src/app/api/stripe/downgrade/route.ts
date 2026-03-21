import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id, stripe_customer_id, plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan === "solo") {
    return NextResponse.json(
      { error: "Vous êtes déjà sur le plan Solo." },
      { status: 400 }
    );
  }

  const soloPriceId = process.env.STRIPE_PRICE_ID_SOLO;
  if (!soloPriceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_ID_SOLO non configuré." },
      { status: 500 }
    );
  }

  // Resolve subscription ID — fallback to looking up via customer ID
  let subscriptionId = profile?.stripe_subscription_id ?? null;

  if (!subscriptionId && profile?.stripe_customer_id) {
    const list = await getStripe().subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "active",
      limit: 1,
    });
    const found = list.data[0];
    if (found) {
      subscriptionId = found.id;
      await admin
        .from("profiles")
        .update({ stripe_subscription_id: found.id })
        .eq("id", user.id);
    }
  }

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "Aucun abonnement actif trouvé." },
      { status: 400 }
    );
  }

  const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data"],
  });

  const itemId = sub.items.data[0]?.id;
  if (!itemId) {
    return NextResponse.json(
      { error: "Impossible de trouver l'item d'abonnement." },
      { status: 500 }
    );
  }

  // Switch to Solo price at next billing cycle — no immediate DB update.
  // The user keeps Pro access until the current period ends;
  // the webhook invoice.paid (billing_reason: subscription_cycle) will
  // apply "solo" in DB when the 39€ invoice is paid next month.
  await getStripe().subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: soloPriceId }],
    proration_behavior: "none",
    metadata: { plan: "solo" },
  });

  return NextResponse.json({ success: true });
}
