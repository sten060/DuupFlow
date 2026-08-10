// src/lib/ai-editor/transcribe-deepgram.ts
//
// Transcription via Deepgram (nova-3) — VERBATIM par conception : contrairement
// à Whisper (génératif, lisse les disfluences), Deepgram transcrit ce qu'il
// entend : répétitions, faux départs et reprises RESTENT dans le texte. C'est le
// prérequis de la détection des 🔁 REPRISES (nettoyage du rush) et des captions
// mot-à-mot sans dérive (timestamps par mot natifs, précision ~ms).
//
// Chaîne de repli (analyze.ts) : Deepgram → Groq Whisper → whisper local.
// Dégradation douce : toute erreur → null (l'analyse continue sans transcript).
//
// Prérequis : DEEPGRAM_API_KEY (Railway + .env.local). ~0,26 $/h d'audio.

import fs from "fs/promises";
import os from "os";
import path from "path";
import { runFFmpeg } from "@/lib/studio/pipeline";
import type { Transcript } from "@/lib/studio/transcribe";

const DG_URL = "https://api.deepgram.com/v1/listen";
// nova-3 + language=multi : gère le français ET l'anglais (code-switching inclus).
// filler_words garde les hésitations (documenté anglais ; sans effet ailleurs —
// les REPRISES restent visibles dans toutes les langues, c'est l'essentiel).
// smart_format=false : pas de réécriture (dates/nombres) → texte au plus près du dit.
const DG_MODEL = process.env.DEEPGRAM_MODEL || "nova-3";
const DG_LANGUAGE = process.env.DEEPGRAM_LANGUAGE || "multi";

export function isDeepgramAvailable(): boolean {
  return !!process.env.DEEPGRAM_API_KEY;
}

type DgWord = { word: string; start: number; end: number; punctuated_word?: string };
type DgResponse = {
  results?: {
    channels?: Array<{ alternatives?: Array<{ transcript?: string; words?: DgWord[] }> }>;
    utterances?: Array<{ start: number; end: number; transcript: string }>;
  };
};

/** Transcrit une vidéo/audio via Deepgram → phrases + mots horodatés. null si indispo. */
export async function transcribeViaDeepgram(mediaPath: string): Promise<Transcript | null> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return null;

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_dg_"));
  const audio = path.join(dir, "audio.mp3");
  try {
    // Audio mono 16 kHz compact — suffisant pour l'ASR, upload léger.
    const { code } = await runFFmpeg(
      ["-hide_banner", "-loglevel", "error", "-i", mediaPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", "-y", audio],
      120_000,
    );
    if (code !== 0) return null;
    const buf = await fs.readFile(audio);
    if (!buf.length) return null;

    const params = new URLSearchParams({
      model: DG_MODEL,
      language: DG_LANGUAGE,
      punctuate: "true",
      smart_format: "false",
      filler_words: "true",
      utterances: "true", // segments de parole (VAD) → nos « phrases »
    });
    const res = await fetch(`${DG_URL}?${params}`, {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "audio/mpeg" },
      body: new Uint8Array(buf),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      console.warn("[ai-editor] Deepgram HTTP", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as DgResponse;
    const alt = json.results?.channels?.[0]?.alternatives?.[0];
    const words = (alt?.words ?? [])
      .map((w) => ({ startSec: w.start, endSec: w.end, text: (w.punctuated_word || w.word || "").trim() }))
      .filter((w) => w.text.length > 0 && w.endSec > w.startSec);
    // Phrases : les utterances Deepgram (plages de parole réelles, trous = silence).
    const utts = (json.results?.utterances ?? [])
      .map((u) => ({ startSec: u.start, endSec: u.end, text: (u.transcript || "").trim() }))
      .filter((p) => p.text.length > 0);
    const phrases = utts.length
      ? utts
      : words.length
      ? [{ startSec: words[0].startSec, endSec: words[words.length - 1].endSec, text: words.map((w) => w.text).join(" ") }]
      : [];
    if (!phrases.length) return null;
    return { phrases, words };
  } catch (e) {
    console.warn("[ai-editor] Deepgram transcription échouée:", (e as Error)?.message);
    return null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
