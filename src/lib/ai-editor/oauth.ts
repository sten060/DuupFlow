// src/lib/ai-editor/oauth.ts
//
// Serveur OAuth 2.1 (PKCE) minimal pour le connecteur MCP de l'Éditeur IA.
// But : que l'utilisateur branche DuupFlow à SON Claude en collant l'URL du MCP
// et en cliquant « Autoriser » — SANS clé API à copier.
//
// Choix : tokens SIGNÉS EN JWT (HS256, secret HMAC) → 100% STATELESS, aucune
// base de données / migration. Le userId DuupFlow est encodé dans le token ;
// la route MCP le relit et sait pour qui elle travaille.
//
// Contrat implémenté (spec MCP + RFC 9728/8414/7591/7636/8707) :
//   - /.well-known/oauth-protected-resource   (métadonnées ressource)
//   - /.well-known/oauth-authorization-server (métadonnées serveur d'autorisation)
//   - /register (enregistrement dynamique, stateless), /authorize (consentement),
//     /token (code+PKCE / refresh). La route MCP renvoie 401 + WWW-Authenticate.

import crypto from "crypto";

// Secret de signature (résolu à l'USAGE, pas au chargement du module → n'empêche pas
// le build). En PRODUCTION, si OAUTH_SECRET est absent, on ÉCHOUE FERMÉ (throw) plutôt
// que de tourner sur un repli PUBLIC (présent dans le repo → jetons forgeables). En
// dev seulement, on retombe sur la constante pour tester en local sans configuration.
function secret(): string {
  const s = process.env.OAUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("OAUTH_SECRET manquant en production — le connecteur MCP OAuth est désactivé (sécurité).");
  }
  return "duupflow-dev-oauth-secret-change-me";
}

export const RESOURCE_PATH = "/api/ai-editor/mcp";
export const SCOPES = ["mcp_access", "offline_access"];

/* ── JWT HS256 fait main (pas de dépendance) ─────────────────────────────── */
function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
function hmac(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export type JwtPayload = Record<string, unknown> & { typ?: string; sub?: string; exp?: number };

export function signJwt(payload: JwtPayload, expSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  // jti aléatoire → chaque jeton est une chaîne UNIQUE (rotation des refresh
  // tokens au niveau string, même si en stateless on ne révoque pas l'ancien).
  const jti = crypto.randomBytes(8).toString("hex");
  const head = b64urlJson({ alg: "HS256", typ: "JWT" });
  const body = b64urlJson({ ...payload, iat: now, exp: now + expSec, jti });
  return `${head}.${body}.${hmac(`${head}.${body}`)}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  try {
    const expected = hmac(`${head}.${body}`); // peut throw si OAUTH_SECRET absent en prod → fail closed (401)
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as JwtPayload;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ── PKCE (RFC 7636) ─────────────────────────────────────────────────────── */
export function pkceS256(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/* ── Origine publique de la requête (dev localhost / prod www) ───────────── */
export function originOf(req: Request): string {
  const h = (n: string) => req.headers.get(n) || "";
  const proto = h("x-forwarded-proto") || (h("host").startsWith("localhost") ? "http" : "https");
  const host = h("x-forwarded-host") || h("host");
  return `${proto}://${host}`;
}

/** URL de découverte à annoncer dans l'en-tête WWW-Authenticate de la route MCP. */
export function wwwAuthenticate(req: Request): string {
  return `Bearer resource_metadata="${originOf(req)}/.well-known/oauth-protected-resource"`;
}

/* ── redirect_uri autorisés : claude.ai/claude.com + loopback (Claude Code) ─ */
export function isAllowedRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === "https:" && (u.hostname === "claude.ai" || u.hostname === "claude.com")) return true;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return true;
    return false;
  } catch {
    return false;
  }
}

/* ── Bearer + résolution du userId OAuth (pour la route MCP) ─────────────── */
export function bearerFrom(req: Request): string {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

/** Renvoie le userId DuupFlow si le Bearer est un access token OAuth valide. */
export function oauthUserId(req: Request): string | null {
  const tok = bearerFrom(req);
  if (!tok || tok.startsWith("dflw_")) return null; // clé API DuupFlow → autre voie
  const p = verifyJwt(tok);
  if (!p || p.typ !== "access" || typeof p.sub !== "string") return null;
  return p.sub;
}

/* ── En-têtes CORS communs (les métadonnées sont fetchées publiquement) ──── */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
