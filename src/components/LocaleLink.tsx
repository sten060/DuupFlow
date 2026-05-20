"use client";

// Drop-in replacement for next/link's <Link>. When `href` is a plain string
// like "/features" or "/register", it's rewritten to "/{currentLocale}/features"
// using the locale of the surrounding LanguageProvider.
//
// Dashboard/admin/affiliate/checkout paths and external URLs pass through
// unchanged. See localizedHref() for the rules.
//
// Usage:
//   import Link from "@/components/LocaleLink";
//   <Link href="/register">Sign up</Link>

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocalizedHref } from "@/lib/i18n/href";

type Props = ComponentProps<typeof NextLink>;

export default function LocaleLink({ href, ...rest }: Props) {
  const lh = useLocalizedHref();
  const resolved = typeof href === "string" ? lh(href) : href;
  return <NextLink href={resolved} {...rest} />;
}
