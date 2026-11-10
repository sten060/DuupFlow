// Metadata SEO d'une page publique : titre unique, canonical, hreflang
// (en-US → racine, fr-FR → /fr, x-default → racine) et Open Graph.
import type { Metadata } from "next";
import { absoluteUrl, alternatesFor, type Locale } from "./routes";

const OG_IMAGE = "/og-image-fr.png?v=3";

export type PageCopy = Record<Locale, { title: string; description: string }>;

export function pageMetadata(locale: Locale, path: string, copy: PageCopy): Metadata {
  const { title, description } = copy[locale];
  return {
    title,
    description,
    alternates: alternatesFor(locale, path),
    openGraph: {
      title,
      description,
      url: absoluteUrl(locale, path),
      siteName: "DuupFlow",
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "DuupFlow" }],
      locale: locale === "fr" ? "fr_FR" : "en_US",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}

export const asLocale = (l: string): Locale => (l === "fr" ? "fr" : "en");
