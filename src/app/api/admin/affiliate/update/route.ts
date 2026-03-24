import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const admin = createAdminClient();

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId.trim()) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { code, commission_pct, discount_pct } = await req.json();
  if (!code) return NextResponse.json({ error: "code requis" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof commission_pct === "number") updates.commission_pct = commission_pct;
  if (discount_pct === null || typeof discount_pct === "number") updates.discount_pct = discount_pct;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
  }

  // Si discount_pct change, on doit recréer le coupon + promotion code Stripe
  // (les coupons Stripe sont immuables, on ne peut pas modifier le pourcentage)
  if (typeof discount_pct === "number" && discount_pct > 0) {
    const upperCode = code.trim().toUpperCase();

    // Récupérer l'affilié courant pour obtenir l'ancien stripe_promotion_code_id
    const { data: affiliate } = await admin
      .from("affiliates")
      .select("stripe_promotion_code_id")
      .eq("code", upperCode)
      .single();

    const stripe = getStripe();

    // Désactiver l'ancien code promo Stripe
    if (affiliate?.stripe_promotion_code_id) {
      try {
        await stripe.promotionCodes.update(affiliate.stripe_promotion_code_id, { active: false });
      } catch {
        // On continue même si la désactivation échoue
      }
    }

    // Créer un nouveau coupon avec le nouveau pourcentage
    const coupon = await stripe.coupons.create({
      percent_off: discount_pct,
      duration: "once",
      name: `DuupFlow Partenaire ${upperCode} -${discount_pct}%`,
      metadata: { duupflow_link_partner: "true", affiliate_code: upperCode },
    });

    // Créer un nouveau promotion code avec un suffixe unique
    const uniqueSuffix = Date.now().toString(36).toUpperCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promoCode = await (stripe.promotionCodes.create as any)({
      coupon: coupon.id,
      code: `REF${upperCode}${uniqueSuffix}`,
      restrictions: { first_time_transaction: true },
      metadata: { affiliate_code: upperCode, type: "link_only" },
    });

    updates.stripe_promotion_code_id = promoCode.id;
  }

  const { error: dbError } = await admin
    .from("affiliates")
    .update(updates)
    .eq("code", code);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
