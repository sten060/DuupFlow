// Centre d'aide public — index (/fr/docs, /docs). Une carte par fonctionnalité.
// Pensé pour les utilisateurs ET les assistants IA (cf. /llms.txt).

import type { Metadata } from "next";
import { ogImageFor } from "@/lib/i18n/seo";
import { absoluteUrl, alternatesFor } from "@/lib/i18n/routes";
import { notFound } from "next/navigation";
import { HelpIndexPage } from "@/components/marketing/HelpDocPage";
import { HELP_DOCS, HELP_UI } from "@/components/marketing/helpCenterContent";
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
  const ui = HELP_UI[lang];
  const plain = (t: string) => t.replace(/\*\*|`/g, "");
  // Données structurées : ce qu'est DuupFlow (application, prix) + la liste
  // des pages d'aide. Aident Google et les assistants IA à décrire le produit.
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "DuupFlow",
      url: absoluteUrl(lang, "/"),
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      description: plain(ui.about),
      offers: [
        { "@type": "Offer", name: "Solo", price: "39", priceCurrency: "EUR" },
        { "@type": "Offer", name: "Pro", price: "99", priceCurrency: "EUR" },
        { "@type": "Offer", name: "Agency", price: "249", priceCurrency: "EUR" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: ui.title,
      description: ui.lead,
      url: absoluteUrl(lang, "/docs"),
      inLanguage: lang,
      hasPart: HELP_DOCS.map((d) => ({ "@type": "TechArticle", headline: d.title[lang], description: d.summary[lang], url: absoluteUrl(lang, `/docs/${d.slug}`) })),
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <HelpIndexPage lang={lang} />
    </>
  );
}
