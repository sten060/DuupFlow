// Top-level route for the permanent "Submagic alternative" SEO page.
// English only (no hreflang): the /fr route redirects to the canonical /en URL.

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import SubmagicAlternativePage, { CANONICAL, META } from "@/components/marketing/SubmagicAlternativePage";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: META.title,
    description: META.description,
    // EN-only page → self-canonical, deliberately no `languages`/hreflang.
    alternates: { canonical: CANONICAL },
    openGraph: {
      title: META.title,
      description: META.description,
      url: `https://www.duupflow.com${CANONICAL}`,
      type: "website",
      locale: "en_US",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale === "fr") redirect(CANONICAL); // English-only page
  if (locale !== "en") notFound();
  return <SubmagicAlternativePage />;
}
