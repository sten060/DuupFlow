import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";
import { requireWorkspaceAccess, canManageWorkspaces, listTeamMembers } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

/** Remplace la liste des VA assignés à ce workspace (propriétaire ou manager).
 *  Body : { userIds: string[] }. Seuls des VA de l'équipe sont acceptés — les
 *  managers voient déjà tout, les assigner n'aurait aucun sens. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const t = await getServerT();
  const { id } = params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });

  const access = await requireWorkspaceAccess(user.id, id);
  if (!access) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  if (!canManageWorkspaces(access.ctx.role)) return NextResponse.json({ error: t("errors.workspaces.forbidden") }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const asked: string[] = Array.isArray(body?.userIds)
    ? body.userIds.filter((u: unknown): u is string => typeof u === "string")
    : [];

  const team = await listTeamMembers(access.ctx.ownerId);
  const vaIds = new Set(team.filter((m) => m.role === "va").map((m) => m.userId));
  const keep = Array.from(new Set(asked.filter((u) => vaIds.has(u))));

  const admin = createAdminClient();
  const { error: delErr } = await admin.from("workspace_members").delete().eq("workspace_id", id);
  if (delErr) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 500 });
  if (keep.length > 0) {
    const { error } = await admin
      .from("workspace_members")
      .insert(keep.map((userId) => ({ workspace_id: id, user_id: userId })));
    if (error) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 500 });
  }
  return NextResponse.json({ ok: true, userIds: keep });
}
