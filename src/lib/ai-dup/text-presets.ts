// src/lib/ai-dup/text-presets.ts
//
// ── STYLES DE TEXTE PRÊTS À L'EMPLOI ─────────────────────────────────────────
// Le planificateur (Claude) CHOISIT un style par son id ; il n'invente jamais
// de couleurs, polices ou tailles. Raison : un style libre produit tôt ou tard
// du texte illisible (blanc sans contour sur fond clair, police fantaisie
// minuscule) — la liste fermée garantit la lisibilité sur n'importe quelle image.
//
// Ajouter un style = une entrée ici. `label` sert au résumé affiché sous la
// copie (« caption haut-gauche style jaune »). Tailles en px pour une largeur
// de 1080 (même convention que EditCaption.fontSize).

import type { EditCaption } from "@/lib/ai-editor/plan-types";

export type TextPreset = {
  id: string;
  /** Nom court affiché au user (« style jaune »). */
  label: string;
  /** Une phrase pour aider Claude à choisir. */
  desc: string;
  /** Usages autorisés. « cover » = boîte qui CACHE la caption d'origine
   *  (réécriture) : fond plein, marges serrées, jamais tirée ailleurs. */
  kinds: ("caption" | "subtitles" | "cover")[];
  /** Taille de base (px @1080). Le placement peut la réduire pour tenir. */
  fontSize: number;
  /** Largeur moyenne d'un caractère / taille de police (estimation du gabarit). */
  charWidth: number;
  /** Réglages passés tels quels au moteur de l'Éditeur IA. */
  caption: Omit<EditCaption, "text" | "startSec" | "endSec">;
};

const OUTLINE = { style: "outline" as const, strokeColor: "#000000", strokeWidth: 6 };

/* Typo PAR DÉFAUT = la « classique » d'Instagram / TikTok : Inter en graisse
 * moyenne (500), droite, sobre (choix de Sten, 16/11, d'après une capture du
 * texte natif). Largeur moyenne mesurée : 0,44 em → 0,47 avec marge. Les
 * styles plus marqués restent pour varier quand la vidéo s'y prête. */
const CLASSIC = { font: "sans" as const, fontWeight: 500 };
const CLASSIC_CW = 0.47;

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: "classic-white", label: "style classique", kinds: ["caption", "subtitles"],
    desc: "PAR DÉFAUT — la typo classique d'Instagram/TikTok : blanc, graisse moyenne, ombre légère",
    fontSize: 58, charWidth: CLASSIC_CW,
    caption: { ...CLASSIC, color: "#FFFFFF", strokeWidth: 0, shadowColor: "#000000", shadowBlur: 10, shadowOffset: 2 },
  },
  {
    id: "white-outline", label: "style blanc", kinds: ["caption", "subtitles"],
    desc: "blanc gras, contour noir — le classique TikTok, lisible partout",
    fontSize: 62, charWidth: 0.58,
    caption: { ...OUTLINE, color: "#FFFFFF", font: "sans", fontWeight: 800 },
  },
  {
    id: "yellow-outline", label: "style jaune", kinds: ["caption", "subtitles"],
    desc: "jaune vif, contour noir — accrocheur",
    fontSize: 62, charWidth: 0.58,
    caption: { ...OUTLINE, color: "#FFD60A", font: "sans", fontWeight: 900 },
  },
  {
    id: "white-box", label: "style boîte blanche", kinds: ["caption", "subtitles"],
    desc: "typo classique, texte noir sur boîte blanche arrondie — style natif Instagram/TikTok",
    fontSize: 56, charWidth: CLASSIC_CW,
    caption: { style: "box", background: "#FFFFFF", color: "#000000", ...CLASSIC, borderRadius: 16, paddingX: 22, paddingY: 12 },
  },
  {
    id: "black-box", label: "style boîte noire", kinds: ["caption", "subtitles"],
    desc: "typo classique, texte blanc sur boîte noire semi-opaque — sobre",
    fontSize: 54, charWidth: CLASSIC_CW,
    caption: { style: "box", background: "#000000", backgroundOpacity: 0.7, color: "#FFFFFF", ...CLASSIC, borderRadius: 14, paddingX: 22, paddingY: 12 },
  },
  {
    id: "rounded-pop", label: "style arrondi", kinds: ["caption", "subtitles"],
    desc: "police arrondie amicale, blanc contour noir — style CapCut",
    fontSize: 64, charWidth: 0.56,
    caption: { ...OUTLINE, color: "#FFFFFF", font: "rounded", fontWeight: 700 },
  },
  {
    id: "impact-caps", label: "style majuscules", kinds: ["caption"],
    desc: "grosses majuscules condensées blanches — hook percutant, textes COURTS",
    fontSize: 78, charWidth: 0.42,
    caption: { ...OUTLINE, color: "#FFFFFF", font: "heavy", fontWeight: 400, textTransform: "uppercase" },
  },
  {
    id: "sticker-pink", label: "style sticker rose", kinds: ["caption"],
    desc: "sticker rose très arrondi, texte blanc — ludique",
    fontSize: 54, charWidth: 0.56,
    caption: { style: "sticker", background: "#FF3D7F", color: "#FFFFFF", font: "geometric", fontWeight: 800 },
  },
  {
    id: "neon-cyan", label: "style néon", kinds: ["caption"],
    desc: "blanc avec halo néon cyan — ambiance nuit / tech",
    fontSize: 60, charWidth: 0.58,
    caption: { color: "#FFFFFF", font: "geometric", fontWeight: 800, strokeColor: "#000000", strokeWidth: 3, glow: { color: "#00E5FF", intensity: 0.8 } },
  },
  {
    id: "handwritten", label: "style manuscrit", kinds: ["caption"],
    desc: "manuscrit blanc, ombre douce — perso, authentique",
    fontSize: 72, charWidth: 0.45,
    caption: { color: "#FFFFFF", font: "script", fontWeight: 700, shadowColor: "#000000", shadowBlur: 12, shadowOffset: 3 },
  },
  {
    id: "karaoke-yellow", label: "style karaoké", kinds: ["subtitles"],
    desc: "sous-titres blancs, le mot prononcé passe en jaune",
    fontSize: 60, charWidth: 0.58,
    caption: { ...OUTLINE, color: "#FFFFFF", font: "sans", fontWeight: 900, animation: "karaoke", highlightColor: "#FFD60A" },
  },
];

/* Boîtes de REMPLACEMENT (réécriture de la caption d'origine). Leur taille
 * est imposée par l'ancienne caption ; c'est la POLICE qui grandit pour la
 * remplir (replace-caption.ts), avec des marges serrées comme le texte natif
 * d'Instagram / TikTok. Typo classique (Inter 500), comme le reste. */
const COVER_BASE = { style: "box" as const, ...CLASSIC, backgroundOpacity: 1, borderRadius: 18, paddingX: 22, paddingY: 12 };
TEXT_PRESETS.push(
  {
    id: "cover-white", label: "boîte blanche", kinds: ["cover"],
    desc: "texte noir sur boîte blanche arrondie — le texte natif d'Instagram / TikTok",
    fontSize: 64, charWidth: CLASSIC_CW,
    caption: { ...COVER_BASE, background: "#FFFFFF", color: "#111111" },
  },
  {
    id: "cover-black", label: "boîte noire", kinds: ["cover"],
    desc: "texte blanc sur boîte noire arrondie — sobre",
    fontSize: 64, charWidth: CLASSIC_CW,
    caption: { ...COVER_BASE, background: "#111111", color: "#FFFFFF" },
  },
  {
    id: "cover-pink", label: "boîte rose", kinds: ["cover"],
    desc: "texte blanc sur boîte rose vif — ludique",
    fontSize: 64, charWidth: CLASSIC_CW,
    caption: { ...COVER_BASE, background: "#FF3D7F", color: "#FFFFFF" },
  },
);

export const PRESET_BY_ID = new Map(TEXT_PRESETS.map((p) => [p.id, p]));

export function presetsFor(kind: "caption" | "subtitles" | "cover"): TextPreset[] {
  return TEXT_PRESETS.filter((p) => p.kinds.includes(kind));
}

/** Liste lisible par Claude (id = description), pour un usage donné. */
export function presetCatalogLines(kind: "caption" | "subtitles" | "cover"): string {
  return presetsFor(kind).map((p) => `- ${p.id} : ${p.desc}`).join("\n");
}
