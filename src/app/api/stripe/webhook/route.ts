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
          // Cancel old subscription if user is upgrading (has a different active sub)
          const admin = createAdminClient();
          const { data: existingProfile } = await admin
            .from("profiles")
            .select("stripe_subscription_id")
            .eq("id", uid)
            .single();

          if (
            existingProfile?.stripe_subscription_id &&
            existingProfile.stripe_subscription_id !== sub.id
          ) {
            await getStripe()
              .subscriptions.cancel(existingProfile.stripe_subscription_id)
              .catch(console.error);
          }

          await markUserPaid(uid, plan, customerId, sub.id);
        }
      } else if (session.client_reference_id) {
        await markUserPaid(session.client_reference_id, "pro");
      }
      break;
    }

    // Renouvellement mensuel → maintenir l'accès + reset usage
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const billingReason = (invoice as any).billing_reason as string;
      const subId = getSubscriptionId(invoice);

      if (subId) {
        const sub = await getStripe().subscriptions.retrieve(subId);
        const uid = sub.metadata?.supabase_user_id;
        if (uid) {
          const admin = createAdminClient();
          await admin
            .from("profiles")
            .update({
              has_paid: true,
              subscription_period_start: new Date().toISOString(),
            })
            .eq("id", uid);

          // Reset usage only on renewal (not on initial creation)
          if (billingReason === "subscription_cycle") {
            await resetUsage(uid).catch(console.error);
          }
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
          .select("stripe_subscription_id")
          .eq("id", uid)
          .single();
        // Only churn if this is still the user's current subscription.
        // If user upgraded, their DB already points to the new sub – don't churn.
        if (!profile?.stripe_subscription_id || profile.stripe_subscription_id === sub.id) {
          await markUserChurned(uid);
        }
      }
      break;
    }

    // Mise à jour d'abonnement (ex: upgrade via portail Stripe)
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.supabase_user_id;
      if (uid && sub.items.data[0]?.price?.id) {
        const plan = resolvePlanFromPriceId(sub.items.data[0].price.id, sub.metadata?.plan);
        const admin = createAdminClient();
        await admin.from("profiles").update({ plan }).eq("id", uid);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
