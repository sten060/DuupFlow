// POST /api/feature-requests — case « Amélioration » de la sidebar.
//
// Le user écrit ce qu'il aimerait voir de nouveau sur DuupFlow. L'idée est
// enregistrée (table feature_requests, migration 062) ET envoyée par email à
// hello@duupflow.com. L'un des deux suffit pour répondre « reçu » : l'idée
// n'est jamais perdue si la table ou Brevo manque.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrevoEmail } from "@/lib/brevo";

export const dynamic = "force-dynamic";

const MAX_CHARS = 3000;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, MAX_CHARS) : "";
  const page = typeof body?.page === "string" ? body.page.slice(0, 200) : null;
  if (message.length < 3) return NextResponse.json({ error: "Message trop court.", code: "EMPTY" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const plan = (profile?.plan as string | null) ?? null;

  const { data: row, error: dbError } = await admin
    .from("feature_requests")
    .insert({ user_id: user.id, user_email: user.email ?? null, plan, message, page })
    .select("id")
    .single();
  if (dbError) console.error("[feature-requests] DB insert error:", dbError.message);

  let emailSent = false;
  try {
    emailSent = await sendBrevoEmail({
      to: "hello@duupflow.com",
      toName: "DuupFlow",
      subject: `[Amélioration] Idée de ${user.email ?? "inconnu"}`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#6366f1;margin-bottom:8px">💡 Nouvelle idée d'amélioration</h2>
          <p style="color:#888;font-size:13px;margin-bottom:16px">
            <strong style="color:#333">Utilisateur :</strong> ${esc(user.email ?? "inconnu")} · plan ${esc(plan ?? "?")}${page ? ` · depuis ${esc(page)}` : ""}
          </p>
          <div style="background:#f4f4f8;border-radius:8px;padding:16px;font-size:14px;white-space:pre-wrap;line-height:1.6">${esc(message)}</div>
          <p style="color:#aaa;font-size:11px;margin-top:16px">Date : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</p>
        </div>
      `,
      replyTo: user.email ?? undefined,
    });
  } catch (err) {
    console.error("[feature-requests] Brevo error:", (err as Error)?.message);
  }
  if (emailSent && row) await admin.from("feature_requests").update({ email_sent: true }).eq("id", row.id);

  if (!row && !emailSent) return NextResponse.json({ error: "Envoi impossible, réessaie.", code: "ERROR" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
