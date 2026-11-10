// Centre d'aide public — index (/fr/docs, /docs). Une carte par fonctionnalité.
// Pensé pour les utilisateurs ET les assistants IA (cf. /llms.txt).

import type { Metadata } from "next";
import { ogImageFor } from "@/lib/i18n/seo";
import { absoluteUrl, alternatesFor } from "@/lib/i18n/routes";
import { notFound } from "next/navigation";
import { HelpIndexPage } from "@/components/marketing/HelpDocPage";
import { HELP_UI } from "@/components/marketing/helpCenterContent";
import type { Lang } from "@/components/marketing/apiDocsContent";

const asLang = (l: string): Lang | null => (l === "fr" || l === "en" ? l : null);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang = asLang(locale) ?? "en";
  const ui = HELP_UI[lang];
  return {
    title: ui.metaTitle,
    description: ui.lead,
    alternates: alternatesFor(lang, "/docs"),
    openGraph: { title: ui.metaTitle, description: ui.lead, url: absoluteUrl(lang, "/docs"), type: "website", images: [ogImageFor(lang)] },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = asLang(locale);
  if (!lang) notFound();
  return <HelpIndexPage lang={lang} />;
}
