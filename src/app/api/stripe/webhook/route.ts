import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveToActiveClient, moveToChurned } from "@/lib/brevo";
import { resetUsage } from "@/lib/usage";
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
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    // Paiement initial → accès débloqué + plan déterminé par le price ID
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
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

        if (uid) {
          // Cancel ALL other active subscriptions for this customer in Stripe.
          // Using the DB stripe_subscription_id is unreliable (can be null/stale),
          // so we query Stripe directly to find any duplicates.
          if (customerId) {
            const activeSubs = await getStripe().subscriptions.list({
              customer: customerId,
              status: "active",
              limit: 10,
            });
            for (const oldSub of activeSubs.data) {
              if (oldSub.id !== sub.id) {
                await getStripe().subscriptions.cancel(oldSub.id).catch(console.error);
              }
            }
          }

          await markUserPaid(uid, plan, customerId, sub.id);

          // Save affiliate_code to profile if not already set (filet de sécurité)
          const affiliateCode = session.metadata?.affiliate_code;
          if (affiliateCode) {
            const admin = createAdminClient();
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
        }
      } else if (session.client_reference_id) {
        await markUserPaid(session.client_reference_id, "pro");
      }
      break;
    }

    // Renouvellement mensuel → maintenir l'accès + reset usage + sync plan
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const billingReason = (invoice as any).billing_reason as string;
      const subId = getSubscriptionId(invoice);

      if (subId) {
        const sub = await getStripe().subscriptions.retrieve(subId, {
          expand: ["items.data.price"],
        });
        const uid = sub.metadata?.supabase_user_id;
        if (uid) {
          const admin = createAdminClient();

          // On subscription_cycle, sync the plan from the current price so
          // a pending downgrade (Pro → Solo) takes effect at the right time.
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

          // ── Tracking affiliation ──────────────────────────────────────
          // Use affiliate_code from subscription metadata first (avoids race condition
          // where invoice.paid fires before checkout.session.completed saves it to profile)
          const { data: profile } = await admin
            .from("profiles")
            .select("affiliate_code")
            .eq("id", uid)
            .single();

          const resolvedAffiliateCode =
            (sub.metadata?.affiliate_code as string | undefined) ?? profile?.affiliate_code;

          if (resolvedAffiliateCode) {
            // Also backfill profile if not yet set
            if (!profile?.affiliate_code) {
              await admin
                .from("profiles")
                .update({ affiliate_code: resolvedAffiliateCode })
                .eq("id", uid);
            }

            const { data: affiliate } = await admin
              .from("affiliates")
              .select("code, commission_pct")
              .eq("code", resolvedAffiliateCode)
              .single();

            if (affiliate) {
              const amountCents = (invoice as any).amount_paid as number;
              const commissionCents = Math.round(
                (amountCents * affiliate.commission_pct) / 100
              );
              await admin.from("affiliate_payments").upsert(
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
            }
          }
          // ─────────────────────────────────────────────────────────────
        }
      }
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
