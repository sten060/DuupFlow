// Metadata SEO d'une page publique : titre unique, canonical, hreflang
// (en-US → racine, fr-FR → /fr, x-default → racine) et Open Graph.
import type { Metadata } from "next";
import { absoluteUrl, alternatesFor, type Locale } from "./routes";

// Image d'aperçu (réseaux sociaux, messageries, IA) : capture de l'accueil
// dans la langue de la page. Changer ?v= force les plateformes à la recharger.
const OG_IMAGES = { en: "/og-image-en.png?v=1", fr: "/og-image-fr.png?v=3" } as const;

export function ogImageFor(locale: Locale) {
  return { url: OG_IMAGES[locale], width: 1200, height: 630, alt: "DuupFlow" };
}

export type PageCopy = Record<Locale, { title: string; description: string }>;

export function pageMetadata(locale: Locale, path: string, copy: PageCopy): Metadata {
  const { title, description } = copy[locale];
  const image = ogImageFor(locale);
  return {
    title,
    description,
    alternates: alternatesFor(locale, path),
    openGraph: {
      title,
      description,
      url: absoluteUrl(locale, path),
      siteName: "DuupFlow",
      images: [image],
      locale: locale === "fr" ? "fr_FR" : "en_US",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export const asLocale = (l: string): Locale => (l === "fr" ? "fr" : "en");
