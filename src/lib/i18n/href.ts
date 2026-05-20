"use client";

import type { Locale } from "./context";

/**
 * Build a locale-prefixed href for a public/auth page.
 *
 *   localizedHref("fr", "/features")  → "/fr/features"
 *   localizedHref("en", "/")          → "/en"
 *   localizedHref("fr", "/#faq")      → "/fr#faq"
 *
 * External URLs and dashboard/admin/affiliate paths are returned unchanged.
 * Hash-only fragments ("#features") are returned unchanged.
 */
const UNLOCALIZED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/affiliate",
  "/affiliate-login",
  "/checkout",
  "/api",
  "/auth",
  "/dev-login",
];

export function localizedHref(locale: Locale, path: string): string {
  // External link or mailto/tel → leave alone
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  if (!path.startsWith("/")) return path;

  // Routes that stay outside the locale prefix
  if (UNLOCALIZED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    return path;
  }

  // Already locale-prefixed? Replace the prefix to match current locale.
  const match = path.match(/^\/(fr|en)(\/.*|$)/);
  if (match) return `/${locale}${match[2] ?? ""}`;

  // Root "/" → "/{locale}"
  if (path === "/") return `/${locale}`;

  // Anchor on root (e.g. "/#faq") → "/{locale}#faq"
  if (path.startsWith("/#")) return `/${locale}${path.slice(1)}`;

  // Normal public path → prepend locale
  return `/${locale}${path}`;
}

/**
 * Hook-friendly version. Use inside a component:
 *
 *   const lh = useLocalizedHref();
 *   <Link href={lh("/features")}>…
 */
import { useTranslation } from "./context";
export function useLocalizedHref() {
  const { locale } = useTranslation();
  return (path: string) => localizedHref(locale, path);
}
