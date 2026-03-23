import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Crée un affilié "lien seul" : pas de code promo visible pour l'utilisateur.
 * La réduction (% personnalisé) s'applique automatiquement quand quelqu'un
 * arrive via le lien ?ref=CODE.
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

  const { code, name, email, commission_pct, discount_pct } = await req.json();
  if (!code || typeof code !== "string" || !name || typeof name !== "string") {
    return NextResponse.json({ error: "code et name requis" }, { status: 400 });
  }
  if (typeof discount_pct !== "number" || discount_pct < 1 || discount_pct > 100) {
    return NextResponse.json({ error: "discount_pct invalide (1-100)" }, { status: 400 });
  }

  const upperCode = code.trim().toUpperCase();
  const commissionPct = typeof commission_pct === "number" ? commission_pct : 20;

  const stripe = getStripe();
  const admin = createAdminClient();

  // ── 1. Créer un coupon Stripe en % (unique par partenaire) ─────────────────
  const coupon = await stripe.coupons.create({
    percent_off: discount_pct,
    duration: "once",
    name: `DuupFlow Partenaire ${upperCode} -${discount_pct}%`,
    metadata: { duupflow_link_partner: "true", affiliate_code: upperCode },
  });

  // ── 2. Créer le Stripe Promotion Code (code interne, non affiché) ──────────
  let stripePromoCodeId: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promoCode = await (stripe.promotionCodes.create as any)({
      coupon: coupon.id,
      code: `REF${upperCode}`,
      restrictions: { first_time_transaction: true },
      metadata: { affiliate_code: upperCode, type: "link_only" },
    });
    stripePromoCodeId = promoCode.id;
  } catch (err: any) {
    if (err?.code === "resource_already_exists") {
      const list = await stripe.promotionCodes.list({ code: `REF${upperCode}`, limit: 1 });
      if (!list.data[0]) {
        return NextResponse.json({ error: `Code Stripe 'REF${upperCode}' déjà utilisé mais introuvable` }, { status: 409 });
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
    discount_pct,
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
