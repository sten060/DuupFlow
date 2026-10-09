// src/lib/ai-editor/asr-filter.ts
//
// PHRASES FANTÔMES de la transcription. Sur un passage sans parole (musique,
// silence), les modèles de type Whisper « inventent » des phrases apprises sur
// des sous-titres de télé : « Sous-titrage Société Radio-Canada », « Sous-titres
// réalisés par la communauté d'Amara.org »… Lues comme un vrai hook par Claude,
// elles finissaient dans les captions. On les retire à la sortie de la chaîne
// de transcription (Deepgram → Groq → local), pour TOUTES les analyses.

type Phrase = { startSec: number; endSec: number; text: string };
type Word = { startSec: number; endSec: number; text: string };

function norm(s: string): string {
  return s.toLowerCase().replace(/[’`]/g, "'").replace(/[.!?…,;:«»"()\-–—]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Toujours fausses : crédits de sous-titrage et marqueurs de musique. */
const ALWAYS = [
  /sous ?titr(age|es?)\b.*\b(radio ?canada|amara|st' ?501|soci[ée]t[ée])/,
  /amara ?org/,
  /castingwords/,
  /subt[ií]tulos realizados/,
  /^(♪\s*)+$/,
  /^\[?(musique|music|applaudissements|applause|rires|laughter)\]?$/,
];

/** Fausses seulement quand c'est TOUT ce qui a été transcrit (sinon, peut-être dites). */
const ALONE = /^(merci( beaucoup)?( d'avoir regard[ée]( cette vid[ée]o)?)?( et (à|a) bient[ôo]t)?|thank you( so much)?( for watching)?|thanks for watching|abonnez vous.*|please subscribe.*|sous ?titr(age|es?).*)$/;

export function isGhostPhrase(text: string): boolean {
  const n = norm(text);
  return !n || ALWAYS.some((re) => re.test(n));
}

/**
 * Retire les phrases fantômes (et leurs mots horodatés). Renvoie null s'il ne
 * reste rien : la vidéo est alors traitée comme sans parole.
 */
export function stripGhostPhrases<T extends { phrases: Phrase[]; words?: Word[] }>(tr: T | null): T | null {
  if (!tr) return tr;
  let phrases = tr.phrases.filter((p) => !isGhostPhrase(p.text));
  if (phrases.length && ALONE.test(norm(phrases.map((p) => p.text).join(" ")))) phrases = [];
  if (phrases.length === tr.phrases.length) return tr;
  if (!phrases.length) return null;
  const kept = (w: Word) => phrases.some((p) => w.startSec >= p.startSec - 0.05 && w.endSec <= p.endSec + 0.05);
  return { ...tr, phrases, ...(tr.words ? { words: tr.words.filter(kept) } : {}) };
}
