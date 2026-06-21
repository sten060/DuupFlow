// EN route for the TikTok "ineligible for recommendation" article.
// Canonical: /en/blog/tiktok-ineligible-for-recommendation
// If reached under /fr, redirect to the FR-slug version.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TikTokArticle, { CANONICAL, META, PUBLISHED_AT } from "../_components/TikTokArticle";

const OG_IMG = "https://www.duupflow.com/SEO-page/tiktok-ineligibility-notice.png";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: META.en.title,
    description: META.en.description,
    alternates: {
      canonical: CANONICAL.en,
      languages: { "fr-FR": CANONICAL.fr, "en-US": CANONICAL.en, "x-default": CANONICAL.fr },
    },
    openGraph: {
      title: META.en.title,
      description: META.en.description,
      url: `https://www.duupflow.com${CANONICAL.en}`,
      type: "article",
      locale: "en_US",
      publishedTime: PUBLISHED_AT,
      images: [OG_IMG],
    },
    twitter: {
      card: "summary_large_image",
      title: META.en.title,
      description: META.en.description,
      images: [OG_IMG],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale === "fr") redirect(CANONICAL.fr);
  return <TikTokArticle lang="en" />;
}
