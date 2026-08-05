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

import { authenticateApiRequest, resolveEffectivePlan } from "@/lib/api-auth";
import { TOOLS, callTool } from "@/lib/ai-editor/mcp-tools";
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

function needsPaidPlan() {
  return new Response(JSON.stringify({ error: "L'Éditeur IA (connecteur MCP) est réservé aux plans Solo et Pro. Passe à un plan payant pour l'utiliser." }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
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
  // Gate PLAN PAYANT (Solo ou Pro) sur la voie OAuth (« Autoriser » en 1 clic).
  // Revérifié à CHAQUE requête → coupe aussi l'accès si le plan tombe en Free
  // (downgrade) même avec un refresh token encore valide. Les rendus restent bornés
  // par le quota « vidéos » (Solo 300/mois partagés, Pro illimité).
  const plan = await resolveEffectivePlan(uid);
  if (plan !== "pro" && plan !== "solo") return { deny: needsPaidPlan() };
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
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return new Response(null, { status: 202 });
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: TOOLS });
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
