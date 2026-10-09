import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";
import { requireWorkspaceAccess, canManageWorkspaces, isValidWorkspaceColor, BRIEF_MAX_CHARS } from "@/lib/workspaces";
import { removeAllBriefImages } from "@/lib/brief-images";
import { syncCreatorFolderInBackground } from "@/lib/google-drive-oauth";

export const dynamic = "force-dynamic";

/** Renommer / changer la couleur / écrire le brief (propriétaire ou manager). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const t = await getServerT();
  const { id } = params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });

  const access = await requireWorkspaceAccess(user.id, id);
  if (!access) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  if (!canManageWorkspaces(access.ctx.role)) return NextResponse.json({ error: t("errors.workspaces.forbidden") }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.name === "string") {
    const name = body.name.trim().slice(0, 60);
    if (!name) return NextResponse.json({ error: t("errors.workspaces.nameRequired") }, { status: 400 });
    patch.name = name;
  }
  if (body?.brief !== undefined) {
    if (typeof body.brief !== "string") return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 400 });
    if (body.brief.length > BRIEF_MAX_CHARS) {
      return NextResponse.json({ error: t("errors.workspaces.briefTooLong", { max: BRIEF_MAX_CHARS }) }, { status: 400 });
    }
    patch.brief = body.brief.trim();
  }
  if (body?.color !== undefined) {
    if (!isValidWorkspaceColor(body.color)) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 400 });
    patch.color = body.color;
  }

  const { error } = await createAdminClient()
    .from("workspaces")
    .update(patch)
    .eq("id", id)
    .eq("owner_user_id", access.ctx.ownerId);
  if (error) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 500 });
  // Renommé → son dossier Drive suit (si Drive est connecté), sans attendre.
  if (typeof patch.name === "string") syncCreatorFolderInBackground(access.ctx.ownerId, { id, name: patch.name });
  return NextResponse.json({ ok: true });
}

/** Supprimer un workspace (propriétaire ou manager — jamais un VA). On garde
 *  toujours au moins un workspace sur le compte. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const t = await getServerT();
  const { id } = params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });

  const access = await requireWorkspaceAccess(user.id, id);
  if (!access) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  if (!canManageWorkspaces(access.ctx.role)) return NextResponse.json({ error: t("errors.workspaces.forbidden") }, { status: 403 });
  if (access.ctx.total <= 1) return NextResponse.json({ error: t("errors.workspaces.keepOne") }, { status: 400 });
  // Le créateur par défaut porte les projets d'avant les workspaces (dossier
  // historique du propriétaire, voir ai-editor/scope.ts) : renommable, pas supprimable.
  if (access.workspace.isDefault) return NextResponse.json({ error: t("errors.workspaces.defaultLocked") }, { status: 400 });

  const { error } = await createAdminClient()
    .from("workspaces")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", access.ctx.ownerId);
  if (error) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 500 });
  // Ses images de brief (permanentes) partent avec lui.
  await removeAllBriefImages(id);
  // active_workspace_id des profils concernés → NULL (ON DELETE SET NULL) :
  // ils retombent automatiquement sur leur premier workspace accessible.
  return NextResponse.json({ ok: true });
}
