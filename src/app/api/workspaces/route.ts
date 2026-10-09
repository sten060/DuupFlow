import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";
import {
  getWorkspaceContext,
  canManageWorkspaces,
  isValidWorkspaceColor,
  workspacesPayload,
  WORKSPACE_COLORS,
} from "@/lib/workspaces";
import { syncCreatorFolderInBackground } from "@/lib/google-drive-oauth";
import { requestedWorkspace } from "@/lib/ai-editor/scope";

export const dynamic = "force-dynamic";

/** Workspaces visibles par l'utilisateur + le workspace actif. Pour le
 *  propriétaire et les managers, aussi l'équipe (pour l'écran d'assignation). */
export async function GET(req: NextRequest) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });

  return NextResponse.json(await workspacesPayload(user.id, t("dashboard.workspaces.defaultName"), requestedWorkspace(req)));
}

/** Créer un workspace (propriétaire ou manager), dans la limite du plan. */
export async function POST(req: NextRequest) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: t("errors.workspaces.nameRequired") }, { status: 400 });
  const color = isValidWorkspaceColor(body?.color) ? body.color : WORKSPACE_COLORS[0];

  const ctx = await getWorkspaceContext(user.id);
  if (!ctx.enabled) return NextResponse.json({ error: t("errors.workspaces.planRequired") }, { status: 403 });
  if (!canManageWorkspaces(ctx.role)) return NextResponse.json({ error: t("errors.workspaces.forbidden") }, { status: 403 });
  if (ctx.total >= ctx.limit) {
    return NextResponse.json(
      { error: t("errors.workspaces.limitReached", { max: ctx.limit }), code: "workspace_limit" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspaces")
    .insert({ owner_user_id: ctx.ownerId, name, color })
    .select("id, name, color, is_default, brief")
    .single();
  if (error || !data) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 500 });

  // Son dossier Drive « <Créateur> — DuupFlow » (si Drive est connecté), sans attendre.
  syncCreatorFolderInBackground(ctx.ownerId, { id: data.id, name: data.name });

  // Le créateur qui vient d'être créé devient le workspace actif de son auteur.
  await admin.from("profiles").update({ active_workspace_id: data.id }).eq("id", user.id);

  return NextResponse.json({
    ok: true,
    id: data.id,
    workspace: { id: data.id, name: data.name, color: data.color, isDefault: data.is_default, brief: data.brief ?? "" },
  });
}
