// POST /api/ai-editor/oauth/token — échange de jetons OAuth 2.1
//   grant_type=authorization_code : valide le code (JWT) + PKCE → access + refresh
//   grant_type=refresh_token       : valide le refresh (JWT) → nouveaux jetons (rotation)
//
// Stateless : les jetons sont des JWT signés (HS256). Aucune DB.

import { NextRequest } from "next/server";
import { originOf, RESOURCE_PATH, signJwt, verifyJwt, pkceS256, CORS_HEADERS } from "@/lib/ai-editor/oauth";

export const dynamic = "force-dynamic";

function tokenError(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, { status, headers: CORS_HEADERS });
}

function issueTokens(sub: string, scope: string, aud: string) {
  const access = signJwt({ typ: "access", sub, scope, aud }, 3600);
  const refresh = signJwt({ typ: "refresh", sub, scope, aud }, 60 * 60 * 24 * 30); // 30 j
  return Response.json(
    { access_token: access, token_type: "Bearer", expires_in: 3600, refresh_token: refresh, scope },
    { headers: CORS_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  const aud = `${originOf(req)}${RESOURCE_PATH}`;
  let form: FormData;
  try { form = await req.formData(); } catch { return tokenError("invalid_request", "Corps form-urlencoded attendu."); }
  const g = (k: string) => (form.get(k) ?? "").toString();
  const grant = g("grant_type");

  if (grant === "authorization_code") {
    const code = g("code");
    const verifier = g("code_verifier");
    const payload = verifyJwt(code);
    if (!payload || payload.typ !== "code" || typeof payload.sub !== "string") {
      return tokenError("invalid_grant", "Code d'autorisation invalide ou expiré.");
    }
    if (!verifier || pkceS256(verifier) !== payload.cc) {
      return tokenError("invalid_grant", "Vérification PKCE échouée.");
    }
    return issueTokens(payload.sub, String(payload.scope ?? "mcp_access"), aud);
  }

  if (grant === "refresh_token") {
    const rt = g("refresh_token");
    const payload = verifyJwt(rt);
    if (!payload || payload.typ !== "refresh" || typeof payload.sub !== "string") {
      return tokenError("invalid_grant", "Refresh token invalide ou expiré.");
    }
    return issueTokens(payload.sub, String(payload.scope ?? "mcp_access"), aud);
  }

  return tokenError("unsupported_grant_type", `grant_type non supporté : ${grant}`);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
