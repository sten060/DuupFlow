import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const plan = body?.plan === "solo" ? "solo" : "pro";

  const priceId =
    plan === "solo"
      ? process.env.STRIPE_PRICE_ID_SOLO
      : process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_ID_${plan.toUpperCase()} non configuré` },
      { status: 500 }
    );
  }

  const { origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;

  // Re-use existing Stripe customer if available (avoids duplicates on upgrade)
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionParams: any = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout`,
    subscription_data: {
      metadata: { supabase_user_id: user.id, plan },
    },
  };

  if (profile?.stripe_customer_id) {
    sessionParams.customer = profile.stripe_customer_id;
  } else {
    sessionParams.customer_email = user.email;
  }

  const session = await getStripe().checkout.sessions.create(sessionParams);

  return NextResponse.json({ url: session.url });
}
