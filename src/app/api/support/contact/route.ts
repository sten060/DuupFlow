// POST /api/support/contact
// Sends a support message to hello@duupflow.com via SMTP (nodemailer).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const body = await req.json().catch(() => ({}));
  const { contact, subject, message } = body as Record<string, string>;

  if (!contact?.trim() || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });
  }

  const userEmail = user?.email ?? "Non connecté";

  await sendMail({
    to: "hello@duupflow.com",
    subject: `[Support] ${subject.trim()}`,
    replyTo: contact.includes("@") ? contact.trim() : undefined,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#6366f1;margin-bottom:4px">Nouvelle demande support — DuupFlow</h2>
        <hr style="border:none;border-top:1px solid #eee;margin:12px 0" />

        <p style="margin:8px 0;font-size:13px"><strong>Compte :</strong> ${userEmail}</p>
        <p style="margin:8px 0;font-size:13px"><strong>Contact (Telegram ou email) :</strong> ${contact.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        <p style="margin:8px 0;font-size:13px"><strong>Objet :</strong> ${subject.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>

        <div style="background:#f4f4f8;border-radius:8px;padding:16px;margin-top:16px;font-size:14px;white-space:pre-wrap;line-height:1.6">
          ${message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>

        <p style="color:#aaa;font-size:11px;margin-top:16px">
          Date : ${new Date().toLocaleString("fr-FR")}
        </p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
