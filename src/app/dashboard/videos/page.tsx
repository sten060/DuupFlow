"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Toasts from "../Toasts";
import { useTranslation } from "@/lib/i18n/context";

export default function VideosHub() {
  const searchParams = useSearchParams();
  const ok = Boolean(searchParams?.get("ok"));
  const err = searchParams?.get("err") ? decodeURIComponent(searchParams.get("err")!) : undefined;
  const warn = searchParams?.get("warn") ? decodeURIComponent(searchParams.get("warn")!) : undefined;
  const { t } = useTranslation();

  return (
    <main className="flex h-full flex-col">
      <Toasts ok={ok} err={err} warn={warn} />

      <header className="px-6 pt-6 pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("dashboard.videos.title")}</h1>
        <p className="text-sm text-[var(--app-text-muted)] mt-1">{t("dashboard.videos.subtitle")}</p>
      </header>

      {/* Cartes plein écran, collées, sans arrondi — couleurs conservées */}
      <section className="grid flex-1 grid-cols-1 grid-rows-3 md:grid-cols-2 md:grid-rows-2">
        {/* Mode Simple — indigo */}
        <Link
          href="/dashboard/videos/simple"
          data-tour-id="video-mode-simple"
          className="group relative flex flex-col justify-center overflow-hidden p-8 sm:p-10 transition-all
                     border border-indigo-500/20 hover:border-indigo-400/40"
          style={{ background: "rgba(99,102,241,0.05)" }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
               style={{ background: "radial-gradient(700px at 30% 30%, rgba(99,102,241,.10), transparent 70%)" }} />
          <div className="relative max-w-md">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl text-indigo-400"
                  style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.22)" }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-tight text-[var(--app-text)]">{t("dashboard.videos.simpleTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">
              {t("dashboard.videos.simpleDesc")}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-300 group-hover:gap-3 transition-all">
              <span>{t("dashboard.videos.simpleStart")}</span>
              <span aria-hidden>→</span>
            </div>
          </div>
        </Link>

        {/* Mode Avancé — sky */}
        <Link
          href="/dashboard/videos/advanced"
          data-tour-id="video-mode-advanced"
          className="group relative flex flex-col justify-center overflow-hidden p-8 sm:p-10 transition-all
                     border border-sky-500/20 hover:border-sky-400/40"
          style={{ background: "rgba(56,189,248,0.05)" }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
               style={{ background: "radial-gradient(700px at 30% 30%, rgba(56,189,248,.10), transparent 70%)" }} />
          <div className="relative max-w-md">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl text-sky-400"
                  style={{ background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.22)" }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
              </svg>
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-tight text-[var(--app-text)]">{t("dashboard.videos.advancedTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">
              {t("dashboard.videos.advancedDesc")}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 group-hover:gap-3 transition-all">
              <span>{t("dashboard.videos.advancedStart")}</span>
              <span aria-hidden>→</span>
            </div>
          </div>
        </Link>

        {/* IA automatique — pleine largeur, verrouillé — fuchsia */}
        <div
          aria-disabled="true"
          className="md:col-span-2 relative flex flex-col justify-center overflow-hidden p-8 sm:p-10 cursor-not-allowed
                     border border-fuchsia-500/20"
          style={{ background: "rgba(217,70,239,0.05)" }}
        >
          <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full border border-fuchsia-500/45 bg-fuchsia-500/[0.14] px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-200">
            🔒 {t("dashboard.videos.aiSoon")}
          </span>
          <div className="relative max-w-xl opacity-80">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl text-fuchsia-400"
                  style={{ background: "rgba(217,70,239,0.10)", border: "1px solid rgba(217,70,239,0.22)" }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6 10l.9 2.5L21.5 15l-2.6.9L18 18.5l-.9-2.6L14.5 15l2.6-.5L18 12zM6 13l.8 2.2L9 16l-2.2.8L6 19l-.8-2.2L3 16l2.2-.8L6 13z" />
              </svg>
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-tight text-[var(--app-text)]">{t("dashboard.videos.aiTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">
              {t("dashboard.videos.aiDesc")}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-300/70">
              <span>{t("dashboard.videos.aiSoon")}</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
