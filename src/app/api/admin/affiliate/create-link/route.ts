import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Crée un affilié "lien seul" : pas de code promo visible pour l'utilisateur.
 * La réduction (% personnalisé) s'applique automatiquement quand quelqu'un
 * arrive via le lien ?ref=CODE.
 */
export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  // Vérification via Bearer token
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId.trim()) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { code, name, email, commission_pct, discount_pct, with_visible_promo } = await req.json();
  if (!code || typeof code !== "string" || !name || typeof name !== "string") {
    return NextResponse.json({ error: "code et name requis" }, { status: 400 });
  }
  if (typeof discount_pct !== "number" || discount_pct < 0 || discount_pct > 100) {
    return NextResponse.json({ error: "discount_pct invalide (0-100)" }, { status: 400 });
  }

  const upperCode = code.trim().toUpperCase();
  const commissionPct = typeof commission_pct === "number" ? commission_pct : 20;
  const hasDiscount = discount_pct > 0;
  // Si with_visible_promo=true, le code Stripe prend le nom du code (saisissable au checkout).
  // Sinon, le code interne Stripe est REF{CODE} (non visible).
  const visiblePromo = hasDiscount && with_visible_promo === true;
  const stripePromoCodeName = visiblePromo ? upperCode : `REF${upperCode}`;

  let stripePromoCodeId: string | null = null;
  let stripeCouponId: string | null = null;

  if (hasDiscount) {
    const stripe = getStripe();

    // ── 1. Créer un coupon Stripe en % (unique par partenaire) ───────────────
    const coupon = await stripe.coupons.create({
      percent_off: discount_pct,
      duration: "once",
      name: `DuupFlow Partenaire ${upperCode} -${discount_pct}%`,
      metadata: { duupflow_link_partner: "true", affiliate_code: upperCode },
    });
    stripeCouponId = coupon.id;

    // ── 2. Créer le Stripe Promotion Code ────────────────────────────────────
    // Si visiblePromo: code = CODE (saisissable au checkout par l'utilisateur)
    // Sinon: code = REFCODE (interne, appliqué automatiquement via le lien)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const promoCode = await (stripe.promotionCodes.create as any)({
        coupon: coupon.id,
        code: stripePromoCodeName,
        restrictions: { first_time_transaction: true },
        metadata: { affiliate_code: upperCode, type: visiblePromo ? "visible_promo" : "link_only" },
      });
      stripePromoCodeId = promoCode.id;
    } catch (err: any) {
      if (err?.code === "resource_already_exists") {
        return NextResponse.json(
          { error: `Le code Stripe '${stripePromoCodeName}' existe déjà. Utilisez un code de suivi différent.` },
          { status: 409 }
        );
      } else {
        return NextResponse.json({ error: err?.message ?? "Erreur Stripe" }, { status: 500 });
      }
    }
  }

  // ── 3. Inviter le partenaire par email (crée son compte affiliation) ────────
  let affiliateUserId: string | null = null;
  const cleanEmail = email?.trim() ?? null;

  if (cleanEmail) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.duupflow.com").replace(/\/$/, "");
    const { data: inviteData } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
      redirectTo: `${appUrl}/auth/callback?next=/affiliate/dashboard`,
    });
    affiliateUserId = inviteData?.user?.id ?? null;
  }

  // ── 4. Insérer l'affilié en DB ─────────────────────────────────────────────
  const { error: dbError } = await admin.from("affiliates").insert({
    code: upperCode,
    name: name.trim(),
    email: cleanEmail,
    user_id: affiliateUserId,
    commission_pct: commissionPct,
    stripe_promotion_code_id: stripePromoCodeId,
    discount_pct: hasDiscount ? discount_pct : null,
  });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    code: upperCode,
    stripe_promotion_code_id: stripePromoCodeId,
    stripe_coupon_id: stripeCouponId,
    invite_sent: !!cleanEmail,
  });
}
