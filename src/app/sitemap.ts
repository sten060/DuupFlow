import { MetadataRoute } from "next";

const BASE_URL = "https://www.duupflow.com";
const LOCALES = ["fr", "en"] as const;

// Localised public pages. The middleware also handles legacy URLs
// (/fonctionnalites, /tarifs, etc.) via 301s — those are kept out of the
// sitemap so crawlers only see the canonical /<locale>/<slug> versions.
const LOCALIZED_PATHS: Array<{ path: string; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }> = [
  { path: "",               changeFrequency: "weekly",  priority: 1.0 }, // home
  { path: "/features",      changeFrequency: "monthly", priority: 0.8 },
  { path: "/how-it-works",  changeFrequency: "monthly", priority: 0.7 },
  { path: "/pricing",       changeFrequency: "monthly", priority: 0.8 },
  { path: "/benefits",      changeFrequency: "monthly", priority: 0.6 },
  { path: "/partners",      changeFrequency: "monthly", priority: 0.5 },
  { path: "/demo",          changeFrequency: "monthly", priority: 0.5 },
  { path: "/blog",          changeFrequency: "weekly",  priority: 0.7 },
  { path: "/login",         changeFrequency: "yearly",  priority: 0.4 },
  { path: "/register",      changeFrequency: "yearly",  priority: 0.5 },
  { path: "/legal/terms",   changeFrequency: "yearly",  priority: 0.3 },
  { path: "/legal/privacy", changeFrequency: "yearly",  priority: 0.3 },
];

// FR-only articles. EN URL serves a stub linking to FR, so we only list FR
// in the sitemap to keep the canonical signal clean.
const FR_ARTICLES: Array<{ slug: string; lastModified: string }> = [
  { slug: "instagram-contenus-non-originaux", lastModified: "2026-05-23" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const localizedEntries: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    LOCALIZED_PATHS.map(({ path, changeFrequency, priority }) => ({
      url: `${BASE_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    })),
  );

  const articleEntries: MetadataRoute.Sitemap = FR_ARTICLES.map((a) => ({
    url: `${BASE_URL}/fr/blog/${a.slug}`,
    lastModified: new Date(a.lastModified),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...localizedEntries, ...articleEntries];
}
