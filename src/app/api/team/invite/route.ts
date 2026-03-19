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

  // --- Email sending ---
  // We try multiple methods in order. If ALL fail, we still return ok because
  // the invitation record is in the DB and the admin can share the link manually.
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

  // Method 2: Supabase inviteUserByEmail (sends via Supabase's own email if method 1 failed)
  if (!magicLink) {
    try {
      const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(guestEmail.toLowerCase(), {
        redirectTo,
        data: { invite_token: token },
      });
      if (!inviteErr) {
        emailSent = true; // Supabase sent the email itself
        console.log("[team/invite] inviteUserByEmail OK");
      } else {
        console.warn("[team/invite] inviteUserByEmail failed:", inviteErr.message);
      }
    } catch (e: any) {
      console.warn("[team/invite] inviteUserByEmail exception:", e?.message);
    }
  }

  // Method 3: Brevo with best available link
  if (!emailSent) {
    const brevoKey = process.env.BREVO_API_KEY;
    const joinLink = magicLink ?? fallbackLink;

    if (brevoKey) {
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "api-key": brevoKey,
          },
          body: JSON.stringify({
            sender: { name: "DuupFlow", email: "noreply@duupflow.com" },
            to: [{ email: guestEmail.toLowerCase() }],
            subject: "Tu as été invité·e à rejoindre un workspace DuupFlow",
            htmlContent: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d1117;color:#e6edf3;padding:32px;border-radius:12px">
                <h2 style="color:#ffffff;margin-bottom:8px">Tu as été invité·e 🎉</h2>
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
          }),
        });
        if (brevoRes.ok) {
          emailSent = true;
          console.log("[team/invite] Brevo email sent OK");
        } else {
          const text = await brevoRes.text().catch(() => "");
          console.error("[team/invite] Brevo error:", brevoRes.status, text);
        }
      } catch (e: any) {
        console.error("[team/invite] Brevo exception:", e?.message);
      }
    } else {
      console.warn("[team/invite] BREVO_API_KEY not set — skipping Brevo");
    }
  }

  // Always return ok if the DB record was created — the link exists in the DB
  // and the admin can share it manually if no email method worked.
  console.log(`[team/invite] invitation created for ${guestEmail} | emailSent=${emailSent}`);
  return NextResponse.json({ ok: true });
}
