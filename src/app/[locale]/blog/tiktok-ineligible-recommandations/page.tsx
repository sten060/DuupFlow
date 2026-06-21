// FR route for the TikTok "ineligible for recommendation" article.
// Canonical: /fr/blog/tiktok-ineligible-recommandations
// If reached under /en, redirect to the EN-slug version.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TikTokArticle, { CANONICAL, META, PUBLISHED_AT } from "../_components/TikTokArticle";

const OG_IMG = "https://www.duupflow.com/SEO-page/tiktok-ineligibility-notice.png";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: META.fr.title,
    description: META.fr.description,
    alternates: {
      canonical: CANONICAL.fr,
      languages: { "fr-FR": CANONICAL.fr, "en-US": CANONICAL.en, "x-default": CANONICAL.fr },
    },
    openGraph: {
      title: META.fr.title,
      description: META.fr.description,
      url: `https://www.duupflow.com${CANONICAL.fr}`,
      type: "article",
      locale: "fr_FR",
      publishedTime: PUBLISHED_AT,
      images: [OG_IMG],
    },
    twitter: {
      card: "summary_large_image",
      title: META.fr.title,
      description: META.fr.description,
      images: [OG_IMG],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale === "en") redirect(CANONICAL.en);
  return <TikTokArticle lang="fr" />;
}
