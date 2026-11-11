// Source unique des adresses publiques FR / EN.
//
//   Anglais  = racine        → /pricing, /blog/<slug-en>, /docs/<slug-en>
//   Français = préfixe /fr   → /fr/pricing, /fr/blog/<slug-fr>, /fr/docs/<slug-fr>
//
// En interne, les pages vivent toujours sous src/app/[locale]/… : le middleware
// réécrit (sans changer l'adresse visible) /pricing → /en/pricing, et
// /docs/ai-editor → /en/docs/editeur-ia. Les anciennes adresses /en/… sont
// redirigées en 301 vers la racine.
//
// Pas de "use client" / "server-only" : importé par le middleware, les
// metadata serveur ET les composants client.

export type Locale = "fr" | "en";

export const SITE_URL = "https://www.duupflow.com";

/** Premiers segments des pages publiques (marketing + auth) gérées par [locale]. */
export const PUBLIC_TOP_LEVEL = new Set([
  "",
  "pricing",
  "partners",
  "blog",
  "capcut-alternative",
  "submagic-alternative",
  "metaghost-alternative",
  "docs",
  "legal",
  "login",
  "register",
  "onboarding",
  "demo-request",
]);

/**
 * Pages dont l'adresse diffère selon la langue.
 *   fr          → adresse française (sous /fr)
 *   en          → adresse anglaise publique (racine)
 *   enInternal  → dossier réellement servi pour l'anglais (sous /en en interne)
 */
type SlugPair = { fr: string; en: string; enInternal: string };

const SLUG_PAIRS: SlugPair[] = [
  // Blog — un même dossier sert les deux langues, seule l'adresse EN change.
  ...([
    ["creer-un-mois-de-reels-automatique-ia", "create-a-month-of-reels-automatically-with-ai"],
    ["duupflow-pas-qu-un-simple-spoofer", "duupflow-more-than-a-video-spoofer"],
    ["instagram-contenus-non-originaux", "instagram-unoriginal-content-rule"],
    ["automatiser-production-contenu-api-duupflow", "automate-content-production-duupflow-api"],
    ["reposter-meme-video-plusieurs-comptes-tiktok-instagram", "repost-same-video-multiple-tiktok-instagram-accounts"],
    ["agence-onlyfans-reels-instagram-plusieurs-comptes", "onlyfans-agency-instagram-reels-multiple-accounts"],
  ] as const).map(([fr, en]) => ({ fr: `/blog/${fr}`, en: `/blog/${en}`, enInternal: `/blog/${fr}` })),
  // Blog — articles qui ont déjà un dossier par langue.
  { fr: "/blog/editeur-video-ia", en: "/blog/ai-video-editor", enInternal: "/blog/ai-video-editor" },
  { fr: "/blog/tiktok-ineligible-recommandations", en: "/blog/tiktok-ineligible-for-recommendation", enInternal: "/blog/tiktok-ineligible-for-recommendation" },
  // Centre d'aide — un même slug interne (helpCenterContent.ts), adresse EN traduite.
  ...([
    ["editeur-ia", "ai-editor"],
    ["comparateur", "comparator"],
    ["compresseur", "compressor"],
    ["variation-ia", "ai-variation"],
    ["retirer-detection-ia", "remove-ai-detection"],
    ["createurs-et-roles", "creators-and-roles"],
    ["duplication-video", "video-duplication"],
    ["duplication-image", "image-duplication"],
  ] as const).map(([fr, en]) => ({ fr: `/docs/${fr}`, en: `/docs/${en}`, enInternal: `/docs/${fr}` })),
];

/** Pages qui n'existent qu'en anglais (la version /fr redirige vers l'anglais). */
export const EN_ONLY = new Set(["/submagic-alternative"]);

function findPair(path: string): SlugPair | undefined {
  return SLUG_PAIRS.find((p) => p.fr === path || p.en === path || p.enInternal === path);
}

/** "/fr/docs/x" → "/docs/x", "/en" → "/", "/pricing" → "/pricing". */
export function stripLocale(path: string): string {
  const m = path.match(/^\/(fr|en)(\/.*)?$/);
  return m ? (m[2] ?? "/") : path;
}

/** Premier segment : "/blog/x" → "blog", "/" → "". */
export function topLevelSegment(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  const slash = trimmed.indexOf("/");
  return slash === -1 ? trimmed : trimmed.slice(0, slash);
}

/** Vrai si le chemin (sans préfixe de langue) est une page publique localisée. */
export function isPublicPath(path: string): boolean {
  return PUBLIC_TOP_LEVEL.has(topLevelSegment(path));
}

/**
 * Adresse publique d'une page dans une langue donnée.
 * Accepte n'importe quelle forme en entrée (adresse FR, EN, interne, avec ou
 * sans /fr|/en) :
 *   publicPath("en", "/fr/docs/editeur-ia") → "/docs/ai-editor"
 *   publicPath("fr", "/docs/ai-editor")     → "/fr/docs/editeur-ia"
 *   publicPath("en", "/")                   → "/"
 *   publicPath("fr", "/")                   → "/fr"
 */
export function publicPath(locale: Locale, path: string): string {
  const bare = stripLocale(path);
  const pair = findPair(bare);
  // Page anglaise uniquement : même lien depuis la version FR (pas de /fr/…)
  if (locale === "en" || EN_ONLY.has(bare)) return pair ? pair.en : bare;
  const fr = pair ? pair.fr : bare;
  return fr === "/" ? "/fr" : `/fr${fr}`;
}

/** URL absolue (pour canonical / Open Graph / sitemap). */
export function absoluteUrl(locale: Locale, path: string): string {
  const p = publicPath(locale, path);
  return p === "/" ? SITE_URL : `${SITE_URL}${p}`;
}

/** Chemin interne servi pour une adresse anglaise publique : "/docs/ai-editor" → "/en/docs/editeur-ia". */
export function enInternalPath(publicEnPath: string): string {
  const pair = findPair(publicEnPath);
  const internal = pair ? pair.enInternal : publicEnPath;
  return internal === "/" ? "/en" : `/en${internal}`;
}

/** Vrai si l'adresse racine donnée n'est pas l'adresse anglaise officielle (ex. ancien slug FR). */
export function isNonCanonicalEnPath(bare: string): boolean {
  const pair = findPair(bare);
  return !!pair && pair.en !== bare;
}

/** Vrai si l'adresse /fr donnée n'est pas l'adresse française officielle (ex. slug EN sous /fr). */
export function isNonCanonicalFrPath(bare: string): boolean {
  const pair = findPair(bare);
  return (!!pair && pair.fr !== bare) || EN_ONLY.has(bare);
}

/**
 * Balises canonical + hreflang d'une page (chemins relatifs, résolus par
 * metadataBase). `path` peut être sous n'importe quelle forme.
 */
export function alternatesFor(locale: Locale, path: string) {
  const bare = stripLocale(path);
  if (EN_ONLY.has(bare)) return { canonical: publicPath("en", bare) };
  const en = publicPath("en", bare);
  const fr = publicPath("fr", bare);
  return {
    canonical: locale === "fr" ? fr : en,
    languages: { "en-US": en, "fr-FR": fr, "x-default": en },
  };
}

/** Robots d'indexation et assistants IA : jamais redirigés selon la langue. */
export const BOT_UA =
  /bot\b|bot\/|crawler|spider|slurp|GPTBot|OAI-SearchBot|ChatGPT-User|PerplexityBot|Perplexity-User|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|Google-Extended|Google-InspectionTool|Storebot-Google|APIs-Google|AdsBot|Mediapartners-Google|FeedFetcher|Applebot|bingpreview|facebookexternalhit|meta-externalagent|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|WhatsApp|CCBot|Bytespider|Amazonbot|YandexBot|Baiduspider|DuckDuckBot|ia_archiver|cohere-ai|Diffbot|MistralAI-User|YouBot|Timpibot|headless/i;

export const LANG_COOKIE = "duupflow_lang";
