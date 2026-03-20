import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Aucun abonnement actif trouvé." },
      { status: 400 }
    );
  }

  // Schedule cancellation at end of current billing period — access remains until then
  const sub = await getStripe().subscriptions.update(
    profile.stripe_subscription_id,
    { cancel_at_period_end: true }
  );

  return NextResponse.json({
    success: true,
    cancelAt: sub.cancel_at, // Unix timestamp
  });
}
