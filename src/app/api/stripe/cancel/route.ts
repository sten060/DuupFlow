import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrevoEmail } from "@/lib/brevo";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const t = await getServerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
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
    // "all" (not "active") so a trialing subscription is still found.
    const list = await getStripe().subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "all",
      limit: 10,
    });
    const found = list.data.find(
      (s) => s.status === "active" || s.status === "trialing"
    );
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
      { error: t("errors.billing.noActiveSubscription") },
      { status: 400 }
    );
  }

  // Schedule cancellation at end of current billing period — access remains until then
  const sub = await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  // Save + email the feedback (best-effort — never blocks the cancellation)
  if (feedback.trim()) {
    let dbSaved = false;
    const { data: row, error: dbError } = await admin
      .from("cancellation_feedback")
      .insert({
        user_id: user.id,
        user_email: user.email ?? null,
        feedback: feedback.trim(),
        email_sent: false,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("[stripe/cancel] DB insert error (non-fatal):", dbError.message);
    } else {
      dbSaved = true;
    }

    try {
      const emailSent = await sendBrevoEmail({
        to: "hello@duupflow.com",
        toName: "DuupFlow",
        subject: `[Résiliation] Feedback de ${user.email ?? "inconnu"}`,
        htmlContent: `
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
        replyTo: user.email ?? undefined,
      });
      if (emailSent && dbSaved && row) {
        await admin
          .from("cancellation_feedback")
          .update({ email_sent: true })
          .eq("id", row.id);
      }
    } catch (err) {
      console.error("[stripe/cancel] Brevo error:", (err as Error)?.message);
    }
  }

  return NextResponse.json({
    success: true,
    cancelAt: sub.cancel_at, // Unix timestamp
  });
}
