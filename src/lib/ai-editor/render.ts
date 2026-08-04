// src/lib/ai-editor/render.ts
//
// Moteur de rendu de l'Éditeur IA. Le Claude du user est le MONTEUR (choisit
// plans, timings, captions, mouvement, colorimétrie) ; ce moteur EXÉCUTE le plan.
//
// Capacités (retours du Claude monteur) :
//  · create_variant renvoie des KEYFRAMES du rendu + la durée réelle.
//  · captions STYLABLES : outline (contour) / box (fond), taille libre, couleur,
//    contour (couleur+épaisseur), position libre x/y en %, alignement.
//  · IMAGES : mouvement (zoomIn/zoomOut/panLeft/panRight) + intensité, et cadrage
//    (contain / cover / blurFill).
//  · COLORIMÉTRIE globale : saturation / contraste / luminosité / grain / vignette.
//  · GLOBAL : fps, couleur de fond.
//  · AUDIO conservé (son des plans vidéo ; silence pour images).
//
// Captions rasterisées en PNG (sharp) + overlay — portable (pas de drawtext).

import fs from "fs/promises";
import os from "os";
import path from "path";
import { runFFmpeg } from "@/lib/studio/pipeline";
import { getProject, materialAbsPath, addVariant, projectPaths } from "./store";
import type { ProjectVariant } from "./store";

export type SegMotion = "none" | "zoomIn" | "zoomOut" | "panLeft" | "panRight" | "handheld";
export type SegFit = "contain" | "cover" | "blurFill";
export type SegTransition = "cut" | "fade" | "whipPan" | "slide" | "zoomPunch";
export type SegLayout = "single" | "splitH" | "splitV" | "pip";
export type SegOverlay = {
  materialId: string;
  x?: number; y?: number;          // position (coin haut-gauche) en % du cadre
  width?: number;                  // largeur en % du cadre (5-100)
  startSec?: number; endSec?: number; // fenêtre d'affichage, relative au segment
  opacity?: number;                // 0-1
  borderRadius?: number;           // px (coins arrondis)
  zIndex?: number;                 // ordre d'empilement (petit = dessous)
};
export type EditSegment = {
  materialId: string;
  startSec?: number;
  endSec?: number;
  motion?: SegMotion | "zoom-in" | "zoom-out";
  motionIntensity?: number;
  fit?: SegFit;
  transition?: SegTransition;      // à l'ENTRÉE du plan (le 1er reste en cut)
  transitionDuration?: number;     // secondes (0.1-0.4 typique), bornée à la durée
  // ── Vitesse (chantier 1) — VIDÉO uniquement (ignoré silencieusement sur image) ──
  speed?: number;                  // 0.25-4, défaut 1 (l'audio du plan suit, pitch modifié)
  freezeAt?: number;               // timecode (s) DANS le fichier → arrêt sur image
  freezeDuration?: number;         // durée du gel (s)
  speedRamp?: { from: number; to: number }; // rampe de vitesse progressive sur le plan
  reverse?: boolean;               // lecture inversée (vidéo + audio)
  // ── Recadrage (chantier 2) — se COMPOSE avec motion (le mouvement passe par-dessus) ──
  scale?: number;                  // 1-3 : zoom (punch-in) dans l'image, défaut 1
  offsetX?: number;                // -50..50 % : position H du recadrage (agit si scale>1)
  offsetY?: number;                // -50..50 % : position V du recadrage
  flipH?: boolean;                 // miroir horizontal (levier d'unicité)
  flipV?: boolean;                 // miroir vertical
  rotate?: number;                 // rotation en degrés
  // ── Composition multi-média (chantier 4) ──
  layout?: SegLayout;              // single (défaut) | splitH | splitV | pip
  overlays?: SegOverlay[];         // médias additionnels compositée dans le plan
};

/** Nom de transition xfade (null = cut). */
function xfadeName(t: unknown): string | null {
  switch (String(t ?? "cut")) {
    case "fade": return "fade";
    case "whipPan": return "smoothleft";
    case "slide": return "slideleft";
    case "zoomPunch": return "zoomin";
    default: return null; // cut
  }
}

export type CaptionStyle = "outline" | "box";
export type CaptionSize = "s" | "m" | "l";
export type CaptionFont = "sans" | "rounded" | "impact" | "serif" | "script" | "display";
// Enum → nom de FAMILLE (fontconfig la trouve dans public/fonts/ dès que le .ttf
// y est déposé ; sinon repli sur ce qui est dispo, pas de crash).
const FONT_FAMILY: Record<CaptionFont, string> = {
  sans: "Noto Sans",
  rounded: "Poppins",
  impact: "Anton",
  serif: "Playfair Display",
  script: "Pacifico",
  display: "Bungee",
};
// Les emojis ne sont PAS rendus par une police (polices couleur COLR/CBDT non
// fiables sous librsvg) : on composite des images (Fluent 3D, cf. plus bas). Si
// aucun asset n'est récupérable, repli sur cette police mono → jamais de tofu.
const EMOJI_TEXT_FALLBACK = "'Noto Emoji', 'Noto Sans'";
export type EditCaption = {
  text: string;
  startSec: number;
  endSec: number;
  position?: "top" | "center" | "bottom";
  x?: number;            // centre horizontal en % (0-100) — prioritaire sur position
  y?: number;            // centre vertical en % (0-100)
  align?: "left" | "center" | "right";
  style?: CaptionStyle;  // outline (défaut) | box
  background?: string;   // couleur hex du fond → force box ; "none" → force outline
  size?: CaptionSize;
  fontSize?: number;     // px (à W=1080), prioritaire sur size
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;  // px
  font?: CaptionFont;    // famille de police
  fontWeight?: number;   // 400-900
  letterSpacing?: number;// px (interlettrage)
  lineHeight?: number;   // multiplicateur (défaut 1.24)
  textTransform?: "none" | "uppercase";
  shadowColor?: string;  // ombre portée (distincte du contour)
  shadowBlur?: number;   // px
  shadowOffset?: number; // px (décalage bas-droite)
  emojiStyle?: EmojiStyle; // "3d" (Fluent, défaut) | "flat" (Twemoji) — override du défaut du plan
  // ── Animation (chantier 3) ──
  animation?: "none" | "fade" | "pop" | "slideUp" | "typewriter" | "wordByWord" | "karaoke";
  animationDuration?: number;                      // s (défaut ~0.35)
  words?: { text: string; start: number; end: number }[]; // wordByWord/karaoke : timing par mot
  highlightColor?: string;                         // karaoké : couleur du mot actif
};

export type ColorGrade = {
  saturation?: number;   // 1 = neutre
  contrast?: number;     // 1 = neutre
  brightness?: number;   // 0 = neutre (-1..1)
  temperature?: number;  // -1 froid .. +1 chaud (0 neutre)
  grain?: number;        // 0..1
  vignette?: boolean;
};

export type EditAudioTrack = {
  materialId: string;      // matière audio OU vidéo (on prend sa piste son)
  startSec?: number;       // décalage dans la piste
  volume?: number;         // 0-2, défaut 1
  mode?: "mix" | "replace";// mix (par-dessus le son des plans, défaut) | replace
};

export type EditPlan = {
  aspect?: "9:16" | "1:1" | "16:9";
  fps?: number;
  background?: string;   // couleur de fond (letterbox), défaut noir
  grade?: ColorGrade;
  audio?: EditAudioTrack;
  segments: EditSegment[];
  captions?: EditCaption[];
  emojiStyle?: EmojiStyle; // défaut des emojis de TOUTES les captions ("3d" | "flat")
  label?: string;
};

export type OutKeyframe = { t: number; dataUri: string };

const CANVAS: Record<string, [number, number]> = { "9:16": [1080, 1920], "1:1": [1080, 1080], "16:9": [1920, 1080] };
const IMG_DEFAULT_SEC = 2.5;
const MAX_SEGMENTS = 40;
const MAX_CAPTIONS = 30;
const SIZE_RATIO: Record<CaptionSize, number> = { s: 0.048, m: 0.058, l: 0.072 };
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#?[0-9a-fA-F]{3,8}$/.test(v) ? (v.startsWith("#") ? v : `#${v}`) : d);

/* ── Polices : sharp/librsvg n'a AUCUNE police système en prod (Railway) → le
   texte SVG sortait en carrés (tofu). On embarque les polices dans public/fonts/
   et on restreint fontconfig À CE dossier : fontconfig indexe toutes les familles
   présentes (Noto Sans, Poppins, Anton, … + Noto Emoji en repli ultime) et fait
   le repli entre elles — jamais de tofu, sans rien installer sur Railway. Déposer
   un nouveau .ttf dans public/fonts/ suffit à activer la famille correspondante. */
const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const FONT_CACHE = path.join(os.tmpdir(), "duup_fontcache");
const FONT_CONF = path.join(FONT_CACHE, "duup-fonts.conf");
process.env.FONTCONFIG_FILE = FONT_CONF;
let fontsReady = false;
async function ensureFonts(): Promise<void> {
  if (fontsReady) return;
  fontsReady = true;
  try {
    await fs.mkdir(FONT_CACHE, { recursive: true });
    const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONT_DIR}</dir>
  <cachedir>${FONT_CACHE}</cachedir>
</fontconfig>
`;
    await fs.writeFile(FONT_CONF, conf, "utf8");
  } catch (e) {
    console.warn("[ai-editor/render] config police:", (e as Error)?.message);
  }
}

/* ── Emojis en COULEUR compositée dans le SVG (image data-URI, pas de police
   couleur). Set principal : Microsoft Fluent Emoji 3D (licence MIT) — look premium
   proche d'Apple, mais 100% libre. On adresse chaque emoji par code-point via une
   map générée (public/fluent-emoji/map.json → chemin de l'asset), les PNG sont
   récupérés au CDN jsDelivr puis mis en cache disque + mémoire. Repli : Twemoji
   (CC-BY 4.0, SVG) puis police mono → jamais de tofu. */
const _seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const isEmojiGrapheme = (g: string) => EMOJI_RE.test(g);
/** Code-point d'un grapheme (règle Twemoji : retire FE0F sauf séquence ZWJ). Sert
 *  de clé pour la map Fluent ET de nom de fichier Twemoji. Ex "🔥"→"1f525". */
function twemojiName(g: string): string {
  const s = g.indexOf("‍") < 0 ? g.replace(/️/g, "") : g;
  const cps: string[] = [];
  for (const ch of s) cps.push(ch.codePointAt(0)!.toString(16));
  return cps.join("-");
}
const EMOJI_CACHE_DIR = path.join(os.tmpdir(), "duup_emoji");
const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/";
const FLUENT_BASE = "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/";
const FLUENT_MAP_FILE = path.join(process.cwd(), "public", "fluent-emoji", "map.json");
const _emojiMem = new Map<string, string | null>();   // clé code-point → data URI (ou null)
let _fluentMap: Record<string, string> | null | undefined; // undefined = pas encore chargé
async function fluentMap(): Promise<Record<string, string> | null> {
  if (_fluentMap !== undefined) return _fluentMap;
  try { _fluentMap = JSON.parse(await fs.readFile(FLUENT_MAP_FILE, "utf8")); }
  catch { _fluentMap = null; }
  return _fluentMap!;
}
/** Récupère un asset (URL) → data URI. Cache disque + repli silencieux. */
async function fetchAssetDataUri(url: string, cacheName: string, mime: string): Promise<string | null> {
  const file = path.join(EMOJI_CACHE_DIR, cacheName);
  try { const b = await fs.readFile(file); if (b.length > 80) return `data:${mime};base64,${b.toString("base64")}`; } catch {}
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 80) {
        await fs.mkdir(EMOJI_CACHE_DIR, { recursive: true }).catch(() => {});
        await fs.writeFile(file, buf).catch(() => {});
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
    }
  } catch {}
  return null;
}
export type EmojiStyle = "3d" | "flat"; // 3d = Fluent 3D (défaut) ; flat = Twemoji
/** Data URI d'un emoji selon le style choisi. "3d" : Fluent 3D (PNG) puis repli
 *  Twemoji ; "flat" : Twemoji (SVG) directement. Repli ultime mono via null. */
async function emojiImage(grapheme: string, style: EmojiStyle = "3d"): Promise<string | null> {
  const key = twemojiName(grapheme);
  const memKey = `${style}:${key}`;
  if (_emojiMem.has(memKey)) return _emojiMem.get(memKey)!;
  let out: string | null = null;
  // 3d : Fluent d'abord (repli teint non listé → emoji de base sans modificateur).
  if (style !== "flat") {
    const map = await fluentMap();
    if (map) {
      const pth = map[key] || map[key.replace(/-1f3f[b-f]/g, "")];
      if (pth) out = await fetchAssetDataUri(FLUENT_BASE + pth.split("/").map(encodeURIComponent).join("/"), `f_${key}.png`, "image/png");
    }
  }
  // Repli (ou style flat) : Twemoji (SVG).
  if (!out) out = await fetchAssetDataUri(TWEMOJI_BASE + key + ".svg", `t_${key}.svg`, "image/svg+xml");
  _emojiMem.set(memKey, out);
  return out;
}
/** Découpe une ligne en segments texte / emoji (graphemes consécutifs regroupés). */
function segmentRuns(line: string): Array<{ t: "text"; s: string } | { t: "emoji"; g: string }> {
  const runs: Array<{ t: "text"; s: string } | { t: "emoji"; g: string }> = [];
  let buf = "";
  for (const { segment } of _seg.segment(line)) {
    if (isEmojiGrapheme(segment)) {
      if (buf) { runs.push({ t: "text", s: buf }); buf = ""; }
      runs.push({ t: "emoji", g: segment });
    } else buf += segment;
  }
  if (buf) runs.push({ t: "text", s: buf });
  return runs;
}
/** Largeur d'encre d'un run texte, mesurée par le rasteriseur (police réelle). */
async function measureInk(sharp: typeof import("sharp"), text: string, attrs: string, fsz: number): Promise<number> {
  if (!text) return 0;
  const spaceW = fsz * 0.26;
  if (!text.trim()) return Math.round(text.length * spaceW); // espaces seuls
  // trim() du rasteriseur enlève les espaces de bord → on les recompte à la main
  // pour préserver l'espacement autour des emojis (runs texte adjacents).
  const edge = (text.length - text.trimStart().length) + (text.length - text.trimEnd().length);
  const w = Math.max(64, Math.ceil(text.length * fsz * 2));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${Math.round(fsz * 2.4)}"><text x="0" y="${Math.round(fsz * 1.6)}" ${attrs} fill="#fff">${esc(text)}</text></svg>`;
  try {
    const { info } = await sharp(Buffer.from(svg)).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    return info.width + Math.round(edge * spaceW);
  } catch { return Math.round(text.length * fsz * 0.5); }
}

/** Rasterise une caption stylée : police/poids/interlettrage/interligne/casse,
 *  contour OU boîte, ombre portée, position libre. Emojis couleur (Fluent 3D). */
async function captionPng(c: EditCaption, W: number, H: number, outPath: string, emojiStyle: EmojiStyle = "3d", hlWord = -1, hlColor = ""): Promise<void> {
  await ensureFonts();
  const sharp = (await import("sharp")).default;

  // Style : background="none" → outline ; background=couleur → box ; sinon style.
  let style: CaptionStyle = c.style === "box" ? "box" : "outline";
  let boxColor = "#000000";
  let boxOpacity = 0.5;
  if (typeof c.background === "string") {
    if (c.background.toLowerCase() === "none") style = "outline";
    else { style = "box"; boxColor = hex(c.background, "#000000"); boxOpacity = 0.62; }
  }

  const size: CaptionSize = c.size === "s" || c.size === "l" ? c.size : "m";
  const fsz = c.fontSize && c.fontSize > 6 ? Math.round((c.fontSize * W) / 1080) : Math.round(W * SIZE_RATIO[size]);
  const color = hex(c.color, "#ffffff");
  const strokeColor = hex(c.strokeColor, "#000000");
  const strokeW = Math.max(2, Math.round((c.strokeWidth != null ? c.strokeWidth : fsz * 0.16)));
  const align = c.align === "left" ? "start" : c.align === "right" ? "end" : "middle";

  // Police : famille (repli auto si le .ttf n'est pas encore déposé). Les emojis
  // ne passent PAS par la police : ils sont compositée en images (voir plus bas).
  const famKey: CaptionFont = c.font && FONT_FAMILY[c.font] ? c.font : "sans";
  const textFamily = `'${FONT_FAMILY[famKey]}'`;
  const weight = Math.round(clamp(num(c.fontWeight, style === "outline" ? 900 : 800), 100, 900));
  const ls = clamp(num(c.letterSpacing, 0), -20, 40);
  const lineMul = clamp(num(c.lineHeight, 1.24), 0.9, 2.2);
  const lineH = Math.round(fsz * lineMul);
  const rawText = c.textTransform === "uppercase" ? c.text.toUpperCase() : c.text;

  // Découpe en mots ; on COLLE tout mot purement emoji au précédent → un emoji
  // terminal ne part jamais seul à la ligne suivante.
  const estVis = (s: string) => {
    let v = 0;
    for (const { segment } of _seg.segment(s)) v += isEmojiGrapheme(segment) ? 2 : 1;
    return v;
  };
  const rawWords = rawText.trim().split(/\s+/).filter(Boolean);
  const words: string[] = [];
  for (const w of rawWords) {
    const allEmoji = EMOJI_RE.test(w) && [..._seg.segment(w)].every((x) => isEmojiGrapheme(x.segment));
    if (allEmoji && words.length) words[words.length - 1] += " " + w;
    else words.push(w);
  }
  const maxChars = Math.max(8, Math.floor(W / (fsz * 0.56)));
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (estVis(cand) > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = cand;
  }
  if (cur) lines.push(cur);
  const used = lines.slice(0, 5);
  const n = used.length;

  // Position : x/y en % prioritaires ; sinon top/center/bottom.
  const yPctDefault = c.position === "top" ? 12 : c.position === "center" ? 50 : 85;
  const yPct = clamp(num(c.y, yPctDefault), 4, 96);
  const xPct = clamp(num(c.x, 50), 4, 96);
  const anchorX = Math.round((W * xPct) / 100);
  const blockH = n * lineH;
  const centerY = Math.round((H * yPct) / 100);
  const firstBaseline = centerY - Math.round(blockH / 2) + fsz;

  const lsAttr = ls ? ` letter-spacing="${ls}px"` : "";
  const textAttrs = `font-family="${textFamily}" font-weight="${weight}" font-size="${fsz}"${lsAttr}`;
  const emojiTextAttrs = `font-family="${EMOJI_TEXT_FALLBACK}" font-weight="${weight}" font-size="${fsz}"${lsAttr}`;
  // Emoji calé sur l'em-box (≈1.15em pour compenser le padding transparent des assets
  // et matcher la hauteur des majuscules), centré optiquement sur le texte.
  const emojiBox = Math.round(fsz * 1.15);
  const emojiPad = Math.round(fsz * 0.08);
  const emojiTop = Math.round(fsz * 0.36) + Math.round(emojiBox / 2); // baseline → haut image

  // Mise en page ligne par ligne : on mesure chaque run texte (police réelle) et
  // on réserve une case carrée par emoji, pour placer chaque élément au pixel.
  type Placed = { x: number; kind: "text" | "emoji-img" | "emoji-text"; s?: string; dataUri?: string; color?: string };
  const placedLines: Array<{ baseline: number; runs: Placed[]; width: number }> = [];
  let maxLineW = 0;
  let wordIdx = 0;                       // compteur GLOBAL de mots (pour hlWord/karaoké)
  const spaceAdv = Math.round(fsz * 0.26);
  for (let i = 0; i < used.length; i++) {
    const runs = segmentRuns(used[i]);
    // 1er passage : largeur d'avance de chaque run.
    const measured: Array<{ adv: number; kind: "text" | "emoji-img" | "emoji-text"; s?: string; dataUri?: string; color?: string }> = [];
    for (const r of runs) {
      if (r.t === "text") {
        if (hlWord >= 0) {
          // Karaoké : on découpe le run en MOTS pour pouvoir en colorer un seul.
          const wlist = r.s.trim().split(/\s+/).filter(Boolean);
          for (let wi = 0; wi < wlist.length; wi++) {
            const isHl = wordIdx === hlWord;
            measured.push({ adv: await measureInk(sharp, wlist[wi], textAttrs, fsz) + (wi < wlist.length - 1 ? spaceAdv : 0), kind: "text", s: wlist[wi], color: isHl && hlColor ? hlColor : undefined });
            wordIdx++;
          }
        } else {
          measured.push({ adv: await measureInk(sharp, r.s, textAttrs, fsz), kind: "text", s: r.s });
        }
      } else {
        const dataUri = await emojiImage(r.g, emojiStyle);
        if (dataUri) measured.push({ adv: emojiBox + 2 * emojiPad, kind: "emoji-img", dataUri });
        else measured.push({ adv: await measureInk(sharp, r.g, emojiTextAttrs, fsz), kind: "emoji-text", s: r.g });
      }
    }
    const lineW = measured.reduce((m, r) => m + r.adv, 0);
    maxLineW = Math.max(maxLineW, lineW);
    const baseline = firstBaseline + i * lineH;
    const startX = align === "start" ? anchorX : align === "end" ? anchorX - lineW : anchorX - Math.round(lineW / 2);
    // 2e passage : positions absolues.
    const placed: Placed[] = [];
    let x = startX;
    for (const r of measured) {
      placed.push({ x, kind: r.kind, s: r.s, dataUri: r.dataUri, color: r.color });
      x += r.adv;
    }
    placedLines.push({ baseline, runs: placed, width: lineW });
  }

  // Éléments SVG : ombre (texte only), fond (box), traits/emplis, images emoji.
  const shadowEls: string[] = [];
  const mainEls: string[] = [];
  const pushText = (x: number, y: number, attrs: string, s: string, fill: string) => {
    if (style === "outline") {
      mainEls.push(`<text x="${x}" y="${y}" ${attrs} fill="${strokeColor}" stroke="${strokeColor}" stroke-width="${strokeW}" stroke-linejoin="round">${esc(s)}</text>`);
    }
    mainEls.push(`<text x="${x}" y="${y}" ${attrs} fill="${fill}">${esc(s)}</text>`);
  };
  for (const ln of placedLines) {
    for (const r of ln.runs) {
      if (r.kind === "emoji-img") {
        mainEls.push(`<image x="${r.x + emojiPad}" y="${ln.baseline - emojiTop}" width="${emojiBox}" height="${emojiBox}" xlink:href="${r.dataUri}"/>`);
      } else {
        const attrs = r.kind === "emoji-text" ? emojiTextAttrs : textAttrs;
        shadowEls.push(`<text x="${r.x}" y="${ln.baseline}" ${attrs} fill="#000">${esc(r.s!)}</text>`);
        pushText(r.x, ln.baseline, attrs, r.s!, r.color || color); // r.color = mot actif (karaoké)
      }
    }
  }

  // Ombre portée (distincte du contour) : copie décalée + floutée derrière.
  let defs = "", shadowGroup = "";
  if (typeof c.shadowColor === "string" && c.shadowColor.toLowerCase() !== "none" && shadowEls.length) {
    const shColor = hex(c.shadowColor, "#000000");
    const shBlur = clamp(num(c.shadowBlur, Math.round(fsz * 0.06)), 0, fsz);
    const shOff = clamp(num(c.shadowOffset, Math.round(fsz * 0.06)), -fsz, fsz);
    defs = `<defs><filter id="sh" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${shBlur}"/></filter></defs>`;
    const els = shadowEls.map((t) => t.replace('fill="#000"', `fill="${shColor}"`)).join("");
    shadowGroup = `<g transform="translate(${shOff},${shOff})" filter="url(#sh)">${els}</g>`;
  }

  let bgRect = "";
  if (style === "box") {
    const boxW = Math.round(Math.min(W * 0.96, maxLineW + fsz * 0.8));
    const boxX = clamp(align === "start" ? anchorX - Math.round(fsz * 0.4) : align === "end" ? anchorX - boxW + Math.round(fsz * 0.4) : anchorX - Math.round(boxW / 2), 6, W - boxW - 6);
    const boxY = firstBaseline - fsz;
    bgRect = `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${blockH + Math.round(fsz * 0.5)}" rx="16" fill="${boxColor}" fill-opacity="${boxOpacity}"/>`;
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${defs}${bgRect}${shadowGroup}${mainEls.join("")}</svg>`;
  await fs.writeFile(outPath, await sharp(Buffer.from(svg)).png().toBuffer());
}

/** Extrait ~5 keyframes du rendu (data URI JPEG) → le monteur VOIT son résultat.
 *  Robuste : vérifie le fichier source (existe + non vide), seek PRÉCIS (-ss après
 *  -i), et logge le stderr ffmpeg + ignore les frames vides (échec jamais silencieux). */
async function extractKeyframes(videoPath: string, durationSec: number, dir: string, count = 5): Promise<OutKeyframe[]> {
  // 1) Le fichier de sortie doit exister ET avoir une taille (évite l'extraction
  //    avant fin d'écriture, ou sur un fichier absent/tronqué).
  try {
    const st = await fs.stat(videoPath);
    if (!st.size) { console.warn("[ai-editor/keyframes] fichier vide:", videoPath); return []; }
  } catch {
    console.warn("[ai-editor/keyframes] fichier introuvable:", videoPath);
    return [];
  }

  const out: OutKeyframe[] = [];
  const total = durationSec > 0 ? durationSec : 1;
  for (let i = 0; i < count; i++) {
    const t = Math.max(0.05, (total * (i + 0.5)) / count);
    const p = path.join(dir, `okf_${i}.jpg`);
    // -ss APRÈS -i = seek précis. scale 360 + q6 = images légères (~10 Ko) pour ne
    // pas dépasser le budget de réponse du client MCP (sinon il vide les blocs image).
    const { code, stderr } = await runFFmpeg(
      ["-hide_banner", "-loglevel", "error", "-i", videoPath, "-ss", t.toFixed(2), "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "6", "-y", p],
      20_000,
    );
    if (code !== 0) { console.warn(`[ai-editor/keyframes] ffmpeg échec t=${t.toFixed(2)} code=${code}: ${stderr.slice(-160)}`); continue; }
    try {
      const b = await fs.readFile(p);
      await fs.unlink(p).catch(() => {});
      if (b.length > 100 && b[0] === 0xff && b[1] === 0xd8) {
        out.push({ t: Math.round(t * 100) / 100, dataUri: `data:image/jpeg;base64,${b.toString("base64")}` });
      } else {
        console.warn(`[ai-editor/keyframes] frame vide/invalide t=${t.toFixed(2)} (${b.length} o)`);
      }
    } catch (e) {
      console.warn(`[ai-editor/keyframes] lecture échouée t=${t.toFixed(2)}:`, (e as Error)?.message);
    }
  }
  if (!out.length) console.warn("[ai-editor/keyframes] 0 frame extraite de", videoPath, "durée", total);
  return out;
}

/** Normalise le nom de mouvement (accepte kebab et camelCase). */
function normMotion(m: unknown): SegMotion {
  const s = String(m ?? "none").replace(/-/g, "").toLowerCase();
  if (s === "zoomin") return "zoomIn";
  if (s === "zoomout") return "zoomOut";
  if (s === "panleft") return "panLeft";
  if (s === "panright") return "panRight";
  if (s === "handheld") return "handheld";
  return "none";
}

/** Préfixe de RECADRAGE (chantier 2), appliqué à la SOURCE avant fit/motion :
 *  flip → rotate → punch-in (scale + offset). Renvoie "" (aucun recadrage) ou une
 *  chaîne de filtres terminée par ",". Se compose avec motion (qui vient après). */
function spatialPrefix(seg: EditSegment, bg: string): string {
  const parts: string[] = [];
  if (seg.flipH) parts.push("hflip");
  if (seg.flipV) parts.push("vflip");
  const rot = num(seg.rotate, 0);
  if (Math.abs(rot) > 0.05) parts.push(`rotate=${(rot * Math.PI / 180).toFixed(5)}:fillcolor=${bg}`);
  const scale = clamp(num(seg.scale, 1), 1, 3);
  if (scale > 1.001) {
    const ox = clamp(num(seg.offsetX, 0), -50, 50) / 100;
    const oy = clamp(num(seg.offsetY, 0), -50, 50) / 100;
    const s = scale.toFixed(4);
    // crop d'une sous-fenêtre iw/s × ih/s, centrée puis décalée par offset (% de la marge).
    parts.push(`crop=iw/${s}:ih/${s}:(iw-iw/${s})*(0.5+${ox.toFixed(4)}):(ih-ih/${s})*(0.5+${oy.toFixed(4)})`);
  }
  return parts.length ? parts.join(",") + "," : "";
}

/** Filtre vidéo d'un segment IMAGE (recadrage + cadrage + éventuel mouvement Ken Burns). */
function imageVideoFilter(i: number, W: number, H: number, fps: number, bg: string, dur: number, motion: SegMotion, intensity: number, fit: SegFit, pre = ""): string {
  if (motion === "handheld") {
    // Tremblement procédural (sommes de sinus lissées) sur image bouclée -t dur.
    // Casse l'effet diaporama de façon naturelle (mieux qu'un zoom sur une fixe).
    const amp = 0.012 * intensity; // ~1.2% de la dimension à intensité 1
    const jx = `${(W * amp).toFixed(2)}*(sin(2*PI*1.7*t)+0.6*sin(2*PI*3.3*t+1.1))`;
    const jy = `${(H * amp).toFixed(2)}*(sin(2*PI*2.1*t+0.5)+0.6*sin(2*PI*4.3*t))`;
    const UW = Math.round(W * 1.12), UH = Math.round(H * 1.12);
    return `[${i}:v]${pre}scale=${UW}:${UH}:force_original_aspect_ratio=increase,crop=${UW}:${UH},` +
      `crop=${W}:${H}:x='(iw-ow)/2+${jx}':y='(ih-oh)/2+${jy}',setsar=1,fps=${fps},format=yuv420p[v${i}]`;
  }
  if (motion !== "none") {
    // NB : l'entrée est UNE seule image (pas de -loop) → zoompan la déploie en
    // `frames` images. Upscale modéré (1,3×) = netteté au zoom sans exploser le CPU.
    const frames = Math.max(2, Math.round(dur * fps));
    const UW = Math.round(W * 1.3), UH = Math.round(H * 1.3);
    const zMax = (1 + 0.25 * intensity).toFixed(3);
    const step = (0.0009 * intensity).toFixed(5);
    let zoom = "1", x = "iw/2-(iw/zoom/2)", y = "ih/2-(ih/zoom/2)";
    if (motion === "zoomIn") zoom = `min(1.0+${step}*on,${zMax})`;
    else if (motion === "zoomOut") zoom = `max(${zMax}-${step}*on,1.0)`;
    else { // pan → zoom constant + translation horizontale
      const z = (1 + 0.15 * intensity).toFixed(3);
      zoom = z;
      x = motion === "panRight" ? `(iw-iw/zoom)*on/${frames}` : `(iw-iw/zoom)*(1-on/${frames})`;
    }
    return `[${i}:v]${pre}scale=${UW}:${UH}:force_original_aspect_ratio=increase,crop=${UW}:${UH},` +
      `zoompan=z='${zoom}':x='${x}':y='${y}':d=${frames}:s=${W}x${H}:fps=${fps},setsar=1,format=yuv420p[v${i}]`;
  }
  if (fit === "cover") {
    return `[${i}:v]${pre}scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${fps},format=yuv420p[v${i}]`;
  }
  if (fit === "blurFill") {
    return `[${i}:v]${pre}split=2[b${i}][f${i}];` +
      `[b${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=42[bb${i}];` +
      `[f${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease[ff${i}];` +
      `[bb${i}][ff${i}]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2,setsar=1,fps=${fps},format=yuv420p[v${i}]`;
  }
  // contain (défaut)
  return `[${i}:v]${pre}scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${bg},setsar=1,fps=${fps},format=yuv420p[v${i}]`;
}

/** Chaîne de colorimétrie globale (eq + grain + vignette). "" si neutre. */
function gradeChain(g?: ColorGrade): string {
  if (!g) return "";
  const parts: string[] = [];
  const sat = num(g.saturation, 1), con = num(g.contrast, 1), bri = num(g.brightness, 0);
  if (sat !== 1 || con !== 1 || bri !== 0) {
    parts.push(`eq=saturation=${clamp(sat, 0, 3).toFixed(3)}:contrast=${clamp(con, 0, 3).toFixed(3)}:brightness=${clamp(bri, -1, 1).toFixed(3)}`);
  }
  const temp = clamp(num(g.temperature, 0), -1, 1);
  if (temp !== 0) {
    // Teinte chaud/froid : +chaud = plus de rouge / moins de bleu (colorbalance).
    parts.push(`colorbalance=rm=${(temp * 0.25).toFixed(3)}:bm=${(-temp * 0.25).toFixed(3)}:rs=${(temp * 0.15).toFixed(3)}:bs=${(-temp * 0.15).toFixed(3)}`);
  }
  const grain = num(g.grain, 0);
  if (grain > 0) parts.push(`noise=alls=${Math.round(clamp(grain, 0, 1) * 40)}:allf=t+u`);
  if (g.vignette) parts.push(`vignette=PI/4`);
  return parts.join(",");
}

/** Décompose un facteur de vitesse en étages atempo valides ([0.5, 2] chacun). */
function atempoStages(f: number): number[] {
  const stages: number[] = [];
  let r = f;
  while (r > 2.0 + 1e-6) { stages.push(2.0); r /= 2.0; }
  while (r < 0.5 - 1e-6) { stages.push(0.5); r /= 0.5; }
  stages.push(Math.round(r * 1000) / 1000);
  return stages;
}

/* ── Vitesse (chantier 1) : pré-rend un plan VIDÉO avec ses effets temporels
   (freeze → retime speed/rampe → reverse), dans un fichier intermédiaire dont on
   PROBE la durée finale (pas de calcul analytique fragile). Renvoie null si le plan
   n'a aucun effet (→ chemin normal). Ordre fixe : gel, puis vitesse/rampe, puis
   inversion. Audio : suit la vitesse (atempo, pitch modifié), silence pendant le
   gel, inversé si reverse ; rampe → atempo moyen. */
async function timeEffectClip(
  abs: string, start: number, segLen: number, seg: EditSegment, dir: string, idx: number, fps: number,
): Promise<{ path: string; durationSec: number; hasAudio: boolean } | null> {
  const spd = clamp(num(seg.speed, 1), 0.25, 4);
  const rev = !!seg.reverse;
  const rampRaw = seg.speedRamp;
  const ramp = rampRaw && Number.isFinite(Number(rampRaw.from)) && Number.isFinite(Number(rampRaw.to))
    ? { from: clamp(num(rampRaw.from, 1), 0.25, 4), to: clamp(num(rampRaw.to, 1), 0.25, 4) } : null;
  const rampActive = !!ramp && Math.abs(ramp.from - ramp.to) > 0.01;
  const fzLocal = seg.freezeAt != null ? num(seg.freezeAt, -1) - start : -1;
  const fzDur = clamp(num(seg.freezeDuration, 0), 0, 10);
  const hasFreeze = fzLocal > 0.02 && fzLocal < segLen - 0.02 && fzDur > 0.02;
  const hasSpeed = Math.abs(spd - 1) > 0.001;
  if (!rev && !rampActive && !hasFreeze && !hasSpeed) return null;

  const { hasAudio } = await probeAV(abs);
  const vf: string[] = [], af: string[] = [];
  let vL = "0:v", aL = "0:a";
  const L = (p: string) => `${p}${idx}`;
  let curDur = segLen;

  if (hasFreeze) {
    vf.push(`[${vL}]trim=0:${fzLocal.toFixed(3)},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${fzDur.toFixed(3)}[${L("vfa")}]`);
    vf.push(`[${vL}]trim=start=${fzLocal.toFixed(3)},setpts=PTS-STARTPTS[${L("vfb")}]`);
    vf.push(`[${L("vfa")}][${L("vfb")}]concat=n=2:v=1:a=0[${L("vf")}]`);
    vL = L("vf");
    if (hasAudio) {
      af.push(`[${aL}]atrim=0:${fzLocal.toFixed(3)},asetpts=N/SR/TB[${L("afa")}]`);
      af.push(`anullsrc=r=44100:cl=stereo,atrim=0:${fzDur.toFixed(3)},asetpts=N/SR/TB[${L("afs")}]`);
      af.push(`[${aL}]atrim=start=${fzLocal.toFixed(3)},asetpts=N/SR/TB[${L("afb")}]`);
      af.push(`[${L("afa")}][${L("afs")}][${L("afb")}]concat=n=3:v=0:a=1[${L("af")}]`);
      aL = L("af");
    }
    curDur += fzDur;
  }

  if (rampActive && ramp) {
    const f = ramp.from, t = ramp.to, K = t - f, D = curDur;
    // setpts logarithmique : out(T) = (D/K)·ln((f + K·T/D)/f) — rampe de vitesse linéaire.
    vf.push(`[${vL}]setpts='(${D.toFixed(3)}/(${K.toFixed(4)}))*log((${f.toFixed(3)}+(${K.toFixed(4)})*T/${D.toFixed(3)})/${f.toFixed(3)})/TB'[${L("vr")}]`);
    vL = L("vr");
    if (hasAudio) { const avg = clamp((f + t) / 2, 0.25, 4); af.push(`[${aL}]${atempoStages(avg).map((s) => `atempo=${s}`).join(",")}[${L("ar")}]`); aL = L("ar"); }
  } else if (hasSpeed) {
    vf.push(`[${vL}]setpts=PTS/${spd.toFixed(4)}[${L("vs")}]`);
    vL = L("vs");
    if (hasAudio) { af.push(`[${aL}]${atempoStages(spd).map((s) => `atempo=${s}`).join(",")}[${L("as")}]`); aL = L("as"); }
  }

  if (rev) {
    vf.push(`[${vL}]reverse[${L("vv")}]`); vL = L("vv");
    if (hasAudio) { af.push(`[${aL}]areverse[${L("aa")}]`); aL = L("aa"); }
  }

  vf.push(`[${vL}]format=yuv420p[vout]`);
  if (hasAudio) af.push(`[${aL}]aresample=44100[aout]`);

  const out = path.join(dir, `timed_${idx}.mp4`);
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  if (start > 0) args.push("-ss", start.toFixed(3));
  args.push("-t", segLen.toFixed(3), "-i", abs, "-filter_complex", [...vf, ...af].join(";"), "-map", "[vout]");
  if (hasAudio) args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "160k");
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", String(fps), out);
  const { code, stderr } = await runFFmpeg(args, 4 * 60 * 1000);
  if (code !== 0) { console.warn("[ai-editor/render] timeEffectClip KO:", stderr.slice(-200)); return null; }
  const { dur } = await probeAV(out);
  return { path: out, durationSec: Math.max(0.1, dur), hasAudio };
}

/* ── Composition multi-média (chantier 4) : pré-rend un plan avec ses overlays et
   son layout (splitV/splitH/pip) dans UN fichier WxH → le graphe principal garde
   1 entrée/plan. base = source déjà coupée/retimée. Renvoie null si rien à composer. */
async function compositeClip(
  materials: { id: string; storedName: string; kind: string }[],
  userId: string, projectId: string,
  seg: EditSegment, base: { abs: string; start: number; len: number; hasAudio: boolean; loop?: boolean },
  W: number, H: number, fps: number, bg: string, dir: string, idx: number,
): Promise<{ path: string; durationSec: number; hasAudio: boolean } | null> {
  const layout: SegLayout = seg.layout && ["splitH", "splitV", "pip"].includes(seg.layout) ? seg.layout : "single";
  const resolved: { abs: string; kind: string; o: SegOverlay }[] = [];
  for (const o of (seg.overlays ?? []).slice(0, 6)) {
    const mat = materials.find((m) => m.id === o?.materialId);
    if (!mat || mat.kind === "audio") continue;
    const oabs = materialAbsPath(userId, projectId, mat.storedName);
    try { await fs.access(oabs); } catch { continue; }
    resolved.push({ abs: oabs, kind: mat.kind, o });
  }
  if (layout === "single" && !resolved.length) return null;   // rien à composer
  if (layout !== "single" && !resolved.length) return null;   // split sans 2e média → ignore

  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  if (base.loop) args.push("-loop", "1");
  if (base.start > 0) args.push("-ss", base.start.toFixed(3));
  args.push("-t", base.len.toFixed(3), "-i", base.abs);
  for (const r of resolved) {
    if (r.kind === "image") args.push("-loop", "1", "-t", base.len.toFixed(3), "-i", r.abs);
    else args.push("-t", base.len.toFixed(3), "-i", r.abs);
  }

  const vf: string[] = [];
  const half = layout === "splitV" ? `${W}:${Math.round(H / 2)}` : layout === "splitH" ? `${Math.round(W / 2)}:${H}` : `${W}:${H}`;
  vf.push(`[0:v]scale=${half}:force_original_aspect_ratio=increase,crop=${half},setsar=1,fps=${fps},format=yuv420p[base]`);
  let acc = "cv0";
  vf.push(`[base]pad=${W}:${H}:0:0:color=${bg}[${acc}]`); // base en haut/gauche (split) ou plein (pip)
  let firstPip = 0;
  if ((layout === "splitV" || layout === "splitH")) {
    vf.push(`[1:v]scale=${half}:force_original_aspect_ratio=increase,crop=${half},setsar=1,fps=${fps},format=yuv420p[p1]`);
    const pos = layout === "splitV" ? `0:${Math.round(H / 2)}` : `${Math.round(W / 2)}:0`;
    vf.push(`[${acc}][p1]overlay=${pos}[cv1]`); acc = "cv1"; firstPip = 1;
  }
  // Overlays restants en PIP (triés par zIndex), scale/opacity/position + fenêtre.
  const pips = resolved.map((r, k) => ({ r, k })).slice(firstPip).sort((a, b) => num(a.r.o.zIndex, 0) - num(b.r.o.zIndex, 0));
  let ci = 2;
  for (const { r, k } of pips) {
    const inIdx = k + 1;
    const o = r.o;
    const wpx = Math.max(16, Math.round(clamp(num(o.width, 32), 5, 100) / 100 * W));
    const op = clamp(num(o.opacity, 1), 0, 1);
    const xp = Math.round(clamp(num(o.x, 62), 0, 100) / 100 * W);
    const yp = Math.round(clamp(num(o.y, 60), 0, 100) / 100 * H);
    const st = num(o.startSec, 0), en = num(o.endSec, base.len);
    const label = `ov${k}`;
    vf.push(`[${inIdx}:v]scale=${wpx}:-2,setsar=1,fps=${fps},format=rgba,colorchannelmixer=aa=${op.toFixed(3)}[${label}]`);
    vf.push(`[${acc}][${label}]overlay=${xp}:${yp}:enable='between(t,${st.toFixed(2)},${en.toFixed(2)})'[cv${ci}]`); acc = `cv${ci}`; ci++;
  }
  vf.push(`[${acc}]format=yuv420p[vout]`);

  const out = path.join(dir, `comp_${idx}.mp4`);
  args.push("-filter_complex", vf.join(";"), "-map", "[vout]");
  if (base.hasAudio) args.push("-map", "0:a?", "-c:a", "aac", "-b:a", "160k");
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", String(fps), out);
  const { code, stderr } = await runFFmpeg(args, 5 * 60 * 1000);
  if (code !== 0) { console.warn("[ai-editor/render] compositeClip KO:", stderr.slice(-200)); return null; }
  const { dur } = await probeAV(out);
  return { path: out, durationSec: Math.max(0.1, dur), hasAudio: base.hasAudio };
}

export async function renderVariant(
  userId: string,
  projectId: string,
  plan: EditPlan,
  extra?: { derivedFrom?: string },
): Promise<{ variant: ProjectVariant; keyframes: OutKeyframe[]; durationSec: number } | { error: string }> {
  const project = await getProject(userId, projectId);
  if (!project) return { error: "Projet introuvable." };

  const segs = Array.isArray(plan.segments) ? plan.segments.slice(0, MAX_SEGMENTS) : [];
  if (segs.length === 0) return { error: "Le plan doit contenir au moins un segment." };
  const [W, H] = CANVAS[plan.aspect ?? "9:16"] ?? CANVAS["9:16"];
  const fps = Math.round(clamp(num(plan.fps, 30), 15, 60));
  const bg = hex(plan.background, "#000000").replace("#", "0x"); // ffmpeg color

  // Dossier temp créé AVANT la boucle : les pré-rendus vitesse (timeEffectClip) y écrivent.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_render_"));
  const inputs: string[] = [];
  const vlabels: string[] = [];
  const alabels: string[] = [];
  const durs: number[] = [];
  const filters: string[] = [];
  // dir est créé avant la boucle → nettoyage sur les retours d'erreur de validation.
  const cleanFail = async (error: string): Promise<{ error: string }> => {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    return { error };
  };

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const mat = project.materials.find((m) => m.id === seg.materialId);
    if (!mat) return cleanFail(`Matière introuvable : ${seg.materialId}. Utilise l'"id" exact renvoyé par list_material.`);
    if (mat.kind === "audio") return cleanFail(`${mat.name} est un fichier audio — mets-le dans le champ "audio" (piste sonore), pas dans segments.`);
    const abs = materialAbsPath(userId, projectId, mat.storedName);
    try { await fs.access(abs); } catch { return cleanFail(`Fichier manquant pour ${mat.name}.`); }
    // Recadrage (chantier 2) : flip/rotate/punch-in appliqué AVANT fit/motion.
    const pre = spatialPrefix(seg, bg);

    if (mat.kind === "image") {
      const dur = Math.max(0.3, seg.endSec != null && seg.startSec != null ? seg.endSec - seg.startSec : seg.endSec ?? IMG_DEFAULT_SEC);
      // Composition (chantier 4) sur une image de base.
      const comp = (seg.overlays?.length || (seg.layout && seg.layout !== "single"))
        ? await compositeClip(project.materials, userId, projectId, seg, { abs, start: 0, len: dur, hasAudio: false, loop: true }, W, H, fps, bg, dir, i)
        : null;
      if (comp) {
        inputs.push("-i", comp.path);
        filters.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${bg},setsar=1,fps=${fps},format=yuv420p[v${i}]`);
        filters.push(`anullsrc=r=44100:cl=stereo,atrim=0:${comp.durationSec.toFixed(3)},asetpts=N/SR/TB[a${i}]`);
        durs.push(comp.durationSec);
      } else {
        const motion = normMotion(seg.motion);
        const intensity = clamp(num(seg.motionIntensity, 1), 0.2, 3);
        // Défaut blurFill (image sur fond flou) : meilleur que des bandes noires sur du vertical.
        const fit: SegFit = seg.fit === "cover" || seg.fit === "contain" ? seg.fit : "blurFill";
        // handheld/none = image bouclée bornée (-t) ; zoom/pan = 1 seule image (zoompan la déploie).
        if (motion === "none" || motion === "handheld") inputs.push("-loop", "1", "-t", dur.toFixed(3), "-i", abs);
        else inputs.push("-i", abs);
        filters.push(imageVideoFilter(i, W, H, fps, bg, dur, motion, intensity, fit, pre));
        filters.push(`anullsrc=r=44100:cl=stereo,atrim=0:${dur.toFixed(3)},asetpts=N/SR/TB[a${i}]`);
        durs.push(dur);
      }
    } else {
      const { dur: fullDur, hasAudio } = await probeAV(abs);
      const start = seg.startSec != null ? Math.max(0, num(seg.startSec, 0)) : 0;
      const end = seg.endSec != null ? num(seg.endSec, 0) : null;
      const segLen = Math.max(0.1, (end != null ? end : fullDur) - start);
      // Effets VITESSE (chantier 1) : si le plan a speed/freeze/rampe/reverse, on
      // pré-rend un clip retimé (durée PROBÉE) qu'on injecte comme source du plan.
      const timed = await timeEffectClip(abs, start, segLen, seg, dir, i, fps);
      // Composition (chantier 4) : overlays/layout → pré-rend un plan composité WxH.
      const baseSrc = timed
        ? { abs: timed.path, start: 0, len: timed.durationSec, hasAudio: timed.hasAudio }
        : { abs, start, len: segLen, hasAudio };
      const comp = (seg.overlays?.length || (seg.layout && seg.layout !== "single"))
        ? await compositeClip(project.materials, userId, projectId, seg, baseSrc, W, H, fps, bg, dir, i)
        : null;
      if (comp) {
        inputs.push("-i", comp.path); // déjà WxH composité
        filters.push(`[${i}:v]setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${bg},setsar=1,fps=${fps},format=yuv420p[v${i}]`);
        if (comp.hasAudio) filters.push(`[${i}:a]asetpts=N/SR/TB,aresample=44100,aformat=channel_layouts=stereo[a${i}]`);
        else filters.push(`anullsrc=r=44100:cl=stereo,atrim=0:${comp.durationSec.toFixed(3)},asetpts=N/SR/TB[a${i}]`);
        durs.push(comp.durationSec);
      } else if (timed) {
        inputs.push("-i", timed.path); // déjà coupé + retimé (pas de re-cut)
        filters.push(`[${i}:v]setpts=PTS-STARTPTS,${pre}scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${bg},setsar=1,fps=${fps},format=yuv420p[v${i}]`);
        if (timed.hasAudio) filters.push(`[${i}:a]asetpts=N/SR/TB,aresample=44100,aformat=channel_layouts=stereo[a${i}]`);
        else filters.push(`anullsrc=r=44100:cl=stereo,atrim=0:${timed.durationSec.toFixed(3)},asetpts=N/SR/TB[a${i}]`);
        durs.push(timed.durationSec);
      } else {
        // Coupe au niveau de l'INPUT (-ss/-t), PAS par le filtre trim : sur d'anciennes
        // versions ffmpeg le filtre trim ignore 'start' (le plan repartait du début du
        // rush). -ss avant -i = seek précis (décodé) sur ffmpeg ≥ 4 ; -t borne la durée.
        // startSec/endSec = points d'entrée/sortie DANS le fichier (cf. get_material).
        if (start > 0) inputs.push("-ss", start.toFixed(3));
        inputs.push("-t", segLen.toFixed(3), "-i", abs);
        filters.push(`[${i}:v]setpts=PTS-STARTPTS,${pre}scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${bg},setsar=1,fps=${fps},format=yuv420p[v${i}]`);
        if (hasAudio) {
          // L'audio est déjà coupé par le seek d'input → pas de re-trim (sync garantie).
          filters.push(`[${i}:a]asetpts=N/SR/TB,aresample=44100,aformat=channel_layouts=stereo[a${i}]`);
        } else {
          filters.push(`anullsrc=r=44100:cl=stereo,atrim=0:${segLen.toFixed(3)},asetpts=N/SR/TB[a${i}]`);
        }
        durs.push(segLen);
      }
    }
    vlabels.push(`[v${i}]`);
    alabels.push(`[a${i}]`);
  }

  const outPath = path.join(dir, "variant.mp4");
  const posterPath = path.join(dir, "poster.jpg");

  try {
    // Assemblage → sortie fixe [vasm][aasm]. Soit concat sec (cut), soit un
    // fold xfade/acrossfade quand des transitions sont demandées. Sortie fixe →
    // repli propre sur le concat si les transitions échouent.
    const wantTransitions = segs.some((s, i) => i > 0 && xfadeName(s.transition));
    // Durée totale du montage (identique au calcul d'assemblage) — sert à caler la
    // piste audio en mode "replace" (pad/coupe exacte).
    const totalVideoDur = (): number => {
      if (!wantTransitions) return durs.reduce((a, b) => a + b, 0);
      let acc = durs[0];
      for (let i = 1; i < segs.length; i++) {
        const name = xfadeName(segs[i].transition);
        const ti = name ? clamp(Math.min(num(segs[i].transitionDuration, 0.25), durs[i] * 0.9, durs[i - 1] * 0.9), 0.05, 1.0) : 0;
        acc += ti <= 0 ? durs[i] : durs[i] - ti;
      }
      return acc;
    };
    const assemble = (useTrans: boolean): string[] => {
      if (!useTrans) {
        const interleaved = segs.map((_, i) => `${vlabels[i]}${alabels[i]}`).join("");
        return [`${interleaved}concat=n=${segs.length}:v=1:a=1[vasm][aasm]`];
      }
      const af: string[] = [];
      let vAcc = "v0", aAcc = "a0", accDur = durs[0];
      for (let i = 1; i < segs.length; i++) {
        const name = xfadeName(segs[i].transition);
        const ti = name ? clamp(Math.min(num(segs[i].transitionDuration, 0.25), durs[i] * 0.9, durs[i - 1] * 0.9), 0.05, 1.0) : 0;
        const vo = `vt${i}`, ao = `at${i}`;
        if (ti <= 0) { // cut → concat 2 à 2
          af.push(`[${vAcc}][v${i}]concat=n=2:v=1:a=0[${vo}]`, `[${aAcc}][a${i}]concat=n=2:v=0:a=1[${ao}]`);
          accDur += durs[i];
        } else { // crossfade vidéo + audio, borné à la durée des plans
          const offset = Math.max(0, accDur - ti);
          af.push(`[${vAcc}][v${i}]xfade=transition=${name}:duration=${ti.toFixed(3)}:offset=${offset.toFixed(3)}[${vo}]`, `[${aAcc}][a${i}]acrossfade=d=${ti.toFixed(3)}[${ao}]`);
          accDur += durs[i] - ti;
        }
        vAcc = vo; aAcc = ao;
      }
      af.push(`[${vAcc}]null[vasm]`, `[${aAcc}]anull[aasm]`);
      return af;
    };

    // Colorimétrie globale (après assemblage, avant captions).
    const grade = gradeChain(plan.grade);
    const gradeFilters = grade ? [`[vasm]${grade}[graded]`] : [];
    const gbase = grade ? "graded" : "vasm";

    // Captions (chantier 3 : animées) : PNG sharp + overlay chaînés depuis gbase.
    // Pour les anims temporelles, l'image est BOUCLÉE (-loop 1 -t vidDur) → les
    // filtres peuvent utiliser le temps absolu (fade/slide/typewriter). Les anims
    // par mot (wordByWord/karaoke) génèrent plusieurs PNG timés.
    const captionFilters: string[] = [];
    let last = gbase;
    const caps = (plan.captions ?? []).slice(0, MAX_CAPTIONS).filter((c) => c?.text?.trim());
    const planEmoji: EmojiStyle = plan.emojiStyle === "flat" ? "flat" : "3d";
    const vidDur = totalVideoDur();
    let capIn = inputs.reduce((n, a) => (a === "-i" ? n + 1 : n), 0); // index d'entrée du 1er PNG caption
    let ccN = 0; // compteur d'étapes d'overlay (labels uniques)
    const overlay = (src: number | string, st: number, en: number, posExpr = "0:0") => {
      const inLabel = typeof src === "number" ? `${src}:v` : src; // index d'entrée OU label de filtre
      const out = `cc${ccN++}`;
      captionFilters.push(`[${last}][${inLabel}]overlay=${posExpr}:enable='between(t,${st.toFixed(2)},${en.toFixed(2)})'[${out}]`);
      last = out;
    };
    // Découpe le texte en mots avec timing (fournis, sinon répartis sur [st,en]).
    const wordTiming = (c: EditCaption, st: number, en: number): { text: string; start: number; end: number }[] => {
      if (Array.isArray(c.words) && c.words.length && c.words.every((w) => w && typeof w.text === "string")) {
        return c.words.slice(0, 16).map((w) => ({ text: w.text, start: num(w.start, st), end: num(w.end, en) }));
      }
      const ws = c.text.trim().split(/\s+/).filter(Boolean).slice(0, 16);
      const span = Math.max(0.2, en - st) / Math.max(1, ws.length);
      return ws.map((t, i) => ({ text: t, start: st + i * span, end: st + (i + 1) * span }));
    };
    try {
      for (let k = 0; k < caps.length; k++) {
        const c = caps[k];
        const es: EmojiStyle = c.emojiStyle === "flat" || c.emojiStyle === "3d" ? c.emojiStyle : planEmoji;
        const anim = c.animation ?? "none";
        const st = num(c.startSec, 0), en = num(c.endSec, 3);
        const ad = clamp(num(c.animationDuration, 0.35), 0.05, 2);

        if (anim === "wordByWord") {
          const wt = wordTiming(c, st, en);
          for (let wi = 0; wi < wt.length; wi++) {
            const png = path.join(dir, `cap${k}_w${wi}.png`);
            await captionPng({ ...c, text: wt.slice(0, wi + 1).map((w) => w.text).join(" ") }, W, H, png, es);
            inputs.push("-i", png);
            overlay(capIn++, wt[wi].start, wi < wt.length - 1 ? wt[wi + 1].start : en); // fenêtres disjointes
          }
        } else if (anim === "karaoke") {
          const wt = wordTiming(c, st, en);
          const hlC = hex(c.highlightColor, "#ffd400");
          const base = path.join(dir, `cap${k}_base.png`);
          await captionPng(c, W, H, base, es);
          inputs.push("-i", base); overlay(capIn++, st, en);          // texte complet, tout le temps
          for (let wi = 0; wi < wt.length; wi++) {
            const png = path.join(dir, `cap${k}_hl${wi}.png`);
            await captionPng(c, W, H, png, es, wi, hlC);               // mot wi surligné
            inputs.push("-i", png); overlay(capIn++, wt[wi].start, wt[wi].end); // par-dessus, pendant le mot
          }
        } else {
          const png = path.join(dir, `cap${k}.png`);
          await captionPng(c, W, H, png, es);
          if (anim === "none") { inputs.push("-i", png); overlay(capIn++, st, en); continue; }
          // Anims temporelles : image bouclée → filtres à temps absolu.
          inputs.push("-loop", "1", "-t", vidDur.toFixed(3), "-i", png);
          const inIdx = capIn++;
          const capf = `capf${k}`;
          if (anim === "fade") {
            captionFilters.push(`[${inIdx}:v]format=rgba,fade=t=in:st=${st.toFixed(2)}:d=${ad.toFixed(2)}:alpha=1,fade=t=out:st=${(en - ad).toFixed(2)}:d=${ad.toFixed(2)}:alpha=1[${capf}]`);
            overlay(capf, st, en);
          } else if (anim === "pop") {
            const pd = Math.min(ad, 0.18);
            captionFilters.push(`[${inIdx}:v]format=rgba,fade=t=in:st=${st.toFixed(2)}:d=${pd.toFixed(2)}:alpha=1,fade=t=out:st=${(en - ad).toFixed(2)}:d=${ad.toFixed(2)}:alpha=1[${capf}]`);
            overlay(capf, st, en);
          } else if (anim === "typewriter") {
            // Révélation gauche→droite : on masque l'alpha des pixels à droite du
            // seuil mobile (taille de sortie constante, contrairement à crop). geq.
            captionFilters.push(`[${inIdx}:v]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X,W*min(1,max(0,(T-${st.toFixed(2)})/${ad.toFixed(2)}))),alpha(X,Y),0)'[${capf}]`);
            overlay(capf, st, en);
          } else { // slideUp
            captionFilters.push(`[${inIdx}:v]format=rgba,fade=t=in:st=${st.toFixed(2)}:d=${ad.toFixed(2)}:alpha=1[${capf}]`);
            overlay(capf, st, en, `x=0:y='if(between(t,${st.toFixed(2)},${(st + ad).toFixed(2)}),(1-(t-${st.toFixed(2)})/${ad.toFixed(2)})*${Math.round(H * 0.05)},0)'`);
          }
        }
      }
    } catch (e) {
      console.warn("[ai-editor/render] captions ignorées:", (e as Error)?.message);
      last = gbase;
    }
    const voutFilter = `[${last}]null[vout]`;

    // Piste audio optionnelle (musique/voix depuis une matière audio OU le son
    // d'un rush vidéo) mixée par-dessus le son des plans, ou en remplacement.
    const audioFilters: string[] = [];
    let audioMap = "[aasm]";
    if (plan.audio && typeof plan.audio.materialId === "string") {
      const tmat = project.materials.find((m) => m.id === plan.audio!.materialId);
      const tabs = tmat && tmat.kind !== "image" ? materialAbsPath(userId, projectId, tmat.storedName) : null;
      let hasA = false;
      if (tabs) { try { await fs.access(tabs); hasA = (await probeAV(tabs)).hasAudio; } catch { hasA = false; } }
      if (tabs && hasA) {
        const startSec = Math.max(0, num(plan.audio.startSec, 0));
        const vol = clamp(num(plan.audio.volume, 1), 0, 2);
        const replace = plan.audio.mode === "replace";
        const tIdx = inputs.reduce((n, a) => (a === "-i" ? n + 1 : n), 0);
        inputs.push("-i", tabs);
        const trk = `[${tIdx}:a]atrim=start=${startSec.toFixed(3)},asetpts=N/SR/TB,aresample=44100,aformat=channel_layouts=stereo,volume=${vol.toFixed(3)}`;
        if (replace) {
          // REMPLACE : le son des plans n'est PAS mixé (pas d'amix, pas de 2e entrée).
          // On mappe UNIQUEMENT la piste externe, calée sur la durée du montage
          // (apad puis atrim → silence si trop courte, coupe si trop longue). [aasm]
          // (son des plans) est consommé par anullsink pour ne pas rester pendant.
          const total = totalVideoDur().toFixed(3);
          audioFilters.push(
            `[aasm]anullsink`,
            `${trk},apad,atrim=0:${total},asetpts=N/SR/TB[arep]`,
          );
          audioMap = "[arep]";
        } else {
          // MIX : musique par-dessus le son des plans. Sans l'option 'normalize'
          // (absente des vieilles versions ffmpeg → cassait le rendu) : amix normalise
          // en divisant par le nb d'entrées (2) → on rétablit le niveau plein (volume=2).
          audioFilters.push(
            `[aasm]aresample=44100,aformat=channel_layouts=stereo[abed]`,
            `${trk}[atrk]`,
            `[abed][atrk]amix=inputs=2:duration=first[amx]`,
            `[amx]volume=2[amixed]`,
          );
          audioMap = "[amixed]";
        }
      }
    }

    const buildArgs = (useTrans: boolean): string[] => [
      "-y", "-hide_banner", "-loglevel", "error",
      ...inputs,
      "-filter_complex", [...filters, ...assemble(useTrans), ...gradeFilters, ...captionFilters, voutFilter, ...audioFilters].join(";"),
      "-map", "[vout]", "-map", audioMap,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-r", String(fps),
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outPath,
    ];

    let { code, stderr } = await runFFmpeg(buildArgs(wantTransitions), 10 * 60 * 1000);
    if (code !== 0 && wantTransitions) {
      console.warn("[ai-editor/render] transitions échouées → repli sur cut:", stderr.slice(-160));
      ({ code, stderr } = await runFFmpeg(buildArgs(false), 10 * 60 * 1000));
    }
    if (code !== 0) return { error: `Rendu FFmpeg échoué : ${stderr.slice(-240)}` };

    const { dur: outDur } = await probeAV(outPath);

    let poster: string | null = null;
    try {
      const r = await runFFmpeg(["-y", "-hide_banner", "-loglevel", "error", "-ss", "0.5", "-i", outPath, "-frames:v", "1", "-vf", "scale=480:-2", posterPath], 30_000);
      if (r.code === 0) {
        const buf = await fs.readFile(posterPath);
        if (buf.length) poster = `data:image/jpeg;base64,${buf.toString("base64")}`;
      }
    } catch { /* poster best-effort */ }

    const keyframes = await extractKeyframes(outPath, outDur, dir, 5);

    const durationSec = Math.round(outDur * 100) / 100;
    const variant = await addVariant(userId, projectId, { srcPath: outPath, poster, label: plan.label, plan: plan as unknown as Record<string, unknown>, durationSec, derivedFrom: extra?.derivedFrom });
    if (!variant) return { error: "Enregistrement de la variante échoué." };
    return { variant, keyframes, durationSec };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ── Probe durée + présence d'audio (ffmpeg -i, lecture stderr) ───────────── */
async function probeAV(p: string): Promise<{ dur: number; hasAudio: boolean }> {
  const { stderr } = await runFFmpeg(["-hide_banner", "-i", p], 30_000, 64_000);
  const d = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const dur = d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0;
  return { dur, hasAudio: /Stream #.*Audio:/.test(stderr) };
}

/** Keyframes d'une variante DÉJÀ rendue (pour get_variant / auto-correction). */
export async function variantKeyframes(userId: string, projectId: string, storedName: string, count = 5): Promise<OutKeyframe[]> {
  const filePath = path.join(projectPaths(userId, projectId).variantsDir, storedName);
  try { await fs.access(filePath); } catch { return []; }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_kf_"));
  try {
    const { dur } = await probeAV(filePath);
    return await extractKeyframes(filePath, dur, dir, count);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Keyframes d'un fichier de MATIÈRE (pour get_material : voir un rush précis). */
export async function materialKeyframes(userId: string, projectId: string, storedName: string, count = 6): Promise<OutKeyframe[]> {
  const filePath = materialAbsPath(userId, projectId, storedName);
  try { await fs.access(filePath); } catch { return []; }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_mkf_"));
  try {
    const { dur } = await probeAV(filePath);
    return await extractKeyframes(filePath, dur, dir, count);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
