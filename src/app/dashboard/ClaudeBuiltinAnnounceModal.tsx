"use client";

/**
 * Annonce « Claude intégré à l'Éditeur IA » — une seule fois par compte.
 *
 * Qui la voit : décidé côté serveur (layout) → comptes créés AVANT la mise en
 * ligne (CLAUDE_INTEGRE_DEPUIS) qui ne l'ont pas encore vue. Les nouveaux
 * inscrits la découvrent dans l'onboarding, pas besoin de l'annonce.
 *
 * « Vue » est enregistré à la FERMETURE (profiles.onboarding_progress), pas à
 * l'affichage : la server action déclenche un nouveau rendu du layout, qui
 * retirait le popup dans la seconde où il apparaissait. Une fois fermée, ni un
 * rechargement ni un autre appareil ne la remontre.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { markOnboardingSeen } from "./actions/onboarding";
import { ANNONCE_CLAUDE_INTEGRE } from "@/lib/launch";

export default function ClaudeBuiltinAnnounceModal() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(true);
  const [shown, setShown] = useState(false);
  const marked = useRef(false);

  useEffect(() => {
    // setTimeout plutôt que requestAnimationFrame : rAF est suspendu tant que
    // l'onglet est en arrière-plan → le popup restait monté mais invisible.
    const id = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(id);
  }, []);

  const close = () => {
    if (!marked.current) {
      marked.current = true;
      void markOnboardingSeen(ANNONCE_CLAUDE_INTEGRE).catch(() => {});
    }
    setShown(false);
    setTimeout(() => setMounted(false), 220);
  };

  if (!mounted) return null;

  const points = [
    { ic: "⚡️", t: t("dashboard.claudeBuiltin.p1t"), d: t("dashboard.claudeBuiltin.p1d") },
    { ic: "💬", t: t("dashboard.claudeBuiltin.p2t"), d: t("dashboard.claudeBuiltin.p2d") },
    { ic: "🎁", t: t("dashboard.claudeBuiltin.p3t"), d: t("dashboard.claudeBuiltin.p3d") },
  ];

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />

      <div
        className={`relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl transition-all duration-200 ${shown ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        {/* Halo de marque */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-60"
          style={{ background: "radial-gradient(640px 240px at 50% -40px, rgba(217,119,87,.20), transparent 70%)" }}
        />

        <button
          onClick={close}
          aria-label={t("dashboard.claudeBuiltin.later")}
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-lg leading-none text-[var(--app-text-muted)] transition hover:bg-[var(--app-bg-2)] hover:text-[var(--app-text)]"
        >
          ✕
        </button>

        <div className="relative px-6 pb-9 pt-10 sm:px-12">
          <div className="text-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(217,119,87,.14)", color: "#D97757" }}
            >
              ✨ {t("dashboard.claudeBuiltin.badge")}
            </span>

            <div className="mt-5 flex items-center justify-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/claude-color.svg" alt="Claude" className="h-9 w-9" />
              </span>
              <span className="text-3xl font-light text-[var(--app-text-faint)]">×</span>
              <span
                className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--app-bg-2)] shadow-md"
                style={{ border: "1px solid var(--app-border)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-mark.png" alt="DuupFlow" className="h-10 w-10 object-contain" />
              </span>
            </div>

            <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-[var(--app-text)] sm:text-[34px]">
              {t("dashboard.claudeBuiltin.title")}
            </h2>
            <p className="mx-auto mt-2.5 max-w-xl text-[15px] leading-relaxed text-[var(--app-text-muted)]">
              {t("dashboard.claudeBuiltin.lead")}
            </p>
          </div>

          {/* Aperçu du chat : montre ce que ça change, en une image */}
          <div className="mx-auto mt-7 max-w-xl rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-2)] p-4">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--app-surface)] px-4 py-2.5 text-[13.5px] text-[var(--app-text)] shadow-sm">
                {t("dashboard.claudeBuiltin.demoUser")}
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/claude-color.svg" alt="" className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-[13.5px] leading-relaxed text-[var(--app-text)]">
                {t("dashboard.claudeBuiltin.demoClaude")}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[1, 2, 3].map((n) => (
                    <span
                      key={n}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--app-text-muted)]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {t("dashboard.claudeBuiltin.demoVariant", { n })}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {points.map((p) => (
              <div key={p.t} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-2)] px-4 py-4">
                <span className="text-2xl">{p.ic}</span>
                <div className="mt-2 text-[14px] font-bold text-[var(--app-text)]">{p.t}</div>
                <div className="mt-1 text-[12.5px] leading-snug text-[var(--app-text-faint)]">{p.d}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
            <Link
              href="/dashboard/ai-editor"
              onClick={close}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: "#D97757", boxShadow: "0 6px 24px rgba(217,119,87,.35)" }}
            >
              {t("dashboard.claudeBuiltin.cta")}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
            </Link>
            <button
              onClick={close}
              className="text-[13px] font-medium text-[var(--app-text-faint)] transition hover:text-[var(--app-text-muted)]"
            >
              {t("dashboard.claudeBuiltin.later")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
