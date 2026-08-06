// EN route for the permanent AI Editor feature page.
// Canonical: /en/ai-video-editor — if reached under /fr, redirect to the FR slug.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AiEditorFeaturePage, { CANONICAL, META } from "@/components/marketing/AiEditorFeaturePage";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: META.en.title,
    description: META.en.description,
    alternates: {
      canonical: CANONICAL.en,
      languages: { "fr-FR": CANONICAL.fr, "en-US": CANONICAL.en, "x-default": CANONICAL.en },
    },
    openGraph: {
      title: META.en.title,
      description: META.en.description,
      url: `https://www.duupflow.com${CANONICAL.en}`,
      type: "website",
      locale: "en_US",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale === "fr") redirect(CANONICAL.fr);
  return <AiEditorFeaturePage lang="en" />;
}
