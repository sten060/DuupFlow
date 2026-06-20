"use client";

/**
 * Per-module coach — the one-time short walkthrough shown the first time a
 * user opens a module. Points at the essentials (where to drop, what to set,
 * where to launch) with a soft spotlight + a compact tooltip. Non-blocking:
 * the page stays fully usable; the user can step through or skip.
 *
 * Shows once per module (marked seen on first appearance). The "Revoir la
 * visite" menu can force it back open for any module.
 *
 * Mounted in the dashboard layout so it survives navigations.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { moduleForPath, type OnboardingModule } from "./modules";
import { useOnboarding } from "./OnboardingProvider";

type Rect = { top: number; left: number; width: number; height: number };

/** Union bounding box of all data-tour-id anchors found for this step. */
function getRect(ids: string[]): Rect | null {
  if (typeof document === "undefined") return null;
  let u: { top: number; left: number; bottom: number; right: number } | null = null;
  for (const id of ids) {
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (!u) u = { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
    else {
      u.top = Math.min(u.top, r.top);
      u.left = Math.min(u.left, r.left);
      u.bottom = Math.max(u.bottom, r.bottom);
      u.right = Math.max(u.right, r.right);
    }
  }
  if (!u) return null;
  return { top: u.top, left: u.left, width: u.right - u.left, height: u.bottom - u.top };
}

const CARD_W = 340;
const CARD_H = 200; // rough footprint for fit checks
const GAP = 16;
const MARGIN = 16;

/** Place the tooltip next to the target without covering it. */
function placeNear(rect: Rect, preference: "right" | "below"): { top: number; left: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const clampTop = (t: number) => Math.max(MARGIN, Math.min(vh - CARD_H - MARGIN, t));
  const clampLeft = (l: number) => Math.max(MARGIN, Math.min(vw - CARD_W - MARGIN, l));

  // Very tall target (e.g. the whole settings + filters block): don't try to
  // sit beside it — pin the card to the top-right corner so it never covers the
  // sidebar or drifts far from view.
  if (rect.height > vh * 0.7) {
    return { top: MARGIN, left: vw - CARD_W - MARGIN };
  }

  const right = () =>
    rect.left + rect.width + GAP + CARD_W <= vw - MARGIN
      ? { top: clampTop(rect.top + rect.height / 2 - CARD_H / 2), left: rect.left + rect.width + GAP }
      : null;
  const below = () =>
    rect.top + rect.height + GAP + CARD_H <= vh - MARGIN
      ? { top: rect.top + rect.height + GAP, left: clampLeft(rect.left + rect.width / 2 - CARD_W / 2) }
      : null;
  const above = () =>
    rect.top - GAP - CARD_H >= MARGIN
      ? { top: rect.top - CARD_H - GAP, left: clampLeft(rect.left + rect.width / 2 - CARD_W / 2) }
      : null;
  const left = () =>
    rect.left - GAP - CARD_W >= MARGIN
      ? { top: clampTop(rect.top + rect.height / 2 - CARD_H / 2), left: rect.left - GAP - CARD_W }
      : null;

  const order = preference === "below" ? [below, right, above, left] : [right, below, above, left];
  for (const fn of order) {
    const r = fn();
    if (r) return r;
  }
  // Last resort: bottom-right corner.
  return { top: vh - CARD_H - MARGIN, left: vw - CARD_W - MARGIN };
}

export default function ModuleCoach() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { enabled, isSeen, markSeen, forcedModule, clearForcedModule } = useOnboarding();

  // active = the coach currently running (may differ from the page once the
  // user starts stepping; cleared on finish/skip/navigation-away).
  const [active, setActive] = useState<{ mod: OnboardingModule; forced: boolean } | null>(null);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Latest "seen" reader so the activation effect can stay keyed only on
  // pathname / forcedModule (avoids re-running when progress updates).
  const isSeenRef = useRef(isSeen);
  isSeenRef.current = isSeen;

  // Decide whether to start / switch / stop a coach when the route or a forced
  // replay changes.
  useEffect(() => {
    if (!enabled && forcedModule == null) {
      setActive(null);
      return;
    }
    const mod = moduleForPath(pathname);

    // Forced replay: only activate once we've actually landed on its route.
    if (forcedModule) {
      if (mod && mod.key === forcedModule && mod.steps.length > 0) {
        setActive({ mod, forced: true });
        setStep(0);
      }
      return; // mid-navigation to the forced module → wait
    }

    if (mod && mod.steps.length > 0 && !isSeenRef.current(mod.key)) {
      setActive({ mod, forced: false });
      setStep(0);
      markSeen(mod.key); // first open → never auto-show again
    } else if (!mod) {
      setActive(null); // left the modules area
    } else {
      setActive(null); // revisiting an already-seen module
    }
  }, [pathname, forcedModule, enabled, markSeen]);

  const current = active?.mod.steps[step] ?? null;

  // Scroll the target into view once when the step changes.
  useEffect(() => {
    if (!current) return;
    const id = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-tour-id="${current.target[0]}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(id);
  }, [current]);

  // Track the target rect (late mount, scroll, resize).
  useLayoutEffect(() => {
    if (!current) {
      setRect(null);
      return;
    }
    const update = () => setRect(getRect(current.target));
    update();
    let tries = 0;
    const poll = window.setInterval(() => {
      const r = getRect(current.target);
      if (r) {
        setRect(r);
        window.clearInterval(poll);
      }
      if (++tries > 20) window.clearInterval(poll);
    }, 100);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [current]);

  if (!active || !current) return null;

  const total = active.mod.steps.length;
  const isLast = step >= total - 1;
  const accent = active.mod.accent;

  function finish() {
    if (active) markSeen(active.mod.key); // idempotent; also covers forced replays
    setActive(null);
    setStep(0);
    if (active?.forced) clearForcedModule();
  }
  function next() {
    if (isLast) finish();
    else setStep((s) => s + 1);
  }

  const pos = rect ? placeNear(rect, current.placement ?? "right") : null;
  const PAD = 10;

  return (
    <>
      {/* Soft spotlight ring — decorative, never blocks clicks. */}
      {rect && (
        <div
          className="fixed pointer-events-none rounded-xl z-[99]"
          style={{
            top: Math.max(0, rect.top - PAD),
            left: Math.max(0, rect.left - PAD),
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: `0 0 0 1px ${accent}88, 0 0 0 4px ${accent}22, 0 0 22px ${accent}33`,
            transition: "all .3s cubic-bezier(.16,1,.3,1)",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="fixed z-[100] pointer-events-auto"
        style={
          pos
            ? { top: pos.top, left: pos.left, width: CARD_W, maxWidth: "calc(100vw - 32px)" }
            : { bottom: 24, right: 24, width: CARD_W, maxWidth: "calc(100vw - 32px)" }
        }
      >
        <div
          className="rounded-2xl p-5"
          style={{
            background: "rgba(10,14,40,0.985)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            {/* Step dots — only when the module has more than one step. */}
            {total > 1 ? (
              <div className="flex items-center gap-1.5">
                {active.mod.steps.map((_, i) => (
                  <span
                    key={i}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: i === step ? 18 : 6,
                      height: 6,
                      background: i === step ? accent : i < step ? `${accent}80` : "rgba(255,255,255,0.16)",
                    }}
                  />
                ))}
              </div>
            ) : (
              <span />
            )}
            <button
              onClick={finish}
              className="text-[11px] text-white/40 hover:text-white/75 transition"
            >
              {t("onb.skip")}
            </button>
          </div>

          <h3 className="text-base font-semibold text-white mb-1.5 tracking-tight">
            {t(current.titleKey)}
          </h3>
          <p className="text-[13px] text-white/60 leading-relaxed mb-4">
            {t(current.bodyKey)}
          </p>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold transition"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.65)",
                }}
              >
                {t("onb.back")}
              </button>
            )}
            <button
              onClick={next}
              className="flex-1 rounded-xl py-2 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              {isLast ? t("onb.done") : t("onb.next")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
