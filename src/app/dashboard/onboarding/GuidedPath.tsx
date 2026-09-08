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
 * Jamais bloquant : la page reste utilisable, « quitter » est toujours là, et
 * une ancre absente fait SAUTER l'étape au lieu de figer le parcours.
 *
 * Monté dans le layout du dashboard, comme ModuleCoach : c'est ce qui lui
 * permet de survivre aux navigations.
 */

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { useOnboarding } from "./OnboardingProvider";
import { PARCOURS, type EtapeParcours } from "./parcours";
import { CARD_W, getRect, placeNear, type Rect } from "./spotlight";

const PAD = 10;

export default function GuidedPath() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { parcours, etape, allerEtape, quitterParcours } = useOnboarding();

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

  const visible = !!courante && pathname === courante.route && !(courante.siPlanFree && planPaye !== false);

  /* Ancre absente (page pas encore montée, élément conditionnel) : on laisse
     un court délai puis on saute l'étape. Un parcours ne doit jamais rester
     coincé sur un élément qui n'existe pas. */
  useLayoutEffect(() => {
    if (!visible || !courante) { setRect(null); setPos(null); return; }

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
  }, [visible, courante, etape, allerEtape]);

  /* Sortie du parcours SANS bouton : la touche Échap. Le bouton « Passer »
     encombrait chaque bulle, mais un guide sans aucune sortie serait un piège —
     surtout aux étapes où le seul geste prévu est de cliquer un lien. */
  useEffect(() => {
    if (!parcours) return;
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") quitterParcours(); };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [parcours, quitterParcours]);

  if (!parcours || !courante || !visible) return null;

  // Fin = dernière étape de la BRANCHE (marquée `fin`), ou fin de liste.
  const dernier = courante.fin === true || etape >= etapes.length - 1;

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
          )}
        </div>
      </div>
    </>
  );
}
