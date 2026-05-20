// Locale-aware layout for the public + auth surface.
//
// Anything under /fr/* and /en/* is wrapped in a LanguageProvider seeded
// from the URL segment so server-rendered HTML matches the URL locale
// (no flash, correct <html lang>, SEO-friendly).
//
// /dashboard/*, /admin/*, /affiliate/*, /checkout/*, /api/* stay outside
// this segment — they keep the dashboard's storage-driven LanguageProvider
// (the outer one in ClientLayout) which respects the user's manual toggle.
import { notFound } from "next/navigation";
import { LanguageProvider, type Locale } from "@/lib/i18n/context";

const SUPPORTED_LOCALES: readonly Locale[] = ["fr", "en"] as const;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
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
