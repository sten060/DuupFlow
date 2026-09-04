import { NextResponse } from "next/server";
import { getStripe, getPlanPriceId, planPriceEnvName } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// Preview d'une montée : renvoie le montant RÉEL à payer maintenant (prorata des
// jours restants, net du crédit non consommé du plan actuel) + le prix récurrent
// du plan visé. Ne modifie rien côté Stripe (createPreview = simulation).
//
// Paramètres : ?plan=starter|solo|pro & billing=monthly|yearly. Sans eux, on
// retombe sur l'ancien comportement (Pro, intervalle courant) — les appels
// existants continuent de marcher.
export async function GET(request: Request) {
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
  const params = new URL(request.url).searchParams;
  const target: "starter" | "solo" | "pro" =
    params.get("plan") === "starter" ? "starter" : params.get("plan") === "solo" ? "solo" : "pro";
  const askedInterval: "monthly" | "yearly" | null =
    params.get("billing") === "yearly" ? "yearly" : params.get("billing") === "monthly" ? "monthly" : null;

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, { expand: ["items.data"] });

  // Par défaut, même intervalle que l'abonnement courant : le preview d'un
  // abonné annuel doit simuler le prix ANNUEL du plan visé.
  const currentInterval = sub.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";
  const interval = askedInterval ?? currentInterval;

  // Rien à prévisualiser si la cible est exactement l'abonnement en cours.
  if (target === profile.plan && interval === currentInterval) {
    return NextResponse.json({ error: t("errors.billing.alreadyOnPro") }, { status: 400 });
  }

  const targetPriceId = getPlanPriceId(target, interval);
  if (!targetPriceId) {
    return NextResponse.json({ error: `${planPriceEnvName(target, interval)} non configuré.` }, { status: 500 });
  }

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
        items: [{ id: itemId, price: targetPriceId }],
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

  // Prix récurrent du plan visé (affichage). Best-effort — fallback 99€.
  let recurringCents = 9900;
  let currency = "EUR";
  try {
    const price = await stripe.prices.retrieve(targetPriceId);
    if (price.unit_amount != null) recurringCents = price.unit_amount;
    if (price.currency) currency = price.currency.toUpperCase();
  } catch { /* garde le fallback */ }

  return NextResponse.json({
    dueNowCents: Math.max(0, dueNowCents),
    recurringCents,
    currency,
    interval,
  });
}
