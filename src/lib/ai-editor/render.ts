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

export type SegMotion = "none" | "zoomIn" | "zoomOut" | "panLeft" | "panRight";
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
};

export type ColorGrade = {
  saturation?: number;   // 1 = neutre
  contrast?: number;     // 1 = neutre
  brightness?: number;   // 0 = neutre (-1..1)
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
   texte SVG sortait en carrés (tofu). On embarque une police (public/fonts/) et
   on restreint fontconfig À CE dossier : toute font-family retombe alors sur
   notre police (seule dispo) — jamais de tofu, sans rien installer sur Railway. */
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

/** Rasterise une caption stylée (contour OU boîte, position/taille/couleur libres). */
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

  const lineH = Math.round(fsz * 1.24);
  const maxChars = Math.max(8, Math.floor(W / (fsz * 0.56)));
  const words = c.text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur ? cur + " " + w : w).length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  const used = lines.slice(0, 5);
  const n = used.length;
  const longest = used.reduce((m, l) => Math.max(m, l.length), 0);

  // Position : x/y en % prioritaires ; sinon top/center/bottom.
  const yPctDefault = c.position === "top" ? 12 : c.position === "center" ? 50 : 85;
  const yPct = clamp(num(c.y, yPctDefault), 4, 96);
  const xPct = clamp(num(c.x, 50), 4, 96);
  const anchorX = Math.round((W * xPct) / 100);
  const blockH = n * lineH;
  const centerY = Math.round((H * yPct) / 100);
  const firstBaseline = centerY - Math.round(blockH / 2) + fsz;
  const tspans = used.map((l, i) => `<tspan x="${anchorX}" y="${firstBaseline + i * lineH}">${esc(l)}</tspan>`).join("");

  let body: string;
  if (style === "box") {
    const boxW = Math.round(Math.min(W * 0.94, longest * fsz * 0.62 + fsz));
    const boxX = clamp(align === "start" ? anchorX - Math.round(fsz * 0.4) : align === "end" ? anchorX - boxW + Math.round(fsz * 0.4) : anchorX - Math.round(boxW / 2), 6, W - boxW - 6);
    const boxY = firstBaseline - fsz;
    body = `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${blockH + Math.round(fsz * 0.5)}" rx="16" fill="${boxColor}" fill-opacity="${boxOpacity}"/>
      <text text-anchor="${align}" font-family="sans-serif" font-weight="800" font-size="${fsz}" fill="${color}">${tspans}</text>`;
  } else {
    // Contour : 2 passes (base épaisse dessous + remplissage dessus) — portable.
    body = `<text text-anchor="${align}" font-family="sans-serif" font-weight="900" font-size="${fsz}" fill="${strokeColor}" stroke="${strokeColor}" stroke-width="${strokeW}" stroke-linejoin="round">${tspans}</text>
      <text text-anchor="${align}" font-family="sans-serif" font-weight="900" font-size="${fsz}" fill="${color}">${tspans}</text>`;
  }
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  await fs.writeFile(outPath, await sharp(Buffer.from(svg)).png().toBuffer());
}

/** Extrait ~5 keyframes du rendu (data URI JPEG) → le monteur VOIT son résultat. */
async function extractKeyframes(videoPath: string, durationSec: number, dir: string, count = 5): Promise<OutKeyframe[]> {
  const out: OutKeyframe[] = [];
  const total = durationSec > 0 ? durationSec : 1;
  for (let i = 0; i < count; i++) {
    const t = Math.max(0.1, (total * (i + 0.5)) / count);
    const p = path.join(dir, `okf_${i}.jpg`);
    const { code } = await runFFmpeg(
      ["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(2), "-i", videoPath, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", "-y", p],
      20_000,
    );
    if (code !== 0) continue;
    try {
      const b = await fs.readFile(p);
      await fs.unlink(p).catch(() => {});
      if (b.length) out.push({ t: Math.round(t * 100) / 100, dataUri: `data:image/jpeg;base64,${b.toString("base64")}` });
    } catch { /* skip */ }
  }
  return out;
}

/** Normalise le nom de mouvement (accepte kebab et camelCase). */
function normMotion(m: unknown): SegMotion {
  const s = String(m ?? "none").replace(/-/g, "").toLowerCase();
  if (s === "zoomin") return "zoomIn";
  if (s === "zoomout") return "zoomOut";
  if (s === "panleft") return "panLeft";
  if (s === "panright") return "panRight";
  return "none";
}

/** Filtre vidéo d'un segment IMAGE (cadrage + éventuel mouvement Ken Burns). */
function imageVideoFilter(i: number, W: number, H: number, fps: number, bg: string, dur: number, motion: SegMotion, intensity: number, fit: SegFit): string {
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
  const grain = num(g.grain, 0);
  if (grain > 0) parts.push(`noise=alls=${Math.round(clamp(grain, 0, 1) * 40)}:allf=t+u`);
  if (g.vignette) parts.push(`vignette=PI/4`);
  return parts.join(",");
}

export async function renderVariant(
  userId: string,
  projectId: string,
  plan: EditPlan,
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
      const fit: SegFit = seg.fit === "cover" || seg.fit === "blurFill" ? seg.fit : "contain";
      if (motion === "none") inputs.push("-loop", "1", "-t", dur.toFixed(3), "-i", abs);
      else inputs.push("-i", abs); // 1 seule image → zoompan la déploie (pas de -loop = pas de flux infini)
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

    const variant = await addVariant(userId, projectId, { srcPath: outPath, poster, label: plan.label });
    if (!variant) return { error: "Enregistrement de la variante échoué." };
    return { variant, keyframes, durationSec: Math.round(outDur * 100) / 100 };
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
