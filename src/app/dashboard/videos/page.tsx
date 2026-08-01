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
    <main className="p-6 space-y-8">
      <Toasts ok={ok} err={err} warn={warn} />

      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("dashboard.videos.title")}</h1>
        <p className="text-sm text-[var(--app-text-muted)] mt-1">{t("dashboard.videos.subtitle")}</p>
      </header>

      <div className="h-px bg-[var(--app-border)]" />

      <section className="grid gap-4 md:grid-cols-2">
        {/* Mode Simple — indigo */}
        <Link
          href="/dashboard/videos/simple"
          data-tour-id="video-mode-simple"
          className="group relative rounded-2xl p-4 transition-all overflow-hidden
                     border border-indigo-500/20 hover:border-indigo-400/40
                     hover:shadow-[0_0_30px_rgba(99,102,241,.15)]"
          style={{ background: "rgba(99,102,241,0.04)" }}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
               style={{ background: "radial-gradient(600px at 30% 20%, rgba(99,102,241,.08), transparent 70%)" }} />
          <div className="relative flex items-start gap-3">
            <svg viewBox="0 0 24 24" className="h-5 w-5 mt-0.5 shrink-0 text-indigo-400" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            <div>
              <h2 className="text-base font-bold text-[var(--app-text)]">{t("dashboard.videos.simpleTitle")}</h2>
              <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                {t("dashboard.videos.simpleDesc")}
              </p>
              <div className="mt-2 inline-flex items-center gap-2 text-xs text-indigo-300 group-hover:gap-3 transition-all">
                <span>{t("dashboard.videos.simpleStart")}</span>
                <span>→</span>
              </div>
            </div>
          </div>
        </Link>

        {/* Mode Avancé — sky */}
        <Link
          href="/dashboard/videos/advanced"
          data-tour-id="video-mode-advanced"
          className="group relative rounded-2xl p-4 transition-all overflow-hidden
                     border border-sky-500/20 hover:border-sky-400/40
                     hover:shadow-[0_0_30px_rgba(56,189,248,.15)]"
          style={{ background: "rgba(56,189,248,0.04)" }}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
               style={{ background: "radial-gradient(600px at 30% 20%, rgba(56,189,248,.08), transparent 70%)" }} />
          <div className="relative flex items-start gap-3">
            <svg viewBox="0 0 24 24" className="h-5 w-5 mt-0.5 shrink-0 text-sky-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
            </svg>
            <div>
              <h2 className="text-base font-bold text-[var(--app-text)]">{t("dashboard.videos.advancedTitle")}</h2>
              <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                {t("dashboard.videos.advancedDesc")}
              </p>
              <div className="mt-2 inline-flex items-center gap-2 text-xs text-sky-300 group-hover:gap-3 transition-all">
                <span>{t("dashboard.videos.advancedStart")}</span>
                <span>→</span>
              </div>
            </div>
          </div>
        </Link>

        {/* Mode IA automatique — pleine largeur (= les deux du haut réunis), verrouillé */}
        <div
          aria-disabled="true"
          className="md:col-span-2 relative rounded-2xl p-4 overflow-hidden cursor-not-allowed
                     border border-fuchsia-500/20"
          style={{ background: "rgba(217,70,239,0.04)" }}
        >
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-fuchsia-500/45 bg-fuchsia-500/[0.14] px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-200">
            🔒 {t("dashboard.videos.aiSoon")}
          </span>
          <div className="relative flex items-start gap-3 opacity-70">
            <svg viewBox="0 0 24 24" className="h-5 w-5 mt-0.5 shrink-0 text-fuchsia-400" fill="currentColor">
              <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6 10l.9 2.5L21.5 15l-2.6.9L18 18.5l-.9-2.6L14.5 15l2.6-.5L18 12zM6 13l.8 2.2L9 16l-2.2.8L6 19l-.8-2.2L3 16l2.2-.8L6 13z" />
            </svg>
            <div>
              <h2 className="text-base font-bold text-[var(--app-text)]">{t("dashboard.videos.aiTitle")}</h2>
              <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                {t("dashboard.videos.aiDesc")}
              </p>
              <div className="mt-2 inline-flex items-center gap-2 text-xs text-fuchsia-300/70">
                <span>{t("dashboard.videos.aiSoon")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
