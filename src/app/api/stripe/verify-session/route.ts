import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveToActiveClient } from "@/lib/brevo";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[verify-session] Auth error:", authError?.message ?? "no user");
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const { sessionId } = body as { sessionId?: string };
  if (!sessionId || typeof sessionId !== "string") {
    console.error("[verify-session] Missing sessionId");
    return NextResponse.json({ error: "session_id manquant" }, { status: 400 });
  }

  console.log(`[verify-session] user=${user.id} session=${sessionId}`);

  let session;
  try {
    // Expand subscription + customer pour récupérer les IDs Stripe complets
    session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });
  } catch (err) {
    console.error("[verify-session] Stripe retrieve error:", err);
    return NextResponse.json({ error: "Session Stripe introuvable" }, { status: 404 });
  }

  console.log(`[verify-session] client_reference_id=${session.client_reference_id} payment_status=${session.payment_status}`);

  // Vérifier que la session appartient bien à cet utilisateur
  if (session.client_reference_id !== user.id) {
    console.error(`[verify-session] ID mismatch: session has ${session.client_reference_id}, user is ${user.id}`);
    return NextResponse.json({ error: "Session non autorisée" }, { status: 403 });
  }

  if (session.payment_status !== "paid") {
    console.warn(`[verify-session] payment_status is ${session.payment_status}, not paid`);

    // Fallback : pour les abonnements, vérifier directement le statut de la subscription.
    // Dans certaines configurations Stripe (API récente, methode de paiement spécifique),
    // payment_status peut ne pas être "paid" immédiatement même si la subscription est active.
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as { id?: string } | null)?.id ?? null;

    if (subId) {
      try {
        const sub = await getStripe().subscriptions.retrieve(subId);
        console.log(`[verify-session] subscription ${subId} status=${sub.status}`);
        if (sub.status !== "active" && sub.status !== "trialing") {
          return NextResponse.json({ paid: false, payment_status: session.payment_status, subscription_status: sub.status });
        }
        // La subscription est active → on continue malgré payment_status != "paid"
        console.log(`[verify-session] subscription is active, proceeding despite payment_status=${session.payment_status}`);
      } catch (err) {
        console.error("[verify-session] subscription retrieve error:", err);
        return NextResponse.json({ paid: false, payment_status: session.payment_status });
      }
    } else {
      return NextResponse.json({ paid: false, payment_status: session.payment_status });
    }
  }

  // Paiement confirmé — extraire les IDs Stripe depuis la session expandée
  const plan = session.metadata?.plan === "solo" ? "solo" : "pro";
  const affiliateCode = session.metadata?.affiliate_code ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as { id?: string } | null)?.id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer as { id?: string } | null)?.id ?? null;

  console.log(`[verify-session] plan=${plan} subscriptionId=${subscriptionId} customerId=${customerId}`);

  const admin = createAdminClient();

  // .select() renvoie les lignes modifiées → si le tableau est vide,
  // le profil n'existe pas encore et l'update n'a touché aucune ligne.
  const { data: updatedRows, error: updateError } = await admin.from("profiles").update({
    has_paid: true,
    plan,
    // Stocker les IDs Stripe immédiatement — indispensable pour que
    // customer.subscription.deleted ne churn pas un utilisateur dont
    // stripe_subscription_id est encore null.
    ...(customerId ? { stripe_customer_id: customerId } : {}),
    ...(subscriptionId ? { stripe_subscription_id: subscriptionId, subscription_period_start: new Date().toISOString() } : {}),
    email_sequence: "active",
    email_sequence_updated_at: new Date().toISOString(),
    ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
  }).eq("id", user.id).select("id");

  if (updateError) {
    console.error("[verify-session] Supabase update error:", updateError);
    return NextResponse.json({ error: "Erreur mise à jour Supabase", detail: updateError.message }, { status: 500 });
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Le profil n'existe pas encore — on le crée via upsert
    console.warn(`[verify-session] Aucune ligne mise à jour pour user ${user.id} — tentative d'upsert`);
    const { error: upsertError } = await admin.from("profiles").upsert({
      id: user.id,
      has_paid: true,
      plan,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId, subscription_period_start: new Date().toISOString() } : {}),
      email_sequence: "active",
      email_sequence_updated_at: new Date().toISOString(),
      ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
    });
    if (upsertError) {
      console.error("[verify-session] Supabase upsert error:", upsertError);
      return NextResponse.json({ error: "Erreur création profil", detail: upsertError.message }, { status: 500 });
    }
  }

  console.log(`[verify-session] has_paid=true set for user ${user.id}`);

  // Déclencher la séquence Brevo (en arrière-plan)
  const [{ data: authUser }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(user.id),
    admin.from("profiles").select("first_name").eq("id", user.id).single(),
  ]);
  const email = authUser?.user?.email;
  if (email) {
    const name = profile?.first_name ?? "";
    moveToActiveClient(email, name).catch(console.error);
  }

  return NextResponse.json({ paid: true });
}
