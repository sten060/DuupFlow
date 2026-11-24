// Top-level route for the permanent "Submagic alternative" SEO page.
// One slug for both locales (/submagic-alternative, /fr/submagic-alternative);
// each locale is self-canonical and cross-linked via hreflang. (Until November
// 2026 the page was English-only and /fr redirected to it.)

import type { Metadata } from "next";
import { ogImageFor } from "@/lib/i18n/seo";
import { notFound } from "next/navigation";
import SubmagicAlternativePage, { CANONICAL, META, type Lang } from "@/components/marketing/SubmagicAlternativePage";

function asLang(locale: string): Lang | null {
  return locale === "fr" || locale === "en" ? locale : null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang = asLang(locale) ?? "en";
  return {
    title: META[lang].title,
    description: META[lang].description,
    alternates: {
      canonical: CANONICAL[lang],
      languages: { "en-US": CANONICAL.en, "fr-FR": CANONICAL.fr, "x-default": CANONICAL.en },
    },
    openGraph: {
      title: META[lang].title,
      description: META[lang].description,
      url: `https://www.duupflow.com${CANONICAL[lang]}`,
      type: "website",
      images: [ogImageFor(lang)],
      locale: lang === "fr" ? "fr_FR" : "en_US",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = asLang(locale);
  if (!lang) notFound();
  return <SubmagicAlternativePage lang={lang} />;
}
