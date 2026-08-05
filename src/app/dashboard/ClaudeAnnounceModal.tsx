"use client";

// Modal d'annonce « Claude × DuupFlow » — s'affiche UNE FOIS par user (localStorage)
// à la connexion à l'outil. Présente l'Éditeur IA de façon très visuelle. Bilingue
// (dashboard.claudeAnnounce). Bumper ANNOUNCE_KEY pour ré-afficher lors d'une maj.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

const ANNOUNCE_KEY = "duupflow_claude_announce_v1";

export default function ClaudeAnnounceModal() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false); // dans le DOM
  const [shown, setShown] = useState(false);     // animé à l'écran

  useEffect(() => {
    try { if (localStorage.getItem(ANNOUNCE_KEY)) return; } catch { /* pas de storage → on affiche */ }
    setMounted(true);
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    try { localStorage.setItem(ANNOUNCE_KEY, "1"); } catch { /* noop */ }
    setShown(false);
    setTimeout(() => setMounted(false), 220);
  };

  if (!mounted) return null;

  const steps = [
    { ic: "🎬", t: t("dashboard.claudeAnnounce.s1t"), d: t("dashboard.claudeAnnounce.s1d") },
    { ic: "📁", t: t("dashboard.claudeAnnounce.s2t"), d: t("dashboard.claudeAnnounce.s2d") },
    { ic: "✨", t: t("dashboard.claudeAnnounce.s3t"), d: t("dashboard.claudeAnnounce.s3d") },
  ];

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} onClick={close} />

      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl transition-all duration-200 ${shown ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        {/* Halo de marque en fond */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-52" style={{ background: "radial-gradient(600px 220px at 50% -40px, rgba(217,119,87,.18), transparent 70%)" }} />

        <button onClick={close} aria-label={t("dashboard.claudeAnnounce.later")} className="absolute right-4 top-4 z-10 text-xl leading-none text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]">✕</button>

        <div className="relative px-8 pt-9 pb-8 text-center">
          {/* Co-branding : logos + « Claude × DuupFlow » */}
          <div className="mb-4 flex items-center justify-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/claude-color.svg" alt="Claude" className="h-9 w-9" />
            </span>
            <span className="text-3xl font-light text-[var(--app-text-faint)]">×</span>
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--app-bg-2)] shadow-md" style={{ border: "1px solid var(--app-border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.png" alt="DuupFlow" className="h-10 w-10 object-contain" />
            </span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-[var(--app-text)] sm:text-4xl">
            Claude <span style={{ color: "#D97757" }}>×</span> <span className="dash-flow">DuupFlow</span>
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] font-semibold text-[var(--app-text)]">{t("dashboard.claudeAnnounce.lead")}</p>
          <p className="mx-auto mt-1.5 max-w-lg text-[13.5px] leading-relaxed text-[var(--app-text-muted)]">{t("dashboard.claudeAnnounce.sub")}</p>

          {/* Flow visuel en 3 étapes */}
          <div className="mt-7 flex items-stretch justify-center gap-2 sm:gap-3">
            {steps.map((s, i) => (
              <div key={i} className="flex items-stretch gap-2 sm:gap-3">
                <div className="flex w-[132px] flex-col items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2.5 py-4 sm:w-[150px]">
                  <span className="text-3xl">{s.ic}</span>
                  <span className="mt-2 text-[13px] font-bold text-[var(--app-text)]">{s.t}</span>
                  <span className="mt-1 text-[11.5px] leading-snug text-[var(--app-text-faint)]">{s.d}</span>
                </div>
                {i < steps.length - 1 && (
                  <span className="flex items-center text-[var(--app-text-faint)]">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard/ai-editor"
              onClick={close}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_4px_20px_rgba(99,102,241,.35)]"
            >
              {t("dashboard.claudeAnnounce.cta")}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
            </Link>
            <button onClick={close} className="text-[13px] font-medium text-[var(--app-text-faint)] transition hover:text-[var(--app-text-muted)]">{t("dashboard.claudeAnnounce.later")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
