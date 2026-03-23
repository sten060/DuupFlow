import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Crée un affilié "avec code promo" en DB et génère automatiquement un coupon
 * Stripe en % sur le 1er paiement, ainsi qu'un Stripe Promotion Code visible.
 *
 * Auth : le JWT de l'utilisateur est attendu dans le header Authorization.
 */
export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  // Vérification via Bearer token (plus fiable que les cookies depuis un Client Component)
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId.trim()) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { code, name, email, commission_pct, discount_pct } = await req.json();
  if (!code || typeof code !== "string" || !name || typeof name !== "string") {
    return NextResponse.json({ error: "code et name requis" }, { status: 400 });
  }

  const upperCode = code.trim().toUpperCase();
  const commissionPct = typeof commission_pct === "number" ? commission_pct : 20;
  const discountPct = typeof discount_pct === "number" ? discount_pct : 20;

  const stripe = getStripe();

  // ── 1. Créer un coupon Stripe en % (unique par partenaire) ────────────────
  const coupon = await stripe.coupons.create({
    percent_off: discountPct,
    duration: "once",
    name: `DuupFlow Partenaire ${upperCode} -${discountPct}%`,
    metadata: { duupflow_partner: "true", affiliate_code: upperCode },
  });

  // ── 2. Créer le Stripe Promotion Code (visible, utilisable manuellement) ──
  let stripePromoCodeId: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promoCode = await (stripe.promotionCodes.create as any)({
      coupon: coupon.id,
      code: upperCode,
      restrictions: { first_time_transaction: true },
      metadata: { affiliate_code: upperCode },
    });
    stripePromoCodeId = promoCode.id;
  } catch (err: any) {
    if (err?.code === "resource_already_exists") {
      const list = await stripe.promotionCodes.list({ code: upperCode, limit: 1 });
      if (!list.data[0]) {
        return NextResponse.json({ error: `Code Stripe '${upperCode}' déjà utilisé mais introuvable` }, { status: 409 });
      }
      stripePromoCodeId = list.data[0].id;
    } else {
      return NextResponse.json({ error: err?.message ?? "Erreur Stripe" }, { status: 500 });
    }
  }

  // ── 3. Insérer l'affilié en DB ─────────────────────────────────────────────
  const { error: dbError } = await admin.from("affiliates").insert({
    code: upperCode,
    name: name.trim(),
    email: email?.trim() ?? null,
    commission_pct: commissionPct,
    stripe_promotion_code_id: stripePromoCodeId,
    discount_pct: null, // null = code promo visible (pas lien seul)
  });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    code: upperCode,
    stripe_promotion_code_id: stripePromoCodeId,
    stripe_coupon_id: coupon.id,
  });
}
