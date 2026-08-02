// src/lib/ai-editor/transcribe-groq.ts
//
// Transcription via l'API Groq Whisper (whisper-large-v3-turbo) — rapide et
// quasi gratuite (~0,04 $/h d'audio). Utilisée en prod (Railway) pour ne pas
// charger le CPU. Repli sur le whisper LOCAL (studio) si la clé est absente.
//
// Endpoint OpenAI-compatible : POST /openai/v1/audio/transcriptions.
// Dégradation douce : toute erreur → null (l'analyse continue sans transcript).

import fs from "fs/promises";
import os from "os";
import path from "path";
import { runFFmpeg } from "@/lib/studio/pipeline";
import type { Transcript } from "@/lib/studio/transcribe";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";

export function isGroqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/** Transcrit une vidéo via Groq Whisper → phrases horodatées. null si indispo. */
export async function transcribeViaGroq(videoPath: string): Promise<Transcript | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_groq_"));
  const audio = path.join(dir, "audio.mp3");
  try {
    // Audio mono 16 kHz compact — suffisant pour Whisper, upload léger.
    const { code } = await runFFmpeg(
      ["-hide_banner", "-loglevel", "error", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", "-y", audio],
      120_000,
    );
    if (code !== 0) return null;
    const buf = await fs.readFile(audio);
    if (!buf.length) return null;

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "audio.mp3");
    form.append("model", GROQ_MODEL);
    form.append("response_format", "verbose_json"); // → segments horodatés
    form.append("temperature", "0");

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      console.warn("[ai-editor] Groq transcription HTTP", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as { text?: string; segments?: { start: number; end: number; text: string }[] };
    const segs = json.segments ?? [];
    const phrases = segs.length
      ? segs.map((s) => ({ startSec: s.start, endSec: s.end, text: (s.text || "").trim() })).filter((p) => p.text)
      : json.text
      ? [{ startSec: 0, endSec: 0, text: json.text.trim() }]
      : [];
    if (!phrases.length) return null;
    // words : non fournis par ce format — laissés vides (les phrases suffisent
    // pour hook/contexte ; les captions mot-à-mot du studio gardent le local).
    return { phrases, words: [] };
  } catch (e) {
    console.warn("[ai-editor] Groq transcription échouée:", (e as Error)?.message);
    return null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
