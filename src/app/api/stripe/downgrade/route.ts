import { NextResponse } from "next/server";
import { getStripe, getPlanPriceId, planPriceEnvName } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";
import { planRank } from "@/lib/plans";

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

  // Target plan (defaults to "solo" to preserve the original Pro→Solo behaviour
  // for callers that POST without a body). Downgrade targets are paid tiers
  // below the current one — Starter or Solo.
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  // "pro" est une cible valide UNIQUEMENT pour un changement d'intervalle
  // (Pro annuel → Pro mensuel) : la garde de palier plus bas s'en assure.
  const target: "starter" | "solo" | "pro" =
    body?.plan === "starter" ? "starter" : body?.plan === "pro" ? "pro" : "solo";
  const askedInterval: "monthly" | "yearly" | null =
    body?.billing === "yearly" ? "yearly" : body?.billing === "monthly" ? "monthly" : null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id, stripe_customer_id, plan")
    .eq("id", user.id)
    .single();

  // Resolve subscription ID — fallback to looking up via customer ID
  let subscriptionId = profile?.stripe_subscription_id ?? null;

  if (!subscriptionId && profile?.stripe_customer_id) {
    const list = await getStripe().subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "active",
      limit: 1,
    });
    const found = list.data[0];
    if (found) {
      subscriptionId = found.id;
      await admin
        .from("profiles")
        .update({ stripe_subscription_id: found.id })
        .eq("id", user.id);
    }
  }

  if (!subscriptionId) {
    return NextResponse.json(
      { error: t("errors.billing.noActiveSubscription") },
      { status: 400 }
    );
  }

  const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data"],
  });

  const itemId = sub.items.data[0]?.id;
  if (!itemId) {
    return NextResponse.json(
      { error: t("errors.billing.subscriptionItemNotFound") },
      { status: 500 }
    );
  }

  // Par défaut, l'intervalle ne bouge pas (annuel reste annuel) ; l'appelant
  // peut demander le retour au mensuel.
  const currentInterval = sub.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";
  const interval = askedInterval ?? currentInterval;

  // Cette route ne fait que DESCENDRE, et il y a deux façons de descendre :
  //   · changer de palier vers le bas ;
  //   · rester sur son palier mais quitter l'engagement annuel.
  // Dans les deux cas c'est appliqué à l'échéance, jamais facturé maintenant :
  // le user garde ce qu'il a payé jusqu'au bout.
  const descendEnPalier = planRank(target) < planRank(profile?.plan);
  const revientAuMensuel =
    planRank(target) === planRank(profile?.plan) && currentInterval === "yearly" && interval === "monthly";
  if (!descendEnPalier && !revientAuMensuel) {
    return NextResponse.json(
      { error: t("errors.billing.alreadyOnSolo") },
      { status: 400 }
    );
  }

  const targetPriceId = getPlanPriceId(target, interval);
  if (!targetPriceId) {
    return NextResponse.json(
      { error: `${planPriceEnvName(target, interval)} non configuré.` },
      { status: 500 }
    );
  }

  // Switch to the target price at next billing cycle — no immediate DB update.
  // The user keeps their current access until the period ends; the webhook
  // invoice.paid (billing_reason: subscription_cycle) applies the target plan
  // in DB when the next invoice is paid.
  await getStripe().subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: targetPriceId }],
    proration_behavior: "none",
    metadata: { plan: target },
  });

  return NextResponse.json({ success: true });
}
