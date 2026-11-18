// src/app/dashboard/videos/text-overlay.ts
//
// ── TEXTES SUR LES DUPLICATIONS (mode Simple, BETA) — côté serveur ───────────
// Réglages : src/lib/text-overlay-config.ts (partagés avec l'aperçu). Ici,
// pour UNE copie :
//   · CAPTION : dessinée en PNG par le moteur de l'Éditeur IA (captionPng :
//     polices, fonds, bandeau ligne par ligne), rognée, posée en incrustation
//     (overlays.ts) pendant sa fenêtre de temps ;
//   · SOUS-TITRES : une PISTE vidéo transparente. Karaoké et mot par mot
//     demandent une image par mot (des centaines pour 2 min) : une incrustation
//     par image ferait exploser le filtergraph. On dessine donc chaque état
//     (bloc, mot actif…) dans une BANDE de hauteur fixe, on assemble les
//     images avec leurs durées (concat FFmpeg) en un .mov avec transparence,
//     et la copie n'a qu'UNE incrustation de plus.
// Les copies qui tombent sur le même style de sous-titres réutilisent la même
// piste (cache par lancement), et la voix est transcrite UNE fois par vidéo.

import fs from "node:fs/promises";
import path from "node:path";
import type { EditCaption } from "@/lib/ai-editor/plan-types";
import type { VideoOverlay } from "@/app/dashboard/videos/overlays";
import {
  TEXT_FONTS, isLight, captionVariant, subtitleVariant, captionCenter, subtitleCenter,
  type TextOverlayConfig, type CaptionVariant, type SubtitleVariant,
} from "@/lib/text-overlay-config";

type Word = { startSec: number; endSec: number; text: string };

/** Largeur de ligne max (px @1080) : ~80 % du cadre, jamais collé aux bords. */
const WRAP_PX = 860;
/** Hauteur de la bande des sous-titres (part de la hauteur du cadre). */
const SUBTITLE_BAND = 0.3;
/** Plafond d'images d'une piste de sous-titres (≈ 2 min de karaoké). */
const MAX_TRACK_FRAMES = 700;

const opposite = (hex: string) => (isLight(hex) ? "#000000" : "#FFFFFF");

/* ── Styles moteur ────────────────────────────────────────────────────────── */

function captionStyle(v: CaptionVariant, size: number): Omit<EditCaption, "text" | "startSec" | "endSec"> {
  const f = TEXT_FONTS[v.font];
  // fixedSize : la taille réglée à la souris est respectée telle quelle.
  // noWrap : seuls les retours à la ligne tapés par le user coupent le texte ;
  // une longue phrase reste sur une ligne, même si elle déborde (choix Sten).
  const base = { font: v.font, fontWeight: f.weight, fontSize: size, color: v.textColor, align: "center" as const, fixedSize: true, noWrap: true };
  if (v.bg === "none") {
    // Texte seul : fin contour + ombre de la couleur OPPOSÉE (un texte blanc
    // sur un mur blanc restait illisible avec l'ombre seule).
    const o = opposite(v.textColor);
    return { ...base, strokeColor: o, strokeWidth: 3, shadowColor: o, shadowBlur: 10, shadowOffset: 2 };
  }
  return {
    ...base, style: "box", background: v.bgColor, backgroundOpacity: 1,
    borderRadius: v.bg === "square" ? 0 : v.bg === "lines" ? 14 : 26,
    paddingX: 22, paddingY: v.bg === "lines" ? 8 : 14,
    ...(v.bg === "lines" ? { boxShape: "lines" as const } : {}),
  };
}

/** Style moteur des sous-titres + découpe de la parole propre au style. */
function subtitleStyle(v: SubtitleVariant): { style: Omit<EditCaption, "text" | "startSec" | "endSec">; maxChars: number; perWord: "none" | "highlight" | "single" } {
  const f = TEXT_FONTS[v.font];
  const base = { font: v.font, fontWeight: f.weight, color: v.textColor, wrapWidth: WRAP_PX, align: "center" as const, fixedSize: true };
  const o = opposite(v.textColor);
  switch (v.style) {
    case "karaoke": // 2-4 mots, MAJUSCULES, contour épais, le mot prononcé s'allume
      return { style: { ...base, fontSize: 66, textTransform: "uppercase", strokeColor: o, strokeWidth: 7, shadowColor: "#000000", shadowBlur: 8, shadowOffset: 3 }, maxChars: 16, perWord: "highlight" };
    case "word": // un seul mot, très gros
      return { style: { ...base, fontSize: 104, textTransform: "uppercase", strokeColor: o, strokeWidth: 9, shadowColor: "#000000", shadowBlur: 10, shadowOffset: 4 }, maxChars: 0, perWord: "single" };
    case "native": // bandeau TikTok : fond de couleur ligne par ligne
      return { style: { ...base, fontSize: 54, style: "box", background: v.accentColor, backgroundOpacity: 1, borderRadius: 14, paddingX: 22, paddingY: 8, boxShape: "lines" }, maxChars: 28, perWord: "none" };
    default: // classique : la phrase, 2 lignes, blanc contour fin
      return { style: { ...base, fontSize: 54, strokeColor: o, strokeWidth: 4, shadowColor: o, shadowBlur: 8, shadowOffset: 2 }, maxChars: 28, perWord: "none" };
  }
}

/* ── Caption ──────────────────────────────────────────────────────────────── */

/** Dessine un texte en PNG puis le rogne, et le pose CENTRÉ sur `at` (% du
 *  cadre), là où le user l'a mis — y compris en partie hors du cadre. Le
 *  texte est dessiné au centre d'une toile 3× plus large que la vidéo (aux
 *  tailles de la vidéo, cf. refW) : une longue ligne n'est jamais rognée au
 *  dessin, seul le cadre de la vidéo la coupe à l'incrustation.
 *  null si rien n'a été dessiné. */
async function renderTrimmed(c: EditCaption, W: number, H: number, outPath: string, at: { x: number; y: number }): Promise<{ path: string; x: number; y: number } | null> {
  const { captionPng } = await import("@/lib/ai-editor/render");
  const sharp = (await import("sharp")).default;
  const full = `${outPath}.full.png`;
  try {
    await captionPng({ ...c, x: 50, y: 50 }, W * 3, H, full, "apple", -1, "", W);
    const info = await sharp(full).trim({ threshold: 0 }).png().toFile(outPath);
    return { path: outPath, x: Math.round((at.x / 100) * W - info.width / 2), y: Math.round((at.y / 100) * H - info.height / 2) };
  } catch (e) {
    console.warn("[text-overlay] rendu impossible :", (e as Error).message.slice(0, 160));
    return null;
  } finally {
    await fs.rm(full, { force: true }).catch(() => {});
  }
}

/* ── Sous-titres : piste transparente ─────────────────────────────────────── */

/** Les « états » à l'écran au fil du temps : un bloc, ou un bloc avec son mot
 *  actif (karaoké), ou un mot seul. Jamais deux états superposés. */
async function subtitleFrames(words: Word[], v: SubtitleVariant): Promise<{ text: string; hl: number; start: number; end: number }[]> {
  const { maxChars, perWord } = subtitleStyle(v);
  const frames: { text: string; hl: number; start: number; end: number }[] = [];
  if (perWord === "single") {
    words.forEach((w, i) => {
      const next = words[i + 1]?.startSec;
      frames.push({ text: w.text.trim(), hl: -1, start: w.startSec, end: Math.min(Math.max(w.endSec, w.startSec + 0.25), next ?? Infinity) });
    });
  } else {
    const { chunkWords } = await import("@/lib/ai-dup/to-edit-plan");
    const blocks = chunkWords(words, maxChars);
    blocks.forEach((b, bi) => {
      const next = blocks[bi + 1]?.[0]?.startSec;
      const blockEnd = Math.min(Math.max(b[b.length - 1].endSec, b[0].startSec + 0.3), next ?? Infinity);
      const text = b.map((w) => w.text).join(" ");
      if (perWord === "highlight") {
        // Un état par mot : le mot i s'allume de son début jusqu'au mot suivant.
        b.forEach((w, wi) => frames.push({ text, hl: wi, start: wi === 0 ? b[0].startSec : w.startSec, end: wi === b.length - 1 ? blockEnd : b[wi + 1].startSec }));
      } else {
        frames.push({ text, hl: -1, start: b[0].startSec, end: blockEnd });
      }
    });
  }
  return frames.filter((f) => f.text && f.end - f.start > 0.02).slice(0, MAX_TRACK_FRAMES);
}

async function buildSubtitleTrack(words: Word[], v: SubtitleVariant, at: { x: number; y: number }, W: number, H: number, durationSec: number, dir: string, tag: string): Promise<VideoOverlay | null> {
  const frames = await subtitleFrames(words, v);
  if (!frames.length) return null;
  const { captionPng } = await import("@/lib/ai-editor/render");
  const { runFFmpeg } = await import("@/lib/studio/pipeline");
  const sharp = (await import("sharp")).default;
  const { style } = subtitleStyle(v);

  // Bande de hauteur fixe, dessinée au MILIEU du cadre (jamais rognée), puis
  // posée sur la copie centrée sur `at` — là où le user a mis les sous-titres
  // à la souris, hors cadre compris (dimensions paires).
  const bandH = Math.round((H * SUBTITLE_BAND) / 2) * 2;
  const top = Math.round((H / 2 - bandH / 2) / 2) * 2;
  const placeY = Math.round(((at.y / 100) * H - bandH / 2) / 2) * 2;
  const placeX = Math.round(((at.x - 50) / 100) * W);
  const work = path.join(dir, `${tag}_subs`);
  await fs.mkdir(work, { recursive: true });

  const blank = path.join(work, "blank.png");
  await sharp({ create: { width: W, height: bandH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(blank);

  // Images : une par état (le même texte + même mot actif n'est dessiné qu'une fois).
  const done = new Map<string, string>();
  const list: string[] = [];
  let cursor = 0;
  const push = (file: string, d: number) => { if (d > 0.005) list.push(`file '${file.replace(/'/g, "'\\''")}'`, `duration ${d.toFixed(3)}`); };
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.start > cursor) push(blank, f.start - cursor);
    const key = `${f.text}§${f.hl}`;
    let file = done.get(key);
    if (!file) {
      const full = path.join(work, `f${i}_full.png`);
      file = path.join(work, `f${i}.png`);
      try {
        await captionPng({ ...style, text: f.text, startSec: 0, endSec: 1, x: 50, y: 50 }, W, H, full, "apple", f.hl, v.accentColor || "");
        await sharp(full).extract({ left: 0, top, width: W, height: bandH }).png().toFile(file);
      } catch (e) {
        console.warn("[text-overlay] image de sous-titre ratée :", (e as Error).message.slice(0, 120));
        file = blank;
      } finally {
        await fs.rm(full, { force: true }).catch(() => {});
      }
      done.set(key, file);
    }
    push(file, f.end - Math.max(f.start, cursor));
    cursor = Math.max(cursor, f.end);
  }
  push(blank, Math.max(0.1, durationSec - cursor + 0.5));
  list.push(`file '${blank}'`); // le concat ignore la durée de la dernière entrée
  const listPath = path.join(work, "list.txt");
  await fs.writeFile(listPath, list.join("\n"));

  const track = path.join(dir, `${tag}_subs.mov`);
  const { code, stderr } = await runFFmpeg(["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listPath,
    "-vf", "fps=25,format=rgba", "-c:v", "png", "-y", track], 300_000);
  await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  if (code !== 0) { console.warn("[text-overlay] piste de sous-titres ratée :", stderr.slice(-300)); return null; }
  return { moviePath: track, scaleW: 0, opacity: 1, x: String(placeX), y: String(placeY) };
}

/* ── Transcription (une fois par vidéo source et par lancement) ───────────── */

export async function transcribeWords(videoPath: string): Promise<Word[]> {
  try {
    const { transcribeViaDeepgram, isDeepgramAvailable } = await import("@/lib/ai-editor/transcribe-deepgram");
    const { transcribeViaGroq, isGroqAvailable } = await import("@/lib/ai-editor/transcribe-groq");
    const { stripGhostPhrases } = await import("@/lib/ai-editor/asr-filter");
    let tr = isDeepgramAvailable() ? await transcribeViaDeepgram(videoPath) : null;
    if (!tr && isGroqAvailable()) tr = await transcribeViaGroq(videoPath);
    if (!tr) { const { transcribeVideo } = await import("@/lib/studio/transcribe"); tr = await transcribeVideo(videoPath); }
    tr = stripGhostPhrases(tr);
    if (!tr) return [];
    if (tr.words?.length) return tr.words.map((w) => ({ startSec: w.startSec, endSec: w.endSec, text: w.text }));
    return tr.phrases.map((p) => ({ startSec: p.startSec, endSec: p.endSec, text: p.text }));
  } catch (e) {
    console.warn("[text-overlay] transcription impossible :", (e as Error).message.slice(0, 160));
    return [];
  }
}

/* ── Incrustations d'UNE copie ────────────────────────────────────────────── */

/** Cache d'un lancement : pistes de sous-titres déjà fabriquées (par vidéo +
 *  style + taille). Plusieurs copies au même style partagent la piste. */
export type TextOverlayCache = Map<string, Promise<VideoOverlay | null>>;
export const createTextOverlayCache = (): TextOverlayCache => new Map();

export async function textOverlaysForCopy(input: {
  config: TextOverlayConfig; copyIndex: number; W: number; H: number;
  durationSec: number; words: Word[]; dir: string; tag: string;
  sourceKey: string; cache: TextOverlayCache;
}): Promise<VideoOverlay[]> {
  const { config, W, H, dir, tag } = input;
  const out: VideoOverlay[] = [];
  const sv = config.subtitles.enabled ? subtitleVariant(config.subtitles, input.copyIndex) : null;

  if (sv && input.words.length) {
    const at = subtitleCenter(config.subtitles, sv);
    const key = `${input.sourceKey}|${W}x${H}|${JSON.stringify(sv)}|${at.x},${at.y}`;
    if (!input.cache.has(key)) input.cache.set(key, buildSubtitleTrack(input.words, sv, at, W, H, input.durationSec, dir, `${tag}_${input.cache.size}`));
    const track = await input.cache.get(key)!;
    if (track) out.push(track);
  }

  if (config.caption.enabled && config.caption.text) {
    const cv = captionVariant(config.caption, input.copyIndex);
    const at = captionCenter(config.caption, cv, !!sv, sv?.position ?? "bottom", !!config.subtitles.place);
    const r = await renderTrimmed({ ...captionStyle(cv, config.caption.size), text: config.caption.text, startSec: 0, endSec: 1 }, W, H, path.join(dir, `${tag}_cap.png`), at);
    if (r) {
      // Fenêtre d'affichage : toute la vidéo, ou de `from` à `to` (to = null :
      // jusqu'à la fin) — la caption peut arriver au milieu ou à la fin.
      const c = config.caption;
      const enable = c.duration === "range"
        ? (c.to != null ? `between(t,${c.from.toFixed(2)},${c.to.toFixed(2)})` : c.from > 0 ? `gte(t,${c.from.toFixed(2)})` : undefined)
        : undefined;
      out.push({ moviePath: r.path, scaleW: 0, opacity: 1, x: String(r.x), y: String(r.y), ...(enable ? { enable } : {}) });
    }
  }
  return out;
}
