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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`;
  const redirectTo = `${appUrl}/auth/callback?invite_token=${token}`;

  // Generate a magic link via admin (no email sent by Supabase, works for new & existing users)
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: guestEmail.toLowerCase(),
    options: { redirectTo },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    await adminClient.from("team_invitations").delete().eq("token", token);
    console.error("generateLink error:", JSON.stringify(linkErr));
    return NextResponse.json({ error: "Impossible de générer l'invitation." }, { status: 500 });
  }

  const magicLink = linkData.properties.action_link;

  // Send the invitation email via Brevo
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    await adminClient.from("team_invitations").delete().eq("token", token);
    return NextResponse.json({ error: "Service email non configuré." }, { status: 500 });
  }

  const emailPayload = {
    sender: { name: "DuupFlow", email: "noreply@duupflow.com" },
    to: [{ email: guestEmail.toLowerCase() }],
    subject: "Tu as été invité·e à rejoindre un workspace DuupFlow",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d1117;color:#e6edf3;padding:32px;border-radius:12px">
        <h2 style="color:#ffffff;margin-bottom:8px">Tu as été invité·e 🎉</h2>
        <p style="color:#8b949e;margin-bottom:24px">
          Clique sur le bouton ci-dessous pour rejoindre le workspace et commencer à collaborer.
          Ce lien est valable une seule fois.
        </p>
        <a href="${magicLink}"
           style="display:inline-block;background:linear-gradient(135deg,#6366f1,#38bdf8);color:#ffffff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
          Rejoindre le workspace
        </a>
        <p style="color:#484f58;font-size:12px;margin-top:24px">
          Si tu n'attendais pas cet email, tu peux l'ignorer.
        </p>
      </div>
    `,
  };

  const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify(emailPayload),
  });

  if (!brevoRes.ok) {
    const text = await brevoRes.text().catch(() => "");
    console.error("Brevo invite error:", brevoRes.status, text);
    await adminClient.from("team_invitations").delete().eq("token", token);
    return NextResponse.json({ error: "Impossible d'envoyer l'invitation." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
