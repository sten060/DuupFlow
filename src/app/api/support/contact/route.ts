// POST /api/support/contact
// Sends a support message to hello@duupflow.com via Brevo transactional API.
// Required env var: BREVO_API_KEY

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const body = await req.json().catch(() => ({}));
  const { email, subject, message } = body as Record<string, string>;

  if (!email?.trim() || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Service email non configuré." }, { status: 500 });
  }

  const payload = {
    sender: { name: "DuupFlow Support", email: "noreply@duupflow.com" },
    to: [{ email: "hello@duupflow.com", name: "Support DuupFlow" }],
    replyTo: { email: email.trim(), name: email.trim() },
    subject: `[Support] ${subject.trim()}`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6366f1">Nouveau message support DuupFlow</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr>
            <td style="padding:6px 12px;color:#888;width:120px">Utilisateur</td>
            <td style="padding:6px 12px">${user?.id ?? "non authentifié"}</td>
          </tr>
          <tr style="background:#f9f9f9">
            <td style="padding:6px 12px;color:#888">Email</td>
            <td style="padding:6px 12px">${email.trim()}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px;color:#888">Objet</td>
            <td style="padding:6px 12px">${subject.trim()}</td>
          </tr>
        </table>
        <div style="background:#f4f4f8;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px">
          ${message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>
      </div>
    `,
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[support/contact] Brevo error:", res.status, text);
    return NextResponse.json({ error: "Erreur lors de l'envoi. Réessayez." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
