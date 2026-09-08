/**
 * Repérage à l'écran : trouver la zone à surligner, poser la bulle à côté.
 *
 * Extrait de ModuleCoach pour être partagé avec le PARCOURS GUIDÉ, qui a
 * exactement les mêmes besoins — deux copies de ce calcul, ce serait deux
 * placements qui divergent au premier ajustement.
 */

export type Rect = { top: number; left: number; width: number; height: number };

/** Union bounding box of all data-tour-id anchors found for this step. */
export function getRect(ids: string[]): Rect | null {
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

export const CARD_W = 340;
export const CARD_H = 200; // rough footprint for fit checks
const GAP = 16;
const MARGIN = 16;

/** Place the tooltip next to the target without covering it. */
export function placeNear(rect: Rect, preference: "right" | "below"): { top: number; left: number } {
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
