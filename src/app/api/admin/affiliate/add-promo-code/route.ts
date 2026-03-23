import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Ajoute un code promo Stripe visible à un partenaire existant (lien seul ou sans code promo).
 * Body: { affiliate_code, promo_code, discount_pct }
 */
export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId.trim()) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { affiliate_code, promo_code, discount_pct } = await req.json();
  if (!affiliate_code || !promo_code) {
    return NextResponse.json({ error: "affiliate_code et promo_code requis" }, { status: 400 });
  }
  if (typeof discount_pct !== "number" || discount_pct < 1 || discount_pct > 100) {
    return NextResponse.json({ error: "discount_pct invalide (1-100)" }, { status: 400 });
  }

  const upperPromo = promo_code.trim().toUpperCase();
  const stripe = getStripe();

  // 1. Créer le coupon Stripe
  const coupon = await stripe.coupons.create({
    percent_off: discount_pct,
    duration: "once",
    name: `DuupFlow Partenaire ${affiliate_code} -${discount_pct}%`,
    metadata: { duupflow_partner: "true", affiliate_code },
  });

  // 2. Créer le Promotion Code Stripe visible
  let stripePromoCodeId: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pc = await (stripe.promotionCodes.create as any)({
      coupon: coupon.id,
      code: upperPromo,
      restrictions: { first_time_transaction: true },
      metadata: { affiliate_code },
    });
    stripePromoCodeId = pc.id;
  } catch (err: any) {
    if (err?.code === "resource_already_exists") {
      const list = await stripe.promotionCodes.list({ code: upperPromo, limit: 1 });
      if (!list.data[0]) {
        return NextResponse.json({ error: `Code Stripe '${upperPromo}' déjà utilisé mais introuvable` }, { status: 409 });
      }
      stripePromoCodeId = list.data[0].id;
    } else {
      return NextResponse.json({ error: err?.message ?? "Erreur Stripe" }, { status: 500 });
    }
  }

  // 3. Mettre à jour l'affilié en DB
  const { error: dbError } = await admin
    .from("affiliates")
    .update({ stripe_promotion_code_id: stripePromoCodeId })
    .eq("code", affiliate_code);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true, stripe_promotion_code_id: stripePromoCodeId, promo_code: upperPromo });
}
