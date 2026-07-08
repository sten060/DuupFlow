// Génère un fichier de sous-titres ASS (libass) pour BRÛLER des captions
// animées façon TikTok/OFM : petits groupes de mots, gros texte centré en
// tiers bas, contour épais, apparition/disparition en fondu, léger pop.
// Pur code, timings calés au mot près grâce à whisper (transcribe.ts).

import type { TranscriptWord } from "./transcribe";

// Résolution de référence = résolution de sortie (1080×1920).
const PLAY_W = 1080;
const PLAY_H = 1920;

// Regroupement des mots : jusqu'à MAX_WORDS mots ou MAX_CHARS caractères par
// caption affichée. 2-3 mots = look "punché" des reels performants.
const MAX_WORDS = 3;
const MAX_CHARS = 18;

interface CaptionChunk {
  startSec: number; // dans le référentiel de SORTIE (après découpe + vitesse)
  endSec: number;
  text: string;
}

/**
 * Construit le contenu d'un fichier .ass pour un extrait.
 * @param words       tous les mots de la vidéo (référentiel SOURCE)
 * @param clipStartSec début de l'extrait dans la source (0 si vidéo entière)
 * @param clipDurSec   durée de l'extrait dans la source (Infinity si entière)
 * @param rate         facteur de vitesse appliqué (setpts/atempo) — les temps
 *                     de sortie = (tSource - clipStart) / rate
 * Retourne null si aucun mot ne tombe dans l'extrait.
 */
import type { RecipeLayout } from "./types";

export interface CaptionStyle {
  accentColor?: string; // couleur du texte des captions (#RRGGBB), défaut blanc
  uppercase?: boolean; // MAJUSCULES (défaut true — look reels)
  // Mesures du montage de la référence (nb de reveals, timings, positions,
  // taille) — quand présent, le rendu REPRODUIT ces mesures.
  layout?: RecipeLayout;
}

export function buildAssForClip(
  words: TranscriptWord[],
  clipStartSec: number,
  clipDurSec: number,
  rate: number,
  style: CaptionStyle = {}
): string | null {
  const from = clipStartSec - 0.2;
  const to = clipStartSec + clipDurSec + 0.2;
  const inClip = words.filter((w) => w.endSec > from && w.startSec < to);
  if (inClip.length === 0) return null;

  // Groupage en chunks.
  const chunks: CaptionChunk[] = [];
  let buf: TranscriptWord[] = [];
  const flush = () => {
    if (buf.length === 0) return;
    const outStart = Math.max(0, (buf[0].startSec - clipStartSec) / rate);
    const outEnd = Math.max(
      outStart + 0.3,
      (buf[buf.length - 1].endSec - clipStartSec) / rate
    );
    const text = buf.map((w) => w.text).join(" ").replace(/\s+/g, " ").trim();
    chunks.push({ startSec: outStart, endSec: outEnd, text });
    buf = [];
  };
  for (const w of inClip) {
    buf.push(w);
    const chars = buf.reduce((n, x) => n + x.text.length + 1, 0);
    if (buf.length >= MAX_WORDS || chars > MAX_CHARS) flush();
  }
  flush();

  // Évite les chevauchements : une caption s'arrête quand la suivante démarre.
  for (let i = 0; i < chunks.length - 1; i++) {
    if (chunks[i].endSec > chunks[i + 1].startSec) {
      chunks[i].endSec = chunks[i + 1].startSec;
    }
  }

  const upper = style.uppercase ?? true;
  const events = chunks
    .filter((c) => c.endSec > c.startSec)
    .map(
      // Apparition INSTANTANÉE : aucun fondu ni pop.
      (c) =>
        `Dialogue: 0,${assTime(c.startSec)},${assTime(c.endSec)},Cap,,0,0,0,,` +
        assText(c.text, upper)
    )
    .join("\n");

  if (!events) return null;

  // Couleur du texte : accent de la référence si fourni, sinon blanc.
  const primary = style.accentColor
    ? hexToAssColor(style.accentColor)
    : "&H00FFFFFF";

  // Style : Montserrat/Arial gras, blanc, contour noir épais, ombre douce,
  // aligné en bas-centre (Alignment 2) remonté par MarginV (tiers bas).
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${PLAY_W}`,
    `PlayResY: ${PLAY_H}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Couleurs ASS = &HAABBGGRR. PrimaryColour = texte (accent réf ou blanc),
    // contour noir, ombre noire.
    `Style: Cap,Arial,96,${primary},&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,7,4,2,80,80,340,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    events,
  ].join("\n");
}

// ── Timing des révélations : RÈGLE UNIQUE (partagée ffmpeg + Remotion) ──────
// Les revealAtFrac de la ref sont convertis en SECONDES ABSOLUES de la ref
// (frac × refDurationSec), puis adaptés à la durée de sortie :
//   • durée_user ≤ durée_ref × 1.5 → adaptation PROPORTIONNELLE (fractions),
//     le tempo relatif de la ref est conservé ;
//   • durée_user > durée_ref × 1.5 → on garde le RYTHME ABSOLU de la ref
//     (mêmes secondes d'apparition) plutôt que d'étirer artificiellement.
export function computeRevealTimes(
  layout: RecipeLayout,
  outDurationSec: number
): number[] {
  const refDur = Math.max(1, layout.refDurationSec);
  if (outDurationSec > refDur * 1.5) {
    return layout.revealAtFrac.map((f) =>
      Math.min(f * refDur, Math.max(0, outDurationSec - 0.5))
    );
  }
  return layout.revealAtFrac.map((f) => f * outDurationSec);
}

// ── Révélation séquentielle (format "liste" OFM) ────────────────────────────
// Le hook s'affiche dès le début ; les révélations apparaissent une par une à
// intervalles réguliers et RESTENT (elles s'empilent), centrées horizontalement.
// Emojis retirés (libass ne rend pas les emojis couleur — carrés [?]).
export function buildRevealAss(
  hook: string,
  reveals: string[],
  outDurationSec: number, // durée de SORTIE (après vitesse)
  style: CaptionStyle = {}
): string | null {
  const upper = style.uppercase ?? false; // OFM = sentence case en général
  const primary = style.accentColor ? hexToAssColor(style.accentColor) : "&H00FFFFFF";
  const layout = style.layout;

  // Taille + largeur de ligne : MESURES de la référence quand disponibles.
  const fontSize = layout
    ? Math.round(layout.fontFrac * PLAY_H)
    : 64;
  const wrapAt = layout ? layout.maxCharsPerLine : 22;

  // Nettoie (échappe + retire emoji) PUIS pré-wrappe en lignes fixes (\N ASS),
  // pour connaître la hauteur réelle de chaque bloc et les empiler proprement.
  const prep = (t: string) => wrapCaptionLines(assText(stripEmojiCaption(t), upper), wrapAt);

  const hookText = prep(hook);
  const allReveals = reveals.map(prep).filter(Boolean);
  if (!hookText && allReveals.length === 0) return null;

  const end = assTime(outDurationSec);
  const lineH = Math.round(fontSize * 1.28); // interligne réel
  const blockGap = Math.round(fontSize * 0.55); // espace entre deux blocs

  // ── Timings : règle unique computeRevealTimes (secondes absolues de la ref,
  // adaptation proportionnelle ou rythme conservé). Sans référence, cadence
  // par défaut : hook seul un moment, puis lignes espacées.
  let shown: string[];
  let times: number[];
  if (layout) {
    shown = allReveals; // la ref impose le nombre — on affiche tout
    const computed = computeRevealTimes(layout, outDurationSec);
    times = shown.map((_, i) => computed[i] ?? outDurationSec * 0.8);
  } else {
    const hookHold = Math.min(2.5, outDurationSec * 0.25);
    const endMargin = 1.0;
    const minGap = 2.5;
    const usable = Math.max(0, outDurationSec - hookHold - endMargin);
    const maxFit = Math.max(0, Math.floor(usable / minGap) + (allReveals.length ? 1 : 0));
    shown = allReveals.slice(0, Math.min(allReveals.length, Math.max(1, maxFit)));
    const gap = shown.length > 1 ? usable / (shown.length - 1) : 0;
    times = shown.map((_, i) => hookHold + gap * i);
  }

  // ── Positions : hook à sa position de référence, révélations empilées à
  // partir de la position de référence, pas = hauteur RÉELLE de chaque bloc.
  const hookTop = layout
    ? layout.hookYFrac * PLAY_H
    : undefined;
  const stackTop = layout
    ? Math.max(layout.stackYFrac * PLAY_H, (hookTop ?? 0) + hookText.split("\\N").length * lineH + blockGap)
    : undefined;

  const blocks = [hookText, ...shown];
  const heights = blocks.map((b) => b.split("\\N").length * lineH);
  const tops: number[] = [];
  if (hookTop !== undefined && stackTop !== undefined) {
    tops.push(hookTop);
    let y = stackTop;
    for (let i = 1; i < blocks.length; i++) {
      tops.push(y);
      y += heights[i] + blockGap;
    }
  } else {
    // Sans référence : l'ensemble centré verticalement.
    const totalH = heights.reduce((a, b) => a + b, 0) + blockGap * (blocks.length - 1);
    let y = Math.max(PLAY_H * 0.12, (PLAY_H - totalH) / 2);
    for (let i = 0; i < blocks.length; i++) {
      tops.push(y);
      y += heights[i] + blockGap;
    }
  }

  const events: string[] = [
    dialogue(0, outDurationSec, tops[0], hookText, end),
  ];
  const mode = layout?.mode ?? "stack";
  if (mode === "replace") {
    // Mode REMPLACEMENT : chaque révélation prend la place de la précédente,
    // à la MÊME position (stackTop) ; sa fin = début de la suivante.
    const top = tops[1] ?? tops[0];
    shown.forEach((line, i) => {
      const until = i + 1 < shown.length ? assTime(times[i + 1]) : end;
      events.push(dialogue(times[i], outDurationSec, top, line, until));
    });
  } else {
    // Mode ACCUMULATION (défaut) : les révélations s'empilent et restent.
    shown.forEach((line, i) => {
      events.push(dialogue(times[i], outDurationSec, tops[i + 1], line, end));
    });
  }

  return assDoc(primary, fontSize, events.join("\n"));
}

// Retour à la ligne "mot entier" → lignes séparées par "\N" (saut de ligne ASS).
// Max 3 lignes (au-delà on laisse libass gérer la dernière).
function wrapCaptionLines(text: string, maxChars: number): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3).join("\\N");
}

// Un événement Dialogue positionné (centre horizontal, top-center + \pos),
// avec fondu + léger pop en entrée.
function dialogue(
  startSec: number,
  _endSec: number,
  y: number,
  text: string,
  endStamp: string
): string {
  // Apparition INSTANTANÉE : aucun fondu ni pop (juste ancrage + position).
  return (
    `Dialogue: 0,${assTime(startSec)},${endStamp},Cap,,0,0,0,,` +
    `{\\an8\\pos(${Math.round(PLAY_W / 2)},${Math.round(y)})}` +
    text
  );
}

// Document ASS commun. fontSize paramétrable (mesuré sur la référence).
function assDoc(primaryColour: string, fontSize: number, events: string): string {
  const outline = Math.max(3, Math.round(fontSize / 11));
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${PLAY_W}`,
    `PlayResY: ${PLAY_H}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Cap,Arial,${fontSize},${primaryColour},&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,${outline},3,8,90,90,60,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    events,
  ].join("\n");
}

// Comme stripEmoji de pipeline.ts mais local (libass ne rend pas les emojis).
function stripEmojiCaption(text: string): string {
  return text
    .replace(
      /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Secondes → "H:MM:SS.cc" (centisecondes), format ASS.
function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(
    Math.min(99, cs)
  ).padStart(2, "0")}`;
}

// Échappe le texte pour ASS (+ MAJUSCULES optionnelles, look reels).
function assText(text: string, uppercase: boolean): string {
  const t = text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/\r?\n/g, " ");
  return uppercase ? t.toUpperCase() : t;
}

// #RRGGBB → couleur ASS &H00BBGGRR (ordre inversé, alpha opaque).
function hexToAssColor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return "&H00FFFFFF";
  const r = m[1].slice(0, 2);
  const g = m[1].slice(2, 4);
  const b = m[1].slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}
