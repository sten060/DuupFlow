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
  // FirstPromoter : identifiant de visite (tid) transmis par le client pour
  // attribuer la vente à l'affilié qui a amené le visiteur via son lien ?ref.
  const fpTid: string | undefined =
    typeof body?.fp_tid === "string" && body.fp_tid.trim() ? body.fp_tid.trim() : undefined;

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

  // ── Anti auto-parrainage ────────────────────────────────────────────────────
  // Un affilié ne doit pas pouvoir se parrainer lui-même : sinon il prendrait la
  // réduction filleul ET toucherait sa propre commission (on le paierait pour être
  // client). On regarde à qui appartient le code (promo ou lien ?ref) dans la table
  // `affiliates` : si c'est le compte qui paie (même user_id ou même email), on
  // refuse la réduction ET l'attribution de commission.
  // NB : ne couvre que les codes du système maison. Les codes FirstPromoter (hors
  // table) sont protégés par la détection fraude de FirstPromoter côté commission.
  const affiliateRow = effectiveAffiliateCode
    ? (
        await admin
          .from("affiliates")
          .select("user_id, email, stripe_promotion_code_id")
          .eq("code", effectiveAffiliateCode)
          .single()
      ).data
    : null;

  const isSelfReferral = Boolean(
    affiliateRow &&
      ((affiliateRow.user_id && affiliateRow.user_id === user.id) ||
        (affiliateRow.email &&
          user.email &&
          affiliateRow.email.toLowerCase() === user.email.toLowerCase()))
  );

  // Code réellement attribué (vidé si auto-parrainage → pas de commission).
  const attributedAffiliateCode = isSelfReferral ? undefined : effectiveAffiliateCode;

  // Résoudre le code de réduction Stripe de façon RÉSILIENTE — UNIQUEMENT si le
  // filleul a saisi un code promo, et que ce n'est PAS un auto-parrainage. Règle
  // d'or : un code stocké mais supprimé/désactivé côté Stripe ne doit JAMAIS
  // bloquer le paiement. On ne retient donc qu'un promotion_code réellement ACTIF ;
  // sinon on facture au plein tarif plutôt que de faire planter le checkout.
  // (Le lien d'affiliation ?ref ne sert qu'au tracking, il n'applique jamais de
  // réduction automatiquement.)
  let stripePromotionCodeId: string | undefined;
  if (promoCode && !isSelfReferral) {
    const stripe = getStripe();

    // 1) Code stocké dans la table `affiliates` : on ne le garde que s'il existe
    //    encore ET qu'il est actif dans Stripe (il a pu être supprimé, ex. après
    //    migration de l'affilié vers un autre système).
    const storedId = affiliateRow?.stripe_promotion_code_id;
    if (storedId) {
      try {
        const pc = await stripe.promotionCodes.retrieve(storedId);
        if (pc.active) stripePromotionCodeId = pc.id;
      } catch {
        // Introuvable/supprimé → on ignore et on tente le fallback par libellé.
      }
    }

    // 2) Fallback auto-réparateur : retrouver un code ACTIF par son libellé.
    //    Couvre les codes hors table (créés dans Stripe/FirstPromoter) et le cas
    //    où l'ID stocké est devenu invalide.
    if (!stripePromotionCodeId) {
      try {
        const list = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 });
        if (list.data[0]) stripePromotionCodeId = list.data[0].id;
      } catch {
        // Stripe inaccessible → pas de réduction, le paiement continue au plein tarif.
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionParams: any = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    metadata: {
      plan,
      ...(attributedAffiliateCode ? { affiliate_code: attributedAffiliateCode } : {}),
      ...(fpTid ? { fp_tid: fpTid } : {}),
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
        ...(attributedAffiliateCode ? { affiliate_code: attributedAffiliateCode } : {}),
        ...(fpTid ? { fp_tid: fpTid } : {}),
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

  // Filet de sécurité : si la réduction fait échouer la création de la session
  // (code devenu invalide entre-temps, etc.), on réessaie SANS réduction plutôt
  // que de bloquer la vente. Mieux vaut un paiement au plein tarif qu'un paiement
  // perdu à cause d'un code promo cassé.
  let session;
  try {
    session = await getStripe().checkout.sessions.create(sessionParams);
  } catch (err) {
    if (sessionParams.discounts) {
      delete sessionParams.discounts;
      session = await getStripe().checkout.sessions.create(sessionParams);
    } else {
      throw err;
    }
  }

  return NextResponse.json({ url: session.url });
}
