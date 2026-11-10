// FR route for the permanent AI Editor feature page.
// Canonical: /fr/editeur-video-ia — if reached under /en, redirect to the EN slug.

import type { Metadata } from "next";
import { ogImageFor } from "@/lib/i18n/seo";
import { redirect } from "next/navigation";
import AiEditorFeaturePage, { CANONICAL, META } from "@/components/marketing/AiEditorFeaturePage";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: META.fr.title,
    description: META.fr.description,
    alternates: {
      canonical: CANONICAL.fr,
      languages: { "en-US": CANONICAL.en, "fr-FR": CANONICAL.fr, "x-default": CANONICAL.en },
    },
    openGraph: {
      title: META.fr.title,
      description: META.fr.description,
      url: `https://www.duupflow.com${CANONICAL.fr}`,
      type: "website",
      images: [ogImageFor("fr")],
      locale: "fr_FR",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale === "en") redirect(CANONICAL.en);
  return <AiEditorFeaturePage lang="fr" />;
}
