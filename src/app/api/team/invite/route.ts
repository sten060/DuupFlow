import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createAnonClient } from "@supabase/supabase-js";
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

  // Try to invite as a new user (Supabase sends the email automatically)
  const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
    guestEmail.toLowerCase(),
    { redirectTo }
  );

  if (inviteErr) {
    const isExisting =
      inviteErr.message?.toLowerCase().includes("already") ||
      (inviteErr as { code?: string }).code === "email_exists";

    if (!isExisting) {
      console.error("inviteUserByEmail error:", JSON.stringify(inviteErr));
      return NextResponse.json({ error: "Impossible d'envoyer l'invitation." }, { status: 500 });
    }

    // User already exists — send a magic link via the same Supabase email system
    const anonClient = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: otpErr } = await anonClient.auth.signInWithOtp({
      email: guestEmail.toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });

    if (otpErr) {
      console.error("signInWithOtp error:", JSON.stringify(otpErr));
      return NextResponse.json({ error: "Impossible d'envoyer l'invitation." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
