// /api/ai-editor/oauth/authorize
//   GET  → écran de consentement « Autoriser Claude ? » (nécessite session DuupFlow)
//   POST → l'utilisateur a cliqué Autoriser/Refuser → redirige vers Claude avec
//          un code d'autorisation (JWT court, encode userId + PKCE challenge).
//
// L'IDENTITÉ vient TOUJOURS de la session DuupFlow (cookie Supabase), jamais du
// client — c'est ce qui rend la connexion sûre ET « 1 clic » (l'user est déjà loggé).

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { originOf, RESOURCE_PATH, isAllowedRedirect, signJwt } from "@/lib/ai-editor/oauth";

export const dynamic = "force-dynamic";

const BRAND = "linear-gradient(135deg,#6366F1,#38BDF8)";

function page(title: string, inner: string): Response {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title>
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b12;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e8e8f0;padding:24px}
  .card{width:100%;max-width:440px;background:#14141d;border:1px solid #262636;border-radius:20px;
    padding:32px;box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:center}
  .logo{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;margin:0 auto 18px;
    font-size:26px;background:${BRAND}}
  h1{font-size:20px;margin:0 0 8px;color:#fff}
  p{font-size:14px;line-height:1.55;color:#a8a8bd;margin:0 0 10px}
  .who{font-size:13px;color:#c9c9de;background:#1c1c28;border:1px solid #2a2a3c;border-radius:10px;
    padding:9px 12px;margin:14px 0}
  .scopes{text-align:left;font-size:13px;color:#c9c9de;margin:16px 0;padding:0}
  .scopes li{list-style:none;padding:6px 0 6px 26px;position:relative}
  .scopes li:before{content:"✓";position:absolute;left:4px;color:#38BDF8;font-weight:700}
  .row{display:flex;gap:10px;margin-top:22px}
  button{flex:1;border:0;border-radius:11px;padding:13px;font-size:14px;font-weight:600;cursor:pointer}
  .primary{background:${BRAND};color:#fff}
  .ghost{background:transparent;color:#a8a8bd;border:1px solid #2a2a3c}
  a.btn{display:inline-block;margin-top:18px;background:${BRAND};color:#fff;text-decoration:none;
    padding:12px 22px;border-radius:11px;font-weight:600;font-size:14px}
  .muted{font-size:12px;color:#6b6b82;margin-top:16px}
</style></head><body><div class="card">${inner}</div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function errorPage(msg: string): Response {
  return page("Connexion impossible", `<div class="logo">⚠️</div>
    <h1>Connexion impossible</h1><p>${msg}</p>
    <p class="muted">Ferme cette fenêtre et réessaie depuis Claude.</p>`);
}

function loginRequiredPage(origin: string): Response {
  return page("Connecte-toi à DuupFlow", `<div class="logo">🔐</div>
    <h1>Connecte-toi à DuupFlow</h1>
    <p>Pour autoriser Claude, tu dois d'abord être connecté à ton compte DuupFlow dans ce navigateur.</p>
    <a class="btn" href="${origin}/login" target="_blank" rel="noopener">Se connecter à DuupFlow</a>
    <p class="muted">Une fois connecté, reviens sur Claude et clique à nouveau sur « Connecter ».</p>`);
}

/** Extrait les paramètres OAuth utiles (GET query ou POST form). */
function readParams(src: URLSearchParams | FormData) {
  const g = (k: string) => (src.get(k) ?? "").toString();
  return {
    responseType: g("response_type"),
    clientId: g("client_id"),
    redirectUri: g("redirect_uri"),
    scope: g("scope") || "mcp_access",
    state: g("state"),
    codeChallenge: g("code_challenge"),
    codeChallengeMethod: g("code_challenge_method"),
    resource: g("resource"),
    decision: g("decision"),
  };
}

export async function GET(req: NextRequest) {
  const p = readParams(new URL(req.url).searchParams);
  if (p.responseType !== "code") return errorPage("Type de réponse non supporté (attendu : code).");
  if (!p.redirectUri || !isAllowedRedirect(p.redirectUri)) return errorPage("Adresse de redirection non autorisée.");
  if (!p.codeChallenge || p.codeChallengeMethod !== "S256") return errorPage("Sécurité PKCE (S256) requise.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return loginRequiredPage(originOf(req));

  const hidden = (k: string, v: string) => `<input type="hidden" name="${k}" value="${v.replace(/"/g, "&quot;")}"/>`;
  const inner = `<div class="logo" style="background:#fff"><img src="${originOf(req)}/claude-color.svg" alt="Claude" width="30" height="30"/></div>
    <h1>Autoriser Claude ?</h1>
    <p><b style="color:#fff">Claude</b> souhaite se connecter à ton <b style="color:#fff">Éditeur IA DuupFlow</b> pour t'aider à monter tes variantes.</p>
    <div class="who">Compte : ${(user.email ?? "ton compte DuupFlow").replace(/</g, "&lt;")}</div>
    <ul class="scopes">
      <li>Lire ta vidéo de référence analysée (structure, hook)</li>
      <li>Lire ta matière (rushes, descriptions)</li>
      <li>Créer des variantes vidéo dans ton projet</li>
    </ul>
    <form method="POST" action="${originOf(req)}/api/ai-editor/oauth/authorize">
      ${hidden("response_type", p.responseType)}
      ${hidden("client_id", p.clientId)}
      ${hidden("redirect_uri", p.redirectUri)}
      ${hidden("scope", p.scope)}
      ${hidden("state", p.state)}
      ${hidden("code_challenge", p.codeChallenge)}
      ${hidden("code_challenge_method", p.codeChallengeMethod)}
      ${hidden("resource", p.resource)}
      <div class="row">
        <button class="ghost" type="submit" name="decision" value="deny">Refuser</button>
        <button class="primary" type="submit" name="decision" value="allow">Autoriser</button>
      </div>
    </form>
    <p class="muted">Tu pourras révoquer l'accès à tout moment depuis Claude.</p>`;
  return page("Autoriser Claude", inner);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const p = readParams(form);
  if (!p.redirectUri || !isAllowedRedirect(p.redirectUri)) return errorPage("Adresse de redirection non autorisée.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return loginRequiredPage(originOf(req));

  const redir = new URL(p.redirectUri);
  if (p.decision !== "allow") {
    redir.searchParams.set("error", "access_denied");
    if (p.state) redir.searchParams.set("state", p.state);
    return Response.redirect(redir.toString(), 303);
  }

  // Code d'autorisation = JWT court (10 min) qui lie userId + PKCE challenge.
  const code = signJwt(
    {
      typ: "code",
      sub: user.id,
      cc: p.codeChallenge,
      ru: p.redirectUri,
      scope: p.scope,
      aud: `${originOf(req)}${RESOURCE_PATH}`,
    },
    600,
  );
  redir.searchParams.set("code", code);
  if (p.state) redir.searchParams.set("state", p.state);
  return Response.redirect(redir.toString(), 303);
}
