import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";
import { requireWorkspaceAccess } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

/** Le sélecteur de la sidebar : change le créateur actif de l'utilisateur. */
export async function POST(req: NextRequest) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  const access = workspaceId ? await requireWorkspaceAccess(user.id, workspaceId) : null;
  if (!access) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ active_workspace_id: workspaceId })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 500 });
  return NextResponse.json({ ok: true });
}
