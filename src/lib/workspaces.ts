/**
 * WORKSPACES — un par créateur / créatrice (plans Pro & Agence).
 *
 *   Compte propriétaire (l'agence) → Workspaces → réglages, brief, destinations
 *
 * Toute la logique d'accès vit ICI. Chaque route qui touche à un workspace
 * passe par `getWorkspaceContext()` / `requireWorkspaceAccess()` : l'app lit la
 * base avec la clé service, les règles RLS ne la protègent donc pas — c'est ce
 * fichier qui fait la sécurité.
 *
 * Rôles (3, pas plus) :
 *   • owner   — le compte qui paie : tout, y compris facturation et sièges.
 *   • manager — invité : tous les workspaces, crée / renomme / assigne,
 *               sans facturation ni gestion des sièges.
 *   • va      — invité : uniquement les workspaces où il est assigné. Peut
 *               produire et télécharger, ne supprime rien.
 *
 * L'accès est relu en base À CHAQUE APPEL : quand le propriétaire assigne ou
 * retire un créateur à un VA, c'est effectif à la requête suivante (y compris
 * côté MCP de l'Éditeur IA), sans reconnexion.
 *
 * Tant que la migration 059 n'est pas appliquée, tout renvoie
 * `enabled: false` : l'app fonctionne exactement comme avant.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { hasProFeatures, workspacesForPlan } from "@/lib/plans";

export type TeamRole = "owner" | "manager" | "va";

export type Workspace = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  /** Brief du créateur pour l'éditeur (lu par Claude). */
  brief: string;
  createdAt: string;
};

/** Longueur max d'un brief : assez pour un vrai guide de style, pas un roman. */
export const BRIEF_MAX_CHARS = 4000;

export type WorkspaceContext = {
  /** false = pas de workspaces pour ce compte (Solo/Starter/Free, impayé,
   *  ou migration 059 absente). L'UI n'affiche alors rien. */
  enabled: boolean;
  /** true = la base n'a pas encore les tables (migration 059 non appliquée). */
  unavailable?: boolean;
  userId: string;
  /** Le compte propriétaire (l'hôte) : c'est lui qui « possède » les workspaces. */
  ownerId: string;
  role: TeamRole;
  ownerPlan: string;
  /** Nombre max de workspaces du plan (Pro 2, Agence 15). */
  limit: number;
  /** Nombre total de workspaces du compte (pas seulement ceux visibles par un VA). */
  total: number;
  /** Workspaces visibles par CET utilisateur. */
  workspaces: Workspace[];
  active: Workspace | null;
};

/** Palette proposée à la création — couleurs lisibles en clair comme en sombre. */
export const WORKSPACE_COLORS = [
  "#6366F1", "#A78BFA", "#EC4899", "#F43F5E", "#F59E0B",
  "#10B981", "#14B8A6", "#38BDF8", "#64748B",
] as const;

export function isValidWorkspaceColor(c: unknown): c is string {
  return typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c);
}

export function canManageWorkspaces(role: TeamRole): boolean {
  return role === "owner" || role === "manager";
}

type Row = { id: string; name: string; color: string; is_default: boolean; brief: string | null; created_at: string };
const toWorkspace = (r: Row): Workspace => ({
  id: r.id, name: r.name, color: r.color, isDefault: r.is_default, brief: r.brief ?? "", createdAt: r.created_at,
});

const disabled = (userId: string): WorkspaceContext => ({
  enabled: false, userId, ownerId: userId, role: "owner", ownerPlan: "free",
  limit: 0, total: 0, workspaces: [], active: null,
});

/** Plan EFFECTIF du propriétaire : un impayé ferme les workspaces comme le
 *  reste des fonctionnalités Pro (même règle que usage.ts). */
function effectiveOwnerPlan(p: { plan: string | null; has_paid: boolean | null; payment_overdue?: boolean | null } | null): string {
  if (!p) return "free";
  if (p.payment_overdue === true) return "free";
  return p.plan ?? (p.has_paid ? "pro" : "free");
}

/** Rôle d'un invité, lu sur son invitation acceptée. Défaut « manager » : les
 *  invités d'avant les workspaces gardent l'accès complet qu'ils avaient. */
async function guestRole(guestId: string, ownerId: string): Promise<TeamRole> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_invitations")
    .select("role")
    .eq("guest_user_id", guestId)
    .eq("host_user_id", ownerId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  // Lecture en échec ou invitation introuvable : le rôle le PLUS RESTREINT. Les
  // invités d'avant les workspaces ont reçu « manager » via la migration 059.
  if (error || !data) return "va";
  return (data as { role?: string }).role === "manager" ? "manager" : "va";
}

/**
 * Le contexte workspace complet d'un utilisateur. `defaultName` sert à créer
 * le workspace par défaut d'un compte Pro/Agence qui n'en a encore aucun —
 * c'est ainsi que les comptes existants « migrent » sans rien perdre.
 */
export async function getWorkspaceContext(
  userId: string,
  opts: { defaultName?: string } = {},
): Promise<WorkspaceContext> {
  const admin = createAdminClient();
  try {
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("plan, has_paid, payment_overdue, is_guest, host_user_id, active_workspace_id")
      .eq("id", userId)
      .single();
    // Colonne active_workspace_id absente = migration 059 pas appliquée.
    if (meErr && /active_workspace_id/.test(meErr.message ?? "")) throw meErr;
    if (!me) return disabled(userId);
    const profile = me as {
      plan: string | null; has_paid: boolean | null; payment_overdue: boolean | null;
      is_guest: boolean | null; host_user_id: string | null; active_workspace_id: string | null;
    };

    const isGuest = profile.is_guest === true && !!profile.host_user_id;
    const ownerId = isGuest ? profile.host_user_id! : userId;

    const listWorkspaces = () => admin
      .from("workspaces")
      .select("id, name, color, is_default, brief, created_at")
      .eq("owner_user_id", ownerId)
      .order("created_at", { ascending: true });

    // Tout ce qui ne dépend que de ownerId part EN PARALLÈLE (plan de l'hôte,
    // rôle, workspaces, assignations) : une seule aller-retour base au lieu de
    // cinq à la suite — c'est ce qui rendait chaque clic lent.
    const [hostRes, role, wsRes, linksRes] = await Promise.all([
      isGuest
        ? admin.from("profiles").select("plan, has_paid, payment_overdue").eq("id", ownerId).single()
        : Promise.resolve({ data: profile }),
      isGuest ? guestRole(userId, ownerId) : Promise.resolve<TeamRole>("owner"),
      listWorkspaces(),
      isGuest
        ? admin.from("workspace_members").select("workspace_id").eq("user_id", userId)
        : Promise.resolve({ data: [] as { workspace_id: string }[] }),
    ]);

    const ownerPlan = effectiveOwnerPlan((hostRes as { data: unknown }).data as never);
    if (!hasProFeatures(ownerPlan)) return { ...disabled(userId), ownerId, ownerPlan };

    if (wsRes.error) throw wsRes.error; // migration 059 absente → désactivé (catch)
    let all = ((wsRes.data ?? []) as Row[]).map(toWorkspace);

    // Premier passage d'un compte Pro/Agence : workspace par défaut. Seuls le
    // propriétaire et un manager le déclenchent (un VA n'a rien à créer).
    if (all.length === 0 && role !== "va") {
      await admin
        .from("workspaces")
        .insert({ owner_user_id: ownerId, name: opts.defaultName?.trim().slice(0, 60) || "Mon créateur", is_default: true })
        .then(() => undefined, () => undefined); // course : l'index unique protège
      const { data: again } = await listWorkspaces();
      all = ((again ?? []) as Row[]).map(toWorkspace);
    }

    let visible = all;
    if (role === "va") {
      const allowed = new Set(((linksRes.data ?? []) as { workspace_id: string }[]).map((l) => l.workspace_id));
      visible = all.filter((w) => allowed.has(w.id));
    }

    const active = visible.find((w) => w.id === profile.active_workspace_id) ?? visible[0] ?? null;

    return {
      enabled: true,
      userId,
      ownerId,
      role,
      ownerPlan,
      limit: workspacesForPlan(ownerPlan),
      total: all.length,
      workspaces: visible,
      active,
    };
  } catch {
    return { ...disabled(userId), unavailable: true };
  }
}

/** Le workspace demandé, SI l'utilisateur y a accès — sinon null. */
export async function requireWorkspaceAccess(
  userId: string,
  workspaceId: string,
): Promise<{ ctx: WorkspaceContext; workspace: Workspace } | null> {
  const ctx = await getWorkspaceContext(userId);
  if (!ctx.enabled) return null;
  const workspace = ctx.workspaces.find((w) => w.id === workspaceId);
  return workspace ? { ctx, workspace } : null;
}

/** Les membres de l'équipe d'un propriétaire, avec leur rôle et leurs
 *  workspaces assignés — pour l'écran de gestion. */
export async function listTeamMembers(ownerId: string): Promise<
  { userId: string; email: string; name: string | null; role: "manager" | "va"; workspaceIds: string[] }[]
> {
  const admin = createAdminClient();
  const { data: invs } = await admin
    .from("team_invitations")
    .select("guest_user_id, guest_email, role")
    .eq("host_user_id", ownerId)
    .eq("status", "accepted");
  const members = ((invs ?? []) as { guest_user_id: string | null; guest_email: string; role: string | null }[])
    .filter((i) => i.guest_user_id);
  if (members.length === 0) return [];
  const ids = members.map((m) => m.guest_user_id!);

  const [{ data: names }, { data: links }] = await Promise.all([
    admin.from("profiles").select("id, first_name").in("id", ids),
    admin.from("workspace_members").select("workspace_id, user_id").in("user_id", ids),
  ]);
  const nameOf = new Map(((names ?? []) as { id: string; first_name: string | null }[]).map((n) => [n.id, n.first_name]));
  const wsOf = new Map<string, string[]>();
  for (const l of (links ?? []) as { workspace_id: string; user_id: string }[]) {
    wsOf.set(l.user_id, [...(wsOf.get(l.user_id) ?? []), l.workspace_id]);
  }
  return members.map((m) => ({
    userId: m.guest_user_id!,
    email: m.guest_email,
    name: nameOf.get(m.guest_user_id!) ?? null,
    role: m.role === "va" ? "va" : "manager",
    workspaceIds: wsOf.get(m.guest_user_id!) ?? [],
  }));
}


/** Écrit le brief d'un créateur (MCP save_creator_brief). Propriétaire ou
 *  manager uniquement ; `append` ajoute une ligne, `replace` remplace tout. */
export async function saveWorkspaceBrief(
  userId: string,
  workspaceId: string,
  text: string,
  mode: "append" | "replace",
): Promise<{ ok: true; brief: string; length: number } | { ok: false; error: string }> {
  const access = await requireWorkspaceAccess(userId, workspaceId);
  if (!access) return { ok: false, error: "Créateur introuvable ou non accessible." };
  if (!canManageWorkspaces(access.ctx.role)) {
    return { ok: false, error: "Ton rôle (VA) ne permet pas de modifier le brief : demande au propriétaire ou à un manager. La consigne reste valable pour cette conversation." };
  }
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Consigne vide : rien à enregistrer." };
  const current = access.workspace.brief.trim();
  const next = mode === "replace" || !current ? clean : `${current}\n- ${clean.replace(/^[-•]\s*/, "")}`;
  if (next.length > BRIEF_MAX_CHARS) {
    return { ok: false, error: `Le brief dépasserait ${BRIEF_MAX_CHARS} caractères (${next.length}). Propose au user de le résumer (mode replace).` };
  }
  const { error } = await createAdminClient()
    .from("workspaces")
    .update({ brief: next, updated_at: new Date().toISOString() })
    .eq("id", workspaceId)
    .eq("owner_user_id", access.ctx.ownerId);
  if (error) return { ok: false, error: "Enregistrement impossible, réessaie." };
  return { ok: true, brief: next, length: next.length };
}


/** Données de la page « Tes créateurs » et du sélecteur — même forme que
 *  GET /api/workspaces. Utilisé côté serveur par la page (rendu direct, sans
 *  aller-retour client) ET par la route API. */
export async function workspacesPayload(userId: string, defaultName?: string, preferred?: string | null) {
  const ctx = await getWorkspaceContext(userId, { defaultName });
  const team = ctx.enabled && canManageWorkspaces(ctx.role) ? await listTeamMembers(ctx.ownerId) : [];
  const drive = await import("@/lib/google-drive-oauth");
  const driveConnected = ctx.enabled && drive.driveOAuthConfigured() ? !!(await drive.getDriveLink(ctx.ownerId)) : false;
  return {
    driveConnected,
    driveConfigured: drive.driveOAuthConfigured(),
    enabled: ctx.enabled,
    unavailable: ctx.unavailable === true,
    role: ctx.role,
    ownerPlan: ctx.ownerPlan,
    limit: ctx.limit,
    total: ctx.total,
    // Nombre d'images de brief par créateur (lecture d'un petit meta.json chacun).
    workspaces: await Promise.all(ctx.workspaces.map(async (w) => ({
      ...w,
      briefImageCount: (await import("@/lib/brief-images").then((m) => m.listBriefImages(w.id))).length,
    }))),
    // Le créateur affiché dans CE navigateur (cookie) s'il est permis. Sinon :
    // la vue admin pour le propriétaire (son écran par défaut), le créateur
    // actif enregistré pour un invité.
    activeId:
      preferred && ctx.workspaces.some((w) => w.id === preferred) ? preferred
      : ctx.role === "owner" ? "admin"
      : ctx.active?.id ?? null,
    team,
  };
}
