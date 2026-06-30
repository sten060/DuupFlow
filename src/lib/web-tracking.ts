/**
 * Anonymous LP behaviour tracking.
 *
 * track() sends an event to /api/track-event carrying the SAME visitor_id as
 * acquisition_clicks (getOrCreateVisitorId → localStorage "acq_visitor_id"),
 * so an anonymous arrival can be joined to the actions that follow it.
 *
 * startAutocapture() wires global scroll-depth + click listeners once.
 * Browser-only — every entry point guards `window`.
 */

import { getOrCreateVisitorId } from "@/lib/acquisition";

export type Track = (name: string, context: Record<string, unknown>) => void;

/** Fire-and-forget an event with the shared visitor_id. */
export const track: Track = (name, context) => {
  if (typeof window === "undefined") return;
  try {
    const visitor_id = getOrCreateVisitorId();
    if (!visitor_id) return;
    fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, visitor_id, context }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the page.
  }
};

/**
 * Mount global autocapture once. Emits:
 *   • scroll_depth { path, surface, depth }  on the FIRST scroll (palier "any",
 *     dès scrollY>150 ou pct>=10) puis aux paliers 25/50/75/90%.
 *   • click        { path, surface, label, href? }  on any a/button/[role=button]/[data-track]
 *   • click        { path, surface, label:"(clic mort) …", dead:true }  on non-interactive
 *     elements — a strong UX-friction signal.
 * Objectif : un visiteur qui scrolle un peu ou clique quoi que ce soit n'est
 * plus compté comme inactif. Resets on SPA navigation (pushState / popstate).
 */
export function startAutocapture(track: Track) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __ac?: boolean };
  if (w.__ac) return;
  w.__ac = true;

  const base = () => ({ path: location.pathname, surface: "marketing" });

  const fired = new Set<string>();
  let t: ReturnType<typeof setTimeout>;
  const onScroll = () => {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    const pct = Math.round((window.scrollY / max) * 100);
    if (!fired.has("any") && (window.scrollY > 150 || pct >= 10)) {
      fired.add("any");
      track("scroll_depth", { ...base(), depth: Math.max(pct, 1) });
    }
    for (const m of [25, 50, 75, 90]) {
      if (pct >= m && !fired.has(String(m))) {
        fired.add(String(m));
        track("scroll_depth", { ...base(), depth: m });
      }
    }
  };
  window.addEventListener(
    "scroll",
    () => {
      clearTimeout(t);
      t = setTimeout(onScroll, 200);
    },
    { passive: true }
  );

  // CLICS : capte TOUT clic, y compris les "clics morts" (sur du non-cliquable = friction)
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("a, button, [role=button], [data-track]");
      if (el) {
        const label =
          el.getAttribute("data-track") ||
          (el.textContent || "").trim().slice(0, 60) ||
          el.getAttribute("aria-label") ||
          "(sans texte)";
        const href = el.getAttribute("href");
        track("click", { ...base(), label, ...(href ? { href } : {}) });
      } else {
        const tag = target.tagName.toLowerCase();
        if (tag === "html" || tag === "body") return; // ignore les clics dans le vide
        const txt = (target.textContent || "").trim().slice(0, 40);
        track("click", { ...base(), label: "(clic mort) " + (txt || tag), dead: true });
      }
    },
    { capture: true }
  );

  const reset = () => {
    fired.clear();
  };
  const push = history.pushState;
  history.pushState = function (...a) {
    reset();
    return push.apply(this, a as Parameters<typeof history.pushState>);
  };
  window.addEventListener("popstate", reset);
}
