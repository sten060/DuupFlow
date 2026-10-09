import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { getServerT } from "@/lib/i18n/server";
import { teamInviteLimitFor } from "@/lib/team-invite-limit";
import { hasProFeatures } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const t = await getServerT();
  const { guestEmail, role: askedRole } = await req.json();
  // Rôle de l'invité (workspaces) : VA par défaut — le plus restreint.
  const role: "manager" | "va" = askedRole === "manager" ? "manager" : "va";

  if (!guestEmail || typeof guestEmail !== "string") {
    return NextResponse.json({ error: t("errors.team.emailRequired") }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Only Pro (3 seats) and Agence (10 seats) can invite team members. Checking
  // `=== "solo"` was a bug: it let FREE users (and any non-solo plan) invite.
  // Allow ONLY plans with seats, and fail-closed if the profile can't be read.
  const { data: hostProfile } = await adminClient
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  // Per-host limit: seats of the plan (Pro 3, Agence 10), +1 for emails in
  // TEAM_INVITE_BONUS_EMAILS
  const inviteLimit = teamInviteLimitFor(user.email, hostProfile?.plan);

  if (!hasProFeatures(hostProfile?.plan)) {
    return NextResponse.json(
      { error: t("errors.team.planCannotInvite", { max: inviteLimit }) },
      { status: 403 }
    );
  }

  // Count existing active invitations for this host
  const { data: existing } = await adminClient
    .from("team_invitations")
    .select("id")
    .eq("host_user_id", user.id)
    .in("status", ["pending", "accepted"]);

  if (existing && existing.length >= inviteLimit) {
    return NextResponse.json(
      { error: t("errors.team.inviteLimitReached", { max: inviteLimit }) },
      { status: 400 }
    );
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
    return NextResponse.json({ error: t("errors.team.alreadyInvited") }, { status: 400 });
  }

  // Create invitation record
  const token = randomUUID();
  const invitation = {
    host_user_id: user.id,
    guest_email: guestEmail.toLowerCase(),
    token,
    status: "pending",
  };
  let { error: insertErr } = await adminClient.from("team_invitations").insert({ ...invitation, role });
  // Migration 059 pas encore appliquée (colonne `role` absente) : on invite
  // quand même, sans rôle — l'invité sera manager, comme avant les workspaces.
  if (insertErr && /role/i.test(insertErr.message ?? "")) {
    ({ error: insertErr } = await adminClient.from("team_invitations").insert(invitation));
  }

  if (insertErr) {
    return NextResponse.json({ error: t("errors.team.createInviteFailed") }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`;
  const redirectTo = `${appUrl}/auth/callback?invite_token=${token}`;

  // Try inviteUserByEmail (new user). If user already exists, fall back to OTP magic link.
  const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
    guestEmail.toLowerCase(),
    { redirectTo }
  );

  if (inviteErr) {
    // User already exists in Supabase auth → send a magic link OTP instead
    const anonClient = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: otpErr } = await anonClient.auth.signInWithOtp({
      email: guestEmail.toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });
    if (otpErr) {
      console.error("[team/invite] signInWithOtp error:", otpErr.message);
      return NextResponse.json({ error: t("errors.team.sendInviteFailed") }, { status: 500 });
    }
  }

  console.log(`[team/invite] invitation sent to ${guestEmail}`);
  return NextResponse.json({ ok: true });
}
