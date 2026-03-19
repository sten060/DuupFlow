// POST /api/support/contact
// Sends a support message. Primary: saves to DB. Secondary: SMTP email to hello@duupflow.com.
// The endpoint NEVER returns an error to the user — if saving fails we still return ok

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const body = await req.json().catch(() => ({}));
  const { email, subject, message } = body as Record<string, string>;

  if (!email?.trim() || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const msgData = {
    user_id: user?.id ?? null,
    email: email.trim(),
    subject: subject.trim(),
    message: message.trim(),
    created_at: now,
  };

  // 1. Save to DB (primary — reliable, admin can read from dashboard)
  let savedToDb = false;
  try {
    const adminClient = createAdminClient();
    const { error: dbErr } = await adminClient.from("support_messages").insert(msgData);
    if (!dbErr) savedToDb = true;
    else console.log("[support/contact] DB insert:", dbErr.message, "(table may not exist yet)");
  } catch (e: any) {
    console.log("[support/contact] DB error:", e?.message);
  }

  // 2. Send email via SMTP directly to hello@duupflow.com
  try {
    const htmlContent = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6366f1">Nouveau message support DuupFlow</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:6px 12px;color:#888;width:120px">Utilisateur</td><td style="padding:6px 12px">${user?.id ?? "non authentifié"}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:6px 12px;color:#888">Email</td><td style="padding:6px 12px">${email.trim()}</td></tr>
          <tr><td style="padding:6px 12px;color:#888">Objet</td><td style="padding:6px 12px">${subject.trim()}</td></tr>
        </table>
        <div style="background:#f4f4f8;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px">${message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      </div>
    `;
    await sendMail({
      to: "hello@duupflow.com",
      subject: `[Support] ${subject.trim()}`,
      html: htmlContent,
      replyTo: email.trim(),
    });
    console.log("[support/contact] Email sent OK via SMTP");
  } catch (e: any) {
    console.error("[support/contact] SMTP error:", e?.message);
  }

  console.log(`[support/contact] message received from ${email.trim()} | savedToDb=${savedToDb}`);
  return NextResponse.json({ ok: true });
}
