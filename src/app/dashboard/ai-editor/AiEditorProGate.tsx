"use client";

// Écran affiché aux users NON-Pro sur /dashboard/ai-editor (l'Éditeur IA est
// réservé au plan Pro, comme l'API). Bilingue via le namespace dashboard.aiEditor.
import { useTranslation } from "@/lib/i18n/context";

export default function AiEditorProGate() {
  const { t } = useTranslation();
  return (
    <main className="relative flex min-h-[70vh] items-center justify-center p-6">
      <div
        className="fixed left-56 right-0 top-0 h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(99,102,241,.10), transparent 70%)" }}
      />
      <div className="w-full max-w-lg rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-8 text-center">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/claude-color.svg" alt="Claude" className="h-8 w-8" />
        </span>
        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">
          {t("dashboard.aiEditor.gate.badge")}
        </div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--app-text)]">{t("dashboard.aiEditor.gate.title")}</h1>
        <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-[var(--app-text-muted)]">{t("dashboard.aiEditor.gate.desc")}</p>
        <a
          href="/dashboard/abonnement?upgrade=1"
          className="mt-6 inline-flex items-center rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_4px_20px_rgba(99,102,241,.35)]"
        >
          {t("dashboard.aiEditor.gate.cta")}
        </a>
      </div>
    </main>
  );
}
