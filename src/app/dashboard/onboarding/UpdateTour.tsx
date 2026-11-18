"use client";

/**
 * Parcours de la mise à jour « Textes & Duplication IA », lancé par les
 * boutons du pop-up d'annonce (UpdateAnnounceModal) :
 *
 *  • « Essayer les captions » → mode Simple : on entoure, une par une, les
 *    nouveautés (Captions, Sous-titres, Templates, bouton Documentations),
 *    chacune avec une courte explication.
 *  • « Voir la Duplication IA » → page des modes de duplication : on entoure
 *    la carte « Duplication IA » et on attend que le user clique dessus. Sur
 *    la page IA, on pousse vers la vidéo démo (ancre `aidup-demo`, bouton à
 *    venir) ; tant qu'elle n'existe pas, on montre la zone de dépôt.
 *
 * Réutilise le repérage de la visite guidée (spotlight.ts). Le parcours en
 * cours vit dans sessionStorage : il survit au changement de page, pas à la
 * fermeture de l'onglet. Rien n'est écrit en base.
 */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { CARD_W, getRect, placeNear, type Rect } from "./spotlight";

export type UpdateTourKind = "captions" | "aidup";
const KEY = "duup_update_tour";
const EVENT = "duup:update-tour";

/** Lance un parcours (appelé au clic d'un bouton du pop-up, avant la navigation). */
export function startUpdateTour(kind: UpdateTourKind) {
  try { sessionStorage.setItem(KEY, kind); } catch { /* sans stockage : pas de parcours */ }
  window.dispatchEvent(new Event(EVENT));
}
function readTour(): UpdateTourKind | null {
  try { const v = sessionStorage.getItem(KEY); return v === "captions" || v === "aidup" ? v : null; } catch { return null; }
}
function endTour() {
  try { sessionStorage.removeItem(KEY); } catch { /* rien */ }
  window.dispatchEvent(new Event(EVENT));
}

type Step = {
  /** Ancres candidates : la première présente à l'écran est entourée. */
  targets: string[];
  title: string;
  body: string;
  /** Étape « clique ici » : pas de bouton Suivant, on attend le clic. */
  waitClick?: boolean;
  placement?: "right" | "below" | "left";
};

export default function UpdateTour() {
  const { t } = useTranslation();
  const pathname = usePathname() ?? "";
  const [kind, setKind] = useState<UpdateTourKind | null>(null);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => { setKind(readTour()); setStep(0); };
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  // Étapes de la page courante.
  const steps: Step[] = useMemo(() => {
    if (kind === "captions" && pathname === "/dashboard/videos/simple") {
      return [
        { targets: ["simple-captions"], title: t("dashboard.updateTour.capT"), body: t("dashboard.updateTour.capB") },
        { targets: ["simple-subtitles"], title: t("dashboard.updateTour.subT"), body: t("dashboard.updateTour.subB") },
        { targets: ["simple-templates"], title: t("dashboard.updateTour.tplT"), body: t("dashboard.updateTour.tplB") },
        { targets: ["module-help"], title: t("dashboard.updateTour.docT"), body: t("dashboard.updateTour.docB"), placement: "below" },
      ];
    }
    if (kind === "aidup" && pathname === "/dashboard/videos") {
      return [{ targets: ["video-mode-ai"], title: t("dashboard.updateTour.aiCardT"), body: t("dashboard.updateTour.aiCardB"), waitClick: true }];
    }
    if (kind === "aidup" && pathname === "/dashboard/videos/ai") {
      return [
        // Vidéo démo (bouton à venir) en priorité ; sinon, la zone de dépôt.
        { targets: ["aidup-demo"], title: t("dashboard.updateTour.demoT"), body: t("dashboard.updateTour.demoB"), placement: "below" },
      ];
    }
    return [];
  }, [kind, pathname, t]);
  const fallbackAi = kind === "aidup" && pathname === "/dashboard/videos/ai";
  const current = steps[step] ?? null;

  // Quitter les pages du parcours y met fin (sauf le passage modes → page IA).
  useEffect(() => {
    if (!kind) return;
    const onPath =
      (kind === "captions" && pathname === "/dashboard/videos/simple") ||
      (kind === "aidup" && (pathname === "/dashboard/videos" || pathname === "/dashboard/videos/ai")) ||
      pathname === "/dashboard"; // juste après le pop-up, avant la navigation
    if (!onPath) endTour();
  }, [kind, pathname]);

  // Repère l'ancre (montage tardif, défilement, redimensionnement).
  useLayoutEffect(() => {
    if (!current) { setRect(null); setAnchor(null); return; }
    let found: string | null = null;
    const find = () => {
      for (const id of current.targets) { const r = getRect([id]); if (r) { found = id; return r; } }
      // Page IA sans bouton démo : on montre la zone de dépôt à la place.
      if (fallbackAi) { const r = getRect(["aidup-drop"]); if (r) { found = "aidup-drop"; return r; } }
      return null;
    };
    const same = (a: Rect | null, b: Rect | null) => !!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
    const update = () => { const r = find(); setRect((p) => (same(p, r) ? p : r)); setAnchor(found); };
    update();
    let tries = 0;
    const poll = window.setInterval(() => {
      const r = find();
      if (r) {
        setRect(r); setAnchor(found); window.clearInterval(poll);
        document.querySelector<HTMLElement>(`[data-tour-id="${found}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (++tries > 30) {
        window.clearInterval(poll);
        if (!r) { if (step < steps.length - 1) setStep((s) => s + 1); else endTour(); }
      }
    }, 100);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.clearInterval(poll); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
    // Clé stable : `current` est un objet recréé à chaque rendu de `t`.
  }, [kind, pathname, step, steps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clic sur la vidéo démo : le parcours a atteint son but, la bulle s'efface
  // pour ne pas recouvrir le lecteur.
  useEffect(() => {
    if (anchor !== "aidup-demo") return;
    const el = document.querySelector<HTMLElement>('[data-tour-id="aidup-demo"]');
    if (!el) return;
    el.addEventListener("click", endTour);
    return () => el.removeEventListener("click", endTour);
  }, [anchor]);

  if (!kind || !current || !rect) return null;

  const isDropFallback = anchor === "aidup-drop";
  const title = isDropFallback ? t("dashboard.updateTour.dropT") : current.title;
  const body = isDropFallback ? t("dashboard.updateTour.dropB") : current.body;
  const total = steps.length;
  const isLast = step >= total - 1;
  const next = () => (isLast ? endTour() : setStep((s) => s + 1));
  const pos = placeNear(rect, current.placement ?? "right");
  const PAD = 10;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes updt-ring{0%,100%{box-shadow:0 0 0 2px #6366F1,0 0 0 6px rgba(99,102,241,.25),0 0 0 9999px rgba(10,12,30,.38)}50%{box-shadow:0 0 0 2px #6366F1,0 0 0 12px rgba(99,102,241,.12),0 0 0 9999px rgba(10,12,30,.38)}}@keyframes updt-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.updt-ring,.updt-in{animation:none!important}}" }} />
      {/* Anneau autour de l'élément + voile sur le reste. Ne bloque aucun clic. */}
      <div
        className="updt-ring pointer-events-none fixed z-[99] rounded-2xl"
        style={{
          top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          boxShadow: "0 0 0 2px #6366F1, 0 0 0 6px rgba(99,102,241,.25), 0 0 0 9999px rgba(10,12,30,.38)",
          animation: "updt-ring 1.8s ease-in-out infinite",
          transition: "top .35s cubic-bezier(.16,1,.3,1), left .35s cubic-bezier(.16,1,.3,1), width .35s, height .35s",
        }}
      />
      <div
        key={`${kind}-${step}-${anchor}`}
        className="updt-in fixed z-[100]"
        style={{ top: pos.top, left: pos.left, width: CARD_W, maxWidth: "calc(100vw - 32px)", animation: "updt-in .35s cubic-bezier(.16,1,.3,1) both" }}
      >
        <div className="rounded-2xl border border-[var(--app-border)] p-5 shadow-2xl" style={{ background: "var(--app-surface)" }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-indigo-500" style={{ background: "rgba(99,102,241,.14)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> {t("dashboard.updateTour.badge")}
            </span>
            <button onClick={endTour} className="text-[11.5px] text-[var(--app-text-faint)] transition hover:text-[var(--app-text-muted)]">{t("onb.skip")}</button>
          </div>
          <h3 className="mb-1.5 text-[15.5px] font-semibold tracking-tight text-[var(--app-text)]">{title}</h3>
          <p className="text-[13.5px] leading-relaxed text-[var(--app-text-muted)]">{body}</p>

          {current.waitClick ? (
            <p className="mt-4 flex items-center gap-2 text-[12.5px] font-semibold text-indigo-500">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 11V5a2 2 0 1 1 4 0v6" /><path d="M13 9a2 2 0 1 1 4 0v3a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5.2-3l-1.6-2.8a1.8 1.8 0 0 1 3.1-1.8L9 13" /></svg>
              {t("dashboard.updateTour.clickHint")}
            </p>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              {total > 1 && (
                <div className="flex items-center gap-1.5">
                  {steps.map((_, i) => (
                    <span key={i} className="h-1.5 rounded-full transition-all duration-200" style={{ width: i === step ? 18 : 6, background: i <= step ? "#6366F1" : "var(--app-border-strong)" }} />
                  ))}
                </div>
              )}
              <div className="ml-auto flex gap-2">
                {step > 0 && (
                  <button onClick={() => setStep((s) => s - 1)} className="rounded-xl border border-[var(--app-border)] px-3.5 py-2 text-xs font-semibold text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]">
                    {t("onb.back")}
                  </button>
                )}
                <button onClick={next} className="rounded-xl px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110" style={{ background: "linear-gradient(180deg,#6366F1,#4F46E5)" }}>
                  {isLast ? t("dashboard.updateTour.done") : t("onb.next")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
