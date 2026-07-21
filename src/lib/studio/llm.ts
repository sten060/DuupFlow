// Couche LLM du Studio — provider-agnostique, LOCAL d'esprit (le code reste
// chez nous ; seul le TEXTE de la transcription part vers l'API).
// Rôle : à partir de la transcription horodatée d'une vidéo parlée, choisir
// les meilleurs extraits (par le SENS, pas juste l'énergie), et écrire pour
// chacun un hook + une caption prêts à publier (niche OFM / clippers).
//
// Dégradation douce TOTALE : pas de clé, pas de réseau, réponse illisible →
// retourne null, et le pipeline retombe sur la découpe pur-code + hooks du pool.
// La vidéo n'est JAMAIS envoyée ; seuls du texte et des timestamps le sont.
//
// Providers : Anthropic implémenté. Le point d'entrée est isolé pour brancher
// OpenAI / Google en une fonction — bascule par STUDIO_LLM_PROVIDER.
// TODO: brancher — analyse LLM des reels de référence une fois leur
//       téléchargement en place (même couche, prompt différent).

import type {
  FootageMap,
  MontageLevel,
  MontageMove,
  ReelFormat,
  ViralRecipe,
} from "./types";
import type { TranscriptSegment } from "./transcribe";

export interface LLMClip {
  startSec: number;
  endSec: number;
  hook: string; // 1ère ligne incrustée (accroche/question qui amorce)
  // Lignes révélées ENSUITE, une par une (format "liste" OFM). Vide = accroche
  // seule. Ex : ["- Je suis capable d'en demander plusieurs fois par jour", …]
  reveals: string[];
  caption: string; // légende + hashtags, prête à publier
}

// ── Config (env) ─────────────────────────────────────────────────────────────
const PROVIDER = (process.env.STUDIO_LLM_PROVIDER || "anthropic").toLowerCase();
// Défaut Haiku : tâche créative/extraction simple + gros volume → rapide et
// peu cher. Passe à claude-opus-4-8 (ou un autre) via STUDIO_LLM_MODEL pour
// une sélection d'extrait plus fine.
const ANTHROPIC_MODEL = process.env.STUDIO_LLM_MODEL || "claude-haiku-4-5";

export function isLLMAvailable(): boolean {
  if (PROVIDER === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  return false;
}

// ── Point d'entrée : planifier hooks/captions (+ extraits si parlé) ─────────
// Marche AVEC ou SANS transcription. Sans transcription (vidéo visuelle type
// OFM), le LLM écrit quand même N captions courtes et accrocheuses dans le
// style de la/les référence(s) — c'est LE texte incrusté "poster".
export async function planClipsWithLLM(opts: {
  transcript?: TranscriptSegment[]; // absent = vidéo sans parole exploitable
  durationSec: number;
  count: number; // nombre de variantes = nombre de captions distinctes voulues
  format: ReelFormat;
  // Recettes des reels de référence — le LLM écrit les hooks/captions dans ce
  // style. Une recette par variante (rotation) pour varier les angles.
  recipes?: ViralRecipe[];
}): Promise<LLMClip[] | null> {
  if (!isLLMAvailable()) return null;

  const prompt = buildPrompt(opts);

  try {
    let raw: string | null = null;
    if (PROVIDER === "anthropic") raw = (await callAnthropic(prompt)).text;
    // else if (PROVIDER === "openai") raw = await callOpenAI(prompt);   // TODO
    // else if (PROVIDER === "google") raw = await callGemini(prompt);   // TODO
    if (!raw) return null;

    const clips = parseClips(raw, opts.durationSec);
    return clips.length > 0 ? clips : null;
  } catch (e) {
    console.error(
      "[studio] LLM indisponible/échec — fallback pur-code :",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

// ── Prompt ───────────────────────────────────────────────────────────────────
function buildPrompt(opts: {
  transcript?: TranscriptSegment[];
  durationSec: number;
  count: number;
  format: ReelFormat;
  recipes?: ViralRecipe[];
}): { system: string; user: string } {
  const hasTranscript = !!opts.transcript && opts.transcript.length > 0;

  const systemParts = [
    "Tu es monteur expert de reels courts pour la niche OFM (agences et clippers qui publient en volume).",
    "Le champ \"hook\" est LE TEXTE INCRUSTÉ À L'ÉCRAN (une accroche courte et percutante, style caption OFM ; emoji autorisé). Le champ \"caption\" est la légende de publication (1-2 phrases + 3 à 5 hashtags).",
  ];

  // La ref PRINCIPALE (celle qui pilote le rendu) tire souvent sa viralité d'un
  // PROCÉDÉ d'accroche précis (« X vs… / …Y », question→réponse, liste
  // numérotée). Quand elle est "coordonnée" et qu'on a ses captions exactes, on
  // FORCE le LLM à rejouer CE mécanisme à l'identique — c'est CE qui la rend
  // virale, pas notre format maison. Prioritaire sur toute autre logique.
  const primaryRec = opts.recipes?.find((r) => r.layout);
  const deviceExamples = primaryRec?.examples ?? [];
  const isDeviceDriven =
    primaryRec?.montageLevel === "coordonne" && deviceExamples.length >= 2;

  if (isDeviceDriven) {
    const steps = (primaryRec!.moves ?? []).map((m) => m.shows).filter(Boolean);
    systemParts.push(
      "⚠️ PRIORITÉ ABSOLUE — la référence PRINCIPALE doit sa viralité à un PROCÉDÉ D'ACCROCHE précis. Reproduire CE procédé passe AVANT le style, le ton ou le sujet.",
      `Ses textes à l'écran EXACTS, dans l'ordre d'apparition : ${deviceExamples
        .map((e, i) => `[${i + 1}] « ${e} »`)
        .join("   ")}`,
      steps.length
        ? `Ce que l'écran montre à chaque étape : ${steps.join(" → ")}.`
        : "",
      "Décode le MÉCANISME de ces textes et REJOUE-LE À L'IDENTIQUE dans sa forme :",
      "- comparaison en deux temps « X vs… » puis « …Y » : GARDE le « vs » et la coupure suspendue « … » qui crée l'attente ;",
      "- question puis réponse, ou liste numérotée : garde exactement ce schéma et sa ponctuation.",
      "Tu changes UNIQUEMENT le sujet (créatrice OFM, double sens soft et malin). Tu ne changes JAMAIS le mécanisme, le nombre de temps, ni les mots de liaison.",
      `Produis ${deviceExamples.length} texte(s) : "hook" = le 1ᵉʳ temps (l'amorce qui tease et reste en suspens), "reveals" = les temps suivants dans l'ordre (${Math.max(
        0,
        deviceExamples.length - 1
      )} élément(s)). Chaque texte est COURT (comme la ref) et FINI (jamais coupé en plein mot).`,
      "Chaque variante = le MÊME procédé rejoué avec un angle différent (jamais un autre format). startSec et endSec = 0.",
      "TON : jeux de mots et double sens coquins, soft et suggestif, jamais explicite."
    );
  } else if (hasTranscript) {
    systemParts.push(
      "On te donne la transcription horodatée d'une vidéo parlée.",
      "Choisis les meilleurs extraits (15-30s), chacun capable d'accrocher dès la 1ère seconde :",
      "- commence sur un début de phrase, finis sur une fin de phrase,",
      "- extraits DIFFÉRENTS les uns des autres, privilégie punchlines/révélations.",
      "Le hook doit refléter ce qui est dit dans l'extrait."
    );
  } else {
    // Vidéo VISUELLE sans parole (le cas OFM typique) : pas de découpe. Le LLM
    // écrit, pour chaque variante, une accroche + une LISTE de révélations qui
    // apparaîtront une par une (format viral "liste qui se dévoile").
    // Le NOMBRE de révélations et la LONGUEUR de ligne sont imposés par la
    // référence mesurée (layout) — on reproduit son montage, pas un format à nous.
    const layout = opts.recipes?.find((r) => r.layout)?.layout;
    const revealSpec = layout
      ? `EXACTEMENT ${layout.revealCount} ligne(s)`
      : "2 à 4 lignes";
    const lineLen = layout
      ? Math.max(30, Math.round(layout.maxCharsPerLine * 1.8))
      : 60;
    // Longueur cible du hook = celle de la caption de la référence (son 1ᵉʳ
    // exemple), pour ne pas raccourcir une caption qui doit être une phrase.
    const refPrimary = opts.recipes?.find((r) => r.layout);
    const refHookLen = refPrimary?.examples?.[0]?.length ?? 0;
    const singleCaption = layout?.revealCount === 0;
    systemParts.push(
      "Cette vidéo n'a pas de parole : c'est une vidéo VISUELLE (créatrice qui pose/se filme). Ne découpe pas.",
      singleCaption
        ? "FORMAT À PRODUIRE — UNE SEULE caption fixe (la référence n'en a qu'une) :"
        : "FORMAT À PRODUIRE (très courant et viral en OFM) — une LISTE qui se dévoile :",
      singleCaption
        ? `- "hook" = LA caption entière : une phrase COMPLÈTE et FINIE (jamais coupée en plein milieu), même esprit/longueur que l'exemple de la référence${refHookLen ? ` (~${refHookLen} caractères)` : ""}. "reveals" = [] (aucune).`
        : "- \"hook\" = une accroche/question provocante qui AMORCE et laisse en suspens (souvent finie par \"…\" ou \"malgré que ..\"), tutoiement, en français. Reste court (l'amorce).",
      singleCaption
        ? ""
        : `- "reveals" = ${revealSpec} qui répondent/complètent, révélées ensuite une par une, de plus en plus culottées. REPRENDS le format de liste des exemples de la référence : si elle numérote ("1.", "2."), numérote pareil ; si elle met des tirets, mets des tirets ; sinon aucun préfixe.`,
      singleCaption
        ? ""
        : `- LONGUEUR : chaque révélation fait MAX ${lineLen} caractères (elle doit tenir en 2 lignes courtes à l'écran).`,
      "TON : jeux de mots et DOUBLE SENS coquins (sous-entendus), soft et suggestif, JAMAIS explicite ou vulgaire. Reste malin et drôle, façon créatrice qui aguiche.",
      "Chaque variante = un ANGLE/enchaînement différent. startSec et endSec = 0.",
      "Reprends l'esprit des exemples de la référence (double sens, autodérision, montée progressive) sans les copier mot pour mot."
    );
  }

  // Recettes de référence : le LLM REPRODUIT le style des reels qui cartonnent.
  // La 1ʳᵉ recette = ref PRINCIPALE (celle qui pilote aussi le rendu visuel) ;
  // les suivantes = inspiration secondaire uniquement.
  if (opts.recipes && opts.recipes.length > 0) {
    systemParts.push(
      "",
      "STYLE À REPRODUIRE — reproduis le SCHÉMA de la référence PRINCIPALE (type de hook, structure, ton, CTA, format de liste ; PAS le sujet). Les références secondaires ne servent que d'inspiration légère :"
    );
    opts.recipes.forEach((r, i) => {
      systemParts.push(
        `Référence ${i === 0 ? "PRINCIPALE" : `secondaire ${i + 1}`} → hook: ${r.hookStyle} | structure: ${r.structure} | ton: ${r.tone} | CTA: ${r.cta}` +
          (r.examples?.length ? ` | exemples de hooks: ${r.examples.join(" / ")}` : "")
      );
    });
  }

  systemParts.push(
    "Réponds UNIQUEMENT avec du JSON valide, sans texte autour, au format :",
    '{"clips":[{"startSec":number,"endSec":number,"hook":string,"reveals":[string],"caption":string}]}',
    hasTranscript
      ? "Pour une vidéo parlée, \"reveals\" peut rester vide []."
      : "\"reveals\" contient 2 à 4 lignes."
  );

  const userParts = [
    `Durée totale de la vidéo : ${opts.durationSec.toFixed(0)}s.`,
    `Nombre de variantes voulues : ${opts.count}.`,
  ];
  if (hasTranscript) {
    userParts.push(
      "",
      "Transcription :",
      opts
        .transcript!.map(
          (s) => `[${s.startSec.toFixed(1)}-${s.endSec.toFixed(1)}] ${s.text}`
        )
        .join("\n")
    );
  }

  return { system: systemParts.join("\n"), user: userParts.join("\n") };
}

// ── Provider : Anthropic (fetch, zéro dépendance) ───────────────────────────
// Accepte des images optionnelles (base64 PNG) pour l'analyse VISION des
// références, une temperature, et un OUTIL structuré : quand `tool` est
// fourni, la réponse est FORCÉE dans le schéma (tool_choice) et on retourne
// l'objet `toolInput` validé par l'API — plus aucune extraction de JSON texte.
async function callAnthropic(prompt: {
  system: string;
  user: string;
  imagesBase64?: string[];
  temperature?: number;
  tool?: { name: string; description: string; input_schema: object };
}): Promise<{ text: string | null; toolInput: unknown | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const content: unknown[] = [];
    for (const img of prompt.imagesBase64 ?? []) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/png", data: img },
      });
    }
    content.push({ type: "text", text: prompt.user });

    const body: Record<string, unknown> = {
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      system: prompt.system,
      messages: [{ role: "user", content }],
    };
    if (prompt.temperature !== undefined) body.temperature = prompt.temperature;
    if (prompt.tool) {
      body.tools = [prompt.tool];
      body.tool_choice = { type: "tool", name: prompt.tool.name };
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Anthropic HTTP ${res.status} ${detail.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string; input?: unknown; name?: string }>;
    };
    if (data.stop_reason === "refusal") return { text: null, toolInput: null };

    const toolBlock = data.content?.find((b) => b.type === "tool_use");
    const text =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
        .trim() || null;

    return { text, toolInput: toolBlock?.input ?? null };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Parsing défensif de la réponse ──────────────────────────────────────────
// On extrait le premier objet JSON de la réponse (au cas où le modèle
// entoure de texte), on valide chaque clip et on borne les timestamps.
function parseClips(raw: string, durationSec: number): LLMClip[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }

  const arr = (parsed as { clips?: unknown }).clips;
  if (!Array.isArray(arr)) return [];

  const clips: LLMClip[] = [];
  for (const c of arr) {
    const o = c as Record<string, unknown>;
    let s = Number(o.startSec);
    let e = Number(o.endSec);
    const hook = typeof o.hook === "string" ? o.hook.trim() : "";
    const caption = typeof o.caption === "string" ? o.caption.trim() : "";
    if (!Number.isFinite(s) || !Number.isFinite(e) || !hook) continue;

    // Bornes de sûreté : dans la vidéo, durée 12-32s.
    s = Math.max(0, Math.min(s, durationSec - 1));
    e = Math.max(s + 12, Math.min(e, durationSec));
    if (e - s > 32) e = s + 32;

    const reveals = Array.isArray(o.reveals)
      ? o.reveals
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];

    clips.push({
      startSec: Math.round(s * 10) / 10,
      endSec: Math.round(e * 10) / 10,
      // Garde-fou anti-abus (240 car.) mais coupé au MOT, jamais au milieu :
      // une caption OFM "poster" est souvent une phrase complète longue.
      hook: capAtWord(hook, 240),
      reveals: reveals.map((r) => capAtWord(r, 240)),
      caption,
    });
  }
  return clips;
}

// Tronque à maxLen SANS couper un mot (recule au dernier espace) — évite les
// "…tiendrais-tu avan" en plein milieu.
function capAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Raffinement des timings : le comptage sur grille est précis à ±1 frame.
// Pour chaque transition détectée, on montre les 2 frames frontières EN GRAND
// et on re-compte les captions de chaque côté — binaire, quasi infaillible.
// ─────────────────────────────────────────────────────────────────────────────
const REFINE_TOOL = {
  name: "save_counts",
  description: "Enregistre le nombre de captions visibles sur chaque moitié de chaque image.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            captionsLeft: { type: "integer", minimum: 0 },
            captionsRight: { type: "integer", minimum: 0 },
          },
          required: ["captionsLeft", "captionsRight"],
        },
      },
    },
    required: ["results"],
  },
} as const;

export async function refineTransitionCounts(
  pairImagesBase64: string[]
): Promise<Array<{ left: number; right: number }> | null> {
  if (!isLLMAvailable() || PROVIDER !== "anthropic") return null;
  try {
    const { toolInput } = await callAnthropic({
      system: [
        "Chaque image montre DEUX frames consécutives d'un reel, côte à côte (GAUCHE = plus tôt, DROITE = plus tard).",
        "Pour CHAQUE image, compte le nombre de captions (blocs de texte incrusté) DISTINCTES visibles sur la moitié gauche, puis sur la moitié droite.",
        "Un bloc de texte = une caption, même sur plusieurs lignes. Réponds via l'outil save_counts, un résultat par image, dans l'ordre.",
      ].join("\n"),
      user: `Compte les captions de chaque côté des ${pairImagesBase64.length} image(s).`,
      imagesBase64: pairImagesBase64,
      tool: REFINE_TOOL,
    });
    const arr = (toolInput as { results?: unknown })?.results;
    if (!Array.isArray(arr)) return null;
    return arr.map((r) => ({
      left: Number((r as Record<string, unknown>).captionsLeft) || 0,
      right: Number((r as Record<string, unknown>).captionsRight) || 0,
    }));
  } catch (e) {
    console.error("[studio] raffinement timing échoué :", e instanceof Error ? e.message : e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Lecture du RUSH de l'utilisateur : où est le visage, quel cadrage.
// Appelée UNIQUEMENT pour les refs "coordonne" (routeur d'effort). ~1-2¢.
// ─────────────────────────────────────────────────────────────────────────────
const FOOTAGE_TOOL = {
  name: "read_footage",
  description: "Décrit ce que contient la vidéo brute (visage, cadrage).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      hasFace: { type: "boolean", description: "un visage humain est-il visible ?" },
      faceX: { type: "number", description: "centre horizontal du visage, 0=gauche 1=droite" },
      faceY: { type: "number", description: "centre vertical du visage, 0=haut 1=bas" },
      faceW: { type: "number", description: "largeur du visage / largeur image (0-1)" },
      faceH: { type: "number", description: "hauteur du visage / hauteur image (0-1)" },
      framing: {
        type: "string",
        enum: ["full-body", "upper-body", "closeup"],
        description:
          "cadrage global : full-body = corps entier visible, upper-body = buste/taille, closeup = gros plan visage/épaules",
      },
    },
    required: ["hasFace", "faceX", "faceY", "faceW", "faceH", "framing"],
  },
} as const;

export async function readFootage(
  framesBase64: string[]
): Promise<FootageMap | null> {
  if (!isLLMAvailable() || PROVIDER !== "anthropic") return null;
  try {
    const { toolInput } = await callAnthropic({
      system: [
        "On te donne des frames d'une vidéo brute verticale (9:16) d'un créateur.",
        "Décris ce qu'elle CONTIENT pour un monteur : y a-t-il un visage, où est-il, et quel est le cadrage global.",
        "Le visage : donne son centre et sa taille en fractions de l'image (0-1). Utilise l'outil read_footage.",
      ].join("\n"),
      user: "Analyse cette vidéo brute.",
      imagesBase64: framesBase64,
      tool: FOOTAGE_TOOL,
    });
    if (!toolInput) return null;
    const o = toolInput as Record<string, unknown>;
    const n = (x: unknown, d: number) =>
      typeof x === "number" && Number.isFinite(x) ? x : d;
    const cl = (x: number) => Math.max(0, Math.min(1, x));
    const hasFace = o.hasFace === true;
    return {
      hasFace,
      faceBox: hasFace
        ? {
            x: cl(n(o.faceX, 0.5) - n(o.faceW, 0.3) / 2),
            y: cl(n(o.faceY, 0.35) - n(o.faceH, 0.2) / 2),
            w: cl(n(o.faceW, 0.3)),
            h: cl(n(o.faceH, 0.2)),
          }
        : null,
      framing:
        o.framing === "full-body" || o.framing === "closeup"
          ? o.framing
          : "upper-body",
    };
  } catch (e) {
    console.error("[studio] lecture du rush échouée :", e instanceof Error ? e.message : e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture d'un reel de RÉFÉRENCE : extrait la "recette virale" à partir d'une
// grille d'images clés (vision) + la transcription + la caption du post.
// Retourne null si LLM indisponible / réponse illisible (l'appelant gère).
// ─────────────────────────────────────────────────────────────────────────────
// Schéma STRICT de la recette — imposé via tool-use (l'API force la sortie
// dans ce schéma ; plus d'extraction du premier {…} d'un texte libre).
const RECIPE_TOOL = {
  name: "save_recipe",
  description:
    "Enregistre la recette virale extraite du reel de référence (style + mesures de montage).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      hookStyle: { type: "string" },
      captionStyle: { type: "string" },
      structure: { type: "string" },
      tone: { type: "string" },
      cta: { type: "string" },
      examples: {
        type: "array",
        items: { type: "string" },
        maxItems: 6,
        description:
          "Textes EXACTS des captions lus à l'écran (hook d'abord), avec leur numérotation/puces d'origine ET les retours à la ligne TELS QU'AFFICHÉS (caractère \\n à chaque passage à la ligne visible). Sert à mesurer la largeur réelle des lignes.",
      },
      accentColor: { type: ["string", "null"] },
      uppercase: { type: "boolean" },
      layout: {
        type: "object",
        additionalProperties: false,
        properties: {
          // Tâche PERCEPTUELLE par tuile (fiable) — les fractions d'apparition
          // sont ensuite CALCULÉES en code à partir des transitions.
          cumulativeCaptionsPerFrame: {
            type: "array",
            items: { type: "integer", minimum: 0 },
            minItems: 16,
            maxItems: 16,
            description:
              "Pour CHACUNE des 16 frames de la grille (ordre de lecture : gauche→droite puis haut→bas), le nombre CUMULÉ de captions DISTINCTES apparues depuis le début de la vidéo jusqu'à cette frame incluse (le hook compte pour 1 ; une caption qui en remplace une autre incrémente le cumul). Ex : [0,1,1,1,2,2,2,3,3,3,3,3,3,3,3,3].",
          },
          hookYFrac: {
            type: "number",
            description:
              "Position verticale du HAUT du premier caractère du hook, lue CONTRE la règle rouge (ligne 30 = 0.30), interpolée à 0.01 près. 2-3 décimales, ne PAS arrondir à 0.05 près.",
          },
          stackYFrac: {
            type: "number",
            description:
              "Position du HAUT de la 1ʳᵉ caption révélée après le hook, même méthode que hookYFrac. S'il n'y a que le hook : même valeur que hookYFrac.",
          },
          fontFrac: {
            type: "number",
            description:
              "HAUTEUR DES CAPITALES d'une caption révélée (du HAUT d'une majuscule à la LIGNE DE BASE, SANS les jambages qui descendent) / hauteur de l'image. Mesure CONTRE la règle : deux lignes rouges consécutives = 0.05. Ex : une majuscule qui occupe les deux tiers d'un intervalle → 0.033. 3 DÉCIMALES obligatoires (jamais 0.04 tout rond si c'est 0.035).",
          },
          longestLineText: {
            type: "string",
            description:
              "Recopie EXACTEMENT la ligne de caption AFFICHÉE la plus longue — UNE seule ligne à l'écran (pas la caption entière si elle fait plusieurs lignes). Sert à mesurer la largeur en code.",
          },
          maxCharsPerLine: {
            type: "integer",
            description:
              "Secours : caractères (espaces compris) de la ligne la plus longue, si tu ne peux pas la recopier.",
          },
          mode: { type: "string", enum: ["stack", "replace"] },
          hookFontFrac: {
            type: "number",
            description:
              "HAUTEUR DES CAPITALES du HOOK (première caption) / hauteur de l'image, même méthode que fontFrac (haut de majuscule → ligne de base, contre la règle à 0.05). Souvent PLUS GROS que les autres captions — mesure-le séparément. Si identique, donne la même valeur que fontFrac.",
          },
          fontFamily: {
            type: "string",
            enum: ["serif", "sans"],
            description:
              "Formes des lettres des captions : \"serif\" = empattements visibles (petites barres au bout des traits, style Times/Georgia, fréquent sur Instagram « classique ») ; \"sans\" = traits nus (Arial/Helvetica).",
          },
          fontWeight: {
            type: "string",
            enum: ["normal", "bold", "heavy"],
            description:
              "Graisse du texte : \"normal\" = traits fins, \"bold\" = gras net, \"heavy\" = très épais/black.",
          },
          outline: {
            type: "string",
            enum: ["none", "thin", "thick"],
            description:
              "Contour autour des lettres : \"none\" = aucun, \"thin\" = liseré fin, \"thick\" = bordure épaisse bien visible.",
          },
          shadow: {
            type: "boolean",
            description: "Ombre portée visible derrière le texte ?",
          },
        },
        required: [
          "cumulativeCaptionsPerFrame", "hookYFrac", "stackYFrac",
          "fontFrac", "longestLineText", "maxCharsPerLine", "mode",
          "hookFontFrac", "fontFamily", "fontWeight", "outline", "shadow",
        ],
      },
      // ── Compréhension du MONTAGE (Phase 1) — greffée sur le même appel ─────
      montageLevel: {
        type: "string",
        enum: ["simple", "rythme", "coordonne"],
        description:
          "Niveau de montage. \"simple\" = plan quasi fixe, l'image ne change pas pour illustrer le texte. \"rythme\" = coupures/jump cuts, MAIS l'image ne montre PAS spécifiquement ce que dit le texte (ex : tête qui parle avec sous-titres qui suivent la voix → rythme). \"coordonne\" UNIQUEMENT si l'image illustre SPÉCIFIQUEMENT le sens du texte : le texte nomme une chose (visage, corps, objet, avant/après) et l'image la MONTRE à ce moment précis.",
      },
      moves: {
        type: "array",
        maxItems: 12,
        description:
          "Suite des mouvements de montage dans l'ordre. Pour un montage simple/rythmé, décris quand même les plans (hold/cut). Pour coordonné, fais bien correspondre chaque plan au texte affiché.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            atFrac: { type: "number", description: "moment 0-1 de la durée" },
            action: {
              type: "string",
              enum: ["hold", "zoom-in", "pull-back", "cut", "pan"],
              description: "hold=plan tenu, zoom-in=on resserre, pull-back=on ouvre, cut=coupure, pan=balayage",
            },
            shows: { type: "string", description: "ce que le plan montre : visage / corps entier / detail / plan large / autre" },
            textAtThisMoment: { type: "string", description: "texte affiché à ce moment, ou vide" },
          },
          required: ["atFrac", "action", "shows", "textAtThisMoment"],
        },
      },
      footageNeeded: {
        type: "string",
        description:
          "En une phrase : quel type de vidéo brute du créateur permettrait de reproduire ce montage.",
      },
    },
    required: [
      "hookStyle", "captionStyle", "structure", "tone", "cta",
      "examples", "accentColor", "uppercase", "layout",
      "montageLevel", "moves", "footageNeeded",
    ],
  },
} as const;

export async function extractRecipeFromReference(opts: {
  gridImagesBase64: string[]; // 4 grilles 2×2 (frames 1-4, 5-8, 9-12, 13-16) — TIMING
  designImage50Base64?: string; // frame réglée à 50% — détection stack/replace
  designImage85Base64?: string; // frame réglée à 85% — mesures de design
  transcript?: string; // hook/texte parlé (whisper) si dispo
  postCaption?: string; // légende écrite du post
  refDurationSec: number; // durée mesurée par ffmpeg (PAS par la vision)
}): Promise<ViralRecipe | null> {
  if (!isLLMAvailable() || PROVIDER !== "anthropic") return null;

  const nGrids = opts.gridImagesBase64.length; // 4
  const hasDesign = !!opts.designImage85Base64;
  const has50 = !!opts.designImage50Base64;
  const img50Idx = nGrids + 1;
  const img85Idx = nGrids + (has50 ? 2 : 1);
  const system = [
    "Tu es analyste de reels viraux (niche OFM). Tu reçois :",
    "- IMAGES 1 à 4 : quatre grilles 2×2 couvrant 16 frames uniformément réparties sur la durée (lecture de chaque grille : gauche→droite puis haut→bas). La frame k est prise à (k-1)/16 de la durée :",
    "  IMAGE 1 = frames 1-4 (0%, 6.25%, 12.5%, 18.75%) · IMAGE 2 = frames 5-8 (25%, 31.25%, 37.5%, 43.75%) · IMAGE 3 = frames 9-12 (50%, 56.25%, 62.5%, 68.75%) · IMAGE 4 = frames 13-16 (75%, 81.25%, 87.5%, 93.75%).",
    "Ces 16 frames servent au TIMING.",
    has50
      ? `- IMAGE ${img50Idx} : frame en grand à 50% de la durée, avec RÈGLE incrustée (lignes rouges tous les 10% de la hauteur, étiquetées 10…90).`
      : "",
    hasDesign
      ? `- IMAGE ${img85Idx} : frame en grand à 85% de la durée, même règle. Sert aux MESURES de design — mesure CONTRE la règle, ne devine pas.`
      : "",
    "Plus (si dispo) la transcription et la légende du post.",
    "Extrais la RECETTE réutilisable : le schéma qui fait marcher ce reel, PAS son sujet.",
    "",
    "STYLE (bref, en français) : type de hook, structure, ton, CTA, style visuel des captions (couleur, contour, MAJUSCULES).",
    "",
    "LAYOUT — mesures précises :",
    "- cumulativeCaptionsPerFrame : examine les 16 frames (IMAGES 1→4, 4 frames chacune) UNE PAR UNE, dans l'ordre. Pour chaque frame, donne le nombre CUMULÉ de captions distinctes apparues jusque-là (hook = 1 ; une caption qui en remplace une autre incrémente quand même le cumul). 16 valeurs, jamais décroissantes. Regarde ATTENTIVEMENT chaque frame : une caption partiellement visible compte.",
    has50 && hasDesign
      ? `- mode : compare IMAGE ${img50Idx} (50%) et IMAGE ${img85Idx} (85%). Si les captions visibles à 50% sont ENCORE là à 85% (d'autres se sont AJOUTÉES) → "stack". Si elles ont été REMPLACÉES par d'autres → "replace".`
      : '- mode : "stack" si les captions s\'accumulent au fil du temps, "replace" si chaque caption remplace la précédente (compare les frames des grilles).',
    hasDesign
      ? [
          `- hookYFrac : lis sur IMAGE ${img85Idx}, contre la règle, la position du HAUT de la première caption (ligne 30 = 0.30). Interpole entre deux lignes si besoin.`,
          "- stackYFrac : idem pour le HAUT de la première caption révélée après le hook.",
          "- fontFrac : la hauteur d'UNE ligne de texte des captions RÉVÉLÉES comparée à l'écart entre deux lignes rouges (qui vaut 0.10). Ex : une ligne de texte = un tiers de l'écart → 0.033.",
          "- hookFontFrac : même mesure pour le HOOK seul (souvent plus gros que les items — regarde bien).",
          "- longestLineText : recopie EXACTEMENT la ligne affichée la plus longue (une seule ligne à l'écran).",
        ].join("\n")
      : [
          "- hookYFrac / stackYFrac : positions verticales du haut des captions (0-1).",
          "- fontFrac / hookFontFrac : hauteur d'une ligne de texte (items / hook) / hauteur de l'image.",
          "- longestLineText : recopie la ligne affichée la plus longue.",
        ].join("\n"),
    "- fontFamily / fontWeight / outline / shadow : observe les LETTRES des captions en zoomant mentalement — empattements ou pas, épaisseur du trait, contour, ombre. Ce sont les tokens de style qui seront reproduits tels quels.",
    "",
    "accentColor = couleur dominante du texte des captions en #RRGGBB si visible, sinon null (ignore les lignes rouges de la règle : c'est un outil de mesure, pas le design).",
    "examples = les textes EXACTS des captions lus à l'écran (hook d'abord), avec leur numérotation/puces d'origine.",
    "",
    "MONTAGE (regarde les 16 frames de timing) :",
    "- montageLevel : \"coordonne\" SEULEMENT si l'image illustre spécifiquement le SENS du texte (le texte nomme une chose — visage, corps, un objet, avant/après — et l'image la MONTRE à ce moment). Une tête qui parle avec des sous-titres qui suivent la voix = \"rythme\", PAS \"coordonne\". Un plan quasi fixe = \"simple\".",
    "- moves : la suite des plans dans l'ordre (action + ce que montre le plan + texte affiché). Sois précis sur le lien image↔texte.",
    "- footageNeeded : en une phrase, le rush idéal pour reproduire ce montage.",
    "Enregistre la recette via l'outil save_recipe.",
  ]
    .filter(Boolean)
    .join("\n");

  const userParts = ["Analyse ce reel de référence."];
  if (opts.postCaption) userParts.push(`\nLégende du post : ${opts.postCaption.slice(0, 1000)}`);
  if (opts.transcript) userParts.push(`\nTranscription : ${opts.transcript.slice(0, 3000)}`);

  try {
    const { toolInput } = await callAnthropic({
      system,
      user: userParts.join("\n"),
      imagesBase64: [
        ...opts.gridImagesBase64,
        ...(opts.designImage50Base64 ? [opts.designImage50Base64] : []),
        ...(opts.designImage85Base64 ? [opts.designImage85Base64] : []),
      ],
      // NB : `temperature` est DÉPRÉCIÉ sur claude-haiku-4-5 (HTTP 400 si
      // envoyé). La reproductibilité opérationnelle vient du cache par hash
      // de contenu (même fichier ⇒ un seul appel vision, recette réutilisée) ;
      // le schéma tool-use réduit la variance résiduelle du modèle.
      tool: RECIPE_TOOL,
    });
    if (!toolInput) return null;
    return parseRecipe(toolInput, opts.refDurationSec);
  } catch (e) {
    console.error(
      "[studio] extraction de recette échouée :",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

// Facteur de calibration de maxCharsPerLine : la vision SURESTIME le compte
// de caractères (mesuré sur ref à vérité connue : 26-28 rendus pour 22 réels,
// soit un biais de +18-27%). 0.85 ramène la mesure dans ±3 chars de la vérité.
const MAXCHARS_CALIBRATION = 0.85;

function parseRecipe(input: unknown, refDurationSec: number): ViralRecipe | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;

  const str = (v: unknown, fallback = ""): string =>
    typeof v === "string" ? v.trim() : fallback;

  const hookStyle = str(o.hookStyle);
  if (!hookStyle) return null; // recette vide = inexploitable

  const accent = str(o.accentColor);
  const examples = Array.isArray(o.examples)
    ? o.examples.filter((x): x is string => typeof x === "string").slice(0, 6)
    : [];

  // ── Montage (Phase 1) : niveau + mouvements (validés/bornés) ──────────────
  const level: MontageLevel =
    o.montageLevel === "coordonne" || o.montageLevel === "rythme"
      ? o.montageLevel
      : "simple";
  const moves: MontageMove[] = Array.isArray(o.moves)
    ? o.moves
        .map((m) => {
          const mo = m as Record<string, unknown>;
          const atFrac = typeof mo.atFrac === "number" ? mo.atFrac : NaN;
          const action = mo.action;
          if (!Number.isFinite(atFrac)) return null;
          if (!["hold", "zoom-in", "pull-back", "cut", "pan"].includes(action as string))
            return null;
          return {
            atFrac: Math.max(0, Math.min(1, atFrac)),
            action: action as MontageMove["action"],
            shows: typeof mo.shows === "string" ? mo.shows.trim() : "",
            textAtThisMoment:
              typeof mo.textAtThisMoment === "string" ? mo.textAtThisMoment.trim() : "",
          };
        })
        .filter((m): m is MontageMove => m !== null)
        .sort((a, b) => a.atFrac - b.atFrac)
        .slice(0, 12)
    : [];

  return {
    hookStyle,
    captionStyle: str(o.captionStyle),
    structure: str(o.structure),
    tone: str(o.tone),
    cta: str(o.cta),
    examples,
    accentColor: /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : undefined,
    uppercase: typeof o.uppercase === "boolean" ? o.uppercase : undefined,
    layout: parseLayout(o.layout, refDurationSec, examples),
    montageLevel: level,
    moves,
    footageNeeded: str(o.footageNeeded) || undefined,
  };
}

// maxCharsPerLine DÉRIVÉ du texte exact des captions (retours à la ligne
// retranscrits par la vision) — mesure déterministe en code, sans estimation.
// Retourne null si les exemples n'ont pas de retours à la ligne exploitables.
function maxCharsFromExamples(examples: string[]): number | null {
  const lines = examples
    .flatMap((e) => e.split("\n"))
    .map((l) => l.trim())
    .filter(Boolean);
  // Sans \n, chaque "ligne" est une caption entière → pas une mesure de wrap.
  if (lines.length <= examples.filter(Boolean).length) return null;
  return Math.max(...lines.map((l) => l.length));
}

// Bornes de sûreté sur les mesures vision : une estimation aberrante ne doit
// jamais produire un rendu illisible. CHAQUE clamp est LOGGÉ (valeur brute vs
// clampée) — plus de correction silencieuse.
function clampLogged(
  field: string,
  raw: number,
  lo: number,
  hi: number
): number {
  const clamped = Math.max(lo, Math.min(hi, raw));
  if (clamped !== raw) {
    console.warn(
      `[studio] parseLayout: ${field} clampé ${raw} → ${clamped} (bornes [${lo}, ${hi}])`
    );
  }
  return clamped;
}

function parseLayout(
  v: unknown,
  refDurationSec: number,
  examples: string[] = []
): ViralRecipe["layout"] {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const num = (x: unknown): number | null =>
    typeof x === "number" && Number.isFinite(x) ? x : null;

  // ── Timing CALCULÉ EN CODE depuis les comptages par frame (déterministe).
  // La vision fait une tâche perceptuelle simple (compter par tuile) ; les
  // fractions viennent des transitions : apparition = point médian entre la
  // dernière frame sans et la première frame avec.
  const rawCounts = Array.isArray(o.cumulativeCaptionsPerFrame)
    ? o.cumulativeCaptionsPerFrame.map(num).map((x) => x ?? 0)
    : [];
  if (rawCounts.length < 2) return undefined;
  // Force la monotonie (un cumul ne redescend jamais).
  const counts = rawCounts.map((c, i, arr) =>
    Math.max(c, i > 0 ? arr[i - 1] : c)
  );
  const n = counts.length;
  const revealAtFrac: number[] = [];
  for (let i = 1; i < n; i++) {
    const delta = counts[i] - counts[i - 1];
    for (let d = 0; d < delta; d++) {
      // Le tout premier incrément = le hook (affiché dès le début) — ignoré.
      if (counts[i - 1] + d === 0) continue;
      // Le filtre fps échantillonne la frame i à i/n de la durée (PAS i/(n-1)) :
      // la dernière frame est à 93.75%, jamais à 100%.
      const mid = ((i - 1) / n + i / n) / 2;
      revealAtFrac.push(clampLogged(`revealAtFrac[${revealAtFrac.length}]`, mid, 0.02, 0.95));
    }
  }
  const count = Math.round(
    clampLogged("revealCount", revealAtFrac.length, 0, 4)
  );
  revealAtFrac.length = count; // borné comme revealCount

  // ── maxCharsPerLine : ligne recopiée (mesure code) > textes des exemples >
  // estimation vision calibrée (biais +18-27% mesuré, voir MAXCHARS_CALIBRATION).
  const longestLine =
    typeof o.longestLineText === "string" ? o.longestLineText.trim() : "";
  const fromExamples = maxCharsFromExamples(examples);
  const rawMaxChars = num(o.maxCharsPerLine) ?? 26;
  let derived: number;
  if (longestLine.length >= 8) {
    derived = longestLine.length;
    console.log(
      `[studio] parseLayout: maxCharsPerLine = ${derived} (ligne recopiée "${longestLine.slice(0, 40)}…" ; vision estimait ${rawMaxChars})`
    );
  } else if (fromExamples !== null) {
    derived = fromExamples;
    console.log(
      `[studio] parseLayout: maxCharsPerLine dérivé des textes = ${fromExamples} (vision estimait ${rawMaxChars})`
    );
  } else {
    derived = Math.round(rawMaxChars * MAXCHARS_CALIBRATION);
    if (derived !== rawMaxChars) {
      console.log(
        `[studio] parseLayout: maxCharsPerLine calibré ${rawMaxChars} → ${derived} (×${MAXCHARS_CALIBRATION})`
      );
    }
  }

  const fontFrac = clampLogged("fontFrac", num(o.fontFrac) ?? 0.032, 0.018, 0.06);
  return {
    revealCount: count,
    revealAtFrac,
    hookYFrac: clampLogged("hookYFrac", num(o.hookYFrac) ?? 0.32, 0.05, 0.75),
    stackYFrac: clampLogged("stackYFrac", num(o.stackYFrac) ?? 0.45, 0.1, 0.85),
    fontFrac,
    maxCharsPerLine: clampLogged("maxCharsPerLine", derived, 12, 42),
    mode: o.mode === "replace" ? "replace" : "stack",
    refDurationSec: Math.max(1, refDurationSec),
    // ── Tokens visuels (Phase 3) — défauts = look actuel si absents ─────────
    hookFontFrac: clampLogged(
      "hookFontFrac",
      num(o.hookFontFrac) ?? fontFrac,
      0.018,
      0.075
    ),
    fontFamily: o.fontFamily === "serif" ? "serif" : "sans",
    fontWeight:
      o.fontWeight === "normal" || o.fontWeight === "bold" || o.fontWeight === "heavy"
        ? o.fontWeight
        : "heavy",
    outline:
      o.outline === "none" || o.outline === "thin" || o.outline === "thick"
        ? o.outline
        : "thick",
    shadow: typeof o.shadow === "boolean" ? o.shadow : true,
  };
}
