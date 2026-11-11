import { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/i18n/routes";
const LOCALES = ["fr", "en"] as const;

// Localised public pages. The middleware also handles legacy URLs
// (/fonctionnalites, /tarifs, etc.) via 301s — those are kept out of the
// sitemap so crawlers only see the canonical addresses (English at the root,
// French under /fr — see src/lib/i18n/routes.ts).
const LOCALIZED_PATHS: Array<{ path: string; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }> = [
  { path: "",               changeFrequency: "weekly",  priority: 1.0 }, // home
  { path: "/pricing",       changeFrequency: "monthly", priority: 0.8 },
  { path: "/partners",      changeFrequency: "monthly", priority: 0.5 },
  { path: "/demo-request",  changeFrequency: "yearly",  priority: 0.4 },
  { path: "/legal",         changeFrequency: "yearly",  priority: 0.2 },
  { path: "/blog",          changeFrequency: "weekly",  priority: 0.7 },
  { path: "/capcut-alternative", changeFrequency: "monthly", priority: 0.8 },
  { path: "/metaghost-alternative", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs/api",      changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs",          changeFrequency: "monthly", priority: 0.7 },
  { path: "/docs/duplication-video", changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs/duplication-image", changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs/editeur-ia", changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs/scraper", changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs/comparateur", changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs/compresseur", changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs/variation-ia", changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs/retirer-detection-ia", changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs/createurs-et-roles", changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs/google-drive", changeFrequency: "monthly", priority: 0.6 },
  { path: "/login",         changeFrequency: "yearly",  priority: 0.4 },
  { path: "/register",      changeFrequency: "yearly",  priority: 0.5 },
  { path: "/legal/terms",   changeFrequency: "yearly",  priority: 0.3 },
  { path: "/legal/privacy", changeFrequency: "yearly",  priority: 0.3 },
];

// EN-only top-level pages (no FR version, no hreflang). The /fr route 301s to
// the root English URL, so only that one is listed here.
const EN_ONLY_PATHS: Array<{ path: string; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }> = [
  { path: "/submagic-alternative", changeFrequency: "monthly", priority: 0.8 },
];

// FR-only articles. EN URL serves a stub linking to FR, so we only list FR
// in the sitemap to keep the canonical signal clean.
const FR_ARTICLES: Array<{ slug: string; lastModified: string }> = [];

// Fully bilingual articles — both FR and EN indexed (each self-canonical, linked
// via hreflang). Slugs are the folder names; absoluteUrl() swaps in the
// translated English address (routes.ts).
const BILINGUAL_ARTICLES: Array<{ frSlug: string; enSlug: string; lastModified: string }> = [
  {
    frSlug: "agence-onlyfans-reels-instagram-plusieurs-comptes",
    enSlug: "agence-onlyfans-reels-instagram-plusieurs-comptes",
    lastModified: "2026-11-11",
  },
  {
    frSlug: "reposter-meme-video-plusieurs-comptes-tiktok-instagram",
    enSlug: "reposter-meme-video-plusieurs-comptes-tiktok-instagram",
    lastModified: "2026-08-01",
  },
  {
    frSlug: "creer-un-mois-de-reels-automatique-ia",
    enSlug: "creer-un-mois-de-reels-automatique-ia",
    lastModified: "2026-11-02",
  },
  {
    frSlug: "duupflow-pas-qu-un-simple-spoofer",
    enSlug: "duupflow-pas-qu-un-simple-spoofer",
    lastModified: "2026-11-02",
  },
  {
    frSlug: "editeur-video-ia",
    enSlug: "ai-video-editor",
    lastModified: "2026-08-06",
  },
  {
    frSlug: "tiktok-ineligible-recommandations",
    enSlug: "tiktok-ineligible-for-recommendation",
    lastModified: "2026-06-21",
  },
  {
    frSlug: "instagram-contenus-non-originaux",
    enSlug: "instagram-contenus-non-originaux",
    lastModified: "2026-05-23",
  },
  {
    frSlug: "automatiser-production-contenu-api-duupflow",
    enSlug: "automatiser-production-contenu-api-duupflow",
    lastModified: "2026-07-04",
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Adresses publiques uniquement : anglais à la racine, français sous /fr,
  // slugs traduits via routes.ts. Aucune adresse /en/… (redirigées en 301).
  const localizedEntries: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    LOCALIZED_PATHS.map(({ path, changeFrequency, priority }) => ({
      url: absoluteUrl(locale, path || "/"),
      lastModified: now,
      changeFrequency,
      priority,
    })),
  );

  const enOnlyEntries: MetadataRoute.Sitemap = EN_ONLY_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl("en", path),
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const articleEntries: MetadataRoute.Sitemap = FR_ARTICLES.map((a) => ({
    url: absoluteUrl("fr", `/blog/${a.slug}`),
    lastModified: new Date(a.lastModified),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const bilingualEntries: MetadataRoute.Sitemap = BILINGUAL_ARTICLES.flatMap((a) => [
    {
      url: absoluteUrl("fr", `/blog/${a.frSlug}`),
      lastModified: new Date(a.lastModified),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: absoluteUrl("en", `/blog/${a.enSlug}`),
      lastModified: new Date(a.lastModified),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
  ]);

  return [...localizedEntries, ...enOnlyEntries, ...articleEntries, ...bilingualEntries];
}
