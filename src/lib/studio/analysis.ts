// Analyse LOCALE d'une vidéo brute (pur ffmpeg, aucune IA) — alimente la
// découpe intelligente (segments.ts) :
//   passe 1 (audio)  : timeline d'énergie (ebur128, ~10 mesures/s) + silences
//   passe 2 (vidéo)  : timestamps des changements de plan (scene detection
//                      sur frames réduites à 320px → rapide même sur du 4K)
// Les vidéos SANS parole (musique/muettes) sont un cas normal : la découpe
// s'appuiera alors sur les changements de plan, pas sur l'audio.

import { runFFmpeg } from "./pipeline";

export interface LoudnessPoint {
  t: number; // secondes
  m: number; // momentary loudness (LUFS, négatif ; plus haut = plus fort)
}

export interface SilenceRange {
  start: number;
  end: number;
}

export interface VideoAnalysis {
  loudness: LoudnessPoint[];
  silences: SilenceRange[];
  sceneCuts: number[]; // timestamps (s) des changements de plan
}

// Seuil silencedetect : sous -35 dB pendant ≥ 0.5s = silence.
const SILENCE_ARGS = "silencedetect=noise=-35dB:d=0.5";
// Seuil de scene detection : 0.30 = changement de plan franc.
const SCENE_THRESHOLD = 0.3;

export async function analyzeVideo(
  inputPath: string,
  hasAudio: boolean
): Promise<VideoAnalysis> {
  const [audio, scenes] = await Promise.all([
    hasAudio ? analyzeAudio(inputPath) : Promise.resolve({ loudness: [], silences: [] }),
    analyzeScenes(inputPath),
  ]);
  return { ...audio, sceneCuts: scenes };
}

async function analyzeAudio(
  inputPath: string
): Promise<{ loudness: LoudnessPoint[]; silences: SilenceRange[] }> {
  // silencedetect laisse passer l'audio inchangé → ebur128 mesure derrière.
  // maxStderrBytes élevé : ebur128 émet ~10 lignes/s — tronquer amputerait
  // le début de la timeline et fausserait le choix des extraits.
  const { stderr } = await runFFmpeg(
    ["-hide_banner", "-i", inputPath, "-map", "0:a:0",
     "-af", `${SILENCE_ARGS},ebur128`, "-f", "null", "-"],
    5 * 60 * 1000,
    16_000_000
  );

  const loudness: LoudnessPoint[] = [];
  // Lignes ebur128 : "t: 2.10238  TARGET:-23 LUFS  M: -25.6 S: ..."
  for (const m of stderr.matchAll(/t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+)/g)) {
    loudness.push({ t: Number(m[1]), m: Number(m[2]) });
  }

  const silences: SilenceRange[] = [];
  let currentStart: number | null = null;
  // silence_start / silence_end arrivent en paires ordonnées.
  for (const m of stderr.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
    if (m[1] === "start") currentStart = Number(m[2]);
    else if (currentStart !== null) {
      silences.push({ start: currentStart, end: Number(m[2]) });
      currentStart = null;
    }
  }

  return { loudness, silences };
}

async function analyzeScenes(inputPath: string): Promise<number[]> {
  // scale=320 avant select : le score de scène se calcule sur de petites
  // frames → analyse ~10× plus rapide, même précision de détection.
  const { stderr } = await runFFmpeg(
    ["-hide_banner", "-i", inputPath, "-an",
     "-vf", `scale=320:-2,select='gt(scene,${SCENE_THRESHOLD})',metadata=print`,
     "-f", "null", "-"],
    5 * 60 * 1000
  );

  const cuts: number[] = [];
  for (const m of stderr.matchAll(/pts_time:([\d.]+)/g)) {
    cuts.push(Number(m[1]));
  }
  return cuts;
}
