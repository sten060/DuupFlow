// GET /.well-known/oauth-authorization-server (via rewrite next.config.js)
// Métadonnées du SERVEUR D'AUTORISATION (RFC 8414) : liste les endpoints
// (authorize/token/register), PKCE S256 obligatoire, client public (auth "none").

import { NextRequest } from "next/server";
import { originOf, SCOPES, CORS_HEADERS } from "@/lib/ai-editor/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = originOf(req);
  const base = `${origin}/api/ai-editor/oauth`;
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      scopes_supported: SCOPES,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
    },
    { headers: { "Cache-Control": "public, max-age=3600", ...CORS_HEADERS } },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
