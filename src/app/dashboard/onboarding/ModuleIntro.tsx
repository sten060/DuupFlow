"use client";

/**
 * INTRO DE MODULE — la fenêtre qui explique le module AVANT d'y toucher.
 *
 * Le parcours guidé montre où cliquer ; il ne dit pas ce qu'on est en train de
 * faire. Quelqu'un qui arrive sur « Duplication vidéo » sans savoir ce que le
 * module produit suit les flèches sans comprendre, et n'y revient pas.
 *
 * D'où cette fenêtre pleine page, une seule fois par module, le jour où le user
 * l'ouvre :
 *   · Vidéos — deux écrans : le concept, puis les modes de duplication ;
 *   · Images — un seul écran.
 *
 * « Une seule fois » est stocké en base (profiles.onboarding_progress) comme le
 * reste de l'onboarding : le user ne la revoit pas, même sur un autre appareil.
 * Elle ne s'affiche pas non plus pour les comptes existants (`enabled`).
 *
 * Montée dans le layout du dashboard, elle passe DEVANT le parcours guidé et le
 * coach de module (voir introStore.ts) — un seul guide à l'écran.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { useOnboarding } from "./OnboardingProvider";
import { setIntroOuverte } from "./introStore";
import { PARCOURS, type CleParcours } from "./parcours";

type Ecran = {
  /** Préfixe des clés i18n sous `onb.intro.*` (…t, …b, …p1/p2/p3). */
  cle: string;
  /** Nombre de puces à afficher (clés …p1, …p2, …). */
  puces?: number;
  /** Deux blocs côte à côte (les modes de duplication). */
  blocs?: string[];
  ctaKey: string;
};

type Intro = {
  area: string;
  route: string;
  accent: string;
  /**
   * Parcours à enchaîner quand la fenêtre se ferme, s'il n'y en a pas déjà un.
   *
   * Le user choisit UN chemin sur la carte d'accueil ; le jour où il ouvre
   * l'autre module de lui-même, il n'a jamais rien vu de celui-là. On reprend
   * donc le parcours correspondant, mais à partir de l'étape qui se joue sur
   * cette page : lui montrer comment arriver là où il est déjà serait absurde.
   * Une seule fois, puisque la fenêtre elle-même ne revient jamais.
   */
  parcours?: CleParcours;
  /** Bandeau à logos plutôt que simple étiquette (Éditeur IA). */
  logos?: boolean;
  ecrans: Ecran[];
};

/** L'icône de l'Éditeur IA, la même que dans la barre latérale. */
const IconeEditeur = (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8 19 13" /><path d="M15 9h0" /><path d="M17.8 6.2 19 5" /><path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />
  </svg>
);

const INTROS: Intro[] = [
  {
    area: "intro-videos",
    parcours: "dup",
    route: "/dashboard/videos",
    accent: "#6366F1",
    ecrans: [
      { cle: "vid1", puces: 3, ctaKey: "onb.intro.ok" },
      // ⚠️ Deux modes seulement. Le mode IA auto n'est pas présenté ici : le
      // découvrir avant d'avoir dupliqué une seule vidéo noie l'essentiel.
      { cle: "vid2", blocs: ["simple", "adv"], ctaKey: "onb.intro.go" },
    ],
  },
  {
    // Ouvre le parcours de l'Éditeur IA : le module d'abord, ses trois étapes
    // ensuite (panneaux du guide).
    area: "intro-ai-editor",
    parcours: "ai",
    route: "/dashboard/ai-editor",
    accent: "#8B5CF6",
    logos: true,
    ecrans: [{ cle: "aie1", puces: 3, ctaKey: "onb.intro.go" }],
  },
  {
    area: "intro-images",
    parcours: "dup",
    route: "/dashboard/images",
    accent: "#C026D3",
    ecrans: [{ cle: "img1", puces: 3, ctaKey: "onb.intro.go" }],
  },
];

export default function ModuleIntro() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { enabled, isSeen, markSeen, parcours, lancerParcours } = useOnboarding();

  const [actif, setActif] = useState<Intro | null>(null);
  const [ecran, setEcran] = useState(0);

  useEffect(() => {
    if (!enabled) { setActif(null); return; }
    const intro = INTROS.find((i) => i.route === pathname);
    if (!intro) { setActif(null); return; }
    if (isSeen(intro.area)) { setActif(null); return; }
    setActif(intro);
    setEcran(0);
    markSeen(intro.area); // vue une fois = vue pour de bon
    // isSeen change à chaque markSeen : le garder hors des dépendances évite de
    // refermer la fenêtre au moment même où on la marque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, enabled, markSeen]);

  /* La fenêtre ne surgit pas au chargement : la page s'installe d'abord, puis
     elle arrive en fondu. Un pop instantané par-dessus une page encore en train
     de se peindre est agressif — et on n'a rien vu de ce qu'on nous explique. */
  const [entree, setEntree] = useState(false);
  useEffect(() => {
    if (!actif) { setEntree(false); return; }
    const id = window.setTimeout(() => setEntree(true), 420);
    return () => window.clearTimeout(id);
  }, [actif]);

  // Le parcours guidé et le coach s'effacent tant que l'intro est là.
  useEffect(() => {
    setIntroOuverte(!!actif);
    return () => setIntroOuverte(false);
  }, [actif]);

  useEffect(() => {
    if (!actif) return;
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") setActif(null); };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [actif]);

  if (!actif) return null;

  const e = actif.ecrans[ecran];
  const dernier = ecran >= actif.ecrans.length - 1;
  const k = (suffixe: string) => `onb.intro.${e.cle}${suffixe}`;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
      style={{
        background: "rgba(2,6,23,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: entree ? 1 : 0,
        transition: "opacity .32s ease",
      }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl px-12 py-11"
        style={{
          opacity: entree ? 1 : 0,
          transform: entree ? "translateY(0) scale(1)" : "translateY(10px) scale(.985)",
          transition: "opacity .34s ease, transform .34s cubic-bezier(.16,1,.3,1)",
          background: "var(--app-surface)",
          border: "1px solid var(--app-border)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
        }}
      >
        {/* Bandeau : de quel module on parle, et où on en est */}
        {actif.logos ? (
          // Éditeur IA : les deux visages du module, l'outil et le Claude du
          // user. Une étiquette texte ne dirait pas que c'est SON Claude.
          <div className="mb-7 flex items-center gap-3">
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl text-white"
              style={{
                background: "linear-gradient(160deg,#A78BFA 0%,#7C3AED 55%,#5B21B6 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 6px rgba(0,0,0,0.25), 0 12px 26px -12px rgba(124,58,237,0.9)",
              }}
            >
              {IconeEditeur}
            </span>
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white">
              {/* Le PNG a sa propre marge : on le recadre pour que la marque
                  pèse autant à l'œil que l'icône violette à côté. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/claude-ai-logo-rounded-hd-free-png-1.webp" alt="Claude" className="h-full w-full scale-[1.22] object-cover" />
            </span>
            <span className="ml-1 text-[11px] font-bold tracking-[0.16em] text-[var(--app-text-faint)]">
              {t("onb.intro.tagAiEditor")}
            </span>
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-2.5">
            <span
              className="rounded-lg px-2.5 py-1 text-[10.5px] font-bold tracking-[0.16em]"
              style={{ color: actif.accent, background: `${actif.accent}1F`, border: `1px solid ${actif.accent}4D` }}
            >
              {t(`onb.intro.${actif.area === "intro-videos" ? "tagVideo" : "tagImage"}`)}
            </span>
            {actif.ecrans.length > 1 && (
              <span className="text-[11px] font-semibold text-[var(--app-text-faint)]">
                {ecran + 1}/{actif.ecrans.length}
              </span>
            )}
          </div>
        )}

        <h2 className="mb-4 text-[28px] font-bold leading-tight tracking-tight text-[var(--app-text)]">{t(k("t"))}</h2>
        <p className="text-[15.5px] leading-relaxed text-[var(--app-text-muted)]">{t(k("b"))}</p>

        {/* Écran « concept » : quelques puces, jamais un pavé */}
        {e.puces && (
          <ul className="mt-6 space-y-3">
            {Array.from({ length: e.puces }, (_, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14.5px] font-medium leading-snug text-[var(--app-text)]">
                <span
                  className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: actif.accent }}
                >
                  ✓
                </span>
                {t(k(`p${i + 1}`))}
              </li>
            ))}
          </ul>
        )}

        {/* Écran « modes » : deux blocs côte à côte, un coup d'œil suffit */}
        {e.blocs && (
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {e.blocs.map((b) => (
              <div
                key={b}
                className="rounded-xl px-6 py-5"
                style={{
                  // Un dégradé de blancs ne se voit pas sur un thème clair : on
                  // part des surfaces du thème, qui existent dans les deux.
                  background: "linear-gradient(160deg, var(--app-surface-2), var(--app-surface))",
                  border: "1px solid var(--app-border)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
                }}
              >
                <p className="mb-1.5 text-[15px] font-bold text-[var(--app-text)]">{t(k(`${b}T`))}</p>
                <p className="text-[14px] leading-relaxed text-[var(--app-text-muted)]">{t(k(`${b}B`))}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            if (!dernier) { setEcran((n) => n + 1); return; }
            setActif(null);
            // Enchaînement : la fenêtre a expliqué le module, le parcours
            // montre où cliquer dedans. Jamais par-dessus un parcours en cours.
            if (actif.parcours && !parcours) {
              const i = PARCOURS[actif.parcours].findIndex((e) => e.route === actif.route);
              if (i > -1) lancerParcours(actif.parcours, i);
            }
          }}
          className="mt-9 w-full rounded-xl py-3.5 text-[14.5px] font-bold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)", boxShadow: "0 14px 34px rgba(99,102,241,0.35)" }}
        >
          {t(e.ctaKey)}
        </button>
      </div>
    </div>
  );
}
