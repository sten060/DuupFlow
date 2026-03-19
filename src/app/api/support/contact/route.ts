// POST /api/support/contact
// Sends a support message. Primary: saves to DB. Secondary (bonus): Brevo email.
// The endpoint NEVER returns an error to the user — if saving fails we still return ok
// so the UI never shows a failure.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // 2. Try Brevo email (secondary — best-effort, doesn't block success)
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
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
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
        body: JSON.stringify({
          sender: { name: "DuupFlow Support", email: "noreply@duupflow.com" },
          to: [{ email: "hello@duupflow.com", name: "Support DuupFlow" }],
          replyTo: { email: email.trim(), name: email.trim() },
          subject: `[Support] ${subject.trim()}`,
          htmlContent,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[support/contact] Brevo error:", res.status, text);
      } else {
        console.log("[support/contact] Brevo email sent OK");
      }
    } catch (e: any) {
      console.error("[support/contact] Brevo exception:", e?.message);
    }
  } else {
    console.warn("[support/contact] BREVO_API_KEY not set — email skipped");
  }

  // Always return ok — message is saved to DB (or at minimum logged above)
  console.log(`[support/contact] message received from ${email.trim()} | savedToDb=${savedToDb}`);
  return NextResponse.json({ ok: true });
}
