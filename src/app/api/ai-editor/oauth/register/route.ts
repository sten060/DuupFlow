// POST /api/ai-editor/oauth/register — Dynamic Client Registration (RFC 7591)
// Claude s'enregistre comme client PUBLIC. On est STATELESS : on dérive un
// client_id du contenu (idempotent) sans rien persister. La sécurité repose sur
// PKCE + l'allowlist de redirect_uri (vérifiée à /authorize et /token).

import { NextRequest } from "next/server";
import crypto from "crypto";
import { CORS_HEADERS } from "@/lib/ai-editor/oauth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* corps optionnel */ }

  const redirectUris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as string[]) : [];
  const clientId = "mcp_" + crypto.createHash("sha256").update(JSON.stringify(redirectUris)).digest("hex").slice(0, 24);

  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
