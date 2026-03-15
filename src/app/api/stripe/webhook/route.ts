import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export const dynamic = "force-dynamic";

async function markUserPaid(userId: string) {
  const admin = createAdminClient();
  await admin.from("profiles").update({ has_paid: true }).eq("id", userId);
}

async function markUserUnpaid(userId: string) {
  const admin = createAdminClient();
  await admin.from("profiles").update({ has_paid: false }).eq("id", userId);
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
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    // Paiement initial réussi → accès débloqué
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const uid = sub.metadata?.supabase_user_id ?? session.client_reference_id;
        if (uid) await markUserPaid(uid);
      } else if (session.client_reference_id) {
        await markUserPaid(session.client_reference_id);
      }
      break;
    }

    // Renouvellement mensuel → maintenir l'accès actif
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = getSubscriptionId(invoice);
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        const uid = sub.metadata?.supabase_user_id;
        if (uid) await markUserPaid(uid);
      }
      break;
    }

    // Paiement échoué → révoquer l'accès
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = getSubscriptionId(invoice);
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        const uid = sub.metadata?.supabase_user_id;
        if (uid) await markUserUnpaid(uid);
      }
      break;
    }

    // Abonnement annulé → révoquer l'accès
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.supabase_user_id;
      if (uid) await markUserUnpaid(uid);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
