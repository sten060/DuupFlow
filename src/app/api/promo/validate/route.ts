import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * GET /api/promo/validate?code=FLOW15
 * Valide un code promo partenaire et retourne les infos de réduction réelles.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ valid: false, error: "Code manquant" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: affiliate } = await admin
    .from("affiliates")
    .select("code, name, stripe_promotion_code_id, discount_pct")
    .eq("code", code)
    .single();

  if (!affiliate || !affiliate.stripe_promotion_code_id) {
    return NextResponse.json({ valid: false });
  }

  // Récupérer le vrai % depuis Stripe si discount_pct n'est pas stocké en DB
  let discountPct: number | null = affiliate.discount_pct ?? null;
  if (discountPct === null) {
    try {
      const stripe = getStripe();
      const promoCode = await stripe.promotionCodes.retrieve(
        affiliate.stripe_promotion_code_id,
        { expand: ["coupon"] }
      );
      const coupon = promoCode.coupon as { percent_off?: number | null };
      if (coupon?.percent_off) discountPct = coupon.percent_off;
    } catch {
      // Fallback silencieux si Stripe inaccessible
    }
  }

  const discountLabel = discountPct ? `-${discountPct}%` : "une réduction";

  return NextResponse.json({
    valid: true,
    code: affiliate.code,
    discount: discountLabel,
    message: `${discountLabel} sur ton 1er mois grâce au code ${affiliate.code}`,
  });
}
