import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

// Désactiver le body parsing par défaut de Next.js (Stripe a besoin du raw body)
export const config = { api: { bodyParser: false } };

async function markUserPaid(userId: string) {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ has_paid: true })
    .eq("id", userId);
}

async function markUserUnpaid(userId: string) {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ has_paid: false })
    .eq("id", userId);
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

  // Récupérer l'ID utilisateur Supabase depuis les métadonnées
  function getUserId(obj: { client_reference_id?: string | null; metadata?: Record<string, string> | null }): string | null {
    return obj.metadata?.supabase_user_id ?? obj.client_reference_id ?? null;
  }

  switch (event.type) {
    // Paiement initial réussi → accès débloqué
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = getUserId({ client_reference_id: session.client_reference_id, metadata: session.subscription ? undefined : undefined });
      // Récupérer depuis subscription metadata si nécessaire
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const uid = sub.metadata?.supabase_user_id ?? session.client_reference_id;
        if (uid) await markUserPaid(uid);
      } else if (session.client_reference_id) {
        await markUserPaid(session.client_reference_id);
      }
      break;
    }

    // Renouvellement d'abonnement mensuel → s'assurer que l'accès est actif
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const uid = sub.metadata?.supabase_user_id;
        if (uid) await markUserPaid(uid);
      }
      break;
    }

    // Paiement échoué ou abonnement annulé → révoquer l'accès
    case "invoice.payment_failed":
    case "customer.subscription.deleted": {
      const obj = event.data.object as Stripe.Subscription | Stripe.Invoice;
      const subId = "subscription" in obj && obj.subscription
        ? (obj.subscription as string)
        : (obj as Stripe.Subscription).id;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        const uid = sub.metadata?.supabase_user_id;
        if (uid) await markUserUnpaid(uid);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
