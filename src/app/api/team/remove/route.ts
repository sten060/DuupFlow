import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(req: NextRequest) {
  const { invitationId } = await req.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("team_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("host_user_id", user.id);

  if (error) return NextResponse.json({ error: "Erreur." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
