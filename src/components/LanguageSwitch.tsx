"use client";

import { useTranslation } from "@/lib/i18n/context";

export default function LanguageSwitch() {
  const { locale, setLocale } = useTranslation();

  return (
    <button
      onClick={() => setLocale(locale === "en" ? "fr" : "en")}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.10] text-xs font-medium text-white/70 hover:text-white transition select-none"
      aria-label="Switch language"
    >
      <span style={{ opacity: locale === "en" ? 1 : 0.4 }}>EN</span>
      <span className="text-white/25">|</span>
      <span style={{ opacity: locale === "fr" ? 1 : 0.4 }}>FR</span>
    </button>
  );
}
