"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { isPublicPath, publicPath, stripLocale } from "@/lib/i18n/routes";

/**
 * Sélecteur de langue EN / FR.
 *
 * Sur les pages publiques (anglais à la racine, français sous /fr), on navigue
 * vers la même page dans l'autre langue — slugs traduits compris (routes.ts).
 * Le choix est mémorisé (cookie duupflow_lang via setLocale) : le middleware ne
 * redirige alors plus jamais l'accueil vers l'autre langue.
 *
 * Sur /dashboard/* (pas d'adresse localisée) → on bascule juste la langue.
 *
 * variant : "light" (nav claire), "onBlue" (footer bleu), "dark" (anciennes pages sombres).
 */
type Variant = "light" | "onBlue" | "dark";

const STYLES: Record<Variant, { wrap: string; active: string; idle: string }> = {
  light: {
    wrap: "ring-1 ring-black/10 bg-white",
    active: "bg-[#1a1a1a] text-white",
    idle: "text-[#605f5f] hover:text-[#1a1a1a]",
  },
  onBlue: {
    wrap: "ring-1 ring-white/25 bg-white/10",
    active: "bg-white text-[#1a53ec]",
    idle: "text-white/75 hover:text-white",
  },
  dark: {
    wrap: "ring-1 ring-white/15 bg-white/[0.05]",
    active: "bg-white/90 text-[#0B0F1A]",
    idle: "text-white/60 hover:text-white",
  },
};

export default function LanguageSwitch({
  variant = "dark",
  className = "",
  compactOnMobile = false,
}: {
  variant?: Variant;
  className?: string;
  /** Sous 640 px : un seul bouton (l'autre langue) pour tenir dans la nav. */
  compactOnMobile?: boolean;
}) {
  const { locale, setLocale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const s = STYLES[variant];

  function choose(next: "en" | "fr") {
    if (next === locale) return;
    setLocale(next);
    if (isPublicPath(stripLocale(pathname))) {
      router.push(publicPath(next, pathname) + window.location.search + window.location.hash);
    }
  }

  const other = locale === "en" ? "fr" : "en";

  return (
    <>
    {compactOnMobile && (
      <button
        type="button"
        onClick={() => choose(other)}
        lang={other}
        title={other === "en" ? "English" : "Français"}
        aria-label={other === "en" ? "Switch to English" : "Passer en français"}
        className={`inline-flex sm:hidden items-center rounded-full px-2.5 py-1.5 text-xs font-semibold select-none ${s.wrap} ${s.idle} ${className}`}
      >
        {other.toUpperCase()}
      </button>
    )}
    <div
      role="group"
      aria-label={locale === "fr" ? "Langue" : "Language"}
      className={`${compactOnMobile ? "hidden sm:inline-flex" : "inline-flex"} items-center gap-0.5 rounded-full p-0.5 text-xs font-semibold select-none ${s.wrap} ${className}`}
    >
      {(["en", "fr"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          lang={l}
          title={l === "en" ? "English" : "Français"}
          className={`rounded-full px-2.5 py-1 transition ${locale === l ? s.active : s.idle}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
    </>
  );
}
