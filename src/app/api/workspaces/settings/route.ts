import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";
import { getWorkspaceContext, canManageWorkspaces, type WorkspaceContext } from "@/lib/workspaces";
import { requestedWorkspace, ADMIN_VIEW } from "@/lib/ai-editor/scope";

/** Le créateur visé : celui que l'écran affiche (x-duup-ws, ou workspaceId du
 *  corps) s'il y a accès, sinon le créateur actif. */
function targetWorkspace(ctx: WorkspaceContext, wanted: string | null) {
  return (wanted ? ctx.workspaces.find((w) => w.id === wanted) : null) ?? ctx.active;
}

export const dynamic = "force-dynamic";

/** Modules dont les réglages se rattachent au créateur. */
const MODULES = new Set(["images", "videoSimple", "videoAdvanced"]);
/** Garde-fou : un préréglage reste un petit objet de cases et de curseurs. */
const MAX_BYTES = 20_000;

/** Réglages du créateur ACTIF pour un module. Toujours 200 : sans workspace,
 *  `enabled: false` et le formulaire garde son comportement habituel. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ enabled: false });

  const module = req.nextUrl.searchParams.get("module") ?? "";
  if (!MODULES.has(module)) return NextResponse.json({ enabled: false });

  const ctx = await getWorkspaceContext(user.id);
  const wanted = requestedWorkspace(req);
  // Vue admin (propriétaire uniquement) : aucun créateur sélectionné → pas de
  // réglages de créateur. Pour quelqu'un d'autre, la valeur est ignorée.
  if (wanted === ADMIN_VIEW && ctx.role === "owner") return NextResponse.json({ enabled: false });
  const ws = ctx.enabled ? targetWorkspace(ctx, wanted) : null;
  if (!ws) return NextResponse.json({ enabled: false });

  const { data } = await createAdminClient()
    .from("workspace_settings")
    .select("settings, updated_at")
    .eq("workspace_id", ws.id)
    .eq("module", module)
    .maybeSingle();

  return NextResponse.json({
    enabled: true,
    workspace: { id: ws.id, name: ws.name, color: ws.color },
    settings: (data as { settings?: unknown } | null)?.settings ?? null,
    updatedAt: (data as { updated_at?: string } | null)?.updated_at ?? null,
    canSave: canManageWorkspaces(ctx.role),
  });
}

/** Enregistre les réglages actuels comme ceux du créateur actif.
 *  Propriétaire ou manager : un VA applique les réglages, il ne les modifie pas. */
export async function PUT(req: NextRequest) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const module = typeof body?.module === "string" ? body.module : "";
  const settings = body?.settings;
  if (!MODULES.has(module) || !settings || typeof settings !== "object" || Array.isArray(settings)) {
    return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 400 });
  }
  if (JSON.stringify(settings).length > MAX_BYTES) {
    return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 413 });
  }

  // Le créateur visé est celui NOMMÉ par l'écran (workspaceId) — vérifié : il
  // doit faire partie des créateurs accessibles. Jamais « le créateur actif »
  // par défaut silencieux : avec la bascule instantanée, il peut avoir changé.
  const ctx = await getWorkspaceContext(user.id);
  if (!ctx.enabled) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  const wanted = typeof body?.workspaceId === "string" ? body.workspaceId : requestedWorkspace(req);
  if (wanted === ADMIN_VIEW) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  const ws = targetWorkspace(ctx, wanted);
  if (!ws || (wanted && ws.id !== wanted)) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  if (!canManageWorkspaces(ctx.role)) return NextResponse.json({ error: t("errors.workspaces.forbidden") }, { status: 403 });

  const { error } = await createAdminClient()
    .from("workspace_settings")
    .upsert(
      { workspace_id: ws.id, module, settings, updated_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,module" },
    );
  if (error) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 500 });
  return NextResponse.json({ ok: true });
}
