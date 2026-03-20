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
    .select("stripe_subscription_id, plan")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Aucun abonnement actif trouvé." },
      { status: 400 }
    );
  }

  if (profile.plan === "pro") {
    return NextResponse.json(
      { error: "Vous êtes déjà sur le plan Pro." },
      { status: 400 }
    );
  }

  const proPriceId =
    process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID;
  if (!proPriceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_ID_PRO non configuré." },
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
      { error: "Impossible de trouver l'item d'abonnement." },
      { status: 500 }
    );
  }

  // Update the existing subscription price — no new subscription created
  await getStripe().subscriptions.update(profile.stripe_subscription_id, {
    items: [{ id: itemId, price: proPriceId }],
    proration_behavior: "create_prorations",
    metadata: { plan: "pro" },
  });

  // Update DB immediately (webhook customer.subscription.updated will also fire)
  await admin
    .from("profiles")
    .update({ plan: "pro" })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
