"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import en from "./en.json";
import fr from "./fr.json";

export type Locale = "en" | "fr";

const translations: Record<Locale, Record<string, unknown>> = { en, fr };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

// Cookie used by the middleware to remember the user's manual override of
// the geo-detected locale. Set when setLocale() is called.
const LANG_COOKIE = "duupflow_lang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function writeLangCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LANG_COOKIE}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

interface LanguageProviderProps {
  children: ReactNode;
  /**
   * When provided, the provider is in **URL-driven mode**: the locale is
   * locked to this value (typically passed from a [locale] route segment
   * server layout). Used on the landing + auth pages where the URL is the
   * source of truth.
   *
   * When omitted, the provider is in **storage-driven mode**: the locale
   * is read from localStorage and a toggle (LanguageSwitch) can change it.
   * Used inside /dashboard/* where the user picks the language manually.
   */
  initialLocale?: Locale;
}

export function LanguageProvider({ children, initialLocale }: LanguageProviderProps) {
  const urlDriven = initialLocale !== undefined;
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? "en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (urlDriven) {
      // URL is the source of truth — mirror to localStorage so the dashboard
      // (storage-driven) shows the same language after sign-in.
      //
      // IMPORTANT: we do NOT write the cookie here. The cookie is reserved
      // for an *explicit* user choice (LanguageSwitch toggle). If we wrote
      // it on every URL visit, a French visitor accidentally landing on /en
      // would get locked there forever — even if our geo-detect later starts
      // resolving to FR correctly.
      try {
        localStorage.setItem("duupflow_lang", initialLocale!);
      } catch {}
      document.documentElement.lang = initialLocale!;
      setMounted(true);
      return;
    }
    // Storage-driven mode (dashboard)
    const saved = localStorage.getItem("duupflow_lang") as Locale | null;
    if (saved === "fr" || saved === "en") {
      setLocaleState(saved);
      document.documentElement.lang = saved;
    }
    setMounted(true);
  }, [urlDriven, initialLocale]);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      try {
        localStorage.setItem("duupflow_lang", newLocale);
      } catch {}
      writeLangCookie(newLocale);
      if (typeof document !== "undefined") document.documentElement.lang = newLocale;
    },
    []
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let value = getNestedValue(translations[locale] as Record<string, unknown>, key);
      if (value === key) {
        // Fallback to English
        value = getNestedValue(translations.en as Record<string, unknown>, key);
      }
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          value = value.replace(`{${k}}`, String(v));
        });
      }
      return value;
    },
    [locale]
  );

  // In URL-driven mode the SSR/initial render is already correct → no flash.
  // In storage-driven mode we render with EN until mount to avoid hydration mismatch.
  const effectiveLocale: Locale = urlDriven ? locale : (mounted ? locale : "en");
  const effectiveT = (urlDriven || mounted)
    ? t
    : (key: string) => getNestedValue(translations.en as Record<string, unknown>, key);

  const contextValue: I18nContextType = {
    locale: effectiveLocale,
    setLocale,
    t: effectiveT,
  };

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within LanguageProvider");
  }
  return context;
}

export function useLocale(): Locale {
  const { locale } = useTranslation();
  return locale;
}
