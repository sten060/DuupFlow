// Layout RACINE des pages publiques + auth (voir src/app/RootShell.tsx).
//
// Anglais à la racine (servi en interne depuis /en/* par le middleware),
// français sous /fr/*. Le segment [locale] donne <html lang> dès le HTML
// serveur, et seed le LanguageProvider (pas de flash, SEO correct).
//
// /dashboard/*, /admin/*, /affiliate/*, /checkout/* ont leur propre layout
// racine (lang="en") et le LanguageProvider storage-driven de ClientLayout.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RootShell, { appMetadata } from "@/app/RootShell";
import { LanguageProvider, type Locale } from "@/lib/i18n/context";
import { ogImageFor } from "@/lib/i18n/seo";
import { SITE_URL } from "@/lib/i18n/routes";

const SUPPORTED_LOCALES: readonly Locale[] = ["fr", "en"] as const;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// Valeurs par défaut (les pages qui définissent leurs propres metadata gagnent).
const COPY = {
  en: {
    title: "DuupFlow — Multiply your content by 100 effortlessly",
    description: "Duplicate your content, let AI create variants, and feed all your accounts in minutes.",
  },
  fr: {
    title: "DuupFlow — Multiplie ton contenu par 100 sans effort",
    description: "Duplique ton contenu, laisse l’IA créer des variantes, et alimente tous tes comptes en quelques minutes.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: Locale = locale === "fr" ? "fr" : "en";
  const { title, description } = COPY[lang];
  const image = ogImageFor(lang);
  return {
    metadataBase: appMetadata.metadataBase,
    title,
    description,
    openGraph: {
      title,
      description,
      url: lang === "fr" ? `${SITE_URL}/fr` : SITE_URL,
      siteName: "DuupFlow",
      images: [image],
      locale: lang === "fr" ? "fr_FR" : "en_US",
      type: "website",
    },
    // Sans titre ni description : X/Twitter reprend alors og:title / og:description
    // de chaque page, au lieu du titre de l'accueil.
    twitter: { card: "summary_large_image", images: [image.url] },
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
    <RootShell lang={locale as Locale}>
      <LanguageProvider initialLocale={locale as Locale}>
        {children}
      </LanguageProvider>
    </RootShell>
  );
}
