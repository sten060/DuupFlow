import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";
import { getWorkspaceContext } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

/** Changer le rôle d'un membre (Manager ↔ VA). Propriétaire uniquement : les
 *  rôles relèvent de la gestion des sièges, comme inviter ou retirer. */
export async function PATCH(req: NextRequest) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const guestId = typeof body?.userId === "string" ? body.userId : "";
  const role = body?.role === "va" ? "va" : body?.role === "manager" ? "manager" : null;
  if (!guestId || !role) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 400 });

  const ctx = await getWorkspaceContext(user.id);
  if (!ctx.enabled || ctx.role !== "owner") {
    return NextResponse.json({ error: t("errors.workspaces.forbidden") }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_invitations")
    .update({ role })
    .eq("host_user_id", user.id)
    .eq("guest_user_id", guestId)
    .select("id");
  if (error) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: t("errors.team.inviteNotFound") }, { status: 404 });

  // Un manager voit tout : ses assignations de VA ne servent plus à rien.
  if (role === "manager") {
    await admin.from("workspace_members").delete().eq("user_id", guestId);
  }
  return NextResponse.json({ ok: true });
}
