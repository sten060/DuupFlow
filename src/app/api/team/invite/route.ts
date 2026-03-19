import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mailer";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const { guestEmail } = await req.json();

  if (!guestEmail || typeof guestEmail !== "string") {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Count existing active invitations for this host
  const { data: existing } = await adminClient
    .from("team_invitations")
    .select("id")
    .eq("host_user_id", user.id)
    .in("status", ["pending", "accepted"]);

  if (existing && existing.length >= 3) {
    return NextResponse.json({ error: "Limite de 3 invitations atteinte." }, { status: 400 });
  }

  // Check if already invited
  const { data: dupCheck } = await adminClient
    .from("team_invitations")
    .select("id")
    .eq("host_user_id", user.id)
    .eq("guest_email", guestEmail.toLowerCase())
    .in("status", ["pending", "accepted"])
    .single();

  if (dupCheck) {
    return NextResponse.json({ error: "Cette personne a déjà été invitée." }, { status: 400 });
  }

  // Create invitation record
  const token = randomUUID();
  const { error: insertErr } = await adminClient.from("team_invitations").insert({
    host_user_id: user.id,
    guest_email: guestEmail.toLowerCase(),
    token,
    status: "pending",
  });

  if (insertErr) {
    return NextResponse.json({ error: "Erreur lors de la création de l'invitation." }, { status: 500 });
  }

  // Generate a Supabase auth link (works for new and existing users)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`;
  const redirectTo = `${appUrl}/auth/callback?invite_token=${token}`;

  // Try invite link first (new user); fall back to magic link (existing user)
  let inviteLink: string | null = null;

  const { data: inviteData, error: inviteGenErr } = await adminClient.auth.admin.generateLink({
    type: "invite",
    email: guestEmail.toLowerCase(),
    options: { redirectTo },
  });
  if (!inviteGenErr && inviteData?.properties?.action_link) {
    inviteLink = inviteData.properties.action_link;
  } else {
    const { data: mlData, error: mlErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: guestEmail.toLowerCase(),
      options: { redirectTo },
    });
    if (!mlErr && mlData?.properties?.action_link) {
      inviteLink = mlData.properties.action_link;
    }
  }

  if (!inviteLink) {
    console.error("[team/invite] failed to generate auth link");
    return NextResponse.json({ error: "Impossible de générer le lien d'invitation." }, { status: 500 });
  }

  // Send via project SMTP (nodemailer)
  try {
    await sendMail({
      to: guestEmail.toLowerCase(),
      subject: "Tu as été invité·e sur DuupFlow",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0B0F1A;color:#fff;border-radius:12px;">
          <h2 style="margin:0 0 8px;font-size:22px;color:#fff;">Tu as été invité·e 🎉</h2>
          <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:15px;">
            Tu as reçu une invitation pour rejoindre un workspace DuupFlow.
          </p>
          <a href="${inviteLink}"
             style="display:inline-block;background:linear-gradient(135deg,#6366F1,#38BDF8);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;">
            Rejoindre le workspace →
          </a>
          <p style="margin:24px 0 0;color:rgba(255,255,255,0.3);font-size:12px;">
            Ce lien expire dans 24h. Si tu n'attendais pas cette invitation, ignore cet email.
          </p>
        </div>
      `,
    });
  } catch (mailErr) {
    console.error("[team/invite] sendMail error:", mailErr);
    return NextResponse.json({ error: "Invitation créée mais l'email n'a pas pu être envoyé. Vérifiez la configuration SMTP." }, { status: 500 });
  }

  console.log(`[team/invite] invitation sent to ${guestEmail}`);
  return NextResponse.json({ ok: true });
}
