import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  BOT_UA,
  EN_ONLY,
  LANG_COOKIE,
  enInternalPath,
  isNonCanonicalEnPath,
  isNonCanonicalFrPath,
  isPublicPath,
  publicPath,
  stripLocale,
  topLevelSegment,
  type Locale,
} from "@/lib/i18n/routes";

// ────────────────────────────────────────────────────────────────────────
// i18n routing — anglais à la racine, français sous /fr.
// Adresses FR/EN et slugs traduits : src/lib/i18n/routes.ts.
// ────────────────────────────────────────────────────────────────────────

/** Legacy URLs → forced locale + new slug. Used for SEO-stable 301 redirects. */
const LEGACY_REDIRECTS: Record<string, { locale: Locale; slug: string }> = {
  "/fonctionnalites":     { locale: "fr", slug: "" },
  "/product":             { locale: "en", slug: "" },
  "/comment-ca-marche":   { locale: "fr", slug: "" },
  "/tarifs":              { locale: "fr", slug: "/pricing" },
  "/avantages":           { locale: "fr", slug: "" },
  "/partenaire":          { locale: "fr", slug: "/partners" },
};

/** Anciennes pages marketing supprimées (thème sombre) → 301 vers l'accueil,
 *  avec ou sans préfixe de locale (/features, /fr/demo, /en/benefits…). */
const RETIRED_PAGES = new Set(["features", "how-it-works", "demo", "benefits"]);

/** Langue préférée du navigateur = première langue de la liste Accept-Language. */
function browserPrefersFrench(req: NextRequest): boolean {
  const accept = req.headers.get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
  return first === "fr" || first.startsWith("fr-") || first.startsWith("fr;");
}

/** Langue pour les redirections d'auth (choix mémorisé, sinon navigateur). */
function pickLocale(req: NextRequest): Locale {
  const cookieLocale = req.cookies.get(LANG_COOKIE)?.value;
  if (cookieLocale === "fr" || cookieLocale === "en") return cookieLocale;
  return browserPrefersFrench(req) ? "fr" : "en";
}

/** Même adresse, autre chemin, query conservée (utm_*, fpr, ref, via, gclid…).
 *  Next normalise ensuite le Location (un espace « %20 » devient « + ») :
 *  même valeur pour URLSearchParams, donc pour l'attribution affiliés / UTM. */
function withPath(request: NextRequest, pathname: string): URL {
  const raw = new URL(request.url);
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return new URL(`${url.toString()}${raw.search}`);
}

/** Redirection 301 qui conserve la query intacte. */
function permanent(request: NextRequest, pathname: string): NextResponse {
  return NextResponse.redirect(withPath(request, pathname), 301);
}

type I18nResult =
  | { kind: "redirect"; response: NextResponse }
  | { kind: "rewrite"; url: URL }
  | null;

function handleI18nRouting(request: NextRequest): I18nResult {
  const { pathname } = request.nextUrl;

  // 1) Hardcoded legacy URL redirects (preserve SEO intent for old paths)
  if (LEGACY_REDIRECTS[pathname]) {
    const { locale, slug } = LEGACY_REDIRECTS[pathname];
    return { kind: "redirect", response: permanent(request, publicPath(locale, slug || "/")) };
  }

  const first = topLevelSegment(pathname);
  const bare = stripLocale(pathname);

  // 2) Anciennes pages marketing supprimées → accueil (couvre /demo et /fr/demo)
  if (RETIRED_PAGES.has(topLevelSegment(bare))) {
    const locale: Locale = first === "fr" ? "fr" : "en";
    const res = permanent(request, publicPath(locale, "/"));
    return { kind: "redirect", response: res };
  }

  // 3) Anciennes adresses /en/… → même page à la racine, slug anglais (301, 1 seul saut)
  if (first === "en") {
    return { kind: "redirect", response: permanent(request, publicPath("en", bare)) };
  }

  // 4) /fr/… : passe tel quel, sauf slug anglais tapé sous /fr → slug français
  if (first === "fr") {
    if (isNonCanonicalFrPath(bare)) {
      const target = EN_ONLY.has(bare) ? publicPath("en", bare) : publicPath("fr", bare);
      return { kind: "redirect", response: permanent(request, target) };
    }
    return null;
  }

  // 5) Racine = anglais
  if (!isPublicPath(pathname)) return null;

  // 5a) Ancien slug FR à la racine (ex. /docs/editeur-ia) → slug anglais
  if (isNonCanonicalEnPath(pathname)) {
    return { kind: "redirect", response: permanent(request, publicPath("en", pathname)) };
  }

  // 5b) Accueil seulement : visiteur francophone (ou qui a choisi FR) → /fr.
  //     Jamais pour les robots, jamais si le visiteur a choisi l'anglais.
  if (pathname === "/") {
    const choice = request.cookies.get(LANG_COOKIE)?.value;
    const isBot = BOT_UA.test(request.headers.get("user-agent") ?? "");
    const goFrench = !isBot && (choice === "fr" || (choice !== "en" && browserPrefersFrench(request)));
    if (goFrench) {
      const url = withPath(request, "/fr");
      // Temporaire (307) : dépend du visiteur, ne doit pas être retenue par les moteurs.
      const res = NextResponse.redirect(url, 307);
      res.headers.set("Vary", "Accept-Language, Cookie");
      res.headers.set("Cache-Control", "private, no-store");
      return { kind: "redirect", response: res };
    }
  }

  // 5c) Sert la version anglaise sans changer l'adresse visible
  const url = request.nextUrl.clone();
  url.pathname = enInternalPath(pathname);
  return { kind: "rewrite", url };
}

// ────────────────────────────────────────────────────────────────────────
// Existing auth gating (only runs on routes that touch auth state)
// ────────────────────────────────────────────────────────────────────────
const AUTH_GATED_PREFIXES = ["/dashboard", "/admin", "/affiliate", "/affiliate-login", "/checkout"];

function needsAuthCheck(pathname: string): boolean {
  if (AUTH_GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  // /login and /fr/login also need the "redirect if already authed" check
  const normalized = stripLocale(pathname);
  return normalized === "/login";
}

export async function middleware(request: NextRequest) {
  // ── i18n first — if a redirect is returned we short-circuit
  const i18n = handleI18nRouting(request);
  if (i18n?.kind === "redirect") return i18n.response;
  // Pages anglaises à la racine : servies depuis /en/… sans changer l'adresse.
  const rewriteUrl = i18n?.kind === "rewrite" ? i18n.url : null;
  const passThrough = () =>
    rewriteUrl ? NextResponse.rewrite(rewriteUrl, { request }) : NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // Cheap, no-network check: does this request already carry a Supabase auth
  // cookie? Anonymous visitors on public pages skip the Supabase round-trip
  // entirely (marketing pages stay fast). A logged-in user, on the other hand,
  // ALWAYS goes through the session refresh below — even on public pages — so
  // their access token is refreshed on every navigation and never goes stale.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  if (!hasAuthCookie && !needsAuthCheck(pathname)) {
    return passThrough();
  }

  // ── Rafraîchissement de session — pattern @supabase/ssr canonique. ──
  // getUser() vérifie le token ET rafraîchit un token expiré ; setAll() réécrit
  // alors les nouveaux cookies sur supabaseResponse. Ça DOIT tourner sur chaque
  // requête authentifiée : sinon le refresh token tourne sans être persisté et
  // l'utilisateur est déconnecté au hasard. NE RIEN mettre entre
  // createServerClient et getUser().
  let supabaseResponse = passThrough();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = passThrough();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const normalized = stripLocale(pathname);
  const pageLocale: Locale = topLevelSegment(pathname) === "fr" ? "fr" : "en";

  // Tout redirect doit emporter les cookies de session rafraîchis, sinon le
  // navigateur et le serveur se désynchronisent et la session est invalidée
  // prématurément (exigence @supabase/ssr).
  const redirectWithSession = (url: URL) => {
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // ── « Tape le nom → tu es direct dans l'app » : un utilisateur déjà connecté
  //    qui arrive sur la page d'accueil est envoyé droit au dashboard. Le garde
  //    dashboard plus bas gère le cas des comptes sans profil (ex. affiliés). ──
  if (user && normalized === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return redirectWithSession(url);
  }

  // Redirige vers la page de connexion (/login ou /fr/login) si non authentifié sur les routes protégées
  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    const url = request.nextUrl.clone();
    const locale = pickLocale(request);
    url.pathname = publicPath(locale, "/login");
    return redirectWithSession(url);
  }

  // Redirige vers /affiliate-login si non authentifié sur le dashboard affilié
  if (!user && pathname.startsWith("/affiliate/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/affiliate-login";
    return redirectWithSession(url);
  }

  // Redirige si déjà connecté et tente d'accéder à /affiliate-login
  if (user && pathname === "/affiliate-login") {
    const url = request.nextUrl.clone();
    url.pathname = "/affiliate/dashboard";
    return redirectWithSession(url);
  }

  // Redirige si déjà connecté et tente d'accéder à /login ou /fr/login
  if (user && normalized === "/login") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("has_paid, is_guest, plan")
      .eq("id", user.id)
      .single();
    if (!profile) {
      const url = request.nextUrl.clone();
      url.pathname = publicPath(pageLocale, "/login");
      url.searchParams.set("error", "compte_affilie");
      return redirectWithSession(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return redirectWithSession(url);
  }

  // ── Garde dashboard : laisse passer tout user ayant un profil ──
  if (user && pathname.startsWith("/dashboard")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      const locale = pickLocale(request);
      const url = request.nextUrl.clone();
      url.pathname = publicPath(locale, "/login");
      url.searchParams.set("error", "compte_affilie");
      return redirectWithSession(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  // Match all non-asset pages so we can catch legacy URLs + locale prefixes.
  // The middleware short-circuits early for public pages so the Supabase
  // round-trip only happens on auth-gated routes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|og-image.png|og-image-fr.png|robots.txt|sitemap.xml|llms.txt|api/|auth/|out/).*)",
  ],
};
