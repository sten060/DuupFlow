/**
 * Score TECHNIQUE d'une paire de fichiers : conteneur, tags, pistes.
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────────
 * L'ancien calcul comptait « champs identiques / champs comparés » sur TOUS les
 * champs ffprobe. Deux problèmes mesurés sur de vraies copies :
 *
 *  1. La majorité des champs ne PEUVENT pas différer. Deux MOV/HEVC issus de la
 *     même chaîne partagent forcément format_name, format_long_name, nb_streams,
 *     start_time, probe_score, le codec, le pix_fmt, la fréquence audio et le
 *     nombre de canaux — en changer casserait le fichier. Sur un test réel,
 *     22 des 28 champs comparés étaient dans ce cas : le score ne pouvait pas
 *     descendre sous ~75 %, et l'interface affichait « très similaire » en rouge
 *     sur des copies parfaitement saines.
 *
 *  2. La comparaison était binaire. Deux tailles de 46 796 222 et 46 796 226
 *     octets comptaient comme « différentes » au même titre qu'un fichier deux
 *     fois plus lourd.
 *
 * Corrections : seuls les champs DISCRIMINANTS entrent dans le score (les autres
 * restent affichés dans les tableaux, ils informent sans polluer la note), et
 * les champs numériques sont notés par ratio min/max au lieu d'égalité stricte.
 *
 * Module pur (aucune I/O) : utilisable côté client comme côté serveur.
 */

export type ProbeLike = { format?: Record<string, any>; streams?: Record<string, any>[] };

/**
 * Champs volontairement EXCLUS du score : deux fichiers de même nature ne
 * peuvent pas en différer sans devenir des fichiers d'une autre nature. Les
 * inclure revenait à offrir des points de ressemblance gratuits.
 */
export const STRUCTURAL_FIELDS = new Set([
  "format.format_name",
  "format.format_long_name",
  "format.nb_streams",
  "format.start_time",
  "format.probe_score",
  "video.codec_name",
  "video.pix_fmt",
  "audio.codec_name",
  "audio.channels",
]);

/** Champs notés au ratio (proches ⇒ score élevé) plutôt qu'en tout-ou-rien. */
const RATIO_FIELDS = new Set([
  "format.duration",
  "format.size",
  "format.bit_rate",
  "video.width",
  "video.height",
  "video.bit_rate",
  "video.avg_frame_rate",
  "video.duration",
  "audio.bit_rate",
  "audio.sample_rate",
]);

/** Champs discriminants, dans l'ordre d'affichage. */
const SCORED_FIELDS = [
  "format.duration", "format.size", "format.bit_rate",
  "video.width", "video.height", "video.bit_rate", "video.avg_frame_rate", "video.duration",
  "audio.bit_rate", "audio.sample_rate",
];

/** "30000/1001" → 29.97 ; "1920" → 1920 ; sinon null. */
function numeric(v: string): number | null {
  const frac = v.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = Number(frac[2]);
    return d > 0 ? Number(frac[1]) / d : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Similarité d'un champ, 0–100. */
function fieldSimilarity(v1: string, v2: string, ratio: boolean): number {
  if (v1 === v2) return 100;
  if (!v1 || !v2) return 0;
  if (!ratio) return 0;
  const a = numeric(v1), b = numeric(v2);
  if (a === null || b === null || a <= 0 || b <= 0) return 0;
  return Math.round((Math.min(a, b) / Math.max(a, b)) * 100);
}

/**
 * Similarité de nom de fichier — noms normalisés (sans extension, minuscules,
 * alphanumérique). Jaccard sur bigrammes. 100 = identiques, 0 = rien en commun.
 */
export function filenameSimilarity(nameA: string, nameB: string): number {
  const norm = (n: string) => n.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = norm(nameA), b = norm(nameB);
  if (a === b) return 100;
  if (!a || !b) return 0;
  const bigrams = (s: string) => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
  const ba = bigrams(a), bb = bigrams(b);
  const inter = [...ba].filter((x) => bb.has(x)).length;
  const union = new Set([...ba, ...bb]).size;
  return union === 0 ? 0 : Math.round((inter / union) * 100);
}

export type TechnicalField = {
  key: string;      // "format.duration", "tag.creation_time", …
  v1: string;
  v2: string;
  similarity: number; // 0–100
  scored: boolean;    // false = affiché mais hors note (champ structurel)
};

export type TechnicalResult = {
  score: number;          // 0–100
  fields: TechnicalField[];
  scoredCount: number;    // nombre de champs réellement notés
  identicalCount: number; // parmi eux, ceux à 100
};

function pick(probe: ProbeLike | null, key: string): string {
  if (!probe) return "";
  const [scope, field] = key.split(".");
  if (scope === "format") return String(probe.format?.[field] ?? "");
  const stream = probe.streams?.find((s) => s.codec_type === scope);
  return String(stream?.[field] ?? "");
}

/**
 * Note technique d'une paire. `nameA`/`nameB` sont optionnels : quand ils sont
 * fournis, la ressemblance des noms de fichiers compte comme un champ de plus
 * (une plateforme voit le nom à l'upload — deux copies ne doivent pas le
 * partager).
 */
export function technicalScore(
  probe1: ProbeLike | null,
  probe2: ProbeLike | null,
  nameA?: string,
  nameB?: string,
): TechnicalResult | null {
  if (!probe1 || !probe2) return null;

  const fields: TechnicalField[] = [];
  const add = (key: string, v1: string, v2: string, scored: boolean) => {
    if (!v1 && !v2) return;
    fields.push({ key, v1, v2, similarity: fieldSimilarity(v1, v2, RATIO_FIELDS.has(key)), scored });
  };

  // Champs structurels — affichés, non notés.
  for (const key of STRUCTURAL_FIELDS) add(key, pick(probe1, key), pick(probe2, key), false);

  // Champs discriminants du conteneur et des pistes.
  for (const key of SCORED_FIELDS) add(key, pick(probe1, key), pick(probe2, key), true);

  // Tags du conteneur — c'est la couche d'identité (creation_time, atomes Apple,
  // brands…). Tout tag présent d'un seul côté compte comme une différence.
  const tags1 = probe1.format?.tags ?? {};
  const tags2 = probe2.format?.tags ?? {};
  for (const key of [...new Set([...Object.keys(tags1), ...Object.keys(tags2)])].sort()) {
    add(`tag.${key}`, String(tags1[key] ?? ""), String(tags2[key] ?? ""), true);
  }

  // Nom de fichier — un champ à part entière, visible par la plateforme.
  if (nameA && nameB) {
    fields.push({
      key: "filename", v1: nameA, v2: nameB,
      similarity: filenameSimilarity(nameA, nameB), scored: true,
    });
  }

  const scored = fields.filter((f) => f.scored);
  if (scored.length === 0) return null;
  const score = scored.reduce((s, f) => s + f.similarity, 0) / scored.length;

  return {
    score: +score.toFixed(2),
    fields,
    scoredCount: scored.length,
    identicalCount: scored.filter((f) => f.similarity === 100).length,
  };
}

/**
 * ── Score UNIQUE ────────────────────────────────────────────────────────────
 * Un seul chiffre pour l'utilisateur. Deux volets le composent :
 *
 *  · VISUEL (60 %) — ce que la plateforme compare en premier : l'image. C'est
 *    l'empreinte perceptuelle (SSIM, MSE, histogrammes…), donc le volet qui
 *    décide vraiment si deux fichiers sont « le même contenu ».
 *  · TECHNIQUE (40 %) — conteneur, tags, débits, nom de fichier. Signal plus
 *    faible pour la détection de contenu, mais c'est celui qui regroupe des
 *    fichiers sous une même signature.
 *
 * Si l'un des deux volets manque (image illisible, sonde en échec), le score
 * est celui du volet disponible — jamais une moyenne avec une valeur inventée.
 */
export const VISUAL_WEIGHT = 0.6;
export const TECHNICAL_WEIGHT = 0.4;

export function unifiedScore(visual: number | null, technical: number | null): number | null {
  if (visual === null && technical === null) return null;
  if (visual === null) return Math.round(technical!);
  if (technical === null) return Math.round(visual);
  return Math.round(visual * VISUAL_WEIGHT + technical * TECHNICAL_WEIGHT);
}
