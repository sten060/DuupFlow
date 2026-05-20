"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";

/**
 * Bilingual toggle.
 *
 * On the public/auth surface (pathname starts with /fr or /en) we rewrite
 * the URL to navigate to the same page in the other locale. The cookie is
 * also written via setLocale() so the middleware respects the override on
 * subsequent visits.
 *
 * On /dashboard/* there is no /fr|/en prefix → we only flip the locale
 * state (storage-driven LanguageProvider), no navigation.
 */
export default function LanguageSwitch() {
  const { locale, setLocale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  function handleToggle() {
    const next = locale === "en" ? "fr" : "en";
    setLocale(next);

    // If we're on a /fr/* or /en/* URL, swap the prefix and navigate.
    const match = pathname.match(/^\/(fr|en)(\/.*)?$/);
    if (match) {
      const rest = match[2] ?? "";
      router.push(`/${next}${rest}`);
    }
  }

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.10] text-xs font-medium text-white/70 hover:text-white transition select-none"
      aria-label="Switch language"
    >
      <span style={{ opacity: locale === "en" ? 1 : 0.4 }}>EN</span>
      <span className="text-white/25">|</span>
      <span style={{ opacity: locale === "fr" ? 1 : 0.4 }}>FR</span>
    </button>
  );
}
