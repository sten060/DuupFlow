"use client";

/**
 * Gamified action-driven onboarding tour for the dashboard.
 *
 * Step config supports:
 *   • single or multi-target spotlights — `target` can be a string or an
 *     array of data-tour-ids; the spotlight bounding box is the union of all
 *     matching rects. Useful when the user needs to see related elements
 *     together (e.g. dropzone + copies count under one highlight).
 *   • per-step tooltip placement — "right-panel" (full-height), "below" /
 *     "above" / "right" / "left" relative to the spotlight, or "auto" (pick
 *     the side with the most free space).
 *
 * Progression rules:
 *   • "click" actions (nav links) auto-advance — the click navigates the
 *     user away, so we move the step forward immediately.
 *   • "upload" / "interact" / "submit" only UNLOCK the Suivant button. The
 *     user must click Suivant to advance. This gives them time to verify
 *     the page state (e.g. that their uploaded file is still in place, or
 *     to download generated outputs before moving on).
 *   • "manual" steps (welcome / outro) just show Suivant from the start.
 *
 * State:
 *   • current step persisted via setTourStep server action
 *   • final outro / skip → markOnboardingDone() flips profiles.onboarded_at
 *     and the tour never auto-opens again
 *
 * Mounting: in dashboard/layout.tsx so the tour persists across navigations.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { markOnboardingDone, setTourStep } from "./actions/onboarding";
import { useTour } from "./TourContext";

type AdvanceOn = "click" | "upload" | "interact" | "submit" | "manual";
type TooltipPos =
  | "right-panel"           // welcome / outro — full-height right column
  | "auto"                  // smart side-panel based on spotlight position
  | "top" | "bottom" | "left" | "right"  // force a specific full-side panel
  | "floating-near"         // compact tooltip — right→below→above→left
  | "floating-below"        // compact tooltip — below→right→above→left
  | "fixed-top-right"       // pin to viewport top-right corner
  | "fixed-bottom-right"    // pin to viewport bottom-right corner
  | "right-below-target";   // anchored to right edge of viewport, just below target

type TourStep = {
  /** null = no spotlight (welcome / outro / celebration). */
  target: string | string[] | null;
  /** Pathname matching. "any" = any /dashboard page. */
  page: string | string[] | "any";
  titleKey: string;
  bodyKey: string;
  advanceOn: AdvanceOn;
  /** Where to render the tooltip. Defaults to "auto" for spotlight steps. */
  tooltipPos?: TooltipPos;
  /** When provided and action has been detected, swap body with this text. */
  actionDoneBodyKey?: string;
  /** When true on an interact/click step, the action only UNLOCKS the Suivant
   * button (it doesn't auto-advance). Useful for steps where the user might
   * want to tweak multiple options before moving on. */
  requireSuivant?: boolean;
  /** When true, show the discreet "Passer cette etape" link under the action
   * row. Default false — escape via "Passer le tour" only. */
  allowSkipStep?: boolean;
};

// ────────────────────────────────────────────────────────────────────────────
// Step config. Order matters: tour_step persists indices.
// ────────────────────────────────────────────────────────────────────────────
const STEPS: TourStep[] = [
  // ── Intro (right panel) ──
  { target: null, page: "/dashboard",
    titleKey: "tour.welcomeTitle", bodyKey: "tour.welcomeBody",
    advanceOn: "manual", tooltipPos: "right-panel" },

  // ── Module 1 : Images ──
  // Sidebar nav steps use a compact "floating-near" tooltip placed next to
  // the link, so the full-side panel never covers the sidebar item the user
  // is supposed to click.
  { target: "nav-images", page: "any",
    titleKey: "tour.navImagesTitle", bodyKey: "tour.navImagesBody",
    advanceOn: "click", tooltipPos: "floating-near" },

  // All action steps inside a module share the SAME tooltip anchor (top-right
  // of the viewport) so the user always looks at the same spot for guidance.
  // Sidebar nav steps keep "floating-near" since they're a different pattern
  // (the spotlight is on a small sidebar item, far from the rest of the page).
  { target: ["img-h1", "img-dropzone", "img-copies"], page: "/dashboard/images",
    titleKey: "tour.imgDropzoneTitle", bodyKey: "tour.imgDropzoneBody",
    advanceOn: "upload", tooltipPos: "fixed-top-right",
    allowSkipStep: true /* dropzone — user may not have a file to test */ },

  { target: "img-copies", page: "/dashboard/images",
    titleKey: "tour.imgCopiesTitle", bodyKey: "tour.imgCopiesBody",
    advanceOn: "interact", tooltipPos: "fixed-top-right" },

  // Filters step — user may want to toggle several before moving on, so we
  // wait for an explicit Suivant click instead of auto-advancing on first chip.
  { target: "img-options", page: "/dashboard/images",
    titleKey: "tour.imgOptionsTitle", bodyKey: "tour.imgOptionsBody",
    advanceOn: "interact", tooltipPos: "fixed-top-right",
    requireSuivant: true },

  { target: "img-submit", page: "/dashboard/images",
    titleKey: "tour.imgSubmitTitle", bodyKey: "tour.imgSubmitBody",
    advanceOn: "submit", tooltipPos: "fixed-top-right",
    actionDoneBodyKey: "tour.imgSubmitDoneBody",
    allowSkipStep: true /* user can skip if they don't want to duplicate now */ },

  // ── Module 2 : Videos ──
  { target: "nav-videos", page: "any",
    titleKey: "tour.navVideosTitle", bodyKey: "tour.navVideosBody",
    advanceOn: "click", tooltipPos: "floating-near" },

  // Explain the difference between the two modes BEFORE asking the user
  // to pick. Both mode cards are highlighted together; the user reads the
  // explanation, then clicks Suivant to advance to the actual pick step.
  { target: ["video-mode-simple", "video-mode-advanced"], page: "/dashboard/videos",
    titleKey: "tour.videoModesTitle", bodyKey: "tour.videoModesBody",
    advanceOn: "manual", tooltipPos: "bottom" },

  { target: "video-mode-simple", page: "/dashboard/videos",
    titleKey: "tour.videoModeSimpleTitle", bodyKey: "tour.videoModeSimpleBody",
    advanceOn: "click", tooltipPos: "fixed-top-right" },

  // Video dropzone — tooltip anchored to right edge of viewport but BELOW
  // the dropzone (instead of fixed top-right) so it doesn't crowd the page.
  { target: "video-dropzone", page: "/dashboard/videos/simple",
    titleKey: "tour.videoDropzoneTitle", bodyKey: "tour.videoDropzoneBody",
    advanceOn: "upload", tooltipPos: "right-below-target",
    allowSkipStep: true /* dropzone — user may not have a file to test */ },

  // Packs step — let user toggle several packs before advancing.
  { target: "video-packs", page: "/dashboard/videos/simple",
    titleKey: "tour.videoPacksTitle", bodyKey: "tour.videoPacksBody",
    advanceOn: "interact", tooltipPos: "fixed-top-right",
    requireSuivant: true },

  { target: "video-submit", page: "/dashboard/videos/simple",
    titleKey: "tour.videoSubmitTitle", bodyKey: "tour.videoSubmitBody",
    advanceOn: "submit", tooltipPos: "fixed-top-right",
    actionDoneBodyKey: "tour.videoSubmitDoneBody",
    allowSkipStep: true /* user can skip if they don't want to duplicate now */ },

  // ── Module 3 : Comparator ──
  { target: "nav-similarity", page: "any",
    titleKey: "tour.navSimTitle", bodyKey: "tour.navSimBody",
    advanceOn: "click", tooltipPos: "floating-near" },

  // Comparator dropzones sit at the very top of the page — pin the tooltip
  // to the bottom-right so it never crowds the dropzones themselves.
  { target: "sim-file1-dropzone", page: "/dashboard/similarity",
    titleKey: "tour.simFile1Title", bodyKey: "tour.simFile1Body",
    advanceOn: "upload", tooltipPos: "fixed-bottom-right" },

  { target: "sim-file2-dropzone", page: "/dashboard/similarity",
    titleKey: "tour.simFile2Title", bodyKey: "tour.simFile2Body",
    advanceOn: "upload", tooltipPos: "fixed-bottom-right" },

  { target: "sim-submit", page: "/dashboard/similarity",
    titleKey: "tour.simSubmitTitle", bodyKey: "tour.simSubmitBody",
    advanceOn: "submit", tooltipPos: "fixed-top-right",
    actionDoneBodyKey: "tour.simSubmitDoneBody" },

  // ── Module 4 : AI Variation ──
  { target: "nav-variation", page: "any",
    titleKey: "tour.navGenTitle", bodyKey: "tour.navGenBody",
    advanceOn: "click", tooltipPos: "floating-near" },

  // AI Variation steps — tooltip placed below the target module (the
  // dropzone, mode toggle, or Launch button) so it doesn't crowd the
  // results area on the right of the page.
  { target: "gen-dropzone", page: "/dashboard/generate",
    titleKey: "tour.genDropzoneTitle", bodyKey: "tour.genDropzoneBody",
    advanceOn: "upload", tooltipPos: "floating-below",
    allowSkipStep: true /* dropzone — user may not have a file to test */ },

  { target: "gen-mode-toggle", page: "/dashboard/generate",
    titleKey: "tour.genModeTitle", bodyKey: "tour.genModeBody",
    advanceOn: "interact", tooltipPos: "floating-below" },

  { target: "gen-submit", page: "/dashboard/generate",
    titleKey: "tour.genSubmitTitle", bodyKey: "tour.genSubmitBody",
    advanceOn: "submit", tooltipPos: "floating-below",
    actionDoneBodyKey: "tour.genSubmitDoneBody",
    allowSkipStep: true /* AI submit — user may have 0 tokens */ },

  // ── Outro (right panel) ──
  { target: null, page: "any",
    titleKey: "tour.outroTitle", bodyKey: "tour.outroBody",
    advanceOn: "manual", tooltipPos: "right-panel" },
];

const PAD           = 12;   // Spotlight padding
const RIGHT_PANEL_W = 520;  // Width of full-height right panel (welcome/outro)
// Max width of inner text content for the top/bottom panels — a soft cap so
// the explanation stays readable even on wide displays. Side panels (left/
// right) rely on the panel's own width instead.
const TEXT_MAX_W    = 680;

type Rect = { top: number; left: number; width: number; height: number };

function pathMatches(pathname: string, page: string | string[] | "any"): boolean {
  if (page === "any") return pathname.startsWith("/dashboard");
  if (Array.isArray(page)) return page.some((p) => pathname === p || pathname.startsWith(p + "/"));
  return pathname === page || pathname.startsWith(page + "/");
}

/** Compute the union bounding box of all data-tour-id elements found. */
function getRect(target: string | string[] | null): Rect | null {
  if (!target || typeof document === "undefined") return null;
  const ids = Array.isArray(target) ? target : [target];
  let union: { top: number; left: number; bottom: number; right: number } | null = null;

  for (const id of ids) {
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (union == null) {
      union = { top: r.top, left: r.left, bottom: r.top + r.height, right: r.left + r.width };
    } else {
      union.top    = Math.min(union.top,    r.top);
      union.left   = Math.min(union.left,   r.left);
      union.bottom = Math.max(union.bottom, r.top + r.height);
      union.right  = Math.max(union.right,  r.left + r.width);
    }
  }

  if (!union) return null;
  return {
    top: union.top, left: union.left,
    width: union.right - union.left,
    height: union.bottom - union.top,
  };
}

function isInsideTourId(eventTarget: EventTarget | null, ids: string | string[]): boolean {
  if (!(eventTarget instanceof Element)) return false;
  const list = Array.isArray(ids) ? ids : [ids];
  for (const id of list) {
    if (eventTarget.closest(`[data-tour-id="${id}"]`)) return true;
  }
  return false;
}

/**
 * Compute a compact tooltip placement immediately next to the target rect.
 * Used for sidebar nav steps so we can keep the target visible AND clickable
 * without sacrificing a quarter of the viewport to a full-side panel.
 */
const NEAR_W   = 360;
const NEAR_H   = 220;  // rough vertical footprint
const NEAR_GAP = 16;
const NEAR_MARGIN = 16;
function nearTargetPos(
  rect: Rect,
  preference: "right" | "below" = "right",
): { top: number; left: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight :  800;

  const tryRight = () => {
    if (rect.left + rect.width + NEAR_GAP + NEAR_W <= vw - NEAR_MARGIN) {
      return {
        top:  Math.max(NEAR_MARGIN, Math.min(vh - NEAR_H - NEAR_MARGIN, rect.top + rect.height / 2 - NEAR_H / 2)),
        left: rect.left + rect.width + NEAR_GAP,
      };
    }
    return null;
  };
  const tryBelow = () => {
    if (rect.top + rect.height + NEAR_GAP + NEAR_H <= vh - NEAR_MARGIN) {
      return {
        top:  rect.top + rect.height + NEAR_GAP,
        left: Math.max(NEAR_MARGIN, Math.min(vw - NEAR_W - NEAR_MARGIN, rect.left + rect.width / 2 - NEAR_W / 2)),
      };
    }
    return null;
  };
  const tryAbove = () => {
    if (rect.top - NEAR_GAP - NEAR_H >= NEAR_MARGIN) {
      return {
        top:  rect.top - NEAR_H - NEAR_GAP,
        left: Math.max(NEAR_MARGIN, Math.min(vw - NEAR_W - NEAR_MARGIN, rect.left + rect.width / 2 - NEAR_W / 2)),
      };
    }
    return null;
  };
  const fallbackLeft = () => ({
    top:  Math.max(NEAR_MARGIN, Math.min(vh - NEAR_H - NEAR_MARGIN, rect.top + rect.height / 2 - NEAR_H / 2)),
    left: Math.max(NEAR_MARGIN, rect.left - NEAR_GAP - NEAR_W),
  });

  // Walk the chain in the order dictated by `preference`.
  const order = preference === "below"
    ? [tryBelow, tryRight, tryAbove]
    : [tryRight, tryBelow, tryAbove];
  for (const fn of order) {
    const r = fn();
    if (r) return r;
  }
  return fallbackLeft();
}

/**
 * Decide which side of the viewport the tooltip PANEL should occupy.
 *
 * The panel takes the entire side of the viewport opposite to the spotlight
 * (top half, bottom half, left side or right side — like the welcome panel).
 *
 * Rule:
 *   • If the spotlight hugs a horizontal edge (sidebar items, edge-pinned
 *     controls) → horizontal panel on the opposite side.
 *   • Otherwise (the spotlight sits somewhere in the page body) → vertical
 *     panel on the opposite half. Vertical panels feel less obtrusive than
 *     side panels for most content; they also don't force the user to shift
 *     their gaze across the entire viewport width.
 */
function computePanelSide(rect: Rect): "top" | "bottom" | "left" | "right" {
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight :  800;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  // Tight thresholds: only sidebar nav items / edge-pinned controls trigger
  // a horizontal panel. Anything past these → vertical panel.
  const FAR_LEFT  = vw * 0.22;
  const FAR_RIGHT = vw * 0.78;

  if (cx < FAR_LEFT)  return "right";
  if (cx > FAR_RIGHT) return "left";

  return cy < vh / 2 ? "bottom" : "top";
}

/** Inline style for a full-side panel of the chosen orientation. */
function panelStyle(side: "top" | "bottom" | "left" | "right"): React.CSSProperties {
  const PANEL_BG     = "rgba(10,14,40,0.985)";
  const PANEL_BORDER = "rgba(99,102,241,0.30)";
  const PANEL_SHADOW = "0 24px 80px rgba(0,0,0,0.55)";

  // Top/bottom panels are content-sized (height adapts to text+buttons) so
  // there is never an oversized dead zone above or below the content.
  // Left/right panels span the full viewport height (text vertically centered).
  if (side === "top") {
    return {
      position: "fixed", top: 0, left: 0, right: 0,
      background: PANEL_BG,
      borderBottom: `1px solid ${PANEL_BORDER}`,
      boxShadow: PANEL_SHADOW,
    };
  }
  if (side === "bottom") {
    return {
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: PANEL_BG,
      borderTop: `1px solid ${PANEL_BORDER}`,
      boxShadow: PANEL_SHADOW,
    };
  }
  if (side === "left") {
    return {
      position: "fixed", top: 0, bottom: 0, left: 0,
      width: "30vw", maxWidth: "460px", minWidth: "360px",
      background: PANEL_BG,
      borderRight: `1px solid ${PANEL_BORDER}`,
      boxShadow: PANEL_SHADOW,
    };
  }
  // right
  return {
    position: "fixed", top: 0, bottom: 0, right: 0,
    width: "30vw", maxWidth: "460px", minWidth: "360px",
    background: PANEL_BG,
    borderLeft: `1px solid ${PANEL_BORDER}`,
    boxShadow: PANEL_SHADOW,
  };
}

function isAutoAdvance(advance: AdvanceOn): boolean {
  // Click + upload + interact auto-advance: as soon as the user does the
  // action (clicks nav, drops a file, picks an option), the tour moves on
  // without requiring a Suivant click. Only "submit" stays manual so the
  // user can see the celebration message (e.g. "your images are downloading
  // — click Suivant when ready") before moving to the next module.
  return advance === "click" || advance === "upload" || advance === "interact";
}

export default function CoachmarkTour({
  initialStep = 0,
  isOnboardingActive = true,
}: {
  initialStep?: number;
  /** True when this is the first-time onboarding tour (drives DB persistence
   * + markOnboardingDone). False for rewatch-only mounting where the tour
   * is only active when the TourContext has a rewatch config. */
  isOnboardingActive?: boolean;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tourCtx  = useTour();
  const isRewatch = tourCtx.rewatch != null;

  // Effective start/end indices. Rewatch overrides the onboarding range.
  const effectiveStart = isRewatch ? tourCtx.rewatch!.startStep : initialStep;
  const effectiveEnd   = isRewatch ? tourCtx.rewatch!.endStep   : STEPS.length - 1;

  const safeInitial = Number.isFinite(effectiveStart)
    ? Math.max(0, Math.min(STEPS.length - 1, Math.floor(effectiveStart)))
    : 0;

  const [step, setStep]             = useState(safeInitial);
  const [rect, setRect]             = useState<Rect | null>(null);
  const [closed, setClosed]         = useState(false);
  const [actionDone, setActionDone] = useState(false);
  // Off-page reminder visibility — gated behind a short delay (see effect
  // below) so a quick detour to another module doesn't nag the user instantly.
  const [showOffPage, setShowOffPage] = useState(false);
  // Panel side is decided ONCE per step from the first rect we observe.
  // Subsequent rect updates (scroll, resize) re-position the spotlight ring
  // but never move the panel — the explanation stays anchored where it was
  // first shown, so the user never has to chase it across the screen.
  const [panelSide, setPanelSide] = useState<"top" | "bottom" | "left" | "right">("right");
  const sideLockedForStepRef      = useRef<number>(-1);

  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // When a rewatch is launched (or its chapter changes), jump the tour to
  // the chapter's start step and re-open if we'd previously closed.
  const lastRewatchRef = useRef<typeof tourCtx.rewatch>(null);
  useEffect(() => {
    if (tourCtx.rewatch && tourCtx.rewatch !== lastRewatchRef.current) {
      setStep(tourCtx.rewatch.startStep);
      setClosed(false);
      lastRewatchRef.current = tourCtx.rewatch;
    } else if (!tourCtx.rewatch) {
      lastRewatchRef.current = null;
    }
  }, [tourCtx.rewatch]);

  const current        = STEPS[step];
  // Total / current step shown in the tooltip header. In rewatch mode we
  // relabel relative to the chapter so the user sees "Étape 2 sur 6" within
  // their chapter instead of the absolute "Étape 8 sur 21".
  const total          = isRewatch
    ? (tourCtx.rewatch!.endStep - tourCtx.rewatch!.startStep + 1)
    : STEPS.length;
  const displayStep    = isRewatch
    ? (step - tourCtx.rewatch!.startStep + 1)
    : (step + 1);
  const onMatchingPage = pathMatches(pathname, current.page);
  const isLast         = step >= effectiveEnd;
  const isCentered     = current.target == null;
  const isRightPanel   = current.tooltipPos === "right-panel";
  // A step normally auto-advances on action, UNLESS the step config opts out
  // via `requireSuivant` (e.g. multi-choice options where the user might want
  // to tweak several before moving on).
  const autoAdvance    = isAutoAdvance(current.advanceOn) && !current.requireSuivant;

  // Reset actionDone on step change.
  useEffect(() => { setActionDone(false); }, [step]);

  // Off-page reminder is delayed ~3s: when the user leaves the step's expected
  // module for another page, we wait before nagging so a quick detour doesn't
  // trigger the popup. Returning to the page (or the step becoming centered)
  // resets the timer and hides the reminder immediately.
  const offPage = !isCentered && !onMatchingPage;
  useEffect(() => {
    if (!offPage) { setShowOffPage(false); return; }
    const id = window.setTimeout(() => setShowOffPage(true), 3000);
    return () => window.clearTimeout(id);
  }, [offPage]);

  // Lock the panel side the first time we get a rect for this step. Subsequent
  // rect changes (the user scrolling, viewport resize) do NOT move the panel.
  useEffect(() => {
    if (rect && sideLockedForStepRef.current !== step) {
      sideLockedForStepRef.current = step;
      setPanelSide(computePanelSide(rect));
    }
  }, [rect, step]);

  // Auto-scroll the spotlight target into the centre of the viewport when the
  // step changes. Saves the user from having to hunt for the highlighted
  // element below the fold (e.g. submit buttons at the bottom of a long form).
  // Fires only once per step (not on every rect refresh from resize/scroll).
  const scrolledForStepRef = useRef<number>(-1);
  useEffect(() => {
    if (!current.target) return;
    if (scrolledForStepRef.current === step) return;

    const targetIds = Array.isArray(current.target) ? current.target : [current.target];
    // Defer to let the target mount + the page to settle.
    const id = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-tour-id="${targetIds[0]}"]`);
      if (el) {
        scrolledForStepRef.current = step;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
    return () => window.clearTimeout(id);
  }, [step, current.target]);

  // Recompute target rect on step / pathname / scroll / resize / late-mount.
  useLayoutEffect(() => {
    if (closed) { setRect(null); return; }
    if (!onMatchingPage || isCentered) { setRect(null); return; }

    const update = () => setRect(getRect(current.target));
    update();

    let tries = 0;
    const id = window.setInterval(() => {
      const r = getRect(current.target);
      if (r) { setRect(r); window.clearInterval(id); }
      if (++tries > 20) window.clearInterval(id);
    }, 100);

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step, current.target, onMatchingPage, isCentered, closed, pathname]);

  // Persist step server-side (best-effort). Only in onboarding mode —
  // rewatch never touches the DB so it doesn't fight with onboarded_at.
  useEffect(() => {
    if (closed) return;
    if (isRewatch) return;
    if (!isOnboardingActive) return;
    void setTourStep(step).catch(() => {});
  }, [step, closed, isRewatch, isOnboardingActive]);

  // Event-driven action detection.
  useEffect(() => {
    if (closed) return;
    if (current.advanceOn === "manual") return;
    if (current.target == null) return;
    if (!onMatchingPage) return;

    const target = current.target;

    function advance() {
      if (stepRef.current !== step) return;
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }
    function markDone() {
      if (stepRef.current !== step) return;
      setActionDone(true);
    }

    const onClick = (e: MouseEvent) => {
      if (!isInsideTourId(e.target, target)) return;
      if (current.advanceOn === "click") {
        advance();  // nav clicks always auto-advance
      } else if (current.advanceOn === "interact") {
        // Auto-advance unless the step config forces a manual Suivant.
        if (current.requireSuivant) markDone();
        else                        advance();
      } else if (current.advanceOn === "submit") {
        // Submit only unlocks Suivant — celebration is shown first.
        markDone();
      }
    };

    const onChange = (e: Event) => {
      if (current.advanceOn !== "upload") return;
      if (isInsideTourId(e.target, target)) {
        const el = e.target as HTMLInputElement | null;
        if (el?.type === "file" && el.files && el.files.length > 0) advance();
      }
    };

    const onDrop = (e: DragEvent) => {
      if (current.advanceOn !== "upload") return;
      if (isInsideTourId(e.target, target)) {
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
          window.setTimeout(advance, 50);
        }
      }
    };

    document.addEventListener("click",  onClick,  true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("drop",   onDrop,   true);
    return () => {
      document.removeEventListener("click",  onClick,  true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("drop",   onDrop,   true);
    };
  }, [step, current.advanceOn, current.target, onMatchingPage, closed]);

  if (closed) return null;
  // If we're not in onboarding AND there's no active rewatch, render nothing.
  if (!isOnboardingActive && !isRewatch) return null;

  async function finish() {
    setClosed(true);
    if (isRewatch) {
      tourCtx.endRewatch();
    } else {
      try { await markOnboardingDone(); } catch {}
    }
  }
  function next() {
    if (isLast) { void finish(); return; }
    setStep((s) => s + 1);
  }
  function prev() {
    // Don't let the user step BEFORE the rewatch chapter's start.
    const lowerBound = isRewatch ? tourCtx.rewatch!.startStep : 0;
    if (step > lowerBound) setStep((s) => s - 1);
  }
  function skip() { void finish(); }
  /** Skip just the current step (advance without doing the action). */
  function skipStep() {
    if (isLast) { void finish(); return; }
    setStep((s) => s + 1);
  }

  const stepLabel = t("tour.stepLabel")
    .replace("{n}", String(displayStep))
    .replace("{total}", String(total));

  const canManualAdvance =
    current.advanceOn === "manual" ||
    (!autoAdvance && actionDone);

  // Pick body text: after action, use actionDoneBodyKey if defined (for submit
  // celebrations); otherwise keep the original body.
  const bodyText =
    actionDone && current.actionDoneBodyKey
      ? t(current.actionDoneBodyKey)
      : t(current.bodyKey);

  // Step-specific custom body: side-by-side comparison of the two Video
  // duplication modes. Rendered only on the "videoModes" step; other steps
  // get the default <p>{body}</p>.
  const customBody: React.ReactNode | null =
    current.titleKey === "tour.videoModesTitle" ? (
      <div className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          <div
            className="rounded-xl p-4"
            style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.22)",
            }}
          >
            <h3 className="text-sm font-semibold text-indigo-300 mb-1.5 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              {t("tour.videoModesSimpleTitle")}
            </h3>
            <p className="text-[13px] text-white/65 leading-relaxed">{t("tour.videoModesSimpleBody")}</p>
          </div>
          <div
            className="rounded-xl p-4"
            style={{
              background: "rgba(56,189,248,0.08)",
              border: "1px solid rgba(56,189,248,0.22)",
            }}
          >
            <h3 className="text-sm font-semibold text-sky-300 mb-1.5 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
              </svg>
              {t("tour.videoModesAdvancedTitle")}
            </h3>
            <p className="text-[13px] text-white/65 leading-relaxed">{t("tour.videoModesAdvancedBody")}</p>
          </div>
        </div>
        <p className="text-[13px] text-white/55 italic">{t("tour.videoModesFooter")}</p>
      </div>
    ) : null;

  // Both action hints have been removed per UX request — the disabled
  // Suivant button is the only "you need to act" signal, the green ring
  // around the focused element confirms the action was detected.
  const hintText: string | null = null;
  const hintTone: "info" | "success" = "success";

  // The discreet "Passer cette étape" link is opt-in per step. It only shows
  // on steps that explicitly set `allowSkipStep: true` (typically dropzones
  // / AI submit where the user may legitimately not be able to do the action),
  // and only before the action has been detected.
  const showSkipStep = current.allowSkipStep === true && !actionDone;

  // ── Render mode A : user is NOT on the matching page → friendly off-page
  // reminder. Replaces the step-specific copy with a kind message + a button
  // that navigates the user back to the step's expected page. The current
  // step is paused (not advanced) and the user can resume by clicking back.
  if (offPage) {
    // Delay gate: stay hidden until the user has been off the step's page for
    // ~3s (timer lives in the effect above). Avoids nagging on quick detours.
    if (!showOffPage) return null;

    // Resolve the destination URL for the "Back to module" button.
    // For "any" pages (e.g. nav-* steps) there's no specific target → button
    // is hidden (this branch normally doesn't fire for "any" steps anyway).
    const destination: string | null =
      typeof current.page === "string" && current.page !== "any"
        ? current.page
        : Array.isArray(current.page) && current.page.length > 0
          ? current.page[0]
          : null;

    return (
      <div
        className="fixed bottom-6 right-6 z-[100] pointer-events-auto"
        style={{ width: 420, maxWidth: "calc(100vw - 48px)" }}
      >
        <div
          className="rounded-2xl p-6"
          style={{
            background: "rgba(10,14,40,0.98)",
            border: "1px solid rgba(99,102,241,0.30)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.65), 0 0 60px rgba(99,102,241,0.18)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-indigo-300/85">
              {stepLabel}
            </span>
            <button
              onClick={skip}
              className="text-[11px] text-white/40 hover:text-white/75 transition"
            >
              {t("tour.skip")}
            </button>
          </div>

          <h2 className="text-lg font-semibold text-white mb-2 tracking-tight">
            {t("tour.offPageTitle")}
          </h2>
          <p className="text-sm text-white/65 leading-relaxed mb-5">
            {t("tour.offPageBody")}
          </p>

          {destination && (
            <a
              href={destination}
              className="block text-center rounded-xl py-2.5 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              {t("tour.offPageBack")}
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Render mode B : right-panel (welcome / outro) ──
  if (isCentered && isRightPanel) {
    return (
      <>
        {/* Light dim only — no blur, per UX request. */}
        <div
          className="fixed inset-0 z-[99]"
          style={{ background: "rgba(6,9,24,0.35)" }}
        />
        {/* Full-height right panel */}
        <div
          className="fixed top-0 right-0 bottom-0 z-[100] flex items-center justify-center"
          style={{
            width: RIGHT_PANEL_W,
            maxWidth: "calc(100vw - 64px)",
            background: "rgba(10,14,40,0.985)",
            borderLeft: "1px solid rgba(99,102,241,0.30)",
            boxShadow: "-24px 0 80px rgba(0,0,0,0.55)",
            padding: "32px",
          }}
        >
          <TooltipBody
            stepLabel={stepLabel}
            title={t(current.titleKey)}
            body={t(current.bodyKey)}
            hint={null}
            canManualAdvance
            showBack={step > (isRewatch ? tourCtx.rewatch!.startStep : 0)}
            isLast={isLast}
            onNext={next} onPrev={prev} onSkip={skip} onSkipStep={skipStep} showSkipStep={showSkipStep} t={t}
            large
            /* Welcome step (first manual step) — no "Passer le tour" link
               and extra room between body and the Suivant button. */
            hideSkip={current.titleKey === "tour.welcomeTitle"}
            extraBodySpacing={current.titleKey === "tour.welcomeTitle"}
          />
        </div>
      </>
    );
  }

  // ── Render mode C : centered modal (fallback for null target / no panel) ──
  if (isCentered) {
    return (
      <>
        <div
          className="fixed inset-0 z-[99]"
          style={{ background: "rgba(6,9,24,0.55)" }}
        />
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 pointer-events-none">
          <div className="pointer-events-auto" style={{ width: 480, maxWidth: "calc(100vw - 48px)" }}>
            <TooltipBody
              stepLabel={stepLabel}
              title={t(current.titleKey)}
              body={t(current.bodyKey)}
              hint={null}
              canManualAdvance
              showBack={step > (isRewatch ? tourCtx.rewatch!.startStep : 0)}
              isLast={isLast}
              onNext={next} onPrev={prev} onSkip={skip} onSkipStep={skipStep} showSkipStep={showSkipStep} t={t}
            />
          </div>
        </div>
      </>
    );
  }

  // ── Render mode D : spotlight + floating tooltip ──
  if (!rect) {
    // Target not yet in DOM — show floating in corner.
    return (
      <FloatingTooltip pos="auto" rect={null}>
        <TooltipBody
          stepLabel={stepLabel}
          title={t(current.titleKey)}
          body={bodyText}
          hint={hintText}
          hintTone={hintTone}
          canManualAdvance={canManualAdvance}
          showBack={step > (isRewatch ? tourCtx.rewatch!.startStep : 0)}
          isLast={isLast}
          onNext={next} onPrev={prev} onSkip={skip} onSkipStep={skipStep} showSkipStep={showSkipStep} t={t}
        />
      </FloatingTooltip>
    );
  }

  const top    = Math.max(0, rect.top    - PAD);
  const left   = Math.max(0, rect.left   - PAD);
  const width  = rect.width  + PAD * 2;
  const height = rect.height + PAD * 2;

  // Subtle hairline outline around the focused element — 1 px stroke + soft
  // glow. The rest of the page stays fully visible and interactive. The ring
  // turns from indigo → green once the required action has been detected.
  const ringColor =
    !autoAdvance && actionDone
      ? "0 0 0 1px rgba(34,197,94,0.55),  0 0 14px rgba(34,197,94,0.22)"
      : "0 0 0 1px rgba(99,102,241,0.55), 0 0 16px rgba(99,102,241,0.22)";

  // The explanation lives in a FULL-SIDE panel — top, bottom, left or right
  // half of the viewport. The side was decided once (panelSide state above)
  // when the first rect arrived and stays locked for the duration of the
  // step. Steps can override with an explicit tooltipPos ("top" | "bottom" |
  // "left" | "right") which wins over the auto-computed value.
  const useFixedTopRight    = current.tooltipPos === "fixed-top-right";
  const useFixedBottomRight = current.tooltipPos === "fixed-bottom-right";
  const useRightBelowTarget = current.tooltipPos === "right-below-target";
  const useFloatingNear     = current.tooltipPos === "floating-near"
                              || current.tooltipPos === "floating-below";
  const floatingPreference: "right" | "below" =
    current.tooltipPos === "floating-below" ? "below" : "right";
  const explicitSide: "top" | "bottom" | "left" | "right" | null =
    current.tooltipPos === "top"    ? "top"    :
    current.tooltipPos === "bottom" ? "bottom" :
    current.tooltipPos === "left"   ? "left"   :
    current.tooltipPos === "right"  ? "right"  : null;
  const effectivePanelSide = explicitSide ?? panelSide;

  return (
    <>
      {/* Outline ring — sits on top, doesn't block clicks. */}
      <div
        className="fixed pointer-events-none rounded-xl transition-all duration-300 z-[99]"
        style={{ top, left, width, height, boxShadow: ringColor }}
      />

      {useFixedTopRight ? (
        <div
          className="fixed top-6 right-6 z-[100] pointer-events-auto"
          style={{ width: 480, maxWidth: "calc(100vw - 48px)" }}
        >
          <TooltipBody
            stepLabel={stepLabel}
            title={t(current.titleKey)}
            body={bodyText}
            hint={hintText}
            hintTone={hintTone}
            canManualAdvance={canManualAdvance}
            showBack={step > (isRewatch ? tourCtx.rewatch!.startStep : 0)}
            isLast={isLast}
            onNext={next} onPrev={prev} onSkip={skip} onSkipStep={skipStep} showSkipStep={showSkipStep} t={t}
          />
        </div>
      ) : useFixedBottomRight ? (
        <div
          className="fixed bottom-6 right-6 z-[100] pointer-events-auto"
          style={{ width: 480, maxWidth: "calc(100vw - 48px)" }}
        >
          <TooltipBody
            stepLabel={stepLabel}
            title={t(current.titleKey)}
            body={bodyText}
            hint={hintText}
            hintTone={hintTone}
            canManualAdvance={canManualAdvance}
            showBack={step > (isRewatch ? tourCtx.rewatch!.startStep : 0)}
            isLast={isLast}
            onNext={next} onPrev={prev} onSkip={skip} onSkipStep={skipStep} showSkipStep={showSkipStep} t={t}
          />
        </div>
      ) : useRightBelowTarget ? (
        // Anchored to the right edge of the viewport, top = rect.bottom + gap.
        // Falls back to fixed-top-right if it would overflow below the fold.
        (() => {
          const vh = typeof window !== "undefined" ? window.innerHeight : 800;
          const naturalTop = rect.top + rect.height + 16;
          const fitsBelow = naturalTop + 260 <= vh - 16;
          const finalTop = fitsBelow ? naturalTop : Math.max(24, vh - 280);
          return (
            <div
              className="fixed z-[100] pointer-events-auto"
              style={{
                top: finalTop,
                right: 24,
                width: 480,
                maxWidth: "calc(100vw - 48px)",
              }}
            >
              <TooltipBody
                stepLabel={stepLabel}
                title={t(current.titleKey)}
                body={bodyText}
                hint={hintText}
                hintTone={hintTone}
                canManualAdvance={canManualAdvance}
                showBack={step > (isRewatch ? tourCtx.rewatch!.startStep : 0)}
                isLast={isLast}
                onNext={next} onPrev={prev} onSkip={skip} onSkipStep={skipStep} showSkipStep={showSkipStep} t={t}
              />
            </div>
          );
        })()
      ) : useFloatingNear ? (
        // Compact tooltip placed next to the target — does NOT cover the
        // sidebar / target, so the user can see and click it.
        (() => {
          const pos = nearTargetPos(rect, floatingPreference);
          return (
            <div
              className="fixed z-[100] pointer-events-auto"
              style={{ top: pos.top, left: pos.left, width: NEAR_W, maxWidth: "calc(100vw - 32px)" }}
            >
              <TooltipBody
                stepLabel={stepLabel}
                title={t(current.titleKey)}
                body={bodyText}
                hint={hintText}
                hintTone={hintTone}
                canManualAdvance={canManualAdvance}
                showBack={step > (isRewatch ? tourCtx.rewatch!.startStep : 0)}
                isLast={isLast}
                onNext={next} onPrev={prev} onSkip={skip} onSkipStep={skipStep} showSkipStep={showSkipStep} t={t}
              />
            </div>
          );
        })()
      ) : (
        // Full-side panel — locked to the side decided at step-start OR
        // overridden by an explicit tooltipPos. The TooltipBody renders
        // BARE inside (no nested card). The panel itself is the visual
        // container: background, border, padding here. For top/bottom
        // panels we cap the text column with maxWidth so the line length
        // stays readable on wide displays; for left/right panels the
        // panel's own width already constrains the column.
        <div
          className="z-[100] pointer-events-auto flex flex-col justify-center"
          style={{ ...panelStyle(effectivePanelSide), padding: "28px 36px" }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: effectivePanelSide === "left" || effectivePanelSide === "right" ? "100%" : TEXT_MAX_W,
              margin: effectivePanelSide === "left" || effectivePanelSide === "right" ? "0" : "0 auto",
            }}
          >
            <TooltipBody
              stepLabel={stepLabel}
              title={t(current.titleKey)}
              body={bodyText}
              customBody={customBody}
              hint={hintText}
              hintTone={hintTone}
              canManualAdvance={canManualAdvance}
              showBack={step > (isRewatch ? tourCtx.rewatch!.startStep : 0)}
              isLast={isLast}
              onNext={next} onPrev={prev} onSkip={skip} onSkipStep={skipStep} showSkipStep={showSkipStep} t={t}
              large
            />
          </div>
        </div>
      )}
    </>
  );
}

/** Off-screen fallback tooltip — fixed top-right corner. */
function FloatingTooltip({
  children,
}: {
  pos: TooltipPos;
  rect: Rect | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed top-6 right-6 z-[100] pointer-events-auto"
      style={{ width: 480, maxWidth: "calc(100vw - 48px)" }}
    >
      {children}
    </div>
  );
}

function TooltipBody({
  stepLabel, title, body, customBody, hint, hintTone = "info",
  showBack, isLast, canManualAdvance, large, showSkipStep,
  hideSkip, extraBodySpacing,
  onNext, onPrev, onSkip, onSkipStep, t,
}: {
  stepLabel: string;
  title: string;
  body: string;
  /** Optional custom body node that REPLACES the plain `body` paragraph.
   * Used by step-specific layouts (e.g. side-by-side comparison). */
  customBody?: React.ReactNode;
  hint: string | null;
  hintTone?: "info" | "success";
  showBack: boolean;
  isLast: boolean;
  canManualAdvance: boolean;
  large?: boolean;
  /** When true, render a discreet "Passer cette étape" under Suivant. */
  showSkipStep: boolean;
  /** When true, omit the "Passer le tour" link at the top-right of the header
   * (used for the very first welcome step which shouldn't tempt the user to
   * skip before even starting). */
  hideSkip?: boolean;
  /** When true, add extra breathing room between the body text and the
   * action row — used for the welcome step. */
  extraBodySpacing?: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  /** Skip just this step (advance to the next) — does NOT exit the tour. */
  onSkipStep: () => void;
  t: (k: string) => string;
}) {
  const hintColors =
    hintTone === "success"
      ? { bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.30)",  text: "rgba(134,239,172,0.95)" }
      : { bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.25)", text: "rgba(165,180,252,0.95)" };

  // In "large" mode the wrapping panel already provides the visual container
  // (background, border, shadow, padding) — TooltipBody renders bare so we
  // don't get a card-inside-a-card look. In floating mode (small fallback
  // tooltip), TooltipBody draws its own card.
  return (
    <div
      className={large ? "" : "rounded-2xl"}
      style={
        large
          ? { padding: 0, background: "transparent", border: "none", boxShadow: "none" }
          : {
              padding: "26px",
              background: "rgba(10,14,40,0.98)",
              border: "1px solid rgba(99,102,241,0.30)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.65), 0 0 60px rgba(99,102,241,0.18)",
            }
      }
    >
      <div className={`flex items-center mb-3 ${hideSkip ? "justify-start" : "justify-between"}`}>
        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-indigo-300/85">
          {stepLabel}
        </span>
        {!hideSkip && (
          <button onClick={onSkip} className="text-[11px] text-white/40 hover:text-white/75 transition">
            {t("tour.skip")}
          </button>
        )}
      </div>

      <h2
        className="font-semibold text-white mb-3 tracking-tight"
        style={{ fontSize: large ? "1.75rem" : "1.25rem", lineHeight: 1.2 }}
      >
        {title}
      </h2>
      {customBody ?? (
        <p
          className="text-white/65 leading-relaxed"
          style={{
            fontSize: large ? "1rem" : "0.925rem",
            marginBottom: extraBodySpacing ? "40px" : "16px",
          }}
        >
          {body}
        </p>
      )}

      {hint && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 mb-5"
          style={{ background: hintColors.bg, border: `1px solid ${hintColors.border}`, color: hintColors.text }}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            {hintTone === "success" ? (
              <path d="M5 12l5 5L20 7" />
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </>
            )}
          </svg>
          <span className="text-[11px] font-medium leading-snug">{hint}</span>
        </div>
      )}

      {/* Action row — render only when there's something to show.
       *  Suivant is shown ONLY when clicking it is the way to advance:
       *    • manual steps (welcome / outro / explainer panels)
       *    • action steps AFTER the required action is detected
       *  For click-to-advance steps (nav links, mode cards), the highlighted
       *  element IS the way forward — no disabled-greyed-out Suivant. */}
      {(showBack || canManualAdvance) && (
        <div className="flex gap-2">
          {showBack && (
            <button
              onClick={onPrev}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold transition"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.65)",
              }}
            >
              {t("tour.back")}
            </button>
          )}
          {canManualAdvance && (
            <button
              onClick={onNext}
              className="flex-1 rounded-xl py-2.5 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              {isLast ? t("tour.finish") : t("tour.next")} →
            </button>
          )}
        </div>
      )}

      {/* Discreet "Skip this step" — present only when Suivant isn't enabled
          (i.e. on action steps before the action is detected). Lets the user
          move on even if they don't want to do the action. */}
      {showSkipStep && !canManualAdvance && (
        <div className="mt-3 text-center">
          <button
            onClick={onSkipStep}
            className="text-[11px] text-white/30 hover:text-white/55 transition underline-offset-2 hover:underline"
          >
            {t("tour.skipStep")}
          </button>
        </div>
      )}
    </div>
  );
}
