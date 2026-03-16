import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("id, status")
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`;
  const redirectTo = `${appUrl}/auth/callback?invite_token=${token}`;

  // Generate invite link (creates user if new)
  let inviteLink: string | null = null;

  const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.generateLink({
    type: "invite",
    email: guestEmail.toLowerCase(),
    options: { redirectTo },
  });

  if (inviteErr) {
    const isExisting =
      inviteErr.message?.toLowerCase().includes("already") ||
      (inviteErr as { code?: string }).code === "email_exists";

    if (isExisting) {
      // User already has an account — generate a magic link instead
      const { data: magicData, error: magicErr } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: guestEmail.toLowerCase(),
        options: { redirectTo },
      });
      if (magicErr || !magicData?.properties?.action_link) {
        console.error("generateLink(magiclink) error:", JSON.stringify(magicErr));
        return NextResponse.json({ error: "Impossible de générer le lien d'invitation." }, { status: 500 });
      }
      inviteLink = magicData.properties.action_link;
    } else {
      console.error("generateLink(invite) error:", JSON.stringify(inviteErr));
      return NextResponse.json({ error: "Impossible de générer le lien d'invitation." }, { status: 500 });
    }
  } else {
    inviteLink = inviteData?.properties?.action_link ?? null;
  }

  if (!inviteLink) {
    return NextResponse.json({ error: "Lien d'invitation introuvable." }, { status: 500 });
  }

  // Send the invitation email via Brevo
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    console.error("BREVO_API_KEY not set");
    return NextResponse.json({ error: "Service email non configuré." }, { status: 500 });
  }

  const emailPayload = {
    sender: { name: "DuupFlow", email: "noreply@duupflow.com" },
    to: [{ email: guestEmail.toLowerCase() }],
    subject: "Tu as été invité à rejoindre DuupFlow",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0B0F1A;color:#fff;border-radius:12px;padding:40px 32px">
        <div style="margin-bottom:28px">
          <span style="font-size:22px;font-weight:800;color:#818CF8">Duup</span><span style="font-size:22px;font-weight:800;color:rgba(255,255,255,0.5)">Flow</span>
        </div>
        <h2 style="font-size:20px;font-weight:700;margin:0 0 12px">Tu as été invité à rejoindre un workspace</h2>
        <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.6;margin:0 0 28px">
          Un membre de DuupFlow t'invite à rejoindre son équipe. Clique sur le bouton ci-dessous pour accepter l'invitation et accéder à tous les modules.
        </p>
        <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(135deg,#6366F1,#38BDF8);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:10px">
          Rejoindre le workspace →
        </a>
        <p style="color:rgba(255,255,255,0.25);font-size:12px;margin-top:28px">
          Ce lien expire dans 24 heures. Si tu n'attendais pas cette invitation, ignore cet email.
        </p>
      </div>
    `,
  };

  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify(emailPayload),
  });

  if (!emailRes.ok) {
    const text = await emailRes.text().catch(() => "");
    console.error("[team/invite] Brevo error:", emailRes.status, text);
    return NextResponse.json({ error: "Erreur lors de l'envoi de l'email." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
