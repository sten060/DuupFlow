// POST /api/support/contact
// Saves support message to Supabase (primary) + sends email via Brevo.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrevoEmail } from "@/lib/brevo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const body = await req.json().catch(() => ({}));
  const { contact, subject, message } = body as Record<string, string>;

  if (!contact?.trim() || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });
  }

  const userEmail = user?.email ?? null;

  // ── 1. Save to Supabase (silently skipped if table not yet created) ──────
  const admin = createAdminClient();
  let emailSent = false;
  let dbSaved = false;

  const { error: dbError } = await admin.from("support_messages").insert({
    user_id:    user?.id ?? null,
    user_email: userEmail,
    contact:    contact.trim(),
    subject:    subject.trim(),
    message:    message.trim(),
    email_sent: false,
  });

  if (dbError) {
    console.error("[support/contact] DB insert error (non-fatal):", dbError.message);
  } else {
    dbSaved = true;
  }

  // ── 2. Send email via Brevo ───────────────────────────────────────────────
  const esc = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const htmlContent = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#6366f1;margin-bottom:4px">Nouvelle demande support — DuupFlow</h2>
      <hr style="border:none;border-top:1px solid #eee;margin:12px 0" />
      <p style="margin:8px 0;font-size:13px"><strong>Compte :</strong> ${esc(userEmail ?? "Non connecté")}</p>
      <p style="margin:8px 0;font-size:13px"><strong>Contact :</strong> ${esc(contact.trim())}</p>
      <p style="margin:8px 0;font-size:13px"><strong>Objet :</strong> ${esc(subject.trim())}</p>
      <div style="background:#f4f4f8;border-radius:8px;padding:16px;margin-top:16px;font-size:14px;white-space:pre-wrap;line-height:1.6">
        ${esc(message.trim())}
      </div>
      <p style="color:#aaa;font-size:11px;margin-top:16px">Date : ${new Date().toLocaleString("fr-FR")}</p>
    </div>
  `;

  try {
    emailSent = await sendBrevoEmail({
      to: "hello@duupflow.com",
      subject: `[Support] ${subject.trim()}`,
      htmlContent,
    });

    if (emailSent && dbSaved) {
      await admin.from("support_messages")
        .update({ email_sent: true })
        .eq("contact", contact.trim())
        .eq("subject", subject.trim())
        .order("created_at", { ascending: false })
        .limit(1);
    }
  } catch (err: any) {
    console.error("[support/contact] Brevo error:", err?.message);
  }

  // Fail only if neither channel worked
  if (!emailSent && !dbSaved) {
    console.error("[support/contact] Both DB and email failed");
    return NextResponse.json({ error: "Impossible d'envoyer le message. Réessayez plus tard." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, emailSent, dbSaved });
}
