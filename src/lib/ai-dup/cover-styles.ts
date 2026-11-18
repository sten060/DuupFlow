// src/lib/ai-dup/cover-styles.ts
//
// ── STYLES COMPOSÉS : POLICE × FORME DE BLOC × COULEUR ───────────────────────
// Trois boîtes figées (seule la couleur changeait) faisaient des copies qui
// se ressemblaient toutes (retour Sten, 16/11). Un style se COMPOSE donc de
// trois choix indépendants, faits par Claude pour chaque copie :
//   · la police, parmi celles du catalogue de l'Éditeur IA qui restent
//     lisibles en caption (la classique Inter en tête) ;
//   · la forme du bloc : bandeau ligne par ligne (le texte natif d'Instagram /
//     TikTok), bloc arrondi, bloc à angles droits, pilule ;
//   · la couleur (fond + texte assorti).
// 5 polices × 4 formes × 5 couleurs = 100 combinaisons.
//
// Identifiants : « cover:<couleur>:<forme>:<police> » pour une boîte de
// réécriture ; « <style>@<police> » pour changer la police d'un style de la
// famille classique. presetById() les résout tous en TextPreset.

import { PRESET_BY_ID, type TextPreset } from "./text-presets";
import type { CaptionFont } from "@/lib/ai-editor/font-catalog";

/** Polices de caption : graisse retenue et largeur moyenne d'un caractère
 *  (em), MESURÉE sur des phrases françaises (marge de +0,01 comprise). */
export const TEXT_FONTS = {
  sans:      { weight: 500, cw: 0.50, label: "typo classique" },  // Inter
  grotesk:   { weight: 600, cw: 0.54, label: "typo Montserrat" },
  geometric: { weight: 600, cw: 0.52, label: "typo Poppins" },
  rounded:   { weight: 600, cw: 0.47, label: "typo arrondie" },   // Fredoka
  black:     { weight: 400, cw: 0.57, label: "typo très grasse" }, // Archivo Black
} as const satisfies Partial<Record<CaptionFont, { weight: number; cw: number; label: string }>>;
export type TextFontKey = keyof typeof TEXT_FONTS;
export const TEXT_FONT_KEYS = Object.keys(TEXT_FONTS) as TextFontKey[];

export const COVER_COLORS = {
  white:  { bg: "#FFFFFF", fg: "#111111", label: "blanc" },
  black:  { bg: "#111111", fg: "#FFFFFF", label: "noir" },
  pink:   { bg: "#FF3D7F", fg: "#FFFFFF", label: "rose" },
  yellow: { bg: "#FFD60A", fg: "#111111", label: "jaune" },
  blue:   { bg: "#2F6BFF", fg: "#FFFFFF", label: "bleu" },
} as const;
export type CoverColor = keyof typeof COVER_COLORS;
export const COVER_COLOR_KEYS = Object.keys(COVER_COLORS) as CoverColor[];

export const COVER_SHAPES = {
  lines:   { label: "bandeau ligne par ligne", radius: 14, lines: true },
  rounded: { label: "bloc arrondi", radius: 26, lines: false },
  square:  { label: "bloc à angles droits", radius: 0, lines: false },
  pill:    { label: "pilule", radius: 999, lines: false },
} as const;
export type CoverShape = keyof typeof COVER_SHAPES;
export const COVER_SHAPE_KEYS = Object.keys(COVER_SHAPES) as CoverShape[];

/** Styles dont la police peut être changée (famille classique, sobres). */
const FONT_SWAPPABLE = new Set(["classic-white", "white-box", "black-box"]);

export const coverId = (color: CoverColor, shape: CoverShape, font: TextFontKey) => `cover:${color}:${shape}:${font}`;

export function parseCoverId(id: string): { color: CoverColor; shape: CoverShape; font: TextFontKey } | null {
  const [k, color, shape, font] = id.split(":");
  if (k !== "cover" || !(color in COVER_COLORS) || !(shape in COVER_SHAPES) || !(font in TEXT_FONTS)) return null;
  return { color: color as CoverColor, shape: shape as CoverShape, font: font as TextFontKey };
}

/** Taille de base d'une boîte de réécriture : la police grandit ensuite pour
 *  remplir la place de l'ancienne caption (replace-caption.ts). */
const COVER_FONT_PX = 64;

function coverPreset(id: string): TextPreset | undefined {
  const p = parseCoverId(id);
  if (!p) return undefined;
  const c = COVER_COLORS[p.color], s = COVER_SHAPES[p.shape], f = TEXT_FONTS[p.font];
  return {
    id, kinds: ["cover"], fontSize: COVER_FONT_PX, charWidth: f.cw,
    label: `${s.label} ${c.label}, ${f.label}`,
    desc: `${s.label} ${c.label}, ${f.label}`,
    caption: {
      style: "box", background: c.bg, backgroundOpacity: 1, color: c.fg,
      font: p.font, fontWeight: f.weight, borderRadius: s.radius,
      paddingX: 22, paddingY: s.lines ? 8 : 12,
      ...(s.lines ? { boxShape: "lines" as const } : {}),
    },
  };
}

/** Style classique avec une autre police : « white-box@grotesk ». */
function swappedPreset(id: string): TextPreset | undefined {
  const [base, font] = id.split("@");
  const p = PRESET_BY_ID.get(base);
  if (!p || !(font in TEXT_FONTS) || !FONT_SWAPPABLE.has(base)) return undefined;
  const f = TEXT_FONTS[font as TextFontKey];
  return { ...p, id, charWidth: f.cw, label: `${p.label}, ${f.label}`, caption: { ...p.caption, font: font as TextFontKey, fontWeight: f.weight } };
}

/** Résout n'importe quel identifiant de style (simple, composé, ou avec police). */
export function presetById(id: string | undefined): TextPreset | undefined {
  if (!id) return undefined;
  return PRESET_BY_ID.get(id) ?? coverPreset(id) ?? swappedPreset(id);
}

/** Applique une police à un style si c'est permis (sinon renvoie le style tel quel). */
export function withFont(presetId: string, font: string | undefined): string {
  if (!font || !(font in TEXT_FONTS) || font === "sans" || !FONT_SWAPPABLE.has(presetId)) return presetId;
  return `${presetId}@${font}`;
}

/** Lignes du prompt : les trois listes de choix. */
export function styleChoiceLines(): string {
  return [
    `- polices (font) : ${TEXT_FONT_KEYS.map((k) => `${k} = ${TEXT_FONTS[k].label}`).join(" ; ")}`,
    `- formes de bloc (shape) : ${COVER_SHAPE_KEYS.map((k) => `${k} = ${COVER_SHAPES[k].label}`).join(" ; ")}`,
    `- couleurs (color) : ${COVER_COLOR_KEYS.map((k) => `${k} = ${COVER_COLORS[k].label}`).join(" ; ")}`,
  ].join("\n");
}
