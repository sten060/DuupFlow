import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { firstName, userId } = await req.json();

  if (!firstName || !userId) {
    return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
  }

  // Get invite token from cookie
  const cookieStore = await cookies();
  const inviteToken = cookieStore.get("invite_token")?.value;

  if (!inviteToken) {
    return NextResponse.json({ error: "Token d'invitation introuvable." }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Find the invitation
  const { data: invitation, error: invErr } = await adminClient
    .from("team_invitations")
    .select("id, host_user_id, status")
    .eq("token", inviteToken)
    .single();

  if (invErr || !invitation) {
    return NextResponse.json({ error: "Invitation introuvable ou expirée." }, { status: 404 });
  }

  if (invitation.status === "accepted") {
    return NextResponse.json({ error: "Invitation déjà utilisée." }, { status: 400 });
  }

  // Create guest profile linked to host
  const { error: profileErr } = await adminClient.from("profiles").upsert({
    id: userId,
    first_name: firstName.trim(),
    agency_name: "", // guest uses host's agency name at display time
    host_user_id: invitation.host_user_id,
    is_guest: true,
  });

  if (profileErr) {
    return NextResponse.json({ error: "Erreur création profil." }, { status: 500 });
  }

  // Update invitation status
  await adminClient
    .from("team_invitations")
    .update({ status: "accepted", guest_user_id: userId, accepted_at: new Date().toISOString() })
    .eq("token", inviteToken);

  // Clear the invite token cookie
  cookieStore.delete("invite_token");

  return NextResponse.json({ ok: true });
}
