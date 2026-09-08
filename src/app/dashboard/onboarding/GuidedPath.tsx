"use client";

/**
 * PARCOURS GUIDÉ — le fil qui amène le user jusqu'à son premier résultat.
 *
 * Déclenché depuis la carte d'accueil (« par quoi tu veux commencer ? »), il
 * traverse les pages : surligner, expliquer en une phrase, laisser cliquer.
 *
 * Deux natures d'étapes :
 *   · `parClic` — la zone surlignée est un lien. Pas de bouton « Suivant » :
 *     c'est le vrai clic qui fait avancer, et le changement de route enchaîne.
 *     Guider quelqu'un tout en lui demandant de cliquer ailleurs, c'est le
 *     perdre.
 *   · les autres — on explique, un bouton avance.
 *
 * Deux mises en scène :
 *   · la bulle posée à côté d'un élément surligné (le cas normal) ;
 *   · le grand panneau collé au bord droit, fond flouté, SANS cible — pour
 *     l'Éditeur IA, où chaque étape est une page entière à comprendre et non
 *     un bouton à cliquer. Surligner une zone d'upload n'explique rien.
 *
 * Jamais bloquant : la page reste utilisable, « quitter » est toujours là, et
 * une ancre absente fait SAUTER l'étape au lieu de figer le parcours.
 *
 * Monté dans le layout du dashboard, comme ModuleCoach : c'est ce qui lui
 * permet de survivre aux navigations.
 */

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { useOnboarding } from "./OnboardingProvider";
import { PARCOURS, type EtapeParcours } from "./parcours";
import { CARD_W, getRect, placeNear, type Rect } from "./spotlight";
import { introSnapshot, subscribeIntro } from "./introStore";
import { etapeEditeurSnapshot, subscribeEtapeEditeur } from "./aiStepStore";

const PAD = 10;
const CLE_LUS = "duup_parcours_lus";

export default function GuidedPath() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { parcours, etape, allerEtape, quitterParcours } = useOnboarding();
  // L'intro du module explique où on est ; le guide attend qu'elle soit lue.
  const intro = useSyncExternalStore(subscribeIntro, introSnapshot, () => false);
  // Éditeur IA : c'est le module qui dit où en est le user, pas un bouton.
  const etapeEditeur = useSyncExternalStore(subscribeEtapeEditeur, etapeEditeurSnapshot, () => null);
  // Panneaux déjà lus (« J'ai compris »), par étape de module. Persistés : un
  // rechargement ne doit pas remettre l'explication devant les yeux du user.
  const [lus, setLus] = useState<string[]>([]);
  useEffect(() => {
    try { setLus(JSON.parse(localStorage.getItem(CLE_LUS) || "[]")); } catch { /* sans effet */ }
  }, []);
  const marquerLu = (cle: string) => {
    setLus((v) => {
      const suite = v.includes(cle) ? v : [...v, cle];
      try { localStorage.setItem(CLE_LUS, JSON.stringify(suite)); } catch { /* sans effet */ }
      return suite;
    });
  };

  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Le plan sert à sauter l'étape « active ton plan » pour qui en a déjà un.
  const [planPaye, setPlanPaye] = useState<boolean | null>(null);

  useEffect(() => {
    if (!parcours) return;
    let annule = false;
    fetch("/api/trial-credits")
      .then((r) => r.json())
      .then((d) => { if (!annule) setPlanPaye(d?.plan && d.plan !== "free"); })
      .catch(() => { if (!annule) setPlanPaye(null); });
    return () => { annule = true; };
  }, [parcours]);

  const etapes: EtapeParcours[] = parcours ? PARCOURS[parcours] : [];
  const courante = etapes[etape] ?? null;

  /* Une étape réservée aux comptes sans plan est sautée dès qu'on sait que le
     plan est payé. On attend de le savoir : sauter par défaut afficherait
     l'étape suivante à quelqu'un qui doit d'abord s'abonner. */
  useEffect(() => {
    if (!courante) return;
    if (courante.siPlanFree && planPaye === true) allerEtape(etape + 1);
  }, [courante, planPaye, etape, allerEtape]);

  /* Fin de parcours (dernière étape franchie, ou étapes sautées faute
     d'ancres) : on efface l'état, sinon il resterait en mémoire et le guide
     tenterait de reprendre à une étape qui n'existe pas. */
  useEffect(() => {
    if (parcours && etapes.length > 0 && etape >= etapes.length) quitterParcours();
  }, [parcours, etapes.length, etape, quitterParcours]);

  /* L'étape n'est visible que sur SA page. Quand le user change de page, on
     cherche EN AVANT la première étape qui parle de cette page-là.
     ⚠️ Chercher seulement `etape + 1` cassait le parcours dès qu'il bifurque :
     depuis « Duplication », le user peut atterrir sur Images OU sur Vidéos, et
     l'une des deux branches n'est pas l'étape juste après. S'il part ailleurs,
     on ne montre rien et on l'attend. */
  useEffect(() => {
    if (!courante) return;
    if (pathname === courante.route) return;
    const cible = etapes.findIndex((e, i) => i > etape && e.route === pathname);
    if (cible > -1) allerEtape(cible);
  }, [pathname, courante, etapes, etape, allerEtape]);

  /* Panneaux de l'Éditeur IA : on saute à celui qui correspond à l'étape où le
     user se trouve VRAIMENT. Il connecte son Claude, il passe à la référence,
     et c'est ce passage-là qui ouvre le panneau suivant. */
  useEffect(() => {
    if (!parcours || !etapeEditeur) return;
    const i = etapes.findIndex((e) => e.moduleStep === etapeEditeur);
    if (i > -1 && i !== etape) allerEtape(i);
  }, [parcours, etapeEditeur, etapes, etape, allerEtape]);

  const visible = !!courante && pathname === courante.route && !(courante.siPlanFree && planPaye !== false);

  /* Ancre absente (page pas encore montée, élément conditionnel) : on laisse
     un court délai puis on saute l'étape. Un parcours ne doit jamais rester
     coincé sur un élément qui n'existe pas. */
  useLayoutEffect(() => {
    // Un panneau n'a pas de cible : rien à mesurer, et surtout rien à sauter —
    // sans ce garde-fou, l'ancre introuvable ferait sauter l'étape au bout de
    // 900 ms.
    if (!visible || !courante || intro || courante.presentation === "panneau") { setRect(null); setPos(null); return; }

    let vivant = true;
    const mesurer = () => {
      const r = getRect(courante.target);
      if (!vivant) return false;
      setRect(r);
      setPos(r ? placeNear(r, courante.placement ?? "right") : null);
      return !!r;
    };

    if (!mesurer()) {
      const retard = window.setTimeout(() => { if (vivant && !mesurer()) allerEtape(etape + 1); }, 900);
      return () => { vivant = false; window.clearTimeout(retard); };
    }

    const suivre = () => mesurer();
    window.addEventListener("scroll", suivre, true);
    window.addEventListener("resize", suivre);
    const boucle = window.setInterval(suivre, 400); // l'élément peut bouger (accordéons, chargements)
    return () => {
      vivant = false;
      window.removeEventListener("scroll", suivre, true);
      window.removeEventListener("resize", suivre);
      window.clearInterval(boucle);
    };
  }, [visible, courante, intro, etape, allerEtape]);

  /* Le panneau arrive en glissant depuis le bord, pas d'un coup. */
  const [entree, setEntree] = useState(false);
  useEffect(() => {
    setEntree(false);
    const id = window.setTimeout(() => setEntree(true), 240);
    return () => window.clearTimeout(id);
  }, [etape]);

  /* Sortie du parcours SANS bouton : la touche Échap. Le bouton « Passer »
     encombrait chaque bulle, mais un guide sans aucune sortie serait un piège —
     surtout aux étapes où le seul geste prévu est de cliquer un lien. */
  useEffect(() => {
    if (!parcours) return;
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") quitterParcours(); };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [parcours, quitterParcours]);

  if (!parcours || !courante || !visible || intro) return null;

  // Fin = dernière étape de la BRANCHE (marquée `fin`), ou fin de liste.
  const dernier = courante.fin === true || etape >= etapes.length - 1;

  const boutons = (
    <div className="flex gap-2">
      {etape > 0 && (
        <button
          onClick={() => allerEtape(etape - 1)}
          className="rounded-xl px-3.5 py-2 text-xs font-semibold transition"
          style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", color: "var(--app-text-muted)" }}
        >
          {t("onb.back")}
        </button>
      )}
      <button
        onClick={() => (dernier ? quitterParcours() : allerEtape(etape + 1))}
        className="flex-1 rounded-xl py-2 text-xs font-semibold text-white transition hover:opacity-90"
        style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
      >
        {dernier ? t("onb.done") : t("onb.next")}
      </button>
    </div>
  );

  /* ── Panneau (Éditeur IA) ──────────────────────────────────────────────
     Collé au bord droit, dans le vide laissé par la colonne de gauche. Le
     voile floute la page SANS la bloquer (pointer-events: none) : le user
     garde la main s'il veut agir tout de suite. */
  if (courante.presentation === "panneau") {
    const panneaux = etapes.filter((e) => e.presentation === "panneau");
    const rang = panneaux.indexOf(courante) + 1;
    const total = panneaux.length;
    // Déjà lu, ou le user est reparti sur une autre étape du module : on
    // s'efface et on laisse la page tranquille jusqu'à l'étape suivante.
    if (courante.moduleStep && (lus.includes(courante.moduleStep) || etapeEditeur !== courante.moduleStep)) return null;
    return (
      <>
        <div
          className="pointer-events-none fixed inset-0 z-[98]"
          style={{
            backdropFilter: "blur(3px) saturate(0.9)",
            WebkitBackdropFilter: "blur(3px) saturate(0.9)",
            background: "rgba(2,6,23,0.30)",
            opacity: entree ? 1 : 0,
            transition: "opacity .3s ease",
          }}
        />
        {/* Haut-droite : sous le titre de la page, jamais par-dessus. */}
        <div className="pointer-events-none fixed right-0 top-32 z-[100]">
          <div
            className="pointer-events-auto flex min-h-[30rem] w-[min(34rem,calc(100vw-1.5rem))] flex-col rounded-l-2xl px-11 py-14"
            style={{
              background: "var(--app-surface)",
              border: "1px solid var(--app-border)",
              borderRight: "none",
              boxShadow: "-30px 0 90px rgba(0,0,0,0.45)",
              opacity: entree ? 1 : 0,
              transform: entree ? "translateX(0)" : "translateX(18px)",
              transition: "opacity .32s ease, transform .38s cubic-bezier(.16,1,.3,1)",
            }}
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[10.5px] font-bold tracking-[0.18em] text-indigo-400">{t("onb.path.aiPanel")}</span>
              <span className="h-px flex-1" style={{ background: "var(--app-border)" }} />
              <span className="text-[11px] font-semibold text-[var(--app-text-faint)]">{rang}/{total}</span>
            </div>

            <h3 className="mb-4 text-[24px] font-bold leading-tight tracking-tight text-[var(--app-text)]">{t(courante.titleKey)}</h3>
            <p className="text-[15.5px] leading-relaxed text-[var(--app-text-muted)]">{t(courante.bodyKey)}</p>

            {courante.puces && (
              <ul className="mt-5 space-y-3">
                {Array.from({ length: courante.puces }, (_, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14.5px] font-medium leading-snug text-[var(--app-text)]">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                    {t(`${courante.bodyKey}p${i + 1}`)}
                  </li>
                ))}
              </ul>
            )}

            {courante.actionKey && (
              <p
                className="mb-8 mt-6 flex items-start gap-2.5 rounded-xl px-4 py-3.5 text-[14px] font-semibold leading-snug text-[var(--app-text)]"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.30)" }}
              >
                <svg viewBox="0 0 24 24" className="mt-[2px] h-4 w-4 shrink-0 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
                {t(courante.actionKey)}
              </p>
            )}

            {/* Un seul bouton : le panneau se referme, l'écran se défloute, et
                le user fait l'étape. Le panneau suivant l'attend plus loin. */}
            <button
              onClick={() => {
                if (courante.moduleStep) marquerLu(courante.moduleStep);
                if (dernier) quitterParcours();
              }}
              className="mt-auto w-full rounded-xl py-3.5 text-[14.5px] font-bold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)", boxShadow: "0 14px 34px rgba(99,102,241,0.35)" }}
            >
              {t("onb.path.compris")}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Halo : décoratif, il ne capture jamais le clic — le user doit pouvoir
          cliquer l'élément qu'on lui montre. */}
      {rect && (
        <div
          className="pointer-events-none fixed z-[99] rounded-xl"
          style={{
            top: Math.max(0, rect.top - PAD),
            left: Math.max(0, rect.left - PAD),
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 2px rgba(99,102,241,0.85), 0 0 0 6px rgba(99,102,241,0.18), 0 0 26px rgba(99,102,241,0.35)",
            transition: "all .3s cubic-bezier(.16,1,.3,1)",
          }}
        />
      )}

      <div
        className="fixed z-[100]"
        style={pos ? { top: pos.top, left: pos.left, width: CARD_W, maxWidth: "calc(100vw - 32px)" } : { bottom: 24, right: 24, width: CARD_W, maxWidth: "calc(100vw - 32px)" }}
      >
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", boxShadow: "0 24px 70px rgba(0,0,0,0.45)" }}
        >
          <h3 className="mb-1.5 text-base font-semibold tracking-tight text-[var(--app-text)]">{t(courante.titleKey)}</h3>
          <p className="mb-4 text-[13px] leading-relaxed text-[var(--app-text-muted)]">{t(courante.bodyKey)}</p>

          {courante.parClic ? (
            // Le geste attendu est le clic sur la zone surlignée : pas de
            // bouton qui ferait avancer sans que rien ne se passe.
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-indigo-400">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
              {t(courante.hintKey ?? "onb.path.clickHint")}
            </p>
          ) : (
            boutons
          )}
        </div>
      </div>
    </>
  );
}
