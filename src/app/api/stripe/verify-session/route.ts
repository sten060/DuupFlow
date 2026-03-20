import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveToActiveClient } from "@/lib/brevo";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { sessionId } = await request.json();
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "session_id manquant" }, { status: 400 });
  }

  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "Session Stripe introuvable" }, { status: 404 });
  }

  // Vérifier que la session appartient bien à cet utilisateur
  if (session.client_reference_id !== user.id) {
    return NextResponse.json({ error: "Session non autorisée" }, { status: 403 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ paid: false });
  }

  // Paiement confirmé — mettre à jour Supabase
  const admin = createAdminClient();
  await admin.from("profiles").update({
    has_paid: true,
    email_sequence: "active",
    email_sequence_updated_at: new Date().toISOString(),
  }).eq("id", user.id);

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
