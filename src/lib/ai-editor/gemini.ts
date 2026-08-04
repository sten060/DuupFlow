// src/lib/ai-editor/gemini.ts
//
// Couche « COMPRÉHENSION » de la référence : un modèle qui REGARDE réellement la
// vidéo (Gemini ingère le .mp4 en natif, échantillonné à fps élevé) et renvoie un
// profil STRUCTURÉ — contenu des plans, captions (texte + style + position),
// mouvement, emojis, « pourquoi ça marche ». Tout est exprimé dans les UNITÉS que
// create_variant accepte (x/y %, fontSize px @1080, couleur hex, une des 6 polices)
// pour être passable tel quel par le monteur.
//
// Best-effort : sans GEMINI_API_KEY (ou en cas d'erreur), renvoie null → le reste
// du profil (beats, colorimétrie, keyframes, transcription) fonctionne quand même.
//
// Aucune dépendance : appels REST bruts (fetch) à l'API Files + generateContent.
// La clé est fournie par le user (jamais lue ici en clair) : process.env.GEMINI_API_KEY.

import fs from "fs/promises";
import path from "path";

const API = "https://generativelanguage.googleapis.com";

export type GeminiShot = {
  startSec: number;
  endSec: number;
  content: string;                 // ce qu'on voit dans le plan
  motion: "none" | "zoomIn" | "zoomOut" | "panLeft" | "panRight" | "handheld";
};

// Une caption LUE à l'écran, déjà convertie aux unités de create_variant.captions.
export type GeminiCaption = {
  text: string;
  startSec: number;
  endSec: number;
  xPct: number;          // centre horizontal en % (0-100)
  yPct: number;          // centre vertical en % (0-100)
  fontSizePx: number;    // px à la référence 1080 de large (== create_variant.fontSize)
  color: string;         // hex
  hasStroke: boolean;    // contour présent ?
  strokeWidthPx: number; // épaisseur du contour (px @1080), 0 si aucun
  background: string;    // "none" ou hex (fond derrière le texte)
  font: "sans" | "rounded" | "impact" | "serif" | "script" | "display"; // meilleur match parmi les 6
  emojis: string;        // emojis présents dans/à côté de la caption ("" si aucun)
};

export type GeminiComprehension = {
  whyItWorks: string;
  shots: GeminiShot[];
  captions: GeminiCaption[];
  emojisOverall: string;
  model: string;
};

export function geminiKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}
export function isGeminiAvailable(): boolean {
  return !!geminiKey();
}

function mimeFor(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  if (ext === ".m4v" || ext === ".mp4") return "video/mp4";
  return "video/mp4";
}

// Schéma de sortie structuré (sous-ensemble OpenAPI attendu par Gemini).
const SCHEMA = {
  type: "OBJECT",
  properties: {
    whyItWorks: { type: "STRING" },
    shots: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          startSec: { type: "NUMBER" },
          endSec: { type: "NUMBER" },
          content: { type: "STRING" },
          motion: { type: "STRING", enum: ["none", "zoomIn", "zoomOut", "panLeft", "panRight", "handheld"] },
        },
        required: ["startSec", "endSec", "content", "motion"],
      },
    },
    captions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          startSec: { type: "NUMBER" },
          endSec: { type: "NUMBER" },
          xPct: { type: "NUMBER" },
          yPct: { type: "NUMBER" },
          fontSizePx: { type: "NUMBER" },
          color: { type: "STRING" },
          hasStroke: { type: "BOOLEAN" },
          strokeWidthPx: { type: "NUMBER" },
          background: { type: "STRING" },
          font: { type: "STRING", enum: ["sans", "rounded", "impact", "serif", "script", "display"] },
          emojis: { type: "STRING" },
        },
        required: ["text", "startSec", "endSec", "xPct", "yPct", "fontSizePx", "color", "font"],
      },
    },
    emojisOverall: { type: "STRING" },
  },
  required: ["whyItWorks", "shots", "captions"],
};

const PROMPT = `Tu analyses une vidéo courte (Reel/TikTok) qui a PERFORMÉ, pour qu'un monteur en fabrique des variantes. Réponds UNIQUEMENT en JSON conforme au schéma.

Objectif : décrire la STRUCTURE et le STYLE, pas raconter le contenu. Sois précis et mesuré, pas bavard.

1) shots : découpe en plans. Pour chaque plan : startSec, endSec, content (1 phrase : ce qu'on voit / cadrage), et motion = le mouvement DE CAMÉRA le plus proche parmi : none, zoomIn, zoomOut, panLeft, panRight, handheld (caméra à la main, tremblante). Ne devine pas un zoom sur un plan fixe.

2) captions : CHAQUE texte incrusté à l'écran (hook, sous-titres stylés, mots-clés animés…). Pour chacune, EXPRIME les valeurs dans ces unités exactes (celles du moteur de rendu) :
   - text : le texte exact (avec ses emojis s'il y en a).
   - startSec / endSec : quand elle apparaît / disparaît.
   - xPct / yPct : position du CENTRE de la caption en % de la frame (0 = gauche/haut, 100 = droite/bas). Ex. un texte centré en bas ≈ x 50, y 85.
   - fontSizePx : hauteur de police en px RAMENÉE à une largeur de 1080 (si la frame fait 1080 de large, c'est la taille en px ; sinon convertis). Grosse caption ≈ 70-110, sous-titre ≈ 40-60.
   - color : couleur du texte en hex (#RRGGBB).
   - hasStroke : true s'il y a un contour autour des lettres ; strokeWidthPx : son épaisseur (px @1080), sinon 0.
   - background : "none" si pas de fond, sinon la couleur hex du bloc/boîte derrière le texte.
   - font : la famille la PLUS PROCHE parmi EXACTEMENT ces 6 (ne donne pas le nom réel de la fonte, indevinable — donne le meilleur match) : sans (néo-grotesque type Helvetica/Inter), rounded (arrondie type TikTok/CapCut/Poppins), impact (grasse condensée type Anton), serif (à empattements type Playfair), script (manuscrite type Pacifico), display (fantaisie massive type Bungee).
   - emojis : les emojis de cette caption ("" si aucun).
   S'il n'y a AUCUN texte incrusté, renvoie captions: [].

3) emojisOverall : les emojis marquants de la vidéo en général ("" si aucun).

4) whyItWorks : 2-3 phrases — pourquoi ce format accroche (hook, rythme, promesse, structure). Actionnable.`;

async function gfetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** Repli : liste les modèles RÉELLEMENT disponibles pour cette clé et choisit un
 *  « flash » qui supporte generateContent (video-capable). Robuste quel que soit
 *  l'accès du compte (certaines clés n'ont pas gemini-2.5-flash → 404). */
async function pickAvailableModel(key: string): Promise<string | null> {
  try {
    const r = await gfetch(`${API}/v1beta/models?key=${key}`, { method: "GET" }, 20_000);
    if (!r.ok) return null;
    const j = await r.json().catch(() => null) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] } | null;
    const names = (j?.models ?? [])
      .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => m.name!.replace(/^models\//, ""));
    return (
      names.find((n) => /^gemini-2\.\d+-flash$/.test(n)) ||                       // gemini-2.0-flash, 2.5-flash…
      names.find((n) => /flash/.test(n) && !/(vision|thinking|preview|exp|lite)/.test(n)) ||
      names.find((n) => /flash/.test(n)) ||
      names.find((n) => /gemini/.test(n)) ||
      names[0] || null
    );
  } catch { return null; }
}

/**
 * Analyse la vidéo de référence avec Gemini (couche compréhension).
 * Best-effort : renvoie null si pas de clé / échec / timeout.
 */
export async function analyzeReferenceWithGemini(videoPath: string): Promise<GeminiComprehension | null> {
  const key = geminiKey();
  if (!key) return null;
  // Défaut = gemini-2.0-flash (GA, largement dispo, vidéo). Certaines clés n'ont pas
  // 2.5-flash (404) → repli auto via pickAvailableModel plus bas.
  const model = process.env.AI_EDITOR_GEMINI_MODEL || "gemini-2.0-flash";
  const fps = Math.max(1, Math.min(10, Number(process.env.AI_EDITOR_GEMINI_FPS) || 2));

  try {
    const bytes = await fs.readFile(videoPath);
    const mime = mimeFor(videoPath);
    console.log(`[ai-editor/gemini] appel démarré · model=${model} fps=${fps} · ${(bytes.length / 1e6).toFixed(1)} Mo`);

    // 1) Démarrer un upload résumable (Files API).
    const startRes = await gfetch(`${API}/upload/v1beta/files?key=${key}`, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.length),
        "X-Goog-Upload-Header-Content-Type": mime,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { displayName: "reference" } }),
    }, 30_000);
    const uploadUrl = startRes.headers.get("x-goog-upload-url");
    if (!startRes.ok || !uploadUrl) {
      console.warn("[ai-editor/gemini] upload start KO:", startRes.status);
      return null;
    }

    // 2) Envoyer les octets + finaliser.
    const upRes = await gfetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(bytes.length),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: new Uint8Array(bytes),
    }, 120_000);
    if (!upRes.ok) { console.warn("[ai-editor/gemini] upload KO:", upRes.status); return null; }
    const upJson = await upRes.json().catch(() => null) as { file?: { name?: string; uri?: string; state?: string; mimeType?: string } } | null;
    const file = upJson?.file;
    if (!file?.name || !file?.uri) { console.warn("[ai-editor/gemini] upload sans file.uri"); return null; }

    // 3) Attendre que la vidéo soit traitée (state ACTIVE).
    let state = file.state || "PROCESSING";
    let uri = file.uri;
    let fileMime = file.mimeType || mime;
    const deadline = Date.now() + 120_000;
    while (state === "PROCESSING" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const st = await gfetch(`${API}/v1beta/${file.name}?key=${key}`, { method: "GET" }, 20_000);
      const stJson = await st.json().catch(() => null) as { state?: string; uri?: string; mimeType?: string } | null;
      if (stJson?.state) state = stJson.state;
      if (stJson?.uri) uri = stJson.uri;
      if (stJson?.mimeType) fileMime = stJson.mimeType;
    }
    if (state !== "ACTIVE") { console.warn("[ai-editor/gemini] fichier non ACTIVE:", state); return null; }

    // 4) generateContent (sortie structurée + fps élevé) — avec REPLI auto si le
    //    modèle est indisponible pour cette clé (404, ex. gemini-2.5-flash).
    const buildBody = (m: string) => ({
      contents: [{
        role: "user",
        parts: [
          { fileData: { mimeType: fileMime, fileUri: uri }, videoMetadata: { fps } },
          { text: PROMPT },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 8192,
        // thinkingConfig n'existe QUE sur 2.5+ (l'envoyer à 2.0-flash = 400). Sur
        // 2.5 on coupe le thinking pour réserver tous les tokens au JSON.
        ...(/2\.5|thinking/.test(m) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });
    const runGen = (m: string) => gfetch(`${API}/v1beta/models/${m}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildBody(m)),
    }, 150_000);

    let usedModel = model;
    let genRes = await runGen(model);
    if (genRes.status === 404) {
      const alt = await pickAvailableModel(key);
      if (alt && alt !== model) {
        console.warn(`[ai-editor/gemini] modèle "${model}" indisponible (404) → repli sur "${alt}"`);
        usedModel = alt;
        genRes = await runGen(alt);
      }
    }
    if (!genRes.ok) {
      console.warn("[ai-editor/gemini] generateContent KO:", genRes.status, (await genRes.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const genJson = await genRes.json().catch(() => null) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    } | null;
    const raw = genJson?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const u = genJson?.usageMetadata;
    if (!raw.trim()) {
      console.warn(`[ai-editor/gemini] réponse vide · finishReason=${genJson?.candidates?.[0]?.finishReason ?? "?"} · tokens in=${u?.promptTokenCount ?? "?"} out=${u?.candidatesTokenCount ?? "?"}`);
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<GeminiComprehension>;
    // Nettoyage/normalisation dans les unités attendues.
    const clamp = (v: unknown, lo: number, hi: number, d: number) => {
      const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
    };
    const FONTS = ["sans", "rounded", "impact", "serif", "script", "display"] as const;
    const MOTIONS = ["none", "zoomIn", "zoomOut", "panLeft", "panRight", "handheld"] as const;

    const shots: GeminiShot[] = Array.isArray(parsed.shots) ? parsed.shots.slice(0, 40).map((s) => ({
      startSec: Math.round(clamp(s?.startSec, 0, 100000, 0) * 100) / 100,
      endSec: Math.round(clamp(s?.endSec, 0, 100000, 0) * 100) / 100,
      content: String(s?.content ?? "").slice(0, 240),
      motion: (MOTIONS as readonly string[]).includes(String(s?.motion)) ? (s!.motion as GeminiShot["motion"]) : "none",
    })) : [];

    const captions: GeminiCaption[] = Array.isArray(parsed.captions) ? parsed.captions.slice(0, 30).map((c) => ({
      text: String(c?.text ?? "").slice(0, 300),
      startSec: Math.round(clamp(c?.startSec, 0, 100000, 0) * 100) / 100,
      endSec: Math.round(clamp(c?.endSec, 0, 100000, 0) * 100) / 100,
      xPct: Math.round(clamp(c?.xPct, 0, 100, 50)),
      yPct: Math.round(clamp(c?.yPct, 0, 100, 85)),
      fontSizePx: Math.round(clamp(c?.fontSizePx, 12, 300, 64)),
      color: String(c?.color ?? "#ffffff").slice(0, 9),
      hasStroke: !!c?.hasStroke,
      strokeWidthPx: Math.round(clamp(c?.strokeWidthPx, 0, 40, 0)),
      background: String(c?.background ?? "none").slice(0, 9),
      font: (FONTS as readonly string[]).includes(String(c?.font)) ? (c!.font as GeminiCaption["font"]) : "sans",
      emojis: String(c?.emojis ?? ""),
    })) : [];

    console.log(`[ai-editor/gemini] OK · model=${usedModel} · tokens in=${u?.promptTokenCount ?? "?"} out=${u?.candidatesTokenCount ?? "?"} total=${u?.totalTokenCount ?? "?"} · ${captions.length} caption(s), ${shots.length} plan(s)`);

    return {
      whyItWorks: String(parsed.whyItWorks ?? "").slice(0, 1000),
      shots,
      captions,
      emojisOverall: String(parsed.emojisOverall ?? ""),
      model: usedModel,
    };
  } catch (e) {
    console.warn("[ai-editor/gemini] analyse échouée:", (e as Error)?.message?.slice(0, 200));
    return null;
  }
}
