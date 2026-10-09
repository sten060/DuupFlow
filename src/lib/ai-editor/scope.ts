// src/lib/ai-editor/scope.ts
//
// OÙ sont rangés les projets de l'Éditeur IA (et de l'IA automatique).
//
// Le store (store.ts) range tout sous OUT_BASE/<clé>/ai-editor/. Historiquement
// la clé = l'id du user. Avec les workspaces (Pro & Agence), la clé devient
// celle du CRÉATEUR : `ws_<workspaceId>`. Tous ceux qui ont accès au créateur
// (propriétaire, managers, VA assignés) partagent ainsi les mêmes projets, et
// un VA ne voit jamais ceux d'un créateur qui ne lui est pas assigné.
// Exception : le créateur par défaut garde le dossier historique du
// propriétaire (voir workspaceStoreKey).
//
// ⚠️ Deux identités à ne JAMAIS confondre :
//   • la clé de rangement (storeKey) → chemins de fichiers, jobs de rendu ;
//   • l'utilisateur qui agit (userId) → quotas, plan, journal d'usage.
//
// Sans workspaces (Solo, Starter, Free, ou migration absente), la clé reste
// l'id du user : rien ne change pour ces comptes.

import { getWorkspaceContext, type Workspace, type WorkspaceContext } from "@/lib/workspaces";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Clé de rangement d'un créateur. Le créateur PAR DÉFAUT (créé automatiquement
 * pour les comptes existants) réutilise le dossier historique du propriétaire :
 * ses projets d'avant les workspaces restent là, sans rien déplacer.
 */
export function workspaceStoreKey(ws: Pick<Workspace, "id" | "isDefault">, ownerId: string): string {
  return ws.isDefault ? ownerId : `ws_${ws.id}`;
}

/**
 * Espace de la VUE ADMIN (propriétaire) : son dashboard par défaut, où il
 * duplique et édite comme partout ailleurs, sans être rangé chez un créateur.
 */
export function adminStoreKey(ownerId: string): string {
  return `${ownerId}_admin`;
}

/** Le propriétaire est-il en vue admin ? Choix explicite, ou rien de choisi
 *  (la vue admin est son écran par défaut). Jamais pour un invité. */
export function isAdminChoice(ctx: Pick<WorkspaceContext, "enabled" | "role">, wanted: string | null): boolean {
  return ctx.enabled && ctx.role === "owner" && (wanted === ADMIN_VIEW || !wanted);
}

export type EditorScope = {
  /** Clé de rangement à passer au store / au moteur de rendu. */
  storeKey: string;
  /** Le créateur concerné, ou null (compte sans workspaces, ou vue admin). */
  workspace: Workspace | null;
  /** Son brief pour l'éditeur ('' si vide ou sans workspace). */
  brief: string;
  /** Nombre d'images jointes au brief (0 à 10). */
  briefImages?: number;
  /** Nombre de vidéos « qui marchent » analysées pour le brief (0 à 5). */
  briefVideos?: number;
  ctx: WorkspaceContext;
};

export async function workspaceBrief(workspaceId: string): Promise<string> {
  try {
    const { data } = await createAdminClient()
      .from("workspaces")
      .select("brief")
      .eq("id", workspaceId)
      .maybeSingle();
    return ((data as { brief?: string } | null)?.brief ?? "").trim();
  } catch {
    return "";
  }
}

export const WS_COOKIE = "duup_ws";
export const ADMIN_VIEW = "admin";

/** Lit le cookie duup_ws dans un en-tête Cookie brut. */
export function wsFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  const m = /(?:^|;\s*)duup_ws=([^;]+)/.exec(cookieHeader ?? "");
  return m ? decodeURIComponent(m[1]) : null;
}

/** Valeur acceptée : un id de créateur, ou « admin » (vue admin du propriétaire). */
export function normalizeWsChoice(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (s === ADMIN_VIEW) return ADMIN_VIEW;
  return /^[0-9a-f-]{36}$/.test(s) ? s : null;
}

/** Créateur demandé par l'écran : en-tête x-duup-ws, ?ws= (médias), ou cookie
 *  duup_ws posé par le sélecteur au moment du clic. C'est ce qui rend la bascule
 *  instantanée : pas besoin d'attendre que le « créateur actif » soit enregistré
 *  en base — et l'accès est revérifié ici à chaque requête. */
export function requestedWorkspace(req?: Request | null): string | null {
  if (!req) return null;
  let q: string | null = null;
  try { q = new URL(req.url).searchParams.get("ws"); } catch { /* url relative */ }
  return normalizeWsChoice(req.headers.get("x-duup-ws") || q || wsFromCookieHeader(req.headers.get("cookie")));
}

/** Scope des écrans de l'app : le créateur demandé par l'écran s'il y a accès,
 *  sinon le créateur ACTIF (sélecteur de la sidebar). */
export async function editorScopeForUser(userId: string, req?: Request | null): Promise<EditorScope> {
  const ctx = await getWorkspaceContext(userId);
  if (!ctx.enabled) return { storeKey: userId, workspace: null, brief: "", ctx };
  const wanted = requestedWorkspace(req);
  // Vue admin (propriétaire, par défaut) : son propre espace, aucun brief.
  if (isAdminChoice(ctx, wanted)) return { storeKey: adminStoreKey(ctx.ownerId), workspace: null, brief: "", ctx };
  const pick = wanted && wanted !== ADMIN_VIEW ? ctx.workspaces.find((w) => w.id === wanted) : null;
  if (pick) {
    return {
      storeKey: workspaceStoreKey(pick, ctx.ownerId),
      workspace: pick,
      brief: pick.brief.trim(), // déjà chargé avec le workspace : pas de requête en plus
      briefImages: await countBriefImages(pick.id),
      briefVideos: await countBriefVideos(pick.id),
      ctx,
    };
  }
  if (!ctx.active) {
    // Workspaces actifs mais aucun créateur accessible (VA sans assignation) :
    // une clé qui ne contient rien et ne mélange rien.
    return { storeKey: `${userId}_noworkspace`, workspace: null, brief: "", ctx };
  }
  return {
    storeKey: workspaceStoreKey(ctx.active, ctx.ownerId),
    workspace: ctx.active,
    brief: ctx.active.brief.trim(),
    briefImages: await countBriefImages(ctx.active.id),
    briefVideos: await countBriefVideos(ctx.active.id),
    ctx,
  };
}

/**
 * Scope du serveur MCP (le Claude du user). Pas d'état « actif » caché : le
 * créateur est choisi EXPLICITEMENT (argument `creator`, nom ou id) dès que
 * l'utilisateur en a plusieurs. Les droits sont relus à chaque appel → un
 * créateur ajouté ou retiré par le propriétaire est pris en compte tout de suite.
 */
export async function editorScopeForMcp(
  userId: string,
  creator: unknown,
): Promise<{ ok: true; scope: EditorScope } | { ok: false; text: string }> {
  const ctx = await getWorkspaceContext(userId);
  if (!ctx.enabled) return { ok: true, scope: { storeKey: userId, workspace: null, brief: "", ctx } };

  const list = ctx.workspaces;
  if (list.length === 0) {
    return { ok: false, text: "Aucun créateur ne t'est assigné sur DuupFlow. Demande au propriétaire du compte de t'en assigner un, puis réessaie." };
  }

  const wanted = typeof creator === "string" ? creator.trim() : "";
  let ws: Workspace | undefined;
  if (wanted) {
    const low = wanted.toLowerCase();
    ws = list.find((w) => w.id === wanted) ?? list.find((w) => w.name.trim().toLowerCase() === low);
    if (!ws) {
      return {
        ok: false,
        text: `Créateur « ${wanted} » introuvable ou non accessible. Créateurs accessibles : ${list.map((w) => `« ${w.name} »`).join(", ")}. Demande au user lequel utiliser, puis rappelle l'outil avec creator.`,
      };
    }
  } else if (list.length === 1) {
    ws = list[0];
  } else {
    return {
      ok: false,
      text:
        `Ce compte gère plusieurs créateurs : ${list.map((w) => `« ${w.name} »`).join(", ")}. ` +
        `Demande au user pour lequel il travaille, puis rappelle l'outil avec l'argument creator (le nom exact). ` +
        `Garde ensuite ce même creator pour toute la conversation.`,
    };
  }

  return {
    ok: true,
    scope: {
      storeKey: workspaceStoreKey(ws, ctx.ownerId),
      workspace: ws,
      brief: ws.brief.trim(),
      briefImages: await countBriefImages(ws.id),
      briefVideos: await countBriefVideos(ws.id),
      ctx,
    },
  };
}

/** Bloc texte « créateur + brief » placé en tête des réponses à Claude. */
export async function countBriefImages(workspaceId: string): Promise<number> {
  const { listBriefImages } = await import("@/lib/brief-images");
  return (await listBriefImages(workspaceId)).length;
}

/** Vidéos du brief prêtes à être lues par Claude (analysées). */
export async function countBriefVideos(workspaceId: string): Promise<number> {
  const { listBriefVideos } = await import("@/lib/brief-videos");
  return (await listBriefVideos(workspaceId)).filter((v) => v.status === "ready").length;
}

export function briefBlock(scope: EditorScope): string | null {
  if (!scope.workspace) return null;
  const imgs = (scope.briefImages
    ? `\nIMAGES DE RÉFÉRENCE : ${scope.briefImages} image(s) jointe(s) au brief (style, captions, ambiance…). Appelle get_creator_brief pour les VOIR avant de monter.`
    : "") + (scope.briefVideos
    ? `\nVIDÉOS QUI MARCHENT : ${scope.briefVideos} vidéo(s) de ce créateur analysée(s) (plans, captions, rythme, transitions, son). Appelle get_creator_brief pour lire leur descriptif avant de monter.`
    : "");
  const head = `CRÉATEUR : « ${scope.workspace.name} »${imgs}`;
  if (!scope.brief) {
    return `${head}\nBRIEF : aucun brief enregistré pour ce créateur (le propriétaire peut en écrire un dans DuupFlow → Créateurs).`;
  }
  return (
    `${head}\nBRIEF DU CRÉATEUR — consignes PERMANENTES, à appliquer à chaque variante sans que le user ait à les répéter ` +
    `(style de captions, ton, langue, hooks qui marchent, choses à éviter). En cas de conflit, la demande explicite du user dans la conversation l'emporte.\n` +
    `---\n${scope.brief}\n---`
  );
}
