// FR route for the permanent AI Editor feature page.
// Canonical: /fr/editeur-video-ia — if reached under /en, redirect to the EN slug.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AiEditorFeaturePage, { CANONICAL, META } from "@/components/marketing/AiEditorFeaturePage";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: META.fr.title,
    description: META.fr.description,
    alternates: {
      canonical: CANONICAL.fr,
      languages: { "fr-FR": CANONICAL.fr, "en-US": CANONICAL.en, "x-default": CANONICAL.en },
    },
    openGraph: {
      title: META.fr.title,
      description: META.fr.description,
      url: `https://www.duupflow.com${CANONICAL.fr}`,
      type: "website",
      locale: "fr_FR",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale === "en") redirect(CANONICAL.en);
  return <AiEditorFeaturePage lang="fr" />;
}
