// src/lib/ai-editor/ref-profile.ts
//
// Profil STRUCTURÉ d'une vidéo de référence, calculé UNE fois à l'import (pas de
// modèle vision — que du traitement du signal) pour que le monteur (Claude) sache
// exactement quoi reproduire :
//   · plans (shots) : timecodes de coupe exacts, durée, 2 frames (début/fin)
//   · mouvement par plan : static / zoom / pan / handheld + intensité (diff pixels)
//   · colorimétrie moyenne : saturation, luminosité, chaud/froid, N&B
//   · audio : beats + BPM + courbe d'énergie + type (music / voix+music / speech)
//
// Approximatif mais utile : le but est de guider le montage (caler les cuts sur le
// beat, savoir si un plan bouge), pas de faire de l'analyse forensique.

import fs from "fs/promises";
import path from "path";
import { runFFmpeg } from "@/lib/studio/pipeline";

export type ShotMotion = "static" | "zoom" | "pan" | "handheld";
export type Shot = {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  motion: ShotMotion;
  motionIntensity: number; // 0-1
};
export type ColorProfile = { saturation: number; brightness: number; warmCold: "warm" | "cold" | "neutral"; bw: boolean };
export type AudioDrop = {
  t: number;                       // timecode (s)
  type: "buildup" | "drop" | "silence" | "hit";
  intensity: number;               // 0-1
};
export type AudioProfile = {
  bpm: number | null;
  beats: number[];               // timecodes (s) des temps forts (pulsation)
  energy: { t: number; level: number }[]; // courbe d'énergie par 0.25 s (level 0-1 relatif)
  drops: AudioDrop[];            // RUPTURES d'énergie (≠ beats) : buildup/drop/silence/hit
  durationSec: number;           // durée de la piste
  type: "music" | "voice+music" | "speech" | "unknown";
};

const GRAY = 48; // résolution de comparaison de mouvement

/* ── Frame → { data URI JPEG, niveaux de gris NxN } ───────────────────────── */
async function grabFrame(videoPath: string, t: number, dir: string, i: number): Promise<{ dataUri: string; gray: Uint8Array; jpeg: Buffer } | null> {
  const jpg = path.join(dir, `rp_${i}.jpg`);
  const { code } = await runFFmpeg(
    ["-hide_banner", "-loglevel", "error", "-i", videoPath, "-ss", Math.max(0, t).toFixed(2), "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", "-y", jpg],
    20_000,
  );
  if (code !== 0) return null;
  let jpeg: Buffer;
  try { jpeg = await fs.readFile(jpg); await fs.unlink(jpg).catch(() => {}); } catch { return null; }
  if (jpeg.length < 100) return null;
  try {
    const sharp = (await import("sharp")).default;
    const gray = await sharp(jpeg).grayscale().resize(GRAY, GRAY, { fit: "fill" }).raw().toBuffer();
    return { dataUri: `data:image/jpeg;base64,${jpeg.toString("base64")}`, gray: new Uint8Array(gray), jpeg };
  } catch {
    return { dataUri: `data:image/jpeg;base64,${jpeg.toString("base64")}`, gray: new Uint8Array(GRAY * GRAY), jpeg };
  }
}

function meanAbs(a: Uint8Array, b: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length; // 0-255
}

/** Classe le mouvement d'un plan à partir de 2 frames (début/fin). */
function classifyMotion(a: Uint8Array, b: Uint8Array): { motion: ShotMotion; intensity: number } {
  const diff = meanAbs(a, b);
  const intensity = Math.round(Math.min(1, diff / 40) * 100) / 100;
  if (diff < 5) return { motion: "static", intensity };

  // Pan : un décalage horizontal de b réduit-il fortement la différence ?
  const shiftDiff = (dx: number): number => {
    let s = 0, n = 0;
    for (let y = 0; y < GRAY; y++) for (let x = 0; x < GRAY; x++) {
      const bx = x + dx; if (bx < 0 || bx >= GRAY) continue;
      s += Math.abs(a[y * GRAY + x] - b[y * GRAY + bx]); n++;
    }
    return n ? s / n : diff;
  };
  let bestPan = diff;
  for (const dx of [-6, -4, -2, 2, 4, 6]) { const d = shiftDiff(dx); if (d < bestPan) bestPan = d; }
  const panGain = (diff - bestPan) / diff;
  if (panGain > 0.35) return { motion: "pan", intensity };

  // Zoom : un léger recadrage central de b réduit-il la différence ? (radial)
  if (diff < 20) return { motion: "zoom", intensity };
  return { motion: "handheld", intensity };
}

/** Découpe en plans (depuis les coupes) + 2 frames + mouvement par plan.
 *  Renvoie aussi les JPEG échantillonnés (pour la colorimétrie, sans re-extraction). */
export async function analyzeShots(videoPath: string, sceneCuts: number[], durationSec: number, dir: string, maxShots = 14): Promise<{ shots: Shot[]; jpegs: Buffer[] }> {
  const bounds = [0, ...sceneCuts.filter((c) => c > 0.1 && c < durationSec - 0.05), durationSec].sort((a, b) => a - b);
  const shots: Shot[] = [];
  const jpegs: Buffer[] = [];
  const count = Math.min(maxShots, bounds.length - 1);
  for (let i = 0; i < count; i++) {
    const startSec = Math.round(bounds[i] * 100) / 100;
    const endSec = Math.round(bounds[i + 1] * 100) / 100;
    const d = endSec - startSec;
    if (d <= 0.05) continue;
    const fs0 = await grabFrame(videoPath, startSec + Math.min(0.15, d * 0.15), dir, i * 2);
    const fs1 = await grabFrame(videoPath, endSec - Math.min(0.15, d * 0.15), dir, i * 2 + 1);
    if (fs0?.jpeg) jpegs.push(fs0.jpeg);
    if (fs1?.jpeg) jpegs.push(fs1.jpeg);
    const mv = fs0 && fs1 ? classifyMotion(fs0.gray, fs1.gray) : { motion: "static" as ShotMotion, intensity: 0 };
    shots.push({
      index: i, startSec, endSec, durationSec: Math.round(d * 100) / 100,
      motion: mv.motion, motionIntensity: mv.intensity,
    });
  }
  return { shots, jpegs };
}

/** Colorimétrie moyenne sur des JPEG de frames (sharp stats). */
export async function analyzeColor(jpegs: Buffer[]): Promise<ColorProfile> {
  if (!jpegs.length) return { saturation: 0, brightness: 0, warmCold: "neutral", bw: false };
  const sharp = (await import("sharp")).default;
  let R = 0, G = 0, B = 0, sat = 0, n = 0;
  for (const j of jpegs) {
    try {
      const st = await sharp(j).stats();
      const [r, g, b] = st.channels;
      R += r.mean; G += g.mean; B += b.mean;
      const mx = Math.max(r.mean, g.mean, b.mean), mn = Math.min(r.mean, g.mean, b.mean);
      sat += mx > 0 ? (mx - mn) / mx : 0;
      n++;
    } catch { /* skip */ }
  }
  if (!n) return { saturation: 0, brightness: 0, warmCold: "neutral", bw: false };
  R /= n; G /= n; B /= n; sat /= n;
  return {
    saturation: Math.round(sat * 100) / 100,
    brightness: Math.round(((R + G + B) / 3 / 255) * 100) / 100,
    warmCold: R - B > 12 ? "warm" : B - R > 12 ? "cold" : "neutral",
    bw: sat < 0.06,
  };
}

/** Beats + BPM + courbe d'énergie (détection d'onsets « maison », approximative). */
export async function analyzeAudioBeats(videoPath: string, durationSec: number, dir: string, hasTranscript: boolean): Promise<AudioProfile> {
  const raw = path.join(dir, "audio.raw");
  const { code } = await runFFmpeg(
    ["-hide_banner", "-loglevel", "error", "-i", videoPath, "-vn", "-ac", "1", "-ar", "22050", "-f", "s16le", "-y", raw],
    120_000,
  );
  const durSec = Math.round((durationSec || 0) * 100) / 100;
  const empty = (type: AudioProfile["type"]): AudioProfile => ({ bpm: null, beats: [], energy: [], drops: [], durationSec: durSec, type });
  if (code !== 0) return empty(hasTranscript ? "speech" : "unknown");
  let buf: Buffer;
  try { buf = await fs.readFile(raw); await fs.unlink(raw).catch(() => {}); } catch { return empty("unknown"); }
  const N = Math.floor(buf.length / 2);
  if (N < 4410) return empty(hasTranscript ? "speech" : "unknown");
  const s16 = new Int16Array(buf.buffer, buf.byteOffset, N);

  const sr = 22050, hop = 512;
  const frames = Math.floor(N / hop);
  const env = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let j = 0; j < hop; j++) { const v = s16[i * hop + j] / 32768; s += v * v; }
    env[i] = Math.sqrt(s / hop);
  }
  const perSec = sr / hop;

  // Courbe d'énergie par 0.25 s, niveau normalisé 0-1 (relatif au pic).
  const win = Math.max(1, Math.round(0.25 * perSec));
  const rawE: { t: number; e: number }[] = [];
  for (let i = 0; i < frames; i += win) {
    let s = 0, c = 0;
    for (let j = i; j < Math.min(frames, i + win); j++) { s += env[j]; c++; }
    rawE.push({ t: Math.round((i / perSec) * 100) / 100, e: s / Math.max(1, c) });
  }
  const maxE = rawE.reduce((m, x) => Math.max(m, x.e), 1e-6);
  const energy = rawE.map((x) => ({ t: x.t, level: Math.round((x.e / maxE) * 1000) / 1000 }));

  // Onsets : flux d'énergie positif + pics au-dessus d'un seuil adaptatif.
  const flux = new Float32Array(frames);
  for (let i = 1; i < frames; i++) { const d = env[i] - env[i - 1]; flux[i] = d > 0 ? d : 0; }
  const w = Math.max(2, Math.round(0.1 * perSec));
  const beats: number[] = [];
  for (let i = w; i < frames - w; i++) {
    let mean = 0;
    for (let j = i - w; j <= i + w; j++) mean += flux[j];
    mean /= (2 * w + 1);
    if (flux[i] > mean * 1.6 && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1] && flux[i] > 0.004) {
      const t = Math.round((i / perSec) * 100) / 100;
      if (!beats.length || t - beats[beats.length - 1] > 0.12) beats.push(t);
    }
  }

  // BPM : intervalle inter-onsets médian, replié dans [70,180].
  let bpm: number | null = null;
  if (beats.length >= 4) {
    const iois: number[] = [];
    for (let i = 1; i < beats.length; i++) iois.push(beats[i] - beats[i - 1]);
    iois.sort((a, b) => a - b);
    const med = iois[Math.floor(iois.length / 2)];
    if (med > 0.2 && med < 2) {
      let b = 60 / med;
      while (b < 70) b *= 2;
      while (b > 180) b /= 2;
      bpm = Math.round(b);
    }
  }

  // Ruptures d'énergie (≠ pulsation) : dérivée du niveau RMS, pics au-delà d'un
  // seuil. buildup (montée soutenue) / drop (saut + maintien haut) / silence (chute
  // vers le bas) / hit (impact isolé qui retombe). Intensité normalisée 0-1.
  const L = energy.map((e) => e.level);
  const nE = L.length, dt = 0.25;
  const at = (i: number) => Math.round(i * dt * 100) / 100;
  const c01 = (v: number) => Math.max(0, Math.min(1, Math.round(v * 100) / 100));
  const rawDrops: AudioDrop[] = [];
  for (let i = 2; i < nE - 2; i++) {
    const d = L[i] - L[i - 1];
    const after = (L[i + 1] + L[i + 2]) / 2;
    const before = (L[i - 2] + L[i - 1]) / 2;
    if (d < -0.25 && L[i] < 0.22) rawDrops.push({ t: at(i), type: "silence", intensity: c01(-d) });
    else if (d > 0.28 && after > 0.55 && after >= L[i] * 0.8) rawDrops.push({ t: at(i), type: "drop", intensity: c01(d + (after - before) * 0.5) });
    else if (d > 0.3 && after < L[i] * 0.6) rawDrops.push({ t: at(i), type: "hit", intensity: c01(d) });
  }
  for (let bi = 0; bi < nE - 4;) {
    if (L[bi + 1] > L[bi] + 0.01) {
      let j = bi;
      while (j < nE - 1 && L[j + 1] >= L[j] - 0.06) j++;
      if (L[j] - L[bi] > 0.35 && (j - bi) * dt >= 1.0) rawDrops.push({ t: at(bi), type: "buildup", intensity: c01(L[j] - L[bi]) });
      bi = j + 1;
    } else bi++;
  }
  rawDrops.sort((a, b) => a.t - b.t || b.intensity - a.intensity);
  const drops: AudioDrop[] = [];
  for (const dp of rawDrops) {
    const prev = drops[drops.length - 1];
    if (prev && Math.abs(prev.t - dp.t) < 0.3) { if (dp.intensity > prev.intensity) drops[drops.length - 1] = dp; }
    else drops.push(dp);
  }

  const rhythmic = beats.length > Math.max(4, durationSec * 0.7);
  const type: AudioProfile["type"] = hasTranscript ? (rhythmic ? "voice+music" : "speech") : beats.length ? "music" : "unknown";
  return { bpm, beats: beats.slice(0, 240), energy, drops: drops.slice(0, 120), durationSec: durSec, type };
}
