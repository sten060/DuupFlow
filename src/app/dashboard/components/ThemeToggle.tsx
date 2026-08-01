"use client";

// Toggle thème clair/sombre du dashboard. Écrit data-theme sur <html> et
// persiste dans localStorage. L'app lit les couleurs via var(--app-*), donc
// tout bascule d'un coup. Défaut : sombre.

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

export default function ThemeToggle({ full = false }: { full?: boolean }) {
  const { locale } = useTranslation();
  const en = locale === "en";
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const saved = (localStorage.getItem("duupflow_theme") as "dark" | "light" | null) ?? "light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("duupflow_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  const isDark = theme === "dark";
  const sun = (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
  const moon = (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

  if (full) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}
      >
        <span className="flex h-6 w-6 items-center justify-center">{isDark ? sun : moon}</span>
        {isDark ? (en ? "Light mode" : "Mode clair") : (en ? "Dark mode" : "Mode sombre")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? (en ? "Switch to light mode" : "Passer en mode clair") : (en ? "Switch to dark mode" : "Passer en mode sombre")}
      title={isDark ? (en ? "Light mode" : "Mode clair") : (en ? "Dark mode" : "Mode sombre")}
      className="flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-80"
      style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}
    >
      {isDark ? sun : moon}
    </button>
  );
}
