import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(req: NextRequest) {
  const { invitationId } = await req.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const adminClient = createAdminClient();

  // Fetch invitation first to get guest_user_id (before deletion)
  const { data: invitation, error: fetchErr } = await adminClient
    .from("team_invitations")
    .select("id, guest_user_id")
    .eq("id", invitationId)
    .eq("host_user_id", user.id)
    .single();

  if (fetchErr || !invitation) {
    return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });
  }

  // Delete invitation record
  await adminClient
    .from("team_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("host_user_id", user.id);

  // If guest had accepted (has a Supabase account), delete them entirely
  // This immediately invalidates their session and cascades to their profile
  if (invitation.guest_user_id) {
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(
      invitation.guest_user_id
    );
    if (deleteErr) {
      console.error("Failed to delete guest auth user:", deleteErr.message);
    }
  }

  return NextResponse.json({ ok: true });
}
