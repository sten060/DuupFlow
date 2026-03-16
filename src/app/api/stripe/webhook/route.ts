import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveToActiveClient, moveToChurned } from "@/lib/brevo";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

async function getUserInfo(userId: string): Promise<{ email: string; firstName: string } | null> {
  const admin = createAdminClient();
  const [{ data: authUser }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("first_name").eq("id", userId).single(),
  ]);
  const email = authUser?.user?.email;
  if (!email) return null;
  return { email, firstName: profile?.first_name ?? "" };
}

async function markUserPaid(userId: string) {
  const admin = createAdminClient();
  await admin.from("profiles").update({
    has_paid: true,
    email_sequence: "active",
    email_sequence_updated_at: new Date().toISOString(),
  }).eq("id", userId);

  // Move to Active Clients in Brevo → triggers the paid onboarding sequence
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
  await admin.from("profiles").update({
    has_paid: false,
    email_sequence: "churned",
    email_sequence_updated_at: new Date().toISOString(),
  }).eq("id", userId);

  // Move to Churned in Brevo → triggers the win-back sequence
  const info = await getUserInfo(userId);
  if (info) {
    moveToChurned(info.email, info.firstName).catch(console.error);
  }
}

// Dans l'API Stripe 2025-02-24.acacia, l'ID d'abonnement est dans
// invoice.parent.subscription_details.subscription (plus invoice.subscription)
function getSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = (invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent;
  return parent?.subscription_details?.subscription ?? null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    // Paiement initial réussi → accès débloqué + séquence Active Client
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await getStripe().subscriptions.retrieve(session.subscription as string);
        const uid = sub.metadata?.supabase_user_id ?? session.client_reference_id;
        if (uid) await markUserPaid(uid);
      } else if (session.client_reference_id) {
        await markUserPaid(session.client_reference_id);
      }
      break;
    }

    // Renouvellement mensuel → maintenir l'accès
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = getSubscriptionId(invoice);
      if (subId) {
        const sub = await getStripe().subscriptions.retrieve(subId);
        const uid = sub.metadata?.supabase_user_id;
        if (uid) {
          const admin = createAdminClient();
          await admin.from("profiles").update({ has_paid: true }).eq("id", uid);
        }
      }
      break;
    }

    // Paiement échoué → révoquer l'accès (Stripe retry, pas de séquence churned)
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
      if (uid) await markUserChurned(uid);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
