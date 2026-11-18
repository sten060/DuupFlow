// src/lib/ai-dup/summary.ts
//
// Résumé court affiché sous chaque copie, en langage du user :
//   « Recadrage 4 %, vitesse ×1,03, caption haut-gauche style jaune,
//     métadonnées iPhone 15 »
// Pas de jargon (pas de « grade », « offset », « preset ») et seulement ce qui
// se remarque ou compte : la couleur n'est mentionnée que si elle bouge.

import { presetById } from "./cover-styles";
import type { CopyPlan, TextAnchor } from "./types";

const ROW: Record<string, string> = { top: "haut", middle: "milieu", bottom: "bas" };
const COL: Record<string, string> = { left: "gauche", center: "centre", right: "droite" };

export function anchorLabel(a: TextAnchor): string {
  const [r, c] = a.split("-");
  return c === "center" ? (r === "middle" ? "centre" : `en ${ROW[r]}`) : `${ROW[r]}-${COL[c]}`;
}

const frNum = (n: number, digits: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits });

export function summarizeCopy(copy: CopyPlan, deviceLabel?: string): string {
  const parts: string[] = [];
  const v = copy.visual;
  if (v) {
    parts.push(`Recadrage ${frNum(v.cropPct, 1)} %`);
    if (Math.abs(v.speed - 1) >= 0.005) parts.push(`vitesse ×${frNum(v.speed, 2)}`);
    const c = v.color;
    const colorMoved = Math.abs(c.saturation - 1) >= 0.02 || Math.abs(c.contrast - 1) >= 0.02 || Math.abs(c.brightness) >= 0.01 || Math.abs(c.temperature) >= 0.03;
    if (colorMoved) parts.push(c.temperature >= 0.03 ? "couleurs plus chaudes" : c.temperature <= -0.03 ? "couleurs plus froides" : "couleurs ajustées");
  }
  for (const t of copy.texts) {
    const style = presetById(t.preset)?.label ?? "";
    if (t.replaces) parts.push(`caption d'origine réécrite « ${t.text} » ${style}`.trim());
    else if (t.kind === "caption") parts.push(`caption ${anchorLabel(t.anchor)} ${style}`.trim());
    else {
      const anchors = [...new Set((t.windows ?? []).map((w) => anchorLabel(w.anchor)))];
      parts.push(`sous-titres ${anchors.join(" puis ")} ${style}`.trim());
    }
  }
  parts.push(deviceLabel ? `métadonnées ${deviceLabel}` : "métadonnées neuves");
  if (!v && !copy.texts.length) parts.unshift("Aucune modification visible");
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
