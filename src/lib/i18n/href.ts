"use client";

import type { Locale } from "./context";

import { publicPath } from "./routes";

/**
 * Build the public href of a page in the given locale.
 * English lives at the root, French under /fr; translated slugs come from
 * routes.ts.
 *
 *   localizedHref("fr", "/pricing")         → "/fr/pricing"
 *   localizedHref("en", "/pricing")         → "/pricing"
 *   localizedHref("en", "/docs/editeur-ia") → "/docs/ai-editor"
 *   localizedHref("en", "/#faq")            → "/#faq"
 *   localizedHref("fr", "/#faq")            → "/fr#faq"
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

  // Split off ?query and #hash, localize the pathname only
  const m = path.match(/^([^?#]*)(.*)$/);
  const pathname = m?.[1] || "/";
  const suffix = m?.[2] ?? "";
  const localized = publicPath(locale, pathname);
  // "/#faq" en anglais reste "/#faq" ; en français "/fr#faq"
  return `${localized}${suffix}`;
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
