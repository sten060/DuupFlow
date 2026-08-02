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
  notes: string[]; // messages de dégradation douce (ex. transcript indispo)
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

/* ── Une keyframe à l'instant t → JPEG data URI (largeur 480, seek rapide) ─── */
async function keyframeAt(videoPath: string, t: number, dir: string, i: number): Promise<Keyframe | null> {
  const out = path.join(dir, `kf_${i}.jpg`);
  const { code } = await runFFmpeg(
    ["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3), "-i", videoPath, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", "-y", out],
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

  // Rythme (coupes) — best-effort.
  let sceneCuts: number[] = [];
  try {
    sceneCuts = (await sceneScores(videoPath, 0.3)).map((s) => Math.round(s.t * 100) / 100);
  } catch {
    notes.push("Détection de coupes indisponible (rythme approximatif).");
  }

  // Transcript — Groq Whisper d'abord (prod), repli sur whisper LOCAL (dev).
  let transcript: ReferenceAnalysis["transcript"] = null;
  let hookText: string | null = null;
  try {
    let tr = isGroqAvailable() ? await transcribeViaGroq(videoPath) : null;
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

  // Keyframes.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_kf_"));
  let keyframes: Keyframe[] = [];
  try {
    const ts = pickTimestamps(meta.durationSec, sceneCuts);
    keyframes = (await Promise.all(ts.map((t, i) => keyframeAt(videoPath, t, dir, i)))).filter((k): k is Keyframe => !!k);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  if (keyframes.length === 0) notes.push("Extraction des images clés impossible — vidéo illisible ?");

  const avgCutSec = sceneCuts.length > 0 && meta.durationSec > 0
    ? Math.round((meta.durationSec / (sceneCuts.length + 1)) * 100) / 100
    : null;

  return {
    ...meta,
    keyframes,
    transcript,
    sceneCuts,
    pacing: { cutCount: sceneCuts.length, avgCutSec },
    hookText,
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
};

async function analyzeMaterialVideo(videoPath: string): Promise<MaterialAnalysis> {
  const meta = await probe(videoPath);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_mkf_"));
  let thumb: string | null = null;
  try {
    const t = meta.durationSec > 0 ? Math.min(0.15 * meta.durationSec, 1.5) : 0.5;
    const kf = await keyframeAt(videoPath, t, dir, 0);
    thumb = kf?.dataUri ?? null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  return { kind: "video", durationSec: meta.durationSec, width: meta.width, height: meta.height, hasAudio: meta.hasAudio, thumb };
}

async function analyzeMaterialAudio(audioPath: string): Promise<MaterialAnalysis> {
  const meta = await probe(audioPath);
  return { kind: "audio", durationSec: meta.durationSec, width: 0, height: 0, hasAudio: true, thumb: null };
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
