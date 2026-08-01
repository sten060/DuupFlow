import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// Preview de l'upgrade Solo → Pro : renvoie le montant RÉEL à payer maintenant
// (prorata des jours restants, net du crédit Solo non consommé) + le prix
// récurrent Pro. Ne modifie rien côté Stripe (createPreview = simulation).
export async function GET() {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id, plan")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: t("errors.billing.noActiveSubscription") }, { status: 400 });
  }
  if (profile.plan === "pro") {
    return NextResponse.json({ error: t("errors.billing.alreadyOnPro") }, { status: 400 });
  }

  const proPriceId = process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID;
  if (!proPriceId) {
    return NextResponse.json({ error: "STRIPE_PRICE_ID_PRO non configuré." }, { status: 500 });
  }

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, { expand: ["items.data"] });
  const itemId = sub.items.data[0]?.id;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (!itemId) {
    return NextResponse.json({ error: t("errors.billing.subscriptionItemNotFound") }, { status: 500 });
  }

  const prorationDate = Math.floor(Date.now() / 1000);

  let dueNowCents = 0;
  try {
    // Stripe v20 : invoices.createPreview (remplace retrieveUpcoming).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const preview: any = await (stripe.invoices as any).createPreview({
      customer: customerId,
      subscription: profile.stripe_subscription_id,
      subscription_details: {
        items: [{ id: itemId, price: proPriceId }],
        proration_date: prorationDate,
        proration_behavior: "always_invoice",
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines: any[] = preview?.lines?.data ?? [];
    const prorationLines = lines.filter((l) => l.proration);
    dueNowCents = prorationLines.length
      ? prorationLines.reduce((s: number, l) => s + (l.amount ?? 0), 0)
      : (preview?.amount_due ?? 0);
  } catch (e) {
    return NextResponse.json({ error: "preview_failed", detail: String(e) }, { status: 502 });
  }

  // Prix récurrent Pro (affichage). Best-effort — fallback 99€.
  let recurringCents = 9900;
  let currency = "EUR";
  try {
    const price = await stripe.prices.retrieve(proPriceId);
    if (price.unit_amount != null) recurringCents = price.unit_amount;
    if (price.currency) currency = price.currency.toUpperCase();
  } catch { /* garde le fallback */ }

  return NextResponse.json({
    dueNowCents: Math.max(0, dueNowCents),
    recurringCents,
    currency,
  });
}
