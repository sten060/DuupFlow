import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const feedback: string = (body as Record<string, string>).feedback ?? "";

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id, stripe_customer_id")
    .eq("id", user.id)
    .single();

  // Resolve subscription ID — fallback to looking up via customer ID
  let subscriptionId = profile?.stripe_subscription_id ?? null;

  if (!subscriptionId && profile?.stripe_customer_id) {
    const list = await getStripe().subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "active",
      limit: 1,
    });
    const found = list.data[0];
    if (found) {
      subscriptionId = found.id;
      // Persist for future calls
      await admin
        .from("profiles")
        .update({ stripe_subscription_id: found.id })
        .eq("id", user.id);
    }
  }

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "Aucun abonnement actif trouvé." },
      { status: 400 }
    );
  }

  // Schedule cancellation at end of current billing period — access remains until then
  const sub = await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  // Send feedback email (best-effort, don't block the response)
  if (feedback.trim()) {
    sendMail({
      to: "hello@duupflow.com",
      subject: `[Résiliation] Feedback de ${user.email ?? "inconnu"}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#6366f1;margin-bottom:8px">Résiliation d'abonnement — Feedback</h2>
          <p style="color:#888;font-size:13px;margin-bottom:16px">
            <strong style="color:#333">Utilisateur :</strong> ${user.email ?? "inconnu"}
          </p>
          <div style="background:#f4f4f8;border-radius:8px;padding:16px;font-size:14px;white-space:pre-wrap;line-height:1.6">
            ${feedback.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </div>
          <p style="color:#aaa;font-size:11px;margin-top:16px">
            Date : ${new Date().toLocaleString("fr-FR")}
          </p>
        </div>
      `,
      replyTo: user.email,
    }).catch(console.error);
  }

  return NextResponse.json({
    success: true,
    cancelAt: sub.cancel_at, // Unix timestamp
  });
}
