// Documentation PUBLIQUE de l'API — /fr/docs/api et /en/docs/api.
// Pensée pour les développeurs ET les assistants IA qui répondent aux questions
// des prospects (cf. aussi /llms.txt).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ApiDocsPage from "@/components/marketing/ApiDocsPage";
import { CANONICAL, META, type Lang } from "@/components/marketing/apiDocsContent";

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
  return <ApiDocsPage lang={lang} />;
}
