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
export type EditSegment = {
  materialId: string;
  startSec?: number;
  endSec?: number;
  motion?: SegMotion | "zoom-in" | "zoom-out";
  motionIntensity?: number;
  fit?: SegFit;
  transition?: SegTransition;      // à l'ENTRÉE du plan (le 1er reste en cut)
  transitionDuration?: number;     // secondes (0.1-0.4 typique), bornée à la durée
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
// Les emojis ne sont PAS rendus par une police (les polices couleur COLR/CBDT ne
// sont pas fiables sous librsvg selon la build). On les composite en SVG Twemoji
// (couleur, plat, lisible en petit ; identique quel que soit l'environnement). Si
// un asset ne peut être récupéré, repli sur cette police mono → jamais de tofu.
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

/* ── Emojis en couleur via assets Twemoji (CC-BY 4.0) compositée dans le SVG.
   Fiable partout (pas de dépendance à une police couleur). Récupérés au CDN
   jsDelivr (tag immuable) puis mis en cache disque + mémoire ; repli mono si KO. */
const _seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const isEmojiGrapheme = (g: string) => EMOJI_RE.test(g);
/** Nom de fichier Twemoji d'un grapheme (règle officielle : on retire FE0F sauf
 *  si séquence ZWJ), ex. "🔥" → "1f525", "👋🏽" → "1f44b-1f3fd". */
function twemojiName(g: string): string {
  const s = g.indexOf("‍") < 0 ? g.replace(/️/g, "") : g;
  const cps: string[] = [];
  for (const ch of s) cps.push(ch.codePointAt(0)!.toString(16));
  return cps.join("-");
}
const TWEMOJI_DIR = path.join(os.tmpdir(), "duup_twemoji");
const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/";
const _emojiMem = new Map<string, string | null>();
/** SVG d'un emoji (ou null si introuvable). Cache mémoire → disque → CDN. */
async function emojiSvg(name: string): Promise<string | null> {
  if (_emojiMem.has(name)) return _emojiMem.get(name)!;
  const file = path.join(TWEMOJI_DIR, `${name}.svg`);
  let out: string | null = null;
  try { out = await fs.readFile(file, "utf8"); } catch {}
  if (!out) {
    try {
      const r = await fetch(TWEMOJI_BASE + name + ".svg", { signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const t = await r.text();
        if (t.includes("<svg")) {
          out = t;
          await fs.mkdir(TWEMOJI_DIR, { recursive: true }).catch(() => {});
          await fs.writeFile(file, t, "utf8").catch(() => {});
        }
      }
    } catch {}
  }
  _emojiMem.set(name, out);
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
 *  contour OU boîte, ombre portée, position libre. Emojis couleur (Twemoji). */
async function captionPng(c: EditCaption, W: number, H: number, outPath: string): Promise<void> {
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
  const emojiBox = Math.round(fsz * 0.98);
  const emojiPad = Math.round(fsz * 0.08);
  const emojiTop = Math.round(emojiBox * 0.82); // décalage baseline → haut de l'image

  // Mise en page ligne par ligne : on mesure chaque run texte (police réelle) et
  // on réserve une case carrée par emoji, pour placer chaque élément au pixel.
  type Placed = { x: number; kind: "text" | "emoji-img" | "emoji-text"; s?: string; b64?: string };
  const placedLines: Array<{ baseline: number; runs: Placed[]; width: number }> = [];
  let maxLineW = 0;
  for (let i = 0; i < used.length; i++) {
    const runs = segmentRuns(used[i]);
    // 1er passage : largeur d'avance de chaque run.
    const measured: Array<{ adv: number; kind: "text" | "emoji-img" | "emoji-text"; s?: string; b64?: string }> = [];
    for (const r of runs) {
      if (r.t === "text") {
        measured.push({ adv: await measureInk(sharp, r.s, textAttrs, fsz), kind: "text", s: r.s });
      } else {
        const svg = await emojiSvg(twemojiName(r.g));
        if (svg) measured.push({ adv: emojiBox + 2 * emojiPad, kind: "emoji-img", b64: Buffer.from(svg).toString("base64") });
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
      placed.push({ x, kind: r.kind, s: r.s, b64: r.b64 });
      x += r.adv;
    }
    placedLines.push({ baseline, runs: placed, width: lineW });
  }

  // Éléments SVG : ombre (texte only), fond (box), traits/emplis, images emoji.
  const shadowEls: string[] = [];
  const mainEls: string[] = [];
  const pushText = (x: number, y: number, attrs: string, s: string) => {
    if (style === "outline") {
      mainEls.push(`<text x="${x}" y="${y}" ${attrs} fill="${strokeColor}" stroke="${strokeColor}" stroke-width="${strokeW}" stroke-linejoin="round">${esc(s)}</text>`);
    }
    mainEls.push(`<text x="${x}" y="${y}" ${attrs} fill="${color}">${esc(s)}</text>`);
  };
  for (const ln of placedLines) {
    for (const r of ln.runs) {
      if (r.kind === "emoji-img") {
        mainEls.push(`<image x="${r.x + emojiPad}" y="${ln.baseline - emojiTop}" width="${emojiBox}" height="${emojiBox}" xlink:href="data:image/svg+xml;base64,${r.b64}"/>`);
      } else {
        const attrs = r.kind === "emoji-text" ? emojiTextAttrs : textAttrs;
        shadowEls.push(`<text x="${r.x}" y="${ln.baseline}" ${attrs} fill="#000">${esc(r.s!)}</text>`);
        pushText(r.x, ln.baseline, attrs, r.s!);
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

/** Filtre vidéo d'un segment IMAGE (cadrage + éventuel mouvement Ken Burns). */
function imageVideoFilter(i: number, W: number, H: number, fps: number, bg: string, dur: number, motion: SegMotion, intensity: number, fit: SegFit): string {
  if (motion === "handheld") {
    // Tremblement procédural (sommes de sinus lissées) sur image bouclée -t dur.
    // Casse l'effet diaporama de façon naturelle (mieux qu'un zoom sur une fixe).
    const amp = 0.012 * intensity; // ~1.2% de la dimension à intensité 1
    const jx = `${(W * amp).toFixed(2)}*(sin(2*PI*1.7*t)+0.6*sin(2*PI*3.3*t+1.1))`;
    const jy = `${(H * amp).toFixed(2)}*(sin(2*PI*2.1*t+0.5)+0.6*sin(2*PI*4.3*t))`;
    const UW = Math.round(W * 1.12), UH = Math.round(H * 1.12);
    return `[${i}:v]scale=${UW}:${UH}:force_original_aspect_ratio=increase,crop=${UW}:${UH},` +
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
    return `[${i}:v]scale=${UW}:${UH}:force_original_aspect_ratio=increase,crop=${UW}:${UH},` +
      `zoompan=z='${zoom}':x='${x}':y='${y}':d=${frames}:s=${W}x${H}:fps=${fps},setsar=1,format=yuv420p[v${i}]`;
  }
  if (fit === "cover") {
    return `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${fps},format=yuv420p[v${i}]`;
  }
  if (fit === "blurFill") {
    return `[${i}:v]split=2[b${i}][f${i}];` +
      `[b${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=42[bb${i}];` +
      `[f${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease[ff${i}];` +
      `[bb${i}][ff${i}]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2,setsar=1,fps=${fps},format=yuv420p[v${i}]`;
  }
  // contain (défaut)
  return `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${bg},setsar=1,fps=${fps},format=yuv420p[v${i}]`;
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

  const inputs: string[] = [];
  const vlabels: string[] = [];
  const alabels: string[] = [];
  const durs: number[] = [];
  const filters: string[] = [];

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const mat = project.materials.find((m) => m.id === seg.materialId);
    if (!mat) return { error: `Matière introuvable : ${seg.materialId}. Utilise l'"id" exact renvoyé par list_material.` };
    if (mat.kind === "audio") return { error: `${mat.name} est un fichier audio — mets-le dans le champ "audio" (piste sonore), pas dans segments.` };
    const abs = materialAbsPath(userId, projectId, mat.storedName);
    try { await fs.access(abs); } catch { return { error: `Fichier manquant pour ${mat.name}.` }; }

    if (mat.kind === "image") {
      const dur = Math.max(0.3, seg.endSec != null && seg.startSec != null ? seg.endSec - seg.startSec : seg.endSec ?? IMG_DEFAULT_SEC);
      const motion = normMotion(seg.motion);
      const intensity = clamp(num(seg.motionIntensity, 1), 0.2, 3);
      // Défaut blurFill (image sur fond flou) : meilleur que des bandes noires sur du vertical.
      const fit: SegFit = seg.fit === "cover" || seg.fit === "contain" ? seg.fit : "blurFill";
      // handheld/none = image bouclée bornée (-t) ; zoom/pan = 1 seule image (zoompan la déploie).
      if (motion === "none" || motion === "handheld") inputs.push("-loop", "1", "-t", dur.toFixed(3), "-i", abs);
      else inputs.push("-i", abs);
      filters.push(imageVideoFilter(i, W, H, fps, bg, dur, motion, intensity, fit));
      filters.push(`anullsrc=r=44100:cl=stereo,atrim=0:${dur.toFixed(3)},asetpts=N/SR/TB[a${i}]`);
      durs.push(dur);
    } else {
      const { dur: fullDur, hasAudio } = await probeAV(abs);
      const start = seg.startSec != null ? num(seg.startSec, 0) : 0;
      const end = seg.endSec != null ? num(seg.endSec, 0) : null;
      const segLen = (end != null ? end : fullDur) - start;
      inputs.push("-i", abs);
      const s = seg.startSec != null ? `start=${start.toFixed(3)}` : "";
      const e = seg.endSec != null ? `end=${num(seg.endSec, 0).toFixed(3)}` : "";
      const trim = s || e ? `trim=${[s, e].filter(Boolean).join(":")},setpts=PTS-STARTPTS,` : "";
      filters.push(`[${i}:v]${trim}scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${bg},setsar=1,fps=${fps},format=yuv420p[v${i}]`);
      if (hasAudio) {
        const atrim = `atrim=start=${start.toFixed(3)}${end != null ? `:end=${end.toFixed(3)}` : ""},asetpts=N/SR/TB`;
        filters.push(`[${i}:a]${atrim},aresample=44100,aformat=channel_layouts=stereo[a${i}]`);
      } else {
        filters.push(`anullsrc=r=44100:cl=stereo,atrim=0:${Math.max(0.1, segLen).toFixed(3)},asetpts=N/SR/TB[a${i}]`);
      }
      durs.push(Math.max(0.1, segLen));
    }
    vlabels.push(`[v${i}]`);
    alabels.push(`[a${i}]`);
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_render_"));
  const outPath = path.join(dir, "variant.mp4");
  const posterPath = path.join(dir, "poster.jpg");

  try {
    // Assemblage → sortie fixe [vasm][aasm]. Soit concat sec (cut), soit un
    // fold xfade/acrossfade quand des transitions sont demandées. Sortie fixe →
    // repli propre sur le concat si les transitions échouent.
    const wantTransitions = segs.some((s, i) => i > 0 && xfadeName(s.transition));
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

    // Captions (générées 1 fois) : PNG sharp + overlay, chaînées depuis gbase.
    const captionFilters: string[] = [];
    let last = gbase;
    const caps = (plan.captions ?? []).slice(0, MAX_CAPTIONS).filter((c) => c?.text?.trim());
    try {
      for (let k = 0; k < caps.length; k++) {
        const c = caps[k];
        const png = path.join(dir, `cap${k}.png`);
        await captionPng(c, W, H, png);
        inputs.push("-i", png);
        const inIdx = segs.length + k;
        const out = `cc${k}`;
        captionFilters.push(`[${last}][${inIdx}:v]overlay=0:0:enable='between(t,${num(c.startSec, 0).toFixed(2)},${num(c.endSec, 3).toFixed(2)})'[${out}]`);
        last = out;
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
        const bedVol = plan.audio.mode === "replace" ? 0 : 1;
        const tIdx = inputs.reduce((n, a) => (a === "-i" ? n + 1 : n), 0);
        inputs.push("-i", tabs);
        audioFilters.push(
          `[aasm]volume=${bedVol}[abed]`,
          `[${tIdx}:a]atrim=start=${startSec.toFixed(3)},asetpts=N/SR/TB,aresample=44100,aformat=channel_layouts=stereo,volume=${vol.toFixed(3)}[atrk]`,
          `[abed][atrk]amix=inputs=2:duration=first:normalize=0[amixed]`,
        );
        audioMap = "[amixed]";
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
