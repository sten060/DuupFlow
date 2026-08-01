"use client";

import { useTranslation } from "@/lib/i18n/context";

// Curated list — value is the ISO 3166-1 alpha-2 code, consumed by
// src/lib/locations.ts to map to a city catalog with realistic GPS coords.
// Keep this list in sync with COUNTRIES in src/lib/locations.ts.
const COUNTRIES: { code: string; fr: string; en: string }[] = [
  { code: "FR", fr: "France",         en: "France" },
  { code: "US", fr: "États-Unis",     en: "United States" },
  { code: "GB", fr: "Royaume-Uni",    en: "United Kingdom" },
  { code: "ES", fr: "Espagne",        en: "Spain" },
  { code: "IT", fr: "Italie",         en: "Italy" },
  { code: "DE", fr: "Allemagne",      en: "Germany" },
  { code: "CH", fr: "Suisse",         en: "Switzerland" },
  { code: "BE", fr: "Belgique",       en: "Belgium" },
  { code: "CA", fr: "Canada",         en: "Canada" },
];

type Props = {
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
};

const DEFAULT_CLASS =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)]";

export default function CountrySelect({ name, value, defaultValue, onChange, className }: Props) {
  const { locale, t } = useTranslation();

  const sorted = [...COUNTRIES].sort((a, b) => {
    const al = locale === "fr" ? a.fr : a.en;
    const bl = locale === "fr" ? b.fr : b.en;
    return al.localeCompare(bl, locale);
  });

  const isControlled = value !== undefined;

  return (
    <select
      name={name}
      value={isControlled ? value : undefined}
      defaultValue={isControlled ? undefined : defaultValue ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      className={className ?? DEFAULT_CLASS}
    >
      <option value="">{t("common.countryNone")}</option>
      {sorted.map((c) => (
        <option key={c.code} value={c.code}>
          {locale === "fr" ? c.fr : c.en}
        </option>
      ))}
    </select>
  );
}
