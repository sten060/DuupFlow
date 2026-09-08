"use client";

/**
 * Carte de démarrage — s'affiche une fois, sur l'accueil du dashboard.
 *
 * ⚠️ Elle listait les SEPT modules et se fermait sur « J'ai compris ». Un
 * catalogue : le user savait ce qui existait, et repartait sans rien avoir
 * produit. On sort d'un onboarding qui EXPLIQUE pour un onboarding qui AMÈNE
 * quelque part.
 *
 * Deux chemins seulement, ceux qui font la valeur du produit :
 *   · dupliquer un contenu ;
 *   · reproduire une vidéo qui a marché (Éditeur IA).
 * Les autres modules restent accessibles derrière « Voir les autres modules »,
 * replié par défaut — leur coach les explique quand on les ouvre vraiment.
 *
 * Rien n'est forcé : la carte se ferme d'un clic n'importe où, et l'aide reste
 * à portée (le chat, rappelé en pied de carte).
 *
 * Shows when: enabled, on /dashboard, overview not yet seen — or forced via
 * the "Revoir la visite" menu. Closing it marks "overview" seen (unless forced).
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { ONBOARDING_MODULES } from "./modules";
import { useOnboarding } from "./OnboardingProvider";

export default function AppOverview() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { enabled, isSeen, markSeen, forcedOverview, clearForcedOverview, lancerParcours } = useOnboarding();
  // Sortie en glissé : la fenêtre part sur le côté, le user reste sur
  // l'accueil, et le parcours prend le relais là où il se trouve déjà.
  const [sort, setSort] = useState(false);
  // Liste des modules secondaires : repliée tant qu'on ne la demande pas.
  const [voirModules, setVoirModules] = useState(false);
  // Crédits d'essai, s'il y en a. 0 = on n'en parle pas.
  const [credits, setCredits] = useState<{ restants: number; total: number } | null>(null);

  const autoShow = enabled && pathname === "/dashboard" && !isSeen("overview");
  const open = autoShow || forcedOverview;

  // Drives the entrance transition (fade + lift). Reset whenever we reopen.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let annule = false;
    fetch("/api/trial-credits")
      .then((r) => r.json())
      .then((d) => { if (!annule && typeof d?.restants === "number") setCredits(d); })
      .catch(() => { /* pas de crédits affichés, la carte marche sans */ });
    return () => { annule = true; };
  }, [open]);

  if (!open) return null;

  function close() {
    if (forcedOverview) clearForcedOverview();
    else markSeen("overview");
  }

  /** Choix d'un parcours : la fenêtre glisse hors écran, puis le guide démarre.
   *  On ne navigue PAS — le premier repère du parcours est dans la barre
   *  latérale de l'accueil, c'est au user de faire le geste. */
  function choisir(cle: "dup" | "ai") {
    setSort(true);
    window.setTimeout(() => { close(); lancerParcours(cle); }, 380);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(5,8,22,0.66)", backdropFilter: "blur(6px)" }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-3xl overflow-hidden"
        style={{
          background: "var(--app-surface)",
          border: "1px solid rgba(99,102,241,0.28)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.6), 0 0 70px rgba(99,102,241,0.12)",
          opacity: sort ? 0 : shown ? 1 : 0,
          transform: sort
            ? "translateX(120%) scale(0.96)"
            : shown ? "translateY(0) scale(1)" : "translateY(10px) scale(0.985)",
          transition: sort
            ? "opacity .35s ease, transform .38s cubic-bezier(.4,0,.9,.3)"
            : "opacity .4s ease, transform .4s cubic-bezier(.16,1,.3,1)",
        }}
      >
        {/* Glow header */}
        <div className="relative px-8 pt-9 pb-6 text-center">
          <button
            onClick={close}
            aria-label={t("onb.skip")}
            className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg text-[var(--app-text-faint)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-32"
            style={{ background: "radial-gradient(420px at 50% -10%, rgba(99,102,241,0.22), transparent 70%)" }}
          />
          {/* Hiérarchie inversée : le titre de bienvenue passe en second, la
              QUESTION devient l'élément principal — c'est elle qui appelle une
              action, pas le mot « bienvenue ». */}
          <h2 className="relative text-[15px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-faint)]">
            {t("onb.overview.title")}
          </h2>
          <p className="relative mx-auto mt-2.5 max-w-xl text-[26px] font-bold leading-tight tracking-tight text-[var(--app-text)]">
            {t("onb.overview.subtitle")}
          </p>
        </div>

        {/* Les deux chemins qui produisent quelque chose. Tout le reste de la
            carte est secondaire — d'où la taille et le contraste. */}
        <div className="grid gap-3 px-6 sm:grid-cols-2">
          {[
            { cle: "dup", href: "/dashboard/videos", accent: "linear-gradient(135deg,#6366F1,#38BDF8)", icone: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="8" width="13" height="13" rx="2.5" /><path d="M4 16V5a1 1 0 0 1 1-1h11" />
              </svg>
            ) },
            { cle: "ai", href: "/dashboard/ai-editor", accent: "linear-gradient(135deg,#D97757,#6366F1)", icone: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
              </svg>
            ) },
          ].map((c, i) => (
            <button
              key={c.cle}
              onClick={() => choisir(c.cle as "dup" | "ai")}
              // duup-glass : dégradé, liseré clair sur l'arête haute et double
              // ombre — la même matière que les zones de dépôt de l'Éditeur IA.
              className="duup-glass group relative flex h-full w-full flex-col items-start gap-3 overflow-hidden rounded-2xl px-5 py-5 text-left"
              style={{
                opacity: shown ? 1 : 0,
                transform: shown ? "translateY(0)" : "translateY(6px)",
                transitionDelay: `${120 + i * 80}ms`,
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-70 blur-3xl transition group-hover:opacity-100"
                style={{ background: `radial-gradient(circle, ${c.cle === "dup" ? "rgba(99,102,241,0.32)" : "rgba(217,119,87,0.28)"}, transparent 70%)` }}
              />
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: c.accent, boxShadow: "0 10px 20px -12px rgba(79,70,229,0.8)" }}>
                {c.icone}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-[var(--app-text)]">{t(`onb.start.${c.cle}Title`)}</span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-[var(--app-text-faint)]">{t(`onb.start.${c.cle}Desc`)}</span>
              </span>
              <span className="relative inline-flex items-center gap-1 text-[12.5px] font-semibold text-indigo-400">
                {t("onb.start.go")}
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            </button>
          ))}
        </div>

        {/* Crédits offerts — la raison pour laquelle on ose cliquer. */}
        {credits && credits.restants > 0 && (
          <div className="mx-6 mt-3 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed text-[var(--app-text-muted)]" style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.26)" }}>
            🎁 {t("onb.start.credits", { n: credits.restants })}
          </div>
        )}

        {/* Les autres modules : repliés. On les explique quand on les ouvre. */}
        <div className="px-6 pt-4">
          <button
            onClick={() => setVoirModules((v) => !v)}
            className="flex w-full items-center justify-between text-[12.5px] font-medium text-[var(--app-text-faint)] transition hover:text-[var(--app-text-muted)]"
          >
            {t("onb.start.more")}
            <svg viewBox="0 0 24 24" className={`h-4 w-4 transition ${voirModules ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {voirModules && (
            <div className="mt-3 space-y-1.5">
              {ONBOARDING_MODULES.map((m) => (
                <div key={m.key} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: m.accentBg, border: `1px solid ${m.accentBorder}`, color: m.accent }}>
                    {m.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold leading-tight text-[var(--app-text)]">{t(`onb.modules.${m.i18n}.name`)}</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--app-text-faint)]">{t(`onb.modules.${m.i18n}.tagline`)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pas de bouton « Je commence » : la carte pose une QUESTION, et une
            question ne se valide pas — on y répond en choisissant. Un troisième
            bouton donnait une troisième issue, la seule qui ne mène nulle part.
            Pour sortir sans choisir : la croix, ou un clic à côté. */}
        <div className="px-6 pb-7 pt-5">
          {/* L'aide est à un clic, et elle a une adresse : la bulle en bas à
              droite. Le dire ici évite l'abandon silencieux. */}
          <p className="mt-3.5 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-[var(--app-text-faint)]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {t("onb.start.help")}
          </p>
        </div>
      </div>
    </div>
  );
}
