import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveToActiveClient, moveToChurned } from "@/lib/brevo";
import { resetUsage } from "@/lib/usage";
import { recordTransaction, creditWelcomeTokens } from "@/lib/tokens-server";
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
  plan: "solo" | "pro",
  customerId?: string,
  subscriptionId?: string
) {
  const admin = createAdminClient();
  await admin
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

  const info = await getUserInfo(userId);
  if (info) {
    moveToActiveClient(info.email, info.firstName).catch(console.error);
  }
}

async function markUserUnpaid(userId: string) {
  const admin = createAdminClient();
  await admin.from("profiles").update({ has_paid: false }).eq("id", userId);
}

async function markUserChurned(userId: string) {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      has_paid: false,
      plan: null,
      stripe_subscription_id: null,
      email_sequence: "churned",
      email_sequence_updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

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

function resolvePlanFromPriceId(priceId: string, metadataPlan?: string): "solo" | "pro" {
  if (priceId && priceId === process.env.STRIPE_PRICE_ID_SOLO) return "solo";
  if (priceId && process.env.STRIPE_PRICE_ID_PRO && priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  // Fallback: use subscription metadata plan field (set at checkout time)
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

      await admin.from("profiles").update(updatePayload).eq("id", uid);

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

    // Paiement échoué → révoquer l'accès
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = getSubscriptionId(invoice);
      if (subId) {
        const sub = await getStripe().subscriptions.retrieve(subId);
        const uid = sub.metadata?.supabase_user_id;
        if (uid) await markUserUnpaid(uid);
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
      if (uid && sub.items.data[0]?.price?.id) {
        const plan = resolvePlanFromPriceId(sub.items.data[0].price.id, sub.metadata?.plan);
        if (plan === "pro") {
          const admin = createAdminClient();
          await admin.from("profiles").update({ plan }).eq("id", uid);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
