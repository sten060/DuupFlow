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

  /* Entrée de la carte. Deux conditions, pas une :
       · un court délai — la carte ne doit pas surgir sur une app encore en
         train de se peindre, elle arrive une fois le décor posé ;
       · les crédits connus — le bandeau « X vidéos offertes » arrivait après
         coup et faisait sauter toute la carte. On l'attend, plafonné, pour que
         la fenêtre s'ouvre déjà complète.
     Le plafond est indispensable : une API lente ne doit jamais retenir
     l'accueil en otage. */
  const [shown, setShown] = useState(false);
  const [delaiPasse, setDelaiPasse] = useState(false);
  const [creditsPrets, setCreditsPrets] = useState(false);

  useEffect(() => {
    if (!open) { setShown(false); setDelaiPasse(false); return; }
    const id = window.setTimeout(() => setDelaiPasse(true), 480);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) { setCreditsPrets(false); return; }
    let annule = false;
    const fini = () => { if (!annule) setCreditsPrets(true); };
    // Plafond : au-delà, on ouvre sans le bandeau plutôt que de faire attendre.
    const secours = window.setTimeout(fini, 1200);
    fetch("/api/trial-credits")
      .then((r) => r.json())
      .then((d) => { if (!annule && typeof d?.restants === "number") setCredits(d); })
      .catch(() => { /* pas de crédits affichés, la carte marche sans */ })
      .finally(fini);
    return () => { annule = true; window.clearTimeout(secours); };
  }, [open]);

  useEffect(() => {
    if (!delaiPasse || !creditsPrets) return;
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [delaiPasse, creditsPrets]);

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
      style={{
        background: "rgba(5,8,22,0.66)",
        backdropFilter: "blur(6px)",
        opacity: sort ? 0 : shown ? 1 : 0,
        transition: "opacity .38s ease",
      }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-2xl overflow-hidden"
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
        <div className="relative px-10 pt-11 pb-7 text-center">
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
        <div className="mx-auto grid w-full max-w-4xl gap-4 px-8 sm:grid-cols-2">
          {[
            { cle: "dup", href: "/dashboard/videos", accent: "linear-gradient(135deg,#6366F1,#38BDF8)", icone: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="8" width="13" height="13" rx="2.5" /><path d="M4 16V5a1 1 0 0 1 1-1h11" />
              </svg>
            ) },
            // Même icône que dans la barre latérale : le user doit reconnaître
            // le module qu'il vient de choisir quand il le retrouve à gauche.
            { cle: "ai", href: "/dashboard/ai-editor", accent: "linear-gradient(160deg,#A78BFA 0%,#7C3AED 55%,#5B21B6 100%)", claude: true, icone: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8 19 13" /><path d="M15 9h0" /><path d="M17.8 6.2 19 5" /><path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />
              </svg>
            ) },
          ].map((c, i) => (
            <button
              key={c.cle}
              onClick={() => choisir(c.cle as "dup" | "ai")}
              // duup-glass : dégradé, liseré clair sur l'arête haute et double
              // ombre — la même matière que les zones de dépôt de l'Éditeur IA.
              className="duup-glass group relative flex h-full w-full flex-col items-start gap-3.5 overflow-hidden rounded-2xl px-7 py-7 text-left"
              style={{
                opacity: shown ? 1 : 0,
                transform: shown ? "translateY(0)" : "translateY(6px)",
                transitionDelay: `${120 + i * 80}ms`,
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-70 blur-3xl transition group-hover:opacity-100"
                style={{ background: `radial-gradient(circle, ${c.cle === "dup" ? "rgba(99,102,241,0.32)" : "rgba(124,58,237,0.30)"}, transparent 70%)` }}
              />
              <span className="relative flex shrink-0 items-center gap-2">
                <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: c.accent, boxShadow: "0 10px 20px -12px rgba(79,70,229,0.8)" }}>
                  {c.icone}
                </span>
                {/* Éditeur IA seulement : c'est le Claude du user qui monte,
                    autant le montrer dès le choix. */}
                {"claude" in c && c.claude && (
                  // Même gabarit que la tuile à gauche (h-11 w-11). Le PNG de
                  // Claude porte sa propre marge : à boîte égale, sa marque
                  // paraissait plus petite. On recadre pour égaliser à l'œil.
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/claude-ai-logo-rounded-hd-free-png-1.webp" alt="Claude" className="h-full w-full scale-[1.22] object-cover" />
                  </span>
                )}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-[var(--app-text)]">{t(`onb.start.${c.cle}Title`)}</span>
                <span className="mt-1.5 block text-[13.5px] leading-relaxed text-[var(--app-text-muted)]">{t(`onb.start.${c.cle}Desc`)}</span>
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
          // Verre teinté plutôt qu'un aplat vert : dégradé en biais, liseré
          // clair en haut, halo émeraude qui déborde. Un aplat vert avec un
          // filet de la même couleur, c'est le bandeau d'alerte de n'importe
          // quel formulaire — pas un cadeau.
          <div
            className="duup-glass relative mx-auto mt-5 w-full max-w-4xl overflow-hidden rounded-2xl px-7 py-5"
            style={{ borderColor: "rgba(16,185,129,0.30)" }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full opacity-70 blur-2xl"
              style={{ background: "radial-gradient(circle, rgba(16,185,129,0.45), transparent 70%)" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-12 right-4 h-24 w-24 rounded-full opacity-60 blur-2xl"
              style={{ background: "radial-gradient(circle, rgba(56,189,248,0.32), transparent 70%)" }}
            />
            <span className="relative flex items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[17px]"
                style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.22),rgba(56,189,248,0.18))", border: "1px solid rgba(16,185,129,0.35)" }}
              >
                🎁
              </span>
              <span className="text-[14.5px] font-semibold leading-relaxed text-[var(--app-text)]">
                {t("onb.start.credits", { n: credits.restants })}
              </span>
            </span>
          </div>
        )}

        {/* Les autres modules : repliés. On les explique quand on les ouvre. */}
        <div className="px-8 pt-6">
          <button
            onClick={() => setVoirModules((v) => !v)}
            className="flex w-full items-center justify-between text-[13.5px] font-semibold text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
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
                    <p className="text-[13.5px] font-semibold leading-tight text-[var(--app-text)]">{t(`onb.modules.${m.i18n}.name`)}</p>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--app-text-muted)]">{t(`onb.modules.${m.i18n}.tagline`)}</p>
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
        <div className="px-8 pb-8 pt-5">
          {/* L'aide est à un clic, et elle a une adresse : la bulle en bas à
              droite. Le dire ici évite l'abandon silencieux. */}
          <p className="mt-3.5 flex items-center justify-center gap-1.5 text-center text-[13px] font-medium text-[var(--app-text-muted)]">
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
