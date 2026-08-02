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
import { TOOLS, callTool } from "@/lib/ai-editor/mcp-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  // Auth : clé API DuupFlow en Bearer (réservé aux plans autorisés).
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;
  const userId = auth.actor.userId;

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

// GET : stateless, pas de SSE serveur → non supporté.
export async function GET() {
  return new Response("MCP endpoint — POST only (JSON-RPC).", { status: 405, headers: { Allow: "POST" } });
}
