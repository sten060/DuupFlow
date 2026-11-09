// Locale-aware layout for the public + auth surface.
//
// Anything under /fr/* and /en/* is wrapped in a LanguageProvider seeded
// from the URL segment so server-rendered HTML matches the URL locale
// (no flash, correct <html lang>, SEO-friendly).
//
// /dashboard/*, /admin/*, /affiliate/*, /checkout/*, /api/* stay outside
// this segment — they keep the dashboard's storage-driven LanguageProvider
// (the outer one in ClientLayout) which respects the user's manual toggle.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LanguageProvider, type Locale } from "@/lib/i18n/context";

const SUPPORTED_LOCALES: readonly Locale[] = ["fr", "en"] as const;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// Titre / description de la LP en anglais. Le FR vient du layout racine ; les
// pages qui définissent leurs propres metadata (blog, docs, pricing…) gagnent.
const EN_TITLE = "DuupFlow — Multiply your content by 100 effortlessly";
const EN_DESC = "Duplicate your content, let AI create variants, and feed all your accounts in minutes.";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "en") return {};
  return {
    title: EN_TITLE,
    description: EN_DESC,
    openGraph: {
      title: EN_TITLE,
      description: EN_DESC,
      url: "https://www.duupflow.com/en",
      siteName: "DuupFlow",
      images: [{ url: "/og-image-fr.png?v=3", width: 1200, height: 630, alt: "DuupFlow" }],
      locale: "en_US",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: EN_TITLE, description: EN_DESC, images: ["/og-image-fr.png?v=3"] },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as Locale)) {
    notFound();
  }
  return (
    <LanguageProvider initialLocale={locale as Locale}>
      {children}
    </LanguageProvider>
  );
}
