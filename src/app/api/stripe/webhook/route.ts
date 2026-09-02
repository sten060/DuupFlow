import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveToActiveClient, moveToChurned } from "@/lib/brevo";
import { resetUsage } from "@/lib/usage";
import { recordTransaction, creditWelcomeTokens } from "@/lib/tokens-server";
import { planRank } from "@/lib/plans";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

async function getUserInfo(
  userId: string
): Promise<{ email: string; firstName: string } | null> {
  const admin = createAdminClient();
  const [{ data: authUser }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("first_name").eq("id", userId).single(),
  ]);
  const email = authUser?.user?.email;
  if (!email) return null;
  return { email, firstName: profile?.first_name ?? "" };
}

async function markUserPaid(
  userId: string,
  plan: "starter" | "solo" | "pro",
  customerId?: string,
  subscriptionId?: string
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      has_paid: true,
      plan,
      stripe_customer_id: customerId ?? undefined,
      stripe_subscription_id: subscriptionId ?? undefined,
      subscription_period_start: new Date().toISOString(),
      email_sequence: "active",
      email_sequence_updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  // NE JAMAIS avaler cette erreur : l'update est atomique, donc un plan refusé
  // (contrainte profiles_plan_check, cf. migration 054) fait échouer TOUT le
  // payload — le user paie et reste sur les quotas Free, sans le moindre log.
  // C'est exactement ce qui est arrivé aux abonnés Starter avant la mig. 054.
  if (error) {
    console.error(
      `[webhook] markUserPaid FAILED user=${userId} plan=${plan} — le profil reste NON mis à jour:`,
      error.message,
      error.code,
    );
  }

  const info = await getUserInfo(userId);
  if (info) {
    moveToActiveClient(info.email, info.firstName).catch(console.error);
  }
}

async function markUserUnpaid(userId: string) {
  const admin = createAdminClient();
  await admin.from("profiles").update({ has_paid: false }).eq("id", userId);
}

/**
 * Sync the raw Stripe subscription state onto the profile so analytics can
 * tell trialing / active / canceled apart (has_paid alone can't — it flips
 * true the moment a trial starts).
 *
 * Guard: ignore events for a stale subscription. After an upgrade the DB
 * points at the NEW sub, and Stripe may still emit `updated`/`deleted` on the
 * OLD one — writing its status would corrupt the profile. We sync only when
 * the event's sub is the active one (or none is stored yet, e.g. the trial's
 * `created` racing ahead of checkout.session.completed).
 */
async function syncSubscriptionState(userId: string, sub: Stripe.Subscription) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .single();

  if (
    profile?.stripe_subscription_id &&
    profile.stripe_subscription_id !== sub.id
  ) {
    return; // event belongs to a superseded subscription — ignore
  }

  await admin
    .from("profiles")
    .update({
      subscription_status: sub.status,
      trial_end: sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    })
    .eq("id", userId);
}

/**
 * Stripe reported a failed payment / past_due status.
 *
 * Snapshot the current plan into `paused_plan`, downgrade the user to Free
 * (so Free quotas + Free AI variation pricing apply immediately) and raise
 * the `payment_overdue` flag → triggers the blocking modal in the dashboard.
 *
 * Idempotent: re-firing on a user already overdue is a no-op (we don't
 * overwrite a non-null `paused_plan` so a 2nd webhook doesn't lose the
 * original plan).
 */
async function pauseUserForOverduePayment(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, payment_overdue, paused_plan")
    .eq("id", userId)
    .single();
  if (!profile) return;

  // Already paused → don't overwrite the snapshot.
  if (profile.payment_overdue && profile.paused_plan) return;

  const currentPlan = (profile.plan as string | null) ?? null;
  // If the user is already on Free, there's nothing to downgrade — just
  // raise the flag so the modal still shows (edge case: Free user with a
  // ghost subscription).
  const snapshot = currentPlan && currentPlan !== "free" ? currentPlan : null;

  await admin
    .from("profiles")
    .update({
      payment_overdue: true,
      paused_plan: snapshot ?? profile.paused_plan ?? null,
      payment_overdue_since: new Date().toISOString(),
      plan: "free",
      has_paid: false,
    })
    .eq("id", userId);
}

/**
 * Stripe confirmed a payment after a failure — restore the user's original
 * plan and clear the overdue flag.
 */
async function resumeUserFromOverdue(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("payment_overdue, paused_plan")
    .eq("id", userId)
    .single();
  if (!profile?.payment_overdue) return;

  const restored = (profile.paused_plan as string | null) ?? null;
  await admin
    .from("profiles")
    .update({
      payment_overdue: false,
      paused_plan: null,
      payment_overdue_since: null,
      // Restore the original plan if we had one; otherwise leave whatever is
      // there (the `invoice.paid` handler sets has_paid + plan separately).
      ...(restored ? { plan: restored, has_paid: true } : {}),
    })
    .eq("id", userId);
}

async function markUserChurned(userId: string) {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      has_paid: false,
      plan: "free",
      stripe_subscription_id: null,
      email_sequence: "churned",
      email_sequence_updated_at: new Date().toISOString(),
      // Cancellation supersedes any past_due state — clear the overdue modal
      // so we don't show two popups at once. The user is now terminally Free.
      payment_overdue: false,
      paused_plan: null,
      payment_overdue_since: null,
    })
    .eq("id", userId);

  // Raise the one-shot "subscription canceled" notice. Separate, best-effort
  // write so a not-yet-applied migration (050) can never break the churn above.
  try {
    await admin
      .from("profiles")
      .update({ cancellation_notice_pending: true })
      .eq("id", userId);
  } catch (err) {
    console.error("[webhook] cancellation_notice flag failed (mig 050?):", err);
  }

  const info = await getUserInfo(userId);
  if (info) {
    moveToChurned(info.email, info.firstName).catch(console.error);
  }
}

function getSubscriptionId(invoice: Stripe.Invoice): string | null {
  // API 2024-06-20: subscription ID is directly on invoice.subscription
  const directSub = (invoice as unknown as { subscription?: string | null }).subscription;
  if (directSub) return directSub;
  // Newer API (2025+): invoice.parent.subscription_details.subscription
  const parent = (
    invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string } };
    }
  ).parent;
  return parent?.subscription_details?.subscription ?? null;
}

/**
 * Comme resolvePlanFromPriceId mais STRICT : ne retourne un plan que si le
 * price ID correspond exactement à un des prix configurés, sinon null.
 * Utilisé quand se tromper de plan serait pire que ne rien faire (revert
 * d'un upgrade échoué).
 */
function strictPlanFromPriceId(priceId: string): "starter" | "solo" | "pro" | null {
  if (process.env.STRIPE_PRICE_ID_STARTER && priceId === process.env.STRIPE_PRICE_ID_STARTER) return "starter";
  if (process.env.STRIPE_PRICE_ID_SOLO && priceId === process.env.STRIPE_PRICE_ID_SOLO) return "solo";
  const proPrice = process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID;
  if (proPrice && priceId === proPrice) return "pro";
  // Prix annuels — même plan, intervalle différent.
  if (process.env.STRIPE_PRICE_ID_STARTER_YEARLY && priceId === process.env.STRIPE_PRICE_ID_STARTER_YEARLY) return "starter";
  if (process.env.STRIPE_PRICE_ID_SOLO_YEARLY && priceId === process.env.STRIPE_PRICE_ID_SOLO_YEARLY) return "solo";
  if (process.env.STRIPE_PRICE_ID_PRO_YEARLY && priceId === process.env.STRIPE_PRICE_ID_PRO_YEARLY) return "pro";
  return null;
}

/**
 * La facture de proration d'un UPGRADE (billing_reason=subscription_update) a
 * échoué. Le client a déjà payé son mois sur l'ANCIEN plan — le pauser en Free
 * serait lui retirer un accès réglé (incident du 29/08/2026).
 *
 * À la place : on annule (void) la facture d'upgrade impayée, on rebascule
 * l'abonnement Stripe sur l'ancien prix (retrouvé via la ligne de crédit de
 * proration = dernier plan réellement payé) et on garde le client sur ce plan.
 * Le void ramène l'abonnement en "active" → Stripe émet un
 * customer.subscription.updated qui reconfirme l'état.
 *
 * Retourne true si le cas est traité (il ne faut PAS pauser l'utilisateur),
 * false si on n'a pas pu l'identifier proprement → l'appelant retombe sur
 * pauseUserForOverduePayment.
 */
async function revertFailedUpgrade(
  userId: string,
  invoice: Stripe.Invoice
): Promise<boolean> {
  const subId = getSubscriptionId(invoice);
  if (!subId || !invoice.id) return false;

  // La facture d'upgrade contient une ligne de crédit (montant négatif) pour
  // le temps non utilisé de l'ANCIEN prix : c'est le plan que le client a
  // réellement payé. Comme pour getSubscriptionId, le price d'une ligne se
  // trouve à deux endroits selon la version d'API de l'endpoint webhook :
  // API 2024-06-20 → line.price.id ; API 2025+ → line.pricing.price_details.price.
  const linePriceId = (l: Stripe.InvoiceLineItem): string | undefined => {
    const direct = (l as any).price?.id as string | undefined;
    if (direct) return direct;
    return (l as any).pricing?.price_details?.price as string | undefined;
  };
  const creditLine = invoice.lines?.data?.find(
    (l) => l.amount < 0 && linePriceId(l)
  );
  const oldPriceId = (creditLine ? linePriceId(creditLine) : undefined) ?? null;
  const oldPlan = oldPriceId ? strictPlanFromPriceId(oldPriceId) : null;
  if (!oldPriceId || !oldPlan) {
    console.error(
      `[webhook] revertFailedUpgrade: ancien prix introuvable sur la facture ${invoice.id} — fallback pause`
    );
    return false;
  }

  // Re-lire le statut réel de la facture : si elle a été payée entre-temps
  // (3DS complété…), l'upgrade a finalement réussi — ne rien toucher.
  const freshInvoice = await getStripe().invoices.retrieve(invoice.id);
  if (freshInvoice.status === "paid") {
    console.log(
      `[webhook] revertFailedUpgrade: facture ${invoice.id} finalement payée — upgrade maintenu`
    );
    return true;
  }

  // 1) Void d'abord : la facture ne doit plus jamais pouvoir être payée une
  //    fois l'abonnement rebasculé (sinon le client paierait un plan qu'il n'a
  //    plus). Le void sort aussi l'abonnement de past_due.
  if (freshInvoice.status === "open") {
    try {
      await getStripe().invoices.voidInvoice(invoice.id);
    } catch (err) {
      console.error(
        `[webhook] revertFailedUpgrade: void de la facture ${invoice.id} impossible:`,
        err
      );
      return false;
    }
  }

  // 2) Rebasculer l'abonnement sur l'ancien prix, sans nouvelle proration.
  const sub = await getStripe().subscriptions.retrieve(subId, {
    expand: ["items.data.price"],
  });
  const itemId = sub.items.data[0]?.id;
  const currentPriceId = sub.items.data[0]?.price?.id;
  if (itemId && currentPriceId && currentPriceId !== oldPriceId) {
    await getStripe().subscriptions.update(subId, {
      items: [{ id: itemId, price: oldPriceId }],
      proration_behavior: "none",
      metadata: { plan: oldPlan },
    });
  }

  // 3) La DB doit refléter le plan payé. Si un événement arrivé avant nous a
  //    déjà pausé le user, on corrige juste le snapshot (le retour en "active"
  //    déclenché par le void fera le resume via le webhook) ; sinon on
  //    s'assure que le plan payé est bien en place.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("payment_overdue")
    .eq("id", userId)
    .single();
  if (profile?.payment_overdue) {
    await admin
      .from("profiles")
      .update({ paused_plan: oldPlan })
      .eq("id", userId);
  } else {
    await admin
      .from("profiles")
      .update({ plan: oldPlan, has_paid: true })
      .eq("id", userId);
  }

  console.log(
    `[webhook] revertFailedUpgrade: user ${userId} maintenu sur ${oldPlan}, facture ${invoice.id} annulée`
  );
  return true;
}

function resolvePlanFromPriceId(priceId: string, metadataPlan?: string): "starter" | "solo" | "pro" {
  if (priceId && process.env.STRIPE_PRICE_ID_STARTER && priceId === process.env.STRIPE_PRICE_ID_STARTER) return "starter";
  if (priceId && priceId === process.env.STRIPE_PRICE_ID_SOLO) return "solo";
  if (priceId && process.env.STRIPE_PRICE_ID_PRO && priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  // Prix annuels — même plan, intervalle différent.
  if (priceId && process.env.STRIPE_PRICE_ID_STARTER_YEARLY && priceId === process.env.STRIPE_PRICE_ID_STARTER_YEARLY) return "starter";
  if (priceId && priceId === process.env.STRIPE_PRICE_ID_SOLO_YEARLY) return "solo";
  if (priceId && process.env.STRIPE_PRICE_ID_PRO_YEARLY && priceId === process.env.STRIPE_PRICE_ID_PRO_YEARLY) return "pro";
  // Fallback: use subscription metadata plan field (set at checkout time)
  if (metadataPlan === "starter") return "starter";
  if (metadataPlan === "solo") return "solo";
  if (metadataPlan === "pro") return "pro";
  return "pro";
}

export async function POST(request: NextRequest) {
  console.log("[webhook] POST received");
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("[webhook] Missing stripe-signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[webhook] Invalid signature:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[webhook] event:", event.type, event.id);

  switch (event.type) {
    // Paiement initial → accès débloqué + plan déterminé par le price ID
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("[webhook] checkout.session.completed:", session.id);

      // ── AI token topup (one-shot, mode: "payment") ──────────────────
      if (session.metadata?.type === "ai_topup") {
        const uid = session.metadata?.supabase_user_id ?? session.client_reference_id;
        const amountCents = Number(session.metadata?.amount_cents);
        console.log("[webhook] ai_topup uid:", uid, "amount_cents:", amountCents);
        if (uid && Number.isInteger(amountCents) && amountCents > 0) {
          const result = await recordTransaction({
            userId: uid,
            deltaCents: amountCents,
            reason: "topup",
            metadata: {
              stripe_session_id: session.id,
              payment_intent: session.payment_intent,
            },
          });
          if (!result.ok) {
            console.error("[webhook] ai_topup credit failed:", result.error);
          } else {
            console.log("[webhook] ai_topup credited; new balance:", result.balanceCents);
          }
        } else {
          console.warn("[webhook] ai_topup invalid metadata, skipping");
        }
        // Stop here — this session has no subscription to process.
        return NextResponse.json({ received: true });
      }

      if (session.subscription) {
        const sub = await getStripe().subscriptions.retrieve(
          session.subscription as string,
          { expand: ["items.data.price"] }
        );
        const priceId = sub.items.data[0]?.price?.id ?? "";
        const plan = resolvePlanFromPriceId(priceId, sub.metadata?.plan);
        const uid =
          sub.metadata?.supabase_user_id ?? session.client_reference_id;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;

        console.log("[webhook] checkout uid:", uid, "plan:", plan, "affiliate_code:", session.metadata?.affiliate_code);

        if (uid) {
          // Cancel ALL other active subscriptions for this customer in Stripe.
          if (customerId) {
            try {
              const activeSubs = await getStripe().subscriptions.list({
                customer: customerId,
                status: "active",
                limit: 10,
              });
              for (const oldSub of activeSubs.data) {
                if (oldSub.id !== sub.id) {
                  try {
                    await getStripe().subscriptions.cancel(oldSub.id);
                  } catch (cancelErr) {
                    console.error("[webhook] failed to cancel old subscription:", oldSub.id, cancelErr);
                  }
                }
              }
            } catch (listErr) {
              console.error("[webhook] failed to list active subscriptions:", listErr);
            }
          }

          await markUserPaid(uid, plan, customerId, sub.id);

          // Welcome tokens for new Solo/Pro subscribers (3 images worth).
          // Idempotent — won't double-credit if the user already received
          // this plan's welcome on a previous subscription.
          creditWelcomeTokens(uid, plan).catch((err) =>
            console.error("[webhook] welcome credit failed:", err),
          );

          const affiliateCode = session.metadata?.affiliate_code;
          const admin = createAdminClient();

          // Save affiliate_code to profile if not already set
          if (affiliateCode) {
            const { data: profile } = await admin
              .from("profiles")
              .select("affiliate_code")
              .eq("id", uid)
              .single();
            if (!profile?.affiliate_code) {
              await admin
                .from("profiles")
                .update({ affiliate_code: affiliateCode.toUpperCase() })
                .eq("id", uid);
            }
          }

          // ── Tracking affiliation (premier paiement) ───────────────────
          const invoiceId = typeof session.invoice === "string" ? session.invoice : null;
          console.log("[webhook] affiliate tracking — code:", affiliateCode, "invoiceId:", invoiceId);
          if (affiliateCode && invoiceId) {
            const { data: affiliate, error: affErr } = await admin
              .from("affiliates")
              .select("code, commission_pct")
              .eq("code", affiliateCode.toUpperCase())
              .single();
            console.log("[webhook] affiliate lookup:", affiliate, "error:", affErr);
            if (affiliate) {
              const amountCents = session.amount_total ?? 0;
              const commissionCents = Math.round(
                (amountCents * affiliate.commission_pct) / 100
              );
              const { error: upsertErr } = await admin.from("affiliate_payments").upsert(
                {
                  affiliate_code: affiliate.code,
                  user_id: uid,
                  stripe_invoice_id: invoiceId,
                  amount_cents: amountCents,
                  commission_cents: commissionCents,
                  commission_pct: affiliate.commission_pct,
                  plan,
                  billing_reason: "subscription_create",
                  paid_at: new Date().toISOString(),
                },
                { onConflict: "stripe_invoice_id", ignoreDuplicates: true }
              );
              if (upsertErr) {
                console.error("[webhook] affiliate_payments upsert error:", upsertErr);
              } else {
                console.log("[webhook] affiliate payment recorded — invoice:", invoiceId, "commission:", commissionCents);
              }
            }
          }
          // ─────────────────────────────────────────────────────────────
        }
      } else if (session.client_reference_id) {
        await markUserPaid(session.client_reference_id, "pro");
        creditWelcomeTokens(session.client_reference_id, "pro").catch((err) =>
          console.error("[webhook] welcome credit (fallback) failed:", err),
        );
      }
      break;
    }

    // Renouvellement mensuel → maintenir l'accès + reset usage + sync plan + commission affilié
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const billingReason = (invoice as any).billing_reason as string;
      const subId = getSubscriptionId(invoice);
      console.log("[webhook] invoice.paid:", invoice.id, "billing_reason:", billingReason, "subId:", subId);

      if (!subId) {
        console.warn("[webhook] invoice.paid: no subId found, skipping");
        break;
      }

      const sub = await getStripe().subscriptions.retrieve(subId, {
        expand: ["items.data.price"],
      });
      const uid = sub.metadata?.supabase_user_id;
      console.log("[webhook] invoice.paid uid:", uid, "sub.metadata.affiliate_code:", sub.metadata?.affiliate_code);

      if (!uid) {
        console.warn("[webhook] invoice.paid: no uid in subscription metadata, skipping");
        break;
      }

      const admin = createAdminClient();
      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId
        ? resolvePlanFromPriceId(priceId, sub.metadata?.plan)
        : "pro";

      const updatePayload: Record<string, unknown> = {
        has_paid: true,
        subscription_period_start: new Date().toISOString(),
      };
      if (billingReason === "subscription_cycle") {
        updatePayload.plan = plan;
        await resetUsage(uid).catch(console.error);
      }

      const { error: invoiceUpdateErr } = await admin
        .from("profiles")
        .update(updatePayload)
        .eq("id", uid);
      if (invoiceUpdateErr) {
        console.error(
          `[webhook] invoice.paid profile update FAILED user=${uid} plan=${plan}:`,
          invoiceUpdateErr.message,
          invoiceUpdateErr.code,
        );
      }

      // If this payment recovers a previously failed cycle, clear the
      // overdue flag and restore the original plan snapshot.
      await resumeUserFromOverdue(uid).catch((err) =>
        console.error("[webhook] resumeUserFromOverdue failed:", err),
      );

      // ── Tracking affiliation (tous les paiements) ─────────────────────
      const { data: profile } = await admin
        .from("profiles")
        .select("affiliate_code")
        .eq("id", uid)
        .single();

      const resolvedAffiliateCode =
        (sub.metadata?.affiliate_code as string | undefined) ?? profile?.affiliate_code;

      console.log("[webhook] invoice.paid resolvedAffiliateCode:", resolvedAffiliateCode);

      if (resolvedAffiliateCode) {
        if (!profile?.affiliate_code) {
          await admin
            .from("profiles")
            .update({ affiliate_code: resolvedAffiliateCode })
            .eq("id", uid);
        }

        const { data: affiliate, error: affErr } = await admin
          .from("affiliates")
          .select("code, commission_pct")
          .eq("code", resolvedAffiliateCode)
          .single();

        console.log("[webhook] invoice.paid affiliate lookup:", affiliate, "error:", affErr);

        if (affiliate) {
          const amountCents = (invoice as any).amount_paid as number;
          const commissionCents = Math.round(
            (amountCents * affiliate.commission_pct) / 100
          );
          const { error: upsertErr } = await admin.from("affiliate_payments").upsert(
            {
              affiliate_code: affiliate.code,
              user_id: uid,
              stripe_invoice_id: invoice.id,
              amount_cents: amountCents,
              commission_cents: commissionCents,
              commission_pct: affiliate.commission_pct,
              plan,
              billing_reason: billingReason,
              paid_at: new Date((invoice as any).created * 1000).toISOString(),
            },
            { onConflict: "stripe_invoice_id", ignoreDuplicates: true }
          );
          if (upsertErr) {
            console.error("[webhook] invoice.paid affiliate_payments upsert error:", upsertErr);
          } else {
            console.log("[webhook] invoice.paid affiliate payment recorded:", invoice.id);
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────
      break;
    }

    // Paiement échoué → downgrade auto vers Free + flag pour la modale.
    // EXCEPTION : la proration d'un upgrade (subscription_update) — le mois en
    // cours sur l'ancien plan est déjà payé, on annule l'upgrade au lieu de
    // pauser le client en Free.
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = getSubscriptionId(invoice);
      if (subId) {
        const sub = await getStripe().subscriptions.retrieve(subId);
        const uid = sub.metadata?.supabase_user_id;
        if (uid) {
          const billingReason = (invoice as any).billing_reason as string | undefined;
          let handled = false;
          if (billingReason === "subscription_update") {
            handled = await revertFailedUpgrade(uid, invoice).catch((err) => {
              console.error("[webhook] revertFailedUpgrade failed:", err);
              return false;
            });
          }
          if (!handled) await pauseUserForOverduePayment(uid);
        }
      }
      break;
    }

    // Nouvel abonnement (inclut le démarrage d'un essai Solo) → sync l'état brut
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.supabase_user_id;
      if (uid) {
        await syncSubscriptionState(uid, sub).catch((err) =>
          console.error("[webhook] syncSubscriptionState (created) failed:", err),
        );
      }
      break;
    }

    // Abonnement annulé → révoquer l'accès + séquence Churned
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.supabase_user_id;
      if (uid) {
        const admin = createAdminClient();
        const { data: profile } = await admin
          .from("profiles")
          .select("stripe_subscription_id, has_paid")
          .eq("id", uid)
          .single();
        // Churner uniquement si c'est encore l'abonnement actif en DB.
        // Cas à éviter :
        // 1) L'utilisateur a upgradé → la DB pointe déjà sur le nouvel abonnement.
        // 2) stripe_subscription_id est null (verify-session n'a pas encore eu le
        //    temps de le stocker, ou le webhook checkout.session.completed n'est pas
        //    encore passé) → on ne churn PAS pour éviter de révoquer un accès
        //    qui vient d'être accordé.
        const isCurrentSub = profile?.stripe_subscription_id === sub.id;
        if (isCurrentSub) {
          // Persist the canceled status / cancel_at_period_end before churning.
          await syncSubscriptionState(uid, sub).catch((err) =>
            console.error("[webhook] syncSubscriptionState (deleted) failed:", err),
          );
          await markUserChurned(uid);
        } else {
          console.log(
            `[webhook] subscription.deleted ignoré — sub ${sub.id} n'est pas l'abonnement actif en DB (${profile?.stripe_subscription_id ?? "null"})`
          );
        }
      }
      break;
    }

    // Mise à jour d'abonnement (ex: upgrade via portail Stripe)
    // Only sync immediately for upgrades (→ pro). Downgrades (→ solo) are
    // intentionally deferred to the next invoice.paid cycle so the user
    // keeps Pro access until the end of the current billing period.
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.supabase_user_id;

      // Persist raw subscription state (trialing/active/canceled, trial_end,
      // cancel_at_period_end) so analytics can distinguish trial from paid.
      if (uid) {
        await syncSubscriptionState(uid, sub).catch((err) =>
          console.error("[webhook] syncSubscriptionState (updated) failed:", err),
        );
      }

      // Sync overdue state from Stripe status changes — covers cases
      // where payment_failed wasn't fired or arrived in another order.
      if (uid) {
        if (sub.status === "past_due" || sub.status === "unpaid") {
          // Si le past_due vient d'une proration d'UPGRADE impayée, ne pas
          // pauser en Free : le mois de l'ancien plan est déjà payé — on
          // annule l'upgrade à la place (même logique que payment_failed,
          // pour couvrir le cas où cet événement arrive en premier).
          let handled = false;
          const latestInvoiceId =
            typeof sub.latest_invoice === "string"
              ? sub.latest_invoice
              : (sub.latest_invoice as Stripe.Invoice | null)?.id;
          if (latestInvoiceId) {
            try {
              const latestInvoice = await getStripe().invoices.retrieve(latestInvoiceId);
              // Pas de test sur le statut de la facture ici : revertFailedUpgrade
              // est idempotent (payée → upgrade maintenu ; déjà voidée → il ne
              // reste qu'à vérifier le prix/la DB).
              if (
                ((latestInvoice as any).billing_reason as string | undefined) ===
                "subscription_update"
              ) {
                handled = await revertFailedUpgrade(uid, latestInvoice);
              }
            } catch (err) {
              console.error("[webhook] upgrade-failure check failed:", err);
            }
          }
          if (!handled) {
            await pauseUserForOverduePayment(uid).catch((err) =>
              console.error("[webhook] pauseUserForOverduePayment failed:", err),
            );
          }
        } else if (sub.status === "active") {
          await resumeUserFromOverdue(uid).catch((err) =>
            console.error("[webhook] resumeUserFromOverdue failed:", err),
          );
        }
      }

      // Only (re)grant the plan when the subscription is genuinely in good
      // standing. Without this guard a past_due/unpaid Pro sub would be paused
      // to Free just above, then immediately re-promoted to Pro here (the price
      // is still Pro) — handing full access back to a non-paying user.
      const inGoodStanding = sub.status === "active" || sub.status === "trialing";
      if (uid && inGoodStanding && sub.items.data[0]?.price?.id) {
        const resolved = resolvePlanFromPriceId(sub.items.data[0].price.id, sub.metadata?.plan);
        const admin = createAdminClient();
        const { data: cur } = await admin.from("profiles").select("plan").eq("id", uid).single();
        const currentPlan = (cur as { plan: string | null } | null)?.plan ?? null;
        // Apply UPGRADES (or an equal-tier re-grant, e.g. restoring access after a
        // resume) immediately. DOWNGRADES must stay deferred to the next billing
        // cycle (handled by invoice.paid / subscription_cycle) — dropping a paying
        // user to a lower tier the moment the price changes would revoke access
        // they've already paid for. This preserves the original Pro→Solo behaviour.
        if (planRank(resolved) >= planRank(currentPlan)) {
          await admin.from("profiles").update({ plan: resolved }).eq("id", uid);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
