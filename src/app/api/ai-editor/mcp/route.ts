// Serveur MCP (Model Context Protocol) de l'Éditeur IA — transport HTTP.
//
// Le user branche DuupFlow à son Claude en pointant sur cette URL avec sa clé API
// DuupFlow en header :
//   Authorization: Bearer dflw_live_…
//   (ex. Claude Code : `claude mcp add --transport http duupflow <url> \
//        --header "Authorization: Bearer dflw_live_…"`)
//
// JSON-RPC 2.0 minimal (initialize / tools/list / tools/call / ping), sans SDK,
// stateless. Les outils (mcp-tools.ts) sont EN LECTURE : ils donnent au Claude du
// user la réf analysée (keyframes EN IMAGES → il les VOIT) + la matière.

import { authenticateApiRequest } from "@/lib/api-auth";
import { toolsForUser, callTool, promptsForUser, getPromptForUser } from "@/lib/ai-editor/mcp-tools";
import { bearerFrom, oauthUserId, wwwAuthenticate } from "@/lib/ai-editor/oauth";

export const dynamic = "force-dynamic";
// 300s : un rendu lourd (plans multiples + composites split/pip + effets vitesse +
// captions animées) enchaîne plusieurs passes ffmpeg → 60s était trop court et
// coupait la requête avec une erreur nue (timeout non catchable).
export const maxDuration = 300;

/** 401 avec l'en-tête qui déclenche la découverte OAuth côté Claude. */
function needsAuth(req: Request) {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", "WWW-Authenticate": wwwAuthenticate(req) },
  });
}

/**
 * Auth du connecteur : deux voies.
 *  - Token OAuth (JWT, via « Autoriser » dans Claude) → 1 clic, sans clé.
 *  - Clé API DuupFlow (dflw_…, Bearer) → repli pour Claude Code / power-users.
 * Renvoie le userId, ou une Response 401 (avec WWW-Authenticate) à retourner tel quel.
 */
async function resolveUser(req: Request): Promise<{ userId: string } | { deny: Response }> {
  const tok = bearerFrom(req);
  if (!tok) return { deny: needsAuth(req) };
  if (tok.startsWith("dflw_")) {
    const auth = await authenticateApiRequest(req);
    if (!auth.ok) return { deny: needsAuth(req) };
    return { userId: auth.actor.userId };
  }
  const uid = oauthUserId(req);
  if (!uid) return { deny: needsAuth(req) };
  // Plan gratuit : le connecteur se branche (le user essaie, Claude lit sa réf
  // et sa matière), mais AUCUNE variante n'est rendue — create_variant et
  // update_variant répondent à Claude que le plan ne le permet pas, pour qu'il
  // l'explique au user (mcp-tools.ts, guardVariantQuota). Revérifié à chaque
  // appel d'outil → un downgrade coupe les rendus même avec un token valide.
  return { userId: uid };
}

const SERVER_INFO = { name: "duupflow-ai-editor", version: "0.1.0" };
const DEFAULT_PROTOCOL = "2025-06-18";

type JsonRpcReq = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

function rpcResult(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}
function rpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

export async function POST(req: Request) {
  // Auth : token OAuth (« Autoriser » dans Claude) OU clé API DuupFlow (Bearer).
  const resolved = await resolveUser(req);
  if ("deny" in resolved) return resolved.deny;
  const userId = resolved.userId;

  let body: unknown;
  try { body = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }

  const msg = body as JsonRpcReq;
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError((msg as JsonRpcReq)?.id, -32600, "Invalid Request");
  }
  const isNotification = msg.id === undefined || msg.id === null;

  switch (msg.method) {
    case "initialize": {
      const clientProto = typeof msg.params?.protocolVersion === "string" ? (msg.params.protocolVersion as string) : DEFAULT_PROTOCOL;
      return rpcResult(msg.id, {
        protocolVersion: clientProto,
        // prompts : un prompt « Travailler pour <créateur> » par créateur accessible.
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "DuupFlow Éditeur IA. Si le compte gère plusieurs créateurs (workspaces), appelle d'abord list_creators, demande au user pour lequel il travaille, puis passe ce nom en argument creator à chaque outil (garde-le pour toute la conversation). " +
          "Le BRIEF du créateur (style de captions, ton, langue, hooks, choses à éviter) arrive en tête de get_reference et list_material : applique-le à chaque variante sans que le user ait à le répéter. " +
          "Quand le user donne une consigne DURABLE pour un créateur (« retiens que… », « à partir de maintenant… »), enregistre-la avec save_creator_brief pour qu'elle serve à toute l'équipe. " +
          "Tu peux AJOUTER toi-même de la matière avec add_material (fichier ou dossier Google Drive partagé avec DuupFlow, ou lien https direct), et ENVOYER les variantes finies dans le dossier Drive d'export avec export_to_drive (ticket à suivre avec get_drive_export) — puis les ranger avec ton propre connecteur Drive grâce aux driveFileId renvoyés.",
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return new Response(null, { status: 202 });
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      // Par user : un compte à workspaces reçoit l'argument `creator` + list_creators.
      return rpcResult(msg.id, { tools: await toolsForUser(userId) });
    case "prompts/list":
      return rpcResult(msg.id, { prompts: await promptsForUser(userId) });
    case "prompts/get": {
      const pname = String(msg.params?.name || "");
      const prompt = await getPromptForUser(userId, pname);
      if (!prompt) return rpcError(msg.id, -32602, `Prompt inconnu ou non accessible : ${pname}`);
      return rpcResult(msg.id, prompt);
    }
    case "tools/call": {
      const name = String(msg.params?.name || "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const out = await callTool(userId, name, args);
        return rpcResult(msg.id, out);
      } catch (e) {
        return rpcResult(msg.id, { content: [{ type: "text", text: `Erreur outil : ${(e as Error)?.message ?? "inconnue"}` }], isError: true });
      }
    }
    default:
      if (isNotification) return new Response(null, { status: 202 });
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

// GET : pas de SSE serveur. Sans auth → 401 + WWW-Authenticate (déclenche la
// découverte OAuth) ; avec un token valide → 405 (l'échange se fait en POST).
export async function GET(req: Request) {
  const resolved = await resolveUser(req);
  if ("deny" in resolved) return resolved.deny;
  return new Response("MCP endpoint — POST only (JSON-RPC).", { status: 405, headers: { Allow: "POST" } });
}
