// POST /api/support/contact
// Sends a support message to hello@duupflow.com via Brevo transactional email.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const body = await req.json().catch(() => ({}));
  const { message } = body as Record<string, string>;

  if (!message?.trim()) {
    return NextResponse.json({ error: "Le message est requis." }, { status: 400 });
  }

  const senderEmail = user?.email ?? "inconnu";

  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    console.error("[support/contact] BREVO_API_KEY not set");
    return NextResponse.json({ error: "Configuration email manquante." }, { status: 500 });
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify({
      sender: { name: "DuupFlow Support", email: "hello@duupflow.com" },
      to: [{ email: "hello@duupflow.com" }],
      replyTo: { email: senderEmail },
      subject: `[Support] Message de ${senderEmail}`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#6366f1">Nouveau message support DuupFlow</h2>
          <p style="color:#888;font-size:13px">De : <strong style="color:#333">${senderEmail}</strong></p>
          <div style="background:#f4f4f8;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;margin-top:12px">${message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[support/contact] Brevo error:", res.status, text);
    return NextResponse.json({ error: "Erreur lors de l'envoi." }, { status: 500 });
  }

  console.log(`[support/contact] Email sent via Brevo from ${senderEmail}`);
  return NextResponse.json({ ok: true });
}
