// Top-level route for the permanent "CapCut alternative" SEO page.
// One slug for both locales (/fr/capcut-alternative, /en/capcut-alternative);
// each locale is self-canonical and cross-linked via hreflang.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CapcutAlternativePage, { CANONICAL, META, type Lang } from "@/components/marketing/CapcutAlternativePage";

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
      languages: { "fr-FR": CANONICAL.fr, "en-US": CANONICAL.en, "x-default": CANONICAL.en },
    },
    openGraph: {
      title: META[lang].title,
      description: META[lang].description,
      url: `https://www.duupflow.com${CANONICAL[lang]}`,
      type: "website",
      locale: lang === "fr" ? "fr_FR" : "en_US",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = asLang(locale);
  if (!lang) notFound();
  return <CapcutAlternativePage lang={lang} />;
}
