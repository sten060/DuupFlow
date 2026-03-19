import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import { sendMail } from "@/lib/mailer";

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

  // --- Email sending ---
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`;
  const redirectTo = `${appUrl}/auth/callback?invite_token=${token}`;
  const fallbackLink = `${appUrl}/auth/login?invite_token=${token}`;

  let magicLink: string | null = null;
  let emailSent = false;

  // Method 1: Supabase generateLink (produces a one-click magic link)
  try {
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: guestEmail.toLowerCase(),
      options: { redirectTo },
    });
    if (!linkErr && linkData?.properties?.action_link) {
      magicLink = linkData.properties.action_link;
      console.log("[team/invite] generateLink OK");
    } else {
      console.warn("[team/invite] generateLink failed:", linkErr?.message ?? "no action_link");
    }
  } catch (e: any) {
    console.warn("[team/invite] generateLink exception:", e?.message);
  }

  // Method 2: Send via SMTP with best available link
  const joinLink = magicLink ?? fallbackLink;
  try {
    await sendMail({
      to: guestEmail.toLowerCase(),
      subject: "Tu as été invité·e à rejoindre un workspace DuupFlow",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d1117;color:#e6edf3;padding:32px;border-radius:12px">
          <h2 style="color:#ffffff;margin-bottom:8px">Tu as été invité·e !</h2>
          <p style="color:#8b949e;margin-bottom:24px">
            Clique sur le bouton ci-dessous pour rejoindre le workspace et commencer à collaborer.
            ${magicLink ? "Ce lien est valable une seule fois." : "Crée ton compte ou connecte-toi pour accepter l'invitation."}
          </p>
          <a href="${joinLink}"
             style="display:inline-block;background:linear-gradient(135deg,#6366f1,#38bdf8);color:#ffffff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
            Rejoindre le workspace
          </a>
          <p style="color:#484f58;font-size:12px;margin-top:24px">
            Si tu n'attendais pas cet email, tu peux l'ignorer.
          </p>
        </div>
      `,
    });
    emailSent = true;
    console.log("[team/invite] SMTP email sent OK");
  } catch (e: any) {
    console.error("[team/invite] SMTP error:", e?.message);

    // Fallback: Supabase inviteUserByEmail
    try {
      const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(guestEmail.toLowerCase(), {
        redirectTo,
        data: { invite_token: token },
      });
      if (!inviteErr) {
        emailSent = true;
        console.log("[team/invite] inviteUserByEmail fallback OK");
      } else {
        console.warn("[team/invite] inviteUserByEmail fallback failed:", inviteErr.message);
      }
    } catch (e2: any) {
      console.warn("[team/invite] inviteUserByEmail fallback exception:", e2?.message);
    }
  }

  console.log(`[team/invite] invitation created for ${guestEmail} | emailSent=${emailSent}`);
  return NextResponse.json({ ok: true });
}
