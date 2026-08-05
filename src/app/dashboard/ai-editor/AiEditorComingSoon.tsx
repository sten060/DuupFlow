"use client";

// Écran « BIENTÔT DISPONIBLE » qui BLOQUE l'accès à l'Éditeur IA tant que la feature
// n'est pas ouverte. Teaser vendeur + logo Claude. Bilingue (dashboard.aiEditor.comingSoon).
// Contrôlé par le flag serveur AI_EDITOR_LIVE (cf. page.tsx) → tu peux prévisualiser en
// posant le flag ; le public voit cet écran.
import { useTranslation } from "@/lib/i18n/context";

export default function AiEditorComingSoon() {
  const { t } = useTranslation();
  const bullets = [
    t("dashboard.aiEditor.comingSoon.f1"),
    t("dashboard.aiEditor.comingSoon.f2"),
    t("dashboard.aiEditor.comingSoon.f3"),
  ];
  return (
    <main className="relative flex min-h-[80vh] items-center justify-center p-6">
      <div
        className="pointer-events-none fixed left-56 right-0 top-0 h-[520px]"
        style={{ background: "radial-gradient(820px 420px at 50% -120px, rgba(217,119,87,.14), transparent 70%)" }}
      />
      <div className="w-full max-w-xl rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-9 text-center shadow-xl">
        <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/claude-color.svg" alt="Claude" className="h-9 w-9" />
        </span>

        <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "#D97757", background: "rgba(217,119,87,.12)", border: "1px solid rgba(217,119,87,.30)" }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: "#D97757" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#D97757" }} />
          </span>
          {t("dashboard.aiEditor.comingSoon.badge")}
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--app-text)]">{t("dashboard.aiEditor.comingSoon.title")}</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] font-semibold text-[var(--app-text)]">{t("dashboard.aiEditor.comingSoon.lead")}</p>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-[var(--app-text-muted)]">{t("dashboard.aiEditor.comingSoon.body")}</p>

        <ul className="mx-auto mt-6 max-w-md space-y-2.5 text-left">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-[var(--app-text-muted)]">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex items-center justify-center gap-2 text-[12px] font-medium text-[var(--app-text-faint)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/claude-color.svg" alt="" className="h-4 w-4" />
          {t("dashboard.aiEditor.comingSoon.driven")}
        </div>
      </div>
    </main>
  );
}
