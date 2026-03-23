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
  const affiliateCode: string | undefined =
    typeof body?.affiliate_code === "string" && body.affiliate_code.trim()
      ? body.affiliate_code.trim().toUpperCase()
      : undefined;
  const promoCode: string | undefined =
    typeof body?.promo_code === "string" && body.promo_code.trim()
      ? body.promo_code.trim().toUpperCase()
      : undefined;

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

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  // Le code promo est aussi le code affilié (même chose)
  const effectiveAffiliateCode = promoCode ?? affiliateCode;

  // Résoudre le stripe_promotion_code_id :
  // - si promoCode tapé manuellement → lookup direct
  // - si seulement affiliateCode (lien ?ref=) → lookup aussi pour les partenaires lien-seul
  let stripePromotionCodeId: string | undefined;
  const codeToLookup = promoCode ?? affiliateCode;
  if (codeToLookup) {
    const { data: affiliate } = await admin
      .from("affiliates")
      .select("stripe_promotion_code_id, discount_pct")
      .eq("code", codeToLookup)
      .single();
    // Appliquer si : code promo manuel, ou partenaire lien-seul (discount_pct défini)
    if (affiliate?.stripe_promotion_code_id && (promoCode || affiliate.discount_pct != null)) {
      stripePromotionCodeId = affiliate.stripe_promotion_code_id;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionParams: any = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    metadata: {
      plan,
      ...(effectiveAffiliateCode ? { affiliate_code: effectiveAffiliateCode } : {}),
    },
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

  // Appliquer la réduction si le code promo est valide
  if (stripePromotionCodeId) {
    sessionParams.discounts = [{ promotion_code: stripePromotionCodeId }];
  }

  const session = await getStripe().checkout.sessions.create(sessionParams);

  return NextResponse.json({ url: session.url });
}
