import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const t = await getServerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const plan = body?.plan === "solo" ? "solo" : body?.plan === "starter" ? "starter" : "pro";
  const locale = body?.locale === "en" ? "en" : "fr";
  const affiliateCode: string | undefined =
    typeof body?.affiliate_code === "string" && body.affiliate_code.trim()
      ? body.affiliate_code.trim().toUpperCase()
      : undefined;
  const promoCode: string | undefined =
    typeof body?.promo_code === "string" && body.promo_code.trim()
      ? body.promo_code.trim().toUpperCase()
      : undefined;

  const priceId =
    plan === "starter"
      ? process.env.STRIPE_PRICE_ID_STARTER
      : plan === "solo"
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

  // Résoudre le stripe_promotion_code_id — UNIQUEMENT si le filleul a saisi un
  // code promo au checkout. Le lien d'affiliation (?ref → affiliateCode) ne sert
  // qu'au tracking et à l'attribution de la commission : il n'applique JAMAIS de
  // réduction automatiquement.
  let stripePromotionCodeId: string | undefined;
  if (promoCode) {
    const { data: affiliate } = await admin
      .from("affiliates")
      .select("stripe_promotion_code_id")
      .eq("code", promoCode)
      .single();
    if (affiliate?.stripe_promotion_code_id) {
      stripePromotionCodeId = affiliate.stripe_promotion_code_id;
    }
  }

  // Fallback : code promo saisi manuellement, créé directement dans Stripe
  // (hors table affiliates). On l'applique s'il existe et est actif côté Stripe.
  if (!stripePromotionCodeId && promoCode) {
    try {
      const list = await getStripe().promotionCodes.list({ code: promoCode, active: true, limit: 1 });
      if (list.data[0]) stripePromotionCodeId = list.data[0].id;
    } catch {
      // Stripe inaccessible → pas de réduction, le paiement continue au plein tarif.
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
    // Sortie du paywall sans payer → retour à l'étape "code promo / payer" de
    // l'onboarding (stylée comme les autres), sans relancer Stripe automatiquement.
    cancel_url: `${baseUrl}/${locale}/onboarding?paywall=cancelled&plan=${plan}`,
    subscription_data: {
      // No free trial — checkout charges immediately for the chosen plan.
      metadata: {
        supabase_user_id: user.id,
        plan,
        ...(effectiveAffiliateCode ? { affiliate_code: effectiveAffiliateCode } : {}),
      },
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
