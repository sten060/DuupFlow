// Centre d'aide public — une page par fonctionnalité (/fr/docs/<slug-fr>, /docs/<slug-en>).
// Slug interne = slug FR ; l'adresse anglaise traduite vient de routes.ts. Contenu : helpCenterContent.ts.

import type { Metadata } from "next";
import { absoluteUrl, alternatesFor } from "@/lib/i18n/routes";
import { notFound } from "next/navigation";
import { HelpDocPage } from "@/components/marketing/HelpDocPage";
import { HELP_DOCS } from "@/components/marketing/helpCenterContent";
import type { Lang } from "@/components/marketing/apiDocsContent";

const asLang = (l: string): Lang | null => (l === "fr" || l === "en" ? l : null);

export function generateStaticParams() {
  return HELP_DOCS.flatMap((d) => [{ locale: "fr", slug: d.slug }, { locale: "en", slug: d.slug }]);
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const lang = asLang(locale) ?? "en";
  const doc = HELP_DOCS.find((d) => d.slug === slug);
  if (!doc) return {};
  const title = `${doc.title[lang]} — ${lang === "fr" ? "Centre d'aide DuupFlow" : "DuupFlow Help Center"}`;
  return {
    title,
    description: doc.summary[lang],
    alternates: alternatesFor(lang, `/docs/${slug}`),
    openGraph: { title, description: doc.summary[lang], url: absoluteUrl(lang, `/docs/${slug}`), type: "article" },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const lang = asLang(locale);
  const doc = HELP_DOCS.find((d) => d.slug === slug);
  if (!lang || !doc) notFound();

  // Données structurées FAQ : aident Google et les assistants IA à citer la page.
  const faqLd = doc.faq[lang].length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: doc.faq[lang].map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a.replace(/\*\*|`/g, "") } })),
      }
    : null;
  return (
    <>
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
      <HelpDocPage doc={doc} lang={lang} />
    </>
  );
}
