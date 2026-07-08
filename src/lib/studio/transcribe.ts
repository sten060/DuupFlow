// Transcription LOCALE via whisper.cpp (binaire `whisper-cli`, brew) —
// uniquement pour les vidéos AVEC parole. Les vidéos musique/muettes ne
// passent jamais ici (le pipeline garde sa voie "cuts de scène").
//
// Utilisée pour :
//   1. des coupes alignées sur les phrases (segments.ts)
//   2. des hooks tirés de ce qui est réellement dit dans l'extrait (jobs.ts)
//
// Installation locale attendue :
//   brew install whisper-cpp
//   modèle : .studio-local/models/ggml-base.bin (surchargeable par env)
// Si le binaire ou le modèle manque → retourne null, le pipeline continue
// comme avant (dégradation douce, jamais bloquant).

import { execSync, spawn } from "child_process";
import fsSync from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { STUDIO_ROOT } from "./local-store";
import { runFFmpeg } from "./pipeline";

export interface TranscriptSegment {
  startSec: number;
  endSec: number;
  text: string;
}

// Un mot horodaté (pour les sous-titres animés brûlés).
export interface TranscriptWord {
  startSec: number;
  endSec: number;
  text: string;
}

// Résultat d'une transcription : phrases (pour LLM/hooks/découpe) + mots
// (pour les captions synchronisées).
export interface Transcript {
  phrases: TranscriptSegment[];
  words: TranscriptWord[];
}

// ── Résolution binaire + modèle (au runtime, comme ffmpeg) ───────────────────

const WHISPER_CANDIDATES = [
  "/opt/homebrew/bin/whisper-cli",
  "/usr/local/bin/whisper-cli",
];

let _whisperBin: string | null | undefined; // undefined = pas encore cherché
function getWhisperBin(): string | null {
  if (_whisperBin !== undefined) return _whisperBin;

  const fromEnv = process.env.WHISPER_BIN;
  if (fromEnv && fsSync.existsSync(fromEnv)) return (_whisperBin = fromEnv);

  try {
    const found = execSync("command -v whisper-cli", {
      encoding: "utf8",
      shell: "/bin/sh",
    }).trim();
    if (found && fsSync.existsSync(found)) return (_whisperBin = found);
  } catch {
    /* pas dans le PATH */
  }

  for (const p of WHISPER_CANDIDATES) {
    if (fsSync.existsSync(p)) return (_whisperBin = p);
  }
  return (_whisperBin = null);
}

function getWhisperModel(): string | null {
  const fromEnv = process.env.WHISPER_MODEL;
  if (fromEnv && fsSync.existsSync(fromEnv)) return fromEnv;
  const local = path.join(STUDIO_ROOT, "models", "ggml-base.bin");
  return fsSync.existsSync(local) ? local : null;
}

export function isTranscriptionAvailable(): boolean {
  return getWhisperBin() !== null && getWhisperModel() !== null;
}

// ── Transcription ────────────────────────────────────────────────────────────

/**
 * Transcrit une vidéo parlée MOT PAR MOT (whisper -ml 1 -sow), puis
 * reconstruit les phrases par regroupement. Retourne { phrases, words } ou
 * null si whisper est indisponible / échoue / la piste ne contient pas de
 * vraie parole — le pipeline retombe alors sur la découpe énergie, jamais
 * d'erreur bloquante.
 */
export async function transcribeVideo(
  inputPath: string
): Promise<Transcript | null> {
  const bin = getWhisperBin();
  const model = getWhisperModel();
  if (!bin || !model) {
    console.warn(
      "[studio] whisper indisponible (brew install whisper-cpp + modèle ggml-base.bin) — coupes sans transcription"
    );
    return null;
  }

  const stamp = `${process.pid}_${Date.now()}`;
  const wavPath = path.join(os.tmpdir(), `duup_whisper_${stamp}.wav`);
  const outPrefix = path.join(os.tmpdir(), `duup_whisper_${stamp}`);

  try {
    // whisper.cpp attend du WAV 16 kHz mono.
    const { code } = await runFFmpeg(
      ["-y", "-hide_banner", "-loglevel", "error", "-i", inputPath,
       "-map", "0:a:0", "-ar", "16000", "-ac", "1", wavPath],
      5 * 60 * 1000
    );
    if (code !== 0) return null;

    // -ml 1 -sow : un segment JSON = un MOT horodaté (base des captions).
    // -l auto : FR ou EN. -np : pas de logs parasites.
    await new Promise<void>((resolve, reject) => {
      const p = spawn(
        bin,
        ["-m", model, "-f", wavPath, "-oj", "-of", outPrefix, "-l", "auto",
         "-ml", "1", "-sow",
         "-t", String(Math.max(2, os.cpus().length - 2)), "-np"],
        { stdio: ["ignore", "ignore", "pipe"] }
      );
      let stderr = "";
      const timer = setTimeout(() => {
        p.kill("SIGKILL");
        reject(new Error("whisper timeout après 10 min"));
      }, 10 * 60 * 1000);
      p.stderr.on("data", (d) => {
        stderr += String(d);
        if (stderr.length > 32_000) stderr = stderr.slice(-16_000);
      });
      p.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      p.on("close", (c) => {
        clearTimeout(timer);
        c === 0 ? resolve() : reject(new Error(`whisper a échoué (${c}) : ${stderr.slice(-300)}`));
      });
    });

    const raw = JSON.parse(await fs.readFile(`${outPrefix}.json`, "utf8")) as {
      transcription?: Array<{
        offsets: { from: number; to: number }; // millisecondes
        text: string;
      }>;
    };

    const words: TranscriptWord[] = (raw.transcription ?? [])
      .map((s) => ({
        startSec: s.offsets.from / 1000,
        endSec: s.offsets.to / 1000,
        text: s.text.trim(),
      }))
      // Écarte le bruit : mots vides ou artefacts type "[Music]"/"(...)".
      .filter((w) => w.text.length > 0 && !/^[\[(].*[\])]$/.test(w.text));

    // Quasi rien de dit → pas une vidéo parlée exploitable : on l'assume.
    if (words.length < 5) return null;

    return { words, phrases: buildPhrases(words) };
  } catch (e) {
    console.error(
      "[studio] transcription échouée :",
      e instanceof Error ? e.message : e
    );
    return null;
  } finally {
    await fs.unlink(wavPath).catch(() => {});
    await fs.unlink(`${outPrefix}.json`).catch(() => {});
  }
}

// Regroupe les mots en phrases : on clôt sur ponctuation forte (. ! ? …),
// un silence > 0.6s, ou au-delà de 120 caractères. Sert au LLM, aux hooks
// et à l'alignement de la découpe.
function buildPhrases(words: TranscriptWord[]): TranscriptSegment[] {
  const phrases: TranscriptSegment[] = [];
  let buf: TranscriptWord[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    phrases.push({
      startSec: buf[0].startSec,
      endSec: buf[buf.length - 1].endSec,
      text: buf.map((w) => w.text).join(" ").replace(/\s+/g, " ").trim(),
    });
    buf = [];
  };

  for (let i = 0; i < words.length; i++) {
    buf.push(words[i]);
    const text = words[i].text;
    const next = words[i + 1];
    const gap = next ? next.startSec - words[i].endSec : Infinity;
    const chars = buf.reduce((n, w) => n + w.text.length + 1, 0);
    if (/[.!?…]$/.test(text) || gap > 0.6 || chars > 120) flush();
  }
  flush();
  return phrases;
}

/**
 * Choisit un hook dans ce qui est RÉELLEMENT dit pendant l'extrait :
 * la première phrase complète de l'extrait dont la longueur fait un bon
 * hook d'overlay (12-80 caractères). Retourne null si rien ne convient
 * (l'appelant retombe sur le pool statique).
 * TODO: brancher un LLM pour choisir la phrase la plus accrocheuse.
 */
export function pickHookFromTranscript(
  transcript: TranscriptSegment[],
  startSec: number,
  durationSec: number
): string | null {
  const endSec = startSec + durationSec;
  for (const s of transcript) {
    // Phrase entièrement contenue dans l'extrait (tolérance 0.5s au début).
    if (s.startSec >= startSec - 0.5 && s.endSec <= endSec) {
      const text = s.text.replace(/\s+/g, " ").trim();
      if (text.length >= 12 && text.length <= 80) {
        return text.charAt(0).toUpperCase() + text.slice(1);
      }
    }
  }
  return null;
}
