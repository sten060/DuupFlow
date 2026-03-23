import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Crée un affilié en DB et génère automatiquement un Stripe Promotion Code
 * lié au coupon partenaire (-10€ sur le 1er paiement).
 *
 * Le coupon de base doit être créé une fois dans Stripe et son ID stocké
 * dans STRIPE_PARTNER_COUPON_ID.  S'il n'existe pas encore, il est créé
 * automatiquement au premier appel.
 */
export async function POST(req: NextRequest) {
  // Vérification CEO
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { code, name, email, commission_pct } = await req.json();
  if (!code || typeof code !== "string" || !name || typeof name !== "string") {
    return NextResponse.json({ error: "code et name requis" }, { status: 400 });
  }

  const upperCode = code.trim().toUpperCase();
  const commissionPct = typeof commission_pct === "number" ? commission_pct : 20;

  const stripe = getStripe();
  const admin = createAdminClient();

  // ── 1. Récupérer ou créer le coupon de base -10€ ───────────────────────────
  let couponId = process.env.STRIPE_PARTNER_COUPON_ID;

  if (!couponId) {
    // Cherche un coupon existant avec metadata.duupflow_partner = "true"
    const coupons = await stripe.coupons.list({ limit: 100 });
    const existing = coupons.data.find(
      (c) => c.metadata?.duupflow_partner === "true"
    );
    if (existing) {
      couponId = existing.id;
    } else {
      // Crée le coupon une seule fois
      const coupon = await stripe.coupons.create({
        amount_off: 1000, // 10,00 €
        currency: "eur",
        duration: "once",
        name: "DuupFlow Partenaire -10€",
        metadata: { duupflow_partner: "true" },
      });
      couponId = coupon.id;
    }
  }

  // ── 2. Créer le Stripe Promotion Code ─────────────────────────────────────
  let stripePromoCodeId: string;
  try {
    const promoCode = await stripe.promotionCodes.create({
      coupon: couponId,
      code: upperCode,
      max_redemptions: undefined, // illimité
      restrictions: {
        first_time_transaction: true, // seulement 1er paiement
      },
      metadata: { affiliate_code: upperCode },
    });
    stripePromoCodeId = promoCode.id;
  } catch (err: any) {
    // Le code existe déjà dans Stripe → récupère l'ID existant
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
  });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    code: upperCode,
    stripe_promotion_code_id: stripePromoCodeId,
    stripe_coupon_id: couponId,
  });
}
