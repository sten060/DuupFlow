// src/lib/ai-dup/caption-timing.ts
//
// ── QUAND LA CAPTION D'ORIGINE EST-ELLE À L'ÉCRAN ? (mesure, pas estimation) ─
// L'inspection Gemini donne des débuts / fins approximatifs : sur une vidéo
// testée le 16/11, elle arrêtait la caption ~2 s trop tôt → la boîte de
// réécriture disparaissait et l'ANCIENNE caption réapparaissait en clair.
//
// Mesure : on extrait la zone de la caption (5 images/s, niveaux de gris).
// Un texte incrusté a des pixels SOMBRES (contour, ou lettres noires sur
// boîte blanche) qui restent IMMOBILES pendant que le fond bouge. On garde
// comme « empreinte du texte » les pixels sombres dans au moins 75 % des
// images de la fenêtre Gemini (ce qui passe derrière — cheveux, vêtements —
// ne l'est pas aussi longtemps). La caption est là tant que la majorité de
// cette empreinte reste sombre. Les pixels CLAIRS ne servent qu'en repli :
// un mur blanc derrière le texte les rend trompeurs (vu le 16/11).
//
// Échec de la mesure (ffmpeg, zone vide…) → on garde la fenêtre Gemini.

import fs from "fs/promises";
import os from "os";
import path from "path";
import { runFFmpeg } from "@/lib/studio/pipeline";
import { REPLACE_SAME_TIMING_SEC } from "./config";
import type { AiDupAnalysis } from "./types";

const FPS = 5;
const SAMPLE_W = 240;
/** Part des images de la fenêtre où un pixel doit être sombre pour compter
 *  dans l'empreinte du texte. */
const CORE_SHARE = 0.75;
/** Part de l'empreinte qui doit rester sombre pour dire « la caption est là ». */
const PRESENT_SHARE = 0.6;
/** Trous tolérés dans la plage (images) : un flash, une transition. */
const MAX_GAP_FRAMES = 2;
/** Marge ajoutée de chaque côté (s) : mieux vaut une boîte un peu trop longue
 *  qu'une lettre d'origine visible une fraction de seconde. */
const MARGIN_SEC = 0.3;

const r1 = (v: number) => Math.round(v * 10) / 10;
const dark = (v: number) => v < 60;
const bright = (v: number) => v > 205;

/** Recale le début / la fin de la caption d'origine sur ce que montrent les
 *  pixels. Modifie `a.burnedCaption.boxes` sur place (l'analyse est en cache).
 *  Ne fait rien si la caption a plusieurs moments distincts. */
export async function measureCaptionTiming(a: AiDupAnalysis, videoPath: string): Promise<void> {
  const boxes = a.burnedCaption.boxes;
  if (!a.burnedCaption.present || !boxes.length || a.durationSec <= 0) return;
  const d = a.durationSec;
  // Plusieurs textes successifs : pas une seule caption à recaler (et elle ne
  // sera pas réécrite, cf. replaceTarget).
  const st = boxes.map((b) => b.startSec ?? 0), en = boxes.map((b) => b.endSec ?? d);
  if (Math.max(...st) - Math.min(...st) > REPLACE_SAME_TIMING_SEC || Math.max(...en) - Math.min(...en) > REPLACE_SAME_TIMING_SEC) return;
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  const px = (pct: number, dim: number) => Math.max(0, Math.round((pct / 100) * dim / 2) * 2);
  const cx = px(x0, a.width), cy = px(y0, a.height);
  const cw = Math.min(a.width - cx, Math.max(16, px(x1 - x0, a.width)));
  const ch = Math.min(a.height - cy, Math.max(8, px(y1 - y0, a.height)));
  const sh = Math.max(4, Math.round((ch * SAMPLE_W) / cw / 2) * 2);
  const out = path.join(os.tmpdir(), `aidup_captime_${process.pid}_${Math.random().toString(36).slice(2, 8)}.raw`);
  try {
    const { code } = await runFFmpeg(["-hide_banner", "-loglevel", "error", "-i", videoPath,
      "-vf", `fps=${FPS},crop=${cw}:${ch}:${cx}:${cy},scale=${SAMPLE_W}:${sh},format=gray`,
      "-f", "rawvideo", "-y", out], 120_000);
    if (code !== 0) return;
    const buf = await fs.readFile(out);
    const size = SAMPLE_W * sh;
    const n = Math.floor(buf.length / size);
    if (n < 3) return;
    const gStart = Math.min(...boxes.map((b) => b.startSec ?? 0));
    const gEnd = Math.max(...boxes.map((b) => b.endSec ?? d));
    const w0 = Math.max(0, Math.floor(gStart * FPS)), w1 = Math.min(n - 1, Math.ceil(gEnd * FPS) - 1);
    if (w1 - w0 < 2) return;
    const ref = Math.round((w0 + w1) / 2);
    // Empreinte du texte : pixels sombres (sinon clairs) presque tout le temps
    // pendant la fenêtre Gemini.
    const core = (test: (v: number) => boolean) => {
      const c: number[] = [];
      for (let k = 0; k < size; k++) {
        let hits = 0;
        for (let i = w0; i <= w1; i++) if (test(buf[i * size + k])) hits++;
        if (hits >= (w1 - w0 + 1) * CORE_SHARE) c.push(k);
      }
      return c;
    };
    let test = dark, print = core(dark);
    const fromDark = print.length >= size * 0.01;
    if (!fromDark) { test = bright; print = core(bright); }
    if (print.length < size * 0.01) return; // rien de net à suivre : on garde Gemini

    // Étendue réelle du texte (contours sombres) : la boîte de réécriture se
    // cale dessus au lieu de la boîte Gemini, souvent bien plus large (bloc
    // collé aux bords de la vidéo, vu le 16/11). Pas quand la caption a son
    // propre fond (il faut couvrir tout le fond), ni avec les pixels clairs
    // (un mur blanc gonflerait l'étendue). Centiles 1-99 % : un pixel isolé
    // ne doit pas l'élargir.
    const ownBackground = !!a.burnedCaption.style?.background && !/^(none|transparent)$/i.test(a.burnedCaption.style.background);
    if (fromDark && !ownBackground) {
      const xs = print.map((k) => k % SAMPLE_W).sort((p, q) => p - q);
      const ys = print.map((k) => Math.floor(k / SAMPLE_W)).sort((p, q) => p - q);
      const q = (arr: number[], f: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(f * (arr.length - 1))))];
      const sx0 = Math.max(0, q(xs, 0.01) - 1), sx1 = Math.min(SAMPLE_W, q(xs, 0.99) + 2);
      const sy0 = Math.max(0, q(ys, 0.01) - 1), sy1 = Math.min(sh, q(ys, 0.99) + 2);
      const bx = (cx + (sx0 / SAMPLE_W) * cw) / a.width * 100, by = (cy + (sy0 / sh) * ch) / a.height * 100;
      const bw = ((sx1 - sx0) / SAMPLE_W) * cw / a.width * 100, bh = ((sy1 - sy0) / sh) * ch / a.height * 100;
      a.burnedCaption.tightBox = { x: r1(bx), y: r1(by), w: r1(bw), h: r1(bh) };
      a.notes.push(`Caption d'origine : étendue mesurée ${r1(bw)} × ${r1(bh)} % (inspection : ${r1(x1 - x0)} × ${r1(y1 - y0)} %).`);
    }
    const present = Array.from({ length: n }, (_, i) => {
      let hits = 0;
      for (const k of print) if (test(buf[i * size + k])) hits++;
      return hits / print.length >= PRESENT_SHARE;
    });
    let s = ref, e = ref;
    for (let i = ref - 1, gap = 0; i >= 0; i--) { if (present[i]) { s = i; gap = 0; } else if (++gap > MAX_GAP_FRAMES) break; }
    for (let i = ref + 1, gap = 0; i < n; i++) { if (present[i]) { e = i; gap = 0; } else if (++gap > MAX_GAP_FRAMES) break; }
    const startSec = Math.max(0, s / FPS - MARGIN_SEC);
    const endSec = Math.min(d, (e + 1) / FPS + MARGIN_SEC);
    // Plage mesurée plus courte que Gemini des deux côtés : on prend l'union
    // (la mesure peut rater un fond qui imite le texte ; Gemini, une fin).
    const fs0 = Math.min(startSec, gStart), fe = Math.max(endSec, gEnd);
    for (const b of boxes) { b.startSec = Math.round(fs0 * 100) / 100; b.endSec = Math.round(fe * 100) / 100; }
    a.notes.push(`Caption d'origine mesurée : ${fs0.toFixed(1)}-${fe.toFixed(1)} s (Gemini : ${gStart.toFixed(1)}-${gEnd.toFixed(1)} s).`);
  } catch (e) {
    console.warn("[ai-dup/caption-timing] mesure impossible :", (e as Error).message.slice(0, 120));
  } finally {
    await fs.rm(out, { force: true }).catch(() => {});
  }
}
