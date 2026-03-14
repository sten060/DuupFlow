import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!process.env.STRIPE_PRICE_ID) {
    return NextResponse.json({ error: "STRIPE_PRICE_ID non configuré" }, { status: 500 });
  }

  const { origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    // Associer la session Stripe à l'utilisateur Supabase
    client_reference_id: user.id,
    customer_email: user.email,
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout`,
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
  });

  return NextResponse.json({ url: session.url });
}
