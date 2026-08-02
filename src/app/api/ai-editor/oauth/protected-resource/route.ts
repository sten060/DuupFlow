// GET /.well-known/oauth-protected-resource (via rewrite next.config.js)
// Métadonnées de la RESSOURCE protégée (RFC 9728) : dit à Claude quel serveur
// d'autorisation utiliser pour obtenir un token pour notre MCP.

import { NextRequest } from "next/server";
import { originOf, RESOURCE_PATH, SCOPES, CORS_HEADERS } from "@/lib/ai-editor/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = originOf(req);
  return Response.json(
    {
      resource: `${origin}${RESOURCE_PATH}`,
      authorization_servers: [origin],
      scopes_supported: SCOPES,
    },
    { headers: { "Cache-Control": "public, max-age=3600", ...CORS_HEADERS } },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
