import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ────────────────────────────────────────────────────────────────────────
// i18n routing
// ────────────────────────────────────────────────────────────────────────
const LOCALES = ["fr", "en"] as const;
type Locale = (typeof LOCALES)[number];

/** Top-level public/auth paths that must be wrapped in a locale prefix. */
const LOCALIZED_TOP_LEVEL = new Set([
  "",            // homepage "/"
  "features",
  "how-it-works",
  "pricing",
  "benefits",
  "partners",
  "demo",
  "blog",
  "legal",
  "login",
  "register",
  "onboarding",
]);

/** Legacy URLs → forced locale + new slug. Used for SEO-stable 301 redirects. */
const LEGACY_REDIRECTS: Record<string, { locale: Locale; slug: string }> = {
  "/fonctionnalites":     { locale: "fr", slug: "/features" },
  "/product":             { locale: "en", slug: "/features" },
  "/comment-ca-marche":   { locale: "fr", slug: "/how-it-works" },
  "/tarifs":              { locale: "fr", slug: "/pricing" },
  "/avantages":           { locale: "fr", slug: "/benefits" },
  "/partenaire":          { locale: "fr", slug: "/partners" },
};

const LANG_COOKIE = "duupflow_lang";

function pickLocale(req: NextRequest): Locale {
  // 1) Explicit user override via cookie (only written by the LanguageSwitch
  //    toggle, never auto-set — so its presence reflects a real user choice)
  const cookieLocale = req.cookies.get(LANG_COOKIE)?.value;
  if (cookieLocale === "fr" || cookieLocale === "en") return cookieLocale;

  // 2) Country header — works on Vercel and Cloudflare-proxied setups.
  //    Default rule per product owner: only France gets FR auto, all else EN.
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-country-code") ??
    "";
  if (country.toUpperCase() === "FR") return "fr";

  // 3) Fallback — Accept-Language. Railway-edge (current host) doesn't expose
  //    a country header, so we use the browser's preferred-language list. Any
  //    "fr" or "fr-*" tag (in any quality position) → FR.
  const accept = req.headers.get("accept-language") ?? "";
  if (/(^|,|\s)fr(-[A-Z]{2})?\b/i.test(accept)) return "fr";

  return "en";
}

function topLevelSegment(pathname: string): string {
  if (pathname === "/" || pathname === "") return "";
  const trimmed = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const slash = trimmed.indexOf("/");
  return slash === -1 ? trimmed : trimmed.slice(0, slash);
}

/** Strip /fr or /en prefix; "/fr/login" → "/login", "/dashboard" → "/dashboard". */
function stripLocale(p: string): string {
  const m = p.match(/^\/(fr|en)(\/.*)?$/);
  return m ? (m[2] ?? "/") : p;
}

function localePrefix(p: string): string {
  const m = p.match(/^\/(fr|en)(?:\/.*)?$/);
  return m ? `/${m[1]}` : "";
}

function handleI18nRouting(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;

  // 1) Hardcoded legacy URL redirects (preserve SEO intent for old paths)
  if (LEGACY_REDIRECTS[pathname]) {
    const { locale, slug } = LEGACY_REDIRECTS[pathname];
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${slug}`;
    return NextResponse.redirect(url, 301);
  }

  // 2) Already locale-prefixed → let it through
  const first = topLevelSegment(pathname);
  if (first === "fr" || first === "en") return null;

  // 3) Top-level path that should be localized → redirect to picked locale
  if (LOCALIZED_TOP_LEVEL.has(first)) {
    const locale = pickLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────
// Existing auth gating (only runs on routes that touch auth state)
// ────────────────────────────────────────────────────────────────────────
const AUTH_GATED_PREFIXES = ["/dashboard", "/admin", "/affiliate", "/affiliate-login", "/checkout"];

function needsAuthCheck(pathname: string): boolean {
  if (AUTH_GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  // /{locale}/login also needs the "redirect if already authed" check
  const normalized = stripLocale(pathname);
  return normalized === "/login";
}

export async function middleware(request: NextRequest) {
  // ── i18n first — if a redirect is returned we short-circuit
  const i18nRedirect = handleI18nRouting(request);
  if (i18nRedirect) return i18nRedirect;

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
    return NextResponse.next({ request });
  }

  // ── Rafraîchissement de session — pattern @supabase/ssr canonique. ──
  // getUser() vérifie le token ET rafraîchit un token expiré ; setAll() réécrit
  // alors les nouveaux cookies sur supabaseResponse. Ça DOIT tourner sur chaque
  // requête authentifiée : sinon le refresh token tourne sans être persisté et
  // l'utilisateur est déconnecté au hasard. NE RIEN mettre entre
  // createServerClient et getUser().
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
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
  const prefix = localePrefix(pathname);

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

  // Redirige vers /{locale}/login si non authentifié sur les routes protégées
  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    const url = request.nextUrl.clone();
    const locale = pickLocale(request);
    url.pathname = `/${locale}/login`;
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

  // Redirige si déjà connecté et tente d'accéder à /{locale}/login
  if (user && normalized === "/login") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("has_paid, is_guest, plan")
      .eq("id", user.id)
      .single();
    if (!profile) {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix}/login`;
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
      url.pathname = `/${locale}/login`;
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
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|og-image.png|robots.txt|sitemap.xml|api/|auth/|out/).*)",
  ],
};
