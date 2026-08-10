// src/lib/ai-editor/analyze.ts
//
// Base de l'Éditeur IA : transformer une vidéo de RÉFÉRENCE en « matière que
// Claude peut lire ET voir ». Un LLM ne regarde pas un .mp4 → on le pré-digère.
//
// MVP (keyframes + transcript + rythme + méta) :
//   · keyframes  → images JPEG (data URI) : Claude est multimodal, il les VOIT
//   · transcript → whisper.cpp (ce qui est dit) — dégradation douce si absent
//   · rythme     → détection de coupes FFmpeg (vitesse de montage)
//   · méta       → durée / résolution / fps / audio
//
// Réutilise les helpers éprouvés du /studio (runFFmpeg, transcribeVideo,
// sceneScores). Aucun coût LLM ici : c'est de l'extraction pure. La « recette »
// virale plus fine (vision) viendra par-dessus, plus tard.

import fs from "fs/promises";
import os from "os";
import path from "path";
import { runFFmpeg } from "@/lib/studio/pipeline";
import { transcribeVideo } from "@/lib/studio/transcribe";
import { sceneScores } from "@/lib/studio/analysis";
import { transcribeViaGroq, isGroqAvailable } from "./transcribe-groq";
import { transcribeViaDeepgram, isDeepgramAvailable } from "./transcribe-deepgram";
import { analyzeShots, analyzeColor, analyzeAudioBeats } from "./ref-profile";
import type { Shot, ColorProfile, AudioProfile } from "./ref-profile";
import { analyzeReferenceWithGemini, isGeminiAvailable, type CutStrip } from "./gemini";
import type { GeminiComprehension } from "./gemini";

export type Keyframe = { t: number; dataUri: string };

export type ReferenceAnalysis = {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  keyframes: Keyframe[];
  transcript: { phrases: { startSec: number; endSec: number; text: string }[]; fullText: string } | null;
  sceneCuts: number[];
  pacing: { cutCount: number; avgCutSec: number | null };
  hookText: string | null;
  shots: Shot[];           // plans : timecodes, durée, mouvement, 2 frames
  color: ColorProfile;     // colorimétrie moyenne
  audio: AudioProfile;     // beats / bpm / énergie / type
  comprehension: GeminiComprehension | null; // couche « compréhension » (Gemini regarde la vidéo)
  notes: string[];         // messages de dégradation douce (ex. transcript indispo)
};

/* ── Probe (durée / dims / fps / audio) via ffmpeg -i (stderr) ─────────────── */
async function probe(videoPath: string): Promise<{ durationSec: number; width: number; height: number; fps: number; hasAudio: boolean }> {
  const { stderr } = await runFFmpeg(["-hide_banner", "-i", videoPath], 30_000, 64_000);
  const dur = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const durationSec = dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]) : 0;
  const videoLine = stderr.split("\n").find((l) => /Stream #.*Video:/.test(l)) ?? "";
  const res = videoLine.match(/,\s*(\d{2,5})x(\d{2,5})/);
  const fpsM = videoLine.match(/(\d+(?:\.\d+)?)\s*fps/);
  const hasAudio = /Stream #.*Audio:/.test(stderr);
  return {
    durationSec,
    width: res ? +res[1] : 0,
    height: res ? +res[2] : 0,
    fps: fpsM ? Math.round(parseFloat(fpsM[1]) * 100) / 100 : 0,
    hasAudio,
  };
}

/** Bande de 6 vignettes sur ±0,3s AUTOUR d'une coupe (une image, gauche→droite =
 *  avant→après) → base64 JPEG. Montre à Gemini la transition qu'un échantillonnage
 *  à 2 img/s ne capte pas. null si l'extraction échoue. */
async function cutStrip(videoPath: string, t: number, dir: string, i: number): Promise<CutStrip | null> {
  const out = path.join(dir, `cut_${i}.jpg`);
  const start = Math.max(0, t - 0.3);
  const { code } = await runFFmpeg(
    ["-hide_banner", "-loglevel", "error", "-ss", start.toFixed(3), "-t", "0.6", "-i", videoPath,
      "-vf", "fps=10,scale=240:-1,tile=6x1", "-frames:v", "1", "-q:v", "5", out],
    30_000,
  );
  if (code !== 0) return null;
  try {
    const b = await fs.readFile(out);
    if (!b.length) return null;
    return { t: Math.round(t * 100) / 100, b64: b.toString("base64") };
  } catch { return null; }
}

/** Durée d'un média en secondes (léger, via ffmpeg -i). 0 si indéterminée.
 *  Sert aux gardes de durée (réf/matière) AVANT toute analyse coûteuse. */
export async function probeDurationSec(mediaPath: string): Promise<number> {
  const { stderr } = await runFFmpeg(["-hide_banner", "-i", mediaPath], 30_000, 64_000);
  const d = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0;
}

/* ── Une keyframe à l'instant t → JPEG data URI (largeur 480, seek rapide) ─── */
async function keyframeAt(videoPath: string, t: number, dir: string, i: number): Promise<Keyframe | null> {
  const out = path.join(dir, `kf_${i}.jpg`);
  const { code } = await runFFmpeg(
    ["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3), "-i", videoPath, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "6", "-y", out],
    30_000,
  );
  if (code !== 0) return null;
  try {
    const buf = await fs.readFile(out);
    await fs.unlink(out).catch(() => {});
    if (!buf.length) return null;
    return { t: Math.round(t * 100) / 100, dataUri: `data:image/jpeg;base64,${buf.toString("base64")}` };
  } catch {
    return null;
  }
}

/* ── Choix des instants de keyframes : coupes de scène si dispo, sinon régulier ── */
function pickTimestamps(durationSec: number, sceneCuts: number[], max = 8): number[] {
  if (durationSec <= 0) return [0.1, 0.5, 1, 1.5, 2].filter((t) => t >= 0);
  // Toujours inclure une frame très tôt (le HOOK) + répartir le reste.
  const base = new Set<number>([Math.min(0.15 * durationSec, 0.6)]);
  const pool = sceneCuts.length >= 3 ? sceneCuts : Array.from({ length: max }, (_, i) => ((i + 0.5) / max) * durationSec);
  for (const t of pool) if (t > 0.1 && t < durationSec - 0.1) base.add(t);
  return [...base].sort((a, b) => a - b).slice(0, max);
}

/**
 * Analyse une vidéo de référence → matière exploitable par Claude.
 * Ne jette jamais sur un sous-échec (transcript/scènes) : dégradation douce.
 */
export async function analyzeReferenceVideo(videoPath: string): Promise<ReferenceAnalysis> {
  const notes: string[] = [];
  const meta = await probe(videoPath);

  // Rythme (coupes) — best-effort. Calculé AVANT Gemini : ses timecodes servent à
  // extraire des bandes de vignettes autour de chaque coupe (détection des transitions).
  let sceneCuts: number[] = [];
  try {
    sceneCuts = (await sceneScores(videoPath, 0.3)).map((s) => Math.round(s.t * 100) / 100);
  } catch {
    notes.push("Détection de coupes indisponible (rythme approximatif).");
  }

  // Bandes de coupes pour Gemini (±0,3s, 6 vignettes) — montrent la NATURE des
  // transitions (un cut de 0,2s n'apparaît pas à 2 img/s). ~qq ffmpeg rapides.
  let cutStrips: CutStrip[] = [];
  if (isGeminiAvailable() && sceneCuts.length) {
    const sdir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_cut_"));
    try {
      const picks = sceneCuts.filter((t) => t > 0.15 && t < meta.durationSec - 0.15).slice(0, 16);
      cutStrips = (await Promise.all(picks.map((t, i) => cutStrip(videoPath, t, sdir, i)))).filter((s): s is CutStrip => !!s);
    } catch { /* best-effort */ }
    finally { await fs.rm(sdir, { recursive: true, force: true }).catch(() => {}); }
  }

  // Couche COMPRÉHENSION (Gemini regarde la vidéo + les bandes de coupes) — lancée
  // EN PARALLÈLE des mesures ci-dessous, best-effort. Sans GEMINI_API_KEY → null.
  // Plafond global (200s) : si Gemini traîne, on rend le profil SANS lui plutôt que
  // de faire échouer toute l'analyse (la route a un budget de 300s).
  const comprehensionP: Promise<GeminiComprehension | null> = isGeminiAvailable()
    ? Promise.race([
        analyzeReferenceWithGemini(videoPath, cutStrips).catch(() => null),
        new Promise<null>((r) => setTimeout(() => r(null), 200_000)),
      ])
    : Promise.resolve(null);

  // Transcript — Deepgram (verbatim + mots) d'abord, repli Groq Whisper, puis LOCAL.
  let transcript: ReferenceAnalysis["transcript"] = null;
  let hookText: string | null = null;
  try {
    let tr = isDeepgramAvailable() ? await transcribeViaDeepgram(videoPath) : null;
    if (!tr && isGroqAvailable()) tr = await transcribeViaGroq(videoPath);
    if (!tr) tr = await transcribeVideo(videoPath); // repli local
    if (tr && tr.phrases.length) {
      transcript = {
        phrases: tr.phrases.map((p) => ({ startSec: p.startSec, endSec: p.endSec, text: p.text })),
        fullText: tr.phrases.map((p) => p.text).join(" ").trim(),
      };
      hookText = tr.phrases[0]?.text?.trim() || null;
    } else {
      notes.push("Transcription indisponible (clé GROQ_API_KEY ou whisper local) — analyse visuelle seule.");
    }
  } catch {
    notes.push("Transcription échouée — analyse visuelle seule.");
  }

  // Keyframes + profil structuré (plans / colorimétrie / beats) — best-effort.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_kf_"));
  let keyframes: Keyframe[] = [];
  let shots: Shot[] = [];
  let color: ColorProfile = { saturation: 0, brightness: 0, warmCold: "neutral", bw: false };
  let audio: AudioProfile = { bpm: null, beats: [], energy: [], drops: [], durationSec: 0, type: "unknown" };
  try {
    const ts = pickTimestamps(meta.durationSec, sceneCuts);
    keyframes = (await Promise.all(ts.map((t, i) => keyframeAt(videoPath, t, dir, i)))).filter((k): k is Keyframe => !!k);

    try {
      const res = await analyzeShots(videoPath, sceneCuts, meta.durationSec, dir);
      shots = res.shots;
      color = await analyzeColor(res.jpegs);
    } catch { notes.push("Analyse des plans/colorimétrie indisponible."); }

    if (meta.hasAudio) {
      try { audio = await analyzeAudioBeats(videoPath, meta.durationSec, dir, !!transcript); }
      catch { notes.push("Analyse audio (beats) indisponible."); }
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  if (keyframes.length === 0) notes.push("Extraction des images clés impossible — vidéo illisible ?");

  const avgCutSec = sceneCuts.length > 0 && meta.durationSec > 0
    ? Math.round((meta.durationSec / (sceneCuts.length + 1)) * 100) / 100
    : null;

  // On récupère la compréhension (déjà en cours en parallèle).
  const comprehension = await comprehensionP;
  if (!comprehension) {
    notes.push(isGeminiAvailable()
      ? "Compréhension vidéo (Gemini) indisponible cette fois — profil basé sur les mesures + keyframes."
      : "Compréhension vidéo (Gemini) désactivée (pas de GEMINI_API_KEY) — captions/contenu des plans non lus.");
  }

  return {
    ...meta,
    keyframes,
    transcript,
    sceneCuts,
    pacing: { cutCount: sceneCuts.length, avgCutSec },
    hookText,
    shots,
    color,
    audio,
    comprehension,
    notes,
  };
}

/* ══ Analyse LÉGÈRE de la MATIÈRE (rushes/images du user) ══════════════════════
   Assez pour que Claude sache ce qu'il a sous la main (durée, dims, 1 vignette).
   Pas de transcription ici (la description du user fait le contexte) → rapide. */
export type MaterialAnalysis = {
  kind: "video" | "image" | "audio";
  durationSec?: number;
  width: number;
  height: number;
  hasAudio?: boolean;   // vidéo : a-t-elle une piste son (utile pour l'attacher)
  thumb: string | null; // 1 vignette JPEG (data URI) ; null pour l'audio
  sceneCuts?: number[]; // vidéo : timecodes de coupe (index pour découper le rush)
  transcript?: {
    phrases: { startSec: number; endSec: number; text: string }[];
    fullText: string;
    // Mots horodatés (word-level) : captions wordByWord/karaoke SYNCHRO + détection
    // des reprises. Absent sur les anciennes analyses (re-upload pour l'obtenir).
    words?: { startSec: number; endSec: number; text: string }[];
  } | null;
  audio?: AudioProfile | null; // matière SONORE (audio OU vidéo avec son) : bpm/beats/energy/drops
};

async function analyzeMaterialVideo(videoPath: string): Promise<MaterialAnalysis> {
  const meta = await probe(videoPath);
  // Transcription du rush (s'il a du son) — best-effort.
  let transcript: MaterialAnalysis["transcript"] = null;
  if (meta.hasAudio) {
    try {
      let tr = isDeepgramAvailable() ? await transcribeViaDeepgram(videoPath) : null;
      if (!tr && isGroqAvailable()) tr = await transcribeViaGroq(videoPath);
      if (!tr) tr = await transcribeVideo(videoPath);
      if (tr && tr.phrases.length) {
        transcript = {
          phrases: tr.phrases.map((p) => ({ startSec: p.startSec, endSec: p.endSec, text: p.text })),
          fullText: tr.phrases.map((p) => p.text).join(" ").trim(),
          // Mots horodatés (si le provider les fournit) — captions synchro + reprises.
          words: tr.words?.length ? tr.words.map((w) => ({ startSec: w.startSec, endSec: w.endSec, text: w.text })) : undefined,
        };
      }
    } catch { /* skip */ }
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_mkf_"));
  let thumb: string | null = null;
  let audio: AudioProfile | null = null;
  try {
    const t = meta.durationSec > 0 ? Math.min(0.15 * meta.durationSec, 1.5) : 0.5;
    const kf = await keyframeAt(videoPath, t, dir, 0);
    thumb = kf?.dataUri ?? null;
    // Analyse rythme/énergie/drops de la piste son du rush — pour caler coupes/effets.
    if (meta.hasAudio) {
      try { audio = await analyzeAudioBeats(videoPath, meta.durationSec, dir, !!transcript); } catch { /* skip */ }
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  // Coupes du rush (index pour que Claude découpe sans deviner) — best-effort.
  let sceneCuts: number[] = [];
  try { sceneCuts = (await sceneScores(videoPath, 0.3)).map((s) => Math.round(s.t * 100) / 100); } catch { /* skip */ }
  return { kind: "video", durationSec: meta.durationSec, width: meta.width, height: meta.height, hasAudio: meta.hasAudio, thumb, sceneCuts, transcript, audio };
}

async function analyzeMaterialAudio(audioPath: string): Promise<MaterialAnalysis> {
  const meta = await probe(audioPath);
  // Transcription (si voix) — best-effort ; sert aussi à typer music vs speech.
  let transcript: MaterialAnalysis["transcript"] = null;
  try {
    let tr = isDeepgramAvailable() ? await transcribeViaDeepgram(audioPath) : null;
    if (!tr && isGroqAvailable()) tr = await transcribeViaGroq(audioPath);
    if (!tr) tr = await transcribeVideo(audioPath);
    if (tr && tr.phrases.length) {
      transcript = {
        phrases: tr.phrases.map((p) => ({ startSec: p.startSec, endSec: p.endSec, text: p.text })),
        fullText: tr.phrases.map((p) => p.text).join(" ").trim(),
        words: tr.words?.length ? tr.words.map((w) => ({ startSec: w.startSec, endSec: w.endSec, text: w.text })) : undefined,
      };
    }
  } catch { /* skip */ }
  // Rythme / énergie / drops de la piste (bpm, beats, energy 0.25s, drops).
  let audio: AudioProfile | null = null;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_maud_"));
  try { audio = await analyzeAudioBeats(audioPath, meta.durationSec, dir, !!transcript); }
  catch { /* skip */ }
  finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
  return { kind: "audio", durationSec: meta.durationSec, width: 0, height: 0, hasAudio: true, thumb: null, transcript, audio };
}

async function analyzeMaterialImage(imgPath: string): Promise<MaterialAnalysis> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(imgPath).metadata();
    const buf = await sharp(imgPath).resize({ width: 320, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
    return { kind: "image", width: meta.width ?? 0, height: meta.height ?? 0, thumb: `data:image/jpeg;base64,${buf.toString("base64")}` };
  } catch {
    return { kind: "image", width: 0, height: 0, thumb: null };
  }
}

/** Dispatcher matière : image → sharp ; audio → probe ; sinon → vidéo (ffmpeg). */
export async function analyzeMaterial(filePath: string, mime: string): Promise<MaterialAnalysis> {
  if (mime.startsWith("image")) return analyzeMaterialImage(filePath);
  if (mime.startsWith("audio")) return analyzeMaterialAudio(filePath);
  return analyzeMaterialVideo(filePath);
}
