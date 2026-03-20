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
    session = await getStripe().checkout.sessions.retrieve(sessionId);
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
    return NextResponse.json({ paid: false, payment_status: session.payment_status });
  }

  // Paiement confirmé — mettre à jour Supabase
  const admin = createAdminClient();
  const { error: updateError } = await admin.from("profiles").update({
    has_paid: true,
    email_sequence: "active",
    email_sequence_updated_at: new Date().toISOString(),
  }).eq("id", user.id);

  if (updateError) {
    console.error("[verify-session] Supabase update error:", updateError);
    return NextResponse.json({ error: "Erreur mise à jour Supabase", detail: updateError.message }, { status: 500 });
  }

  console.log(`[verify-session] has_paid=true set for user ${user.id}`);

  // Déclencher la séquence Brevo (en arrière-plan)
  const [{ data: authUser }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(user.id),
    admin.from("profiles").select("first_name").eq("id", user.id).single(),
  ]);
  const email = authUser?.user?.email;
  if (email) {
    moveToActiveClient(email, profile?.first_name ?? "").catch(console.error);
  }

  return NextResponse.json({ paid: true });
}
