// src/lib/ai-editor/mcp-tools.ts
//
// Définition + exécution des OUTILS MCP de l'Éditeur IA (séparé de la route pour
// être testable sans l'auth). Lecture seule pour l'instant : donner au Claude du
// user la référence analysée (keyframes EN IMAGES qu'il VOIT + transcript) et la
// matière. La génération viendra avec le moteur de rendu.

import { getLatestProject } from "./store";
import type { Project } from "./store";
import { renderVariant, variantKeyframes, materialKeyframes } from "./render";
import type { EditPlan } from "./render";

export const MAX_KEYFRAMES = 6; // borne le nombre d'images renvoyées (coût tokens user)

export type Content =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export const TOOLS = [
  {
    name: "get_reference",
    description:
      "Récupère la vidéo de RÉFÉRENCE analysée du dernier projet du user : ses IMAGES CLÉS (que tu peux voir), sa transcription, son rythme (coupes) et ses métadonnées. Sers-t'en pour comprendre la structure à reproduire (hook, rythme, style).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_material",
    description:
      "Liste la MATIÈRE première du user (rushes vidéo / images) du dernier projet, avec la description de chaque fichier et une vignette. C'est le footage à utiliser pour reproduire la référence.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_variant",
    description:
      "Assemble UNE variante vidéo selon TON plan de montage. Contrôles : segments coupés ; captions stylables (contour/box, couleur, contour, taille, position x/y en %, alignement) ; images animées (zoomIn/zoomOut/panLeft/panRight + cadrage cover/contain/blurFill) ; colorimétrie globale (grade) ; fps ; couleur de fond. Le son des plans vidéo est CONSERVÉ. " +
      "IMPORTANT : cet outil te RENVOIE des keyframes du rendu + la durée réelle → REGARDE-LES pour vérifier cadrage/rythme/captions, et rappelle l'outil pour corriger. " +
      "Durées : segment libre (borné à la longueur du fichier pour une vidéo) ; défaut image = 2,5 s. Jusqu'à 40 segments, 30 captions.",
    inputSchema: {
      type: "object",
      properties: {
        aspect: { type: "string", enum: ["9:16", "1:1", "16:9"], description: "Format (défaut 9:16)." },
        fps: { type: "number", description: "Images/s de sortie (15-60, défaut 30)." },
        background: { type: "string", description: "Couleur de fond des bandes (letterbox) en hex. Défaut noir." },
        grade: {
          type: "object",
          description: "Colorimétrie GLOBALE (optionnel).",
          properties: {
            saturation: { type: "number", description: "1 = neutre, >1 plus saturé, <1 désaturé." },
            contrast: { type: "number", description: "1 = neutre." },
            brightness: { type: "number", description: "0 = neutre (-1..1)." },
            temperature: { type: "number", description: "Teinte : -1 froid (bleuté) .. +1 chaud (doré), 0 neutre." },
            grain: { type: "number", description: "0..1 : grain filmique." },
            vignette: { type: "boolean", description: "Assombrit les bords." },
          },
        },
        audio: {
          type: "object",
          description: "Piste sonore optionnelle prise d'une MATIÈRE (fichier audio uploadé, OU le son d'un rush vidéo). Sert à poser une musique/voix sur toute la variante.",
          properties: {
            materialId: { type: "string", description: "id (de list_material) d'une matière audio ou vidéo (on prend sa piste son)." },
            startSec: { type: "number", description: "décalage de départ dans la piste (s). Défaut 0." },
            volume: { type: "number", description: "0-2 (1 = normal). Défaut 1." },
            mode: { type: "string", enum: ["mix", "replace"], description: "mix = par-dessus le son des plans (défaut) ; replace = remplace le son des plans." },
          },
          required: ["materialId"],
        },
        segments: {
          type: "array",
          description: "Plans à enchaîner, dans l'ordre.",
          items: {
            type: "object",
            properties: {
              materialId: { type: "string", description: "L'\"id\" EXACT d'un fichier renvoyé par list_material (champ « id: … »). PAS le nom du fichier ni l'UUID du nom." },
              startSec: { type: "number", description: "début de la coupe dans le fichier (s)." },
              endSec: { type: "number", description: "fin de la coupe (s). Pour une image : durée d'affichage." },
              motion: { type: "string", enum: ["none", "zoomIn", "zoomOut", "panLeft", "panRight", "handheld"], description: "IMAGES : mouvement pour éviter le diaporama figé. handheld = tremblé caméra (idéal pour reproduire un plan handheld de la réf, plus naturel qu'un zoom). Défaut none." },
              motionIntensity: { type: "number", description: "Force du mouvement (0.2-3, défaut 1)." },
              fit: { type: "string", enum: ["contain", "cover", "blurFill"], description: "IMAGES, cadrage : contain (défaut, bandes) ; cover (remplit, recadre) ; blurFill (image centrée sur fond flou — idéal vertical)." },
              transition: { type: "string", enum: ["cut", "fade", "whipPan", "slide", "zoomPunch"], description: "Transition à l'ENTRÉE de ce plan (le 1er reste en cut). Défaut cut." },
              transitionDuration: { type: "number", description: "Durée de la transition en s (0.1-0.4 typique). Bornée à la durée des plans." },
            },
            required: ["materialId"],
          },
        },
        captions: {
          type: "array",
          description: "Textes incrustés (optionnel).",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              startSec: { type: "number" },
              endSec: { type: "number" },
              position: { type: "string", enum: ["top", "center", "bottom"], description: "Position rapide (défaut bottom). Ignorée si x/y fournis." },
              x: { type: "number", description: "Centre horizontal en % (0-100)." },
              y: { type: "number", description: "Centre vertical en % (0-100). Ex. réf ≈ 13 (haut)." },
              align: { type: "string", enum: ["left", "center", "right"], description: "Alignement (défaut center)." },
              style: { type: "string", enum: ["outline", "box"], description: "outline = gros texte contour (défaut) ; box = fond." },
              background: { type: "string", description: "Couleur de fond hex → force le style box ; \"none\" → force outline (sans fond)." },
              size: { type: "string", enum: ["s", "m", "l"], description: "Taille rapide (défaut m)." },
              fontSize: { type: "number", description: "Taille en px (référence 1080 de large). Prioritaire sur size." },
              color: { type: "string", description: "Couleur du texte en hex. Défaut blanc." },
              strokeColor: { type: "string", description: "Couleur du contour (style outline). Défaut noir." },
              strokeWidth: { type: "number", description: "Épaisseur du contour en px." },
              font: { type: "string", enum: ["sans", "rounded", "impact", "serif", "script", "display"], description: "Famille : sans (défaut), rounded (arrondie type TikTok/CapCut), impact (grosse condensée), serif, script (manuscrite), display. (Emojis 🎉 supportés, en couleur.)" },
              fontWeight: { type: "number", description: "Graisse 100-900." },
              letterSpacing: { type: "number", description: "Interlettrage en px." },
              lineHeight: { type: "number", description: "Interligne (multiplicateur, défaut 1.24)." },
              textTransform: { type: "string", enum: ["none", "uppercase"], description: "uppercase = TOUT EN MAJUSCULES." },
              shadowColor: { type: "string", description: "Ombre portée (hex) — distincte du contour ; \"none\" pour aucune." },
              shadowBlur: { type: "number", description: "Flou de l'ombre en px." },
              shadowOffset: { type: "number", description: "Décalage de l'ombre en px (bas-droite)." },
            },
            required: ["text", "startSec", "endSec"],
          },
        },
        label: { type: "string", description: "nom court de la variante (ex. hook utilisé)." },
      },
      required: ["segments"],
    },
  },
  {
    name: "list_variants",
    description: "Liste les variantes déjà générées pour le dernier projet (id + vignette du 1er frame). Pour VOIR une variante en détail, utilise get_variant.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_variant",
    description: "Renvoie plusieurs KEYFRAMES d'une variante déjà rendue (pour la relire et t'auto-corriger). Donne son id (de list_variants / create_variant).",
    inputSchema: {
      type: "object",
      properties: { variantId: { type: "string", description: "id de la variante." } },
      required: ["variantId"],
    },
  },
  {
    name: "get_material",
    description: "Renvoie 4-6 KEYFRAMES d'UN fichier de matière précis (par son id). Appelle-le SEULEMENT sur les 2-3 rushes que tu comptes vraiment utiliser (voir où couper) — pas sur tout, pour ne pas saturer ton contexte. Image → renvoie l'image ; audio → infos texte.",
    inputSchema: {
      type: "object",
      properties: { materialId: { type: "string", description: "id d'un fichier (de list_material)." } },
      required: ["materialId"],
    },
  },
  {
    name: "update_variant",
    description: "Modifie une variante existante SANS tout réécrire : donne son id + un patch (mêmes champs que create_variant, seulement ceux à changer). Ex. { captions:[...] } ne touche que les captions, garde les segments. Rend une NOUVELLE variante et renvoie ses keyframes.",
    inputSchema: {
      type: "object",
      properties: {
        variantId: { type: "string", description: "id de la variante à faire évoluer." },
        patch: { type: "object", description: "Champs à remplacer (segments, captions, grade, audio, fps, background, label…). Les champs absents gardent la valeur d'origine. Pour segments/captions : le tableau fourni REMPLACE l'ancien. Donne un label pour distinguer l'itération ; sinon il est auto-suffixé (v2, v3…)." },
      },
      required: ["variantId", "patch"],
    },
  },
] as const;

/** dataURI "data:image/jpeg;base64,XXX" → bloc image MCP. */
export function dataUriToImage(dataUri: string): Content | null {
  const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { type: "image", data: m[2], mimeType: m[1] };
}

/** Recompresse une image (data URI) en plus petit → réponse MCP allégée (les
 *  keyframes de réf stockées sont en 480px ; certains clients vident les blocs
 *  image si la réponse est trop lourde). Repli sur l'original si sharp échoue. */
async function shrinkDataUri(dataUri: string, width = 360, quality = 60): Promise<string> {
  const m = dataUri.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) return dataUri;
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(Buffer.from(m[1], "base64")).resize({ width, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return dataUri;
  }
}

export async function callTool(userId: string, name: string, args?: Record<string, unknown>): Promise<{ content: Content[]; isError?: boolean }> {
  const project: Project | null = await getLatestProject(userId);

  if (!project) {
    return { content: [{ type: "text", text: "Aucun projet : le user doit d'abord uploader une référence dans l'Éditeur IA de DuupFlow." }], isError: true };
  }

  if (name === "get_reference") {
    const ref = project.reference;
    if (!ref) return { content: [{ type: "text", text: "Aucune référence dans ce projet pour l'instant." }], isError: true };
    const a = ref.analysis;
    const cuts = Array.isArray(a.sceneCuts) ? a.sceneCuts : [];
    const phrases = a.transcript?.phrases ?? [];
    const N_IMG = 5;
    // Beats : échantillonnés sur TOUTE la durée (pas les 48 premiers → sinon le
    // dernier tiers de la réf n'a aucun beat et on ne peut pas y caler les coupes).
    const allBeats = a.audio?.beats ?? [];
    const beatsShown = allBeats.length <= 90 ? allBeats : allBeats.filter((_, i) => i % Math.ceil(allBeats.length / 90) === 0);
    const beatsNote = beatsShown.length < allBeats.length ? ` (${beatsShown.length}/${allBeats.length} répartis)` : "";
    // Colorimétrie traduite dans les UNITÉS de grade (1=neutre sat/contrast, 0=neutre
    // brightness) → passable telle quelle à create_variant.grade (la mesure brute 0-1
    // ne l'est pas). Nudge vers l'aspect de la réf.
    const gsSat = a.color ? Math.round(Math.max(0.6, Math.min(1.4, 0.7 + a.color.saturation * 0.9)) * 100) / 100 : null;
    const gsBri = a.color ? Math.round(Math.max(-0.4, Math.min(0.4, (a.color.brightness - 0.5) * 0.6)) * 100) / 100 : null;
    const gsTemp = a.color ? (a.color.warmCold === "warm" ? 0.3 : a.color.warmCold === "cold" ? -0.3 : 0) : null;
    const lines = [
      `RÉFÉRENCE : ${ref.label} (${ref.source})`,
      `Durée : ${a.durationSec.toFixed(1)}s · ${a.width}×${a.height} · ${a.fps} fps · audio: ${a.hasAudio ? "oui" : "non"}`,
      `Rythme : ${a.pacing.cutCount} coupe(s)${a.pacing.avgCutSec ? ` · ~${a.pacing.avgCutSec}s/plan` : ""}`,
      cuts.length ? `Coupes (timecodes s) : ${cuts.slice(0, 60).map((c) => c.toFixed(2)).join(", ")}` : null,
      a.shots?.length
        ? `PLANS (${a.shots.length}) — reproduis ce mouvement (n'ajoute PAS de zoom sur un plan static) :\n${a.shots.map((s) => `  #${s.index} [${s.startSec}–${s.endSec}s · ${s.durationSec}s] ${s.motion}${s.motion !== "static" ? ` (intensité ${s.motionIntensity})` : ""}`).join("\n")}`
        : null,
      a.color ? `Colorimétrie moyenne (mesure 0-1) : saturation ${a.color.saturation} · luminosité ${a.color.brightness} · ${a.color.warmCold}${a.color.bw ? " · N&B" : ""}\n  → gradeSuggested (passe-le TEL QUEL à create_variant.grade) : { saturation: ${gsSat}, contrast: 1, brightness: ${gsBri}, temperature: ${gsTemp} }` : null,
      a.audio && (a.audio.bpm || allBeats.length)
        ? `AUDIO : type ${a.audio.type}${a.audio.bpm ? ` · ~${a.audio.bpm} BPM` : ""}${allBeats.length ? ` · ${allBeats.length} temps forts détectés` : ""}${beatsShown.length ? `\n  Beats (s)${beatsNote} — CALE tes coupes dessus : ${beatsShown.map((b) => b.toFixed(2)).join(", ")}` : ""}`
        : null,
      a.hookText ? `Hook (parlé) : « ${a.hookText} »` : "Hook parlé : (aucune transcription)",
      phrases.length
        ? `Transcription horodatée :\n${phrases.slice(0, 50).map((p) => `  [${p.startSec.toFixed(1)}–${p.endSec.toFixed(1)}s] ${p.text}`).join("\n")}`
        : a.transcript ? `Transcription : ${a.transcript.fullText}` : "Transcription : indisponible (analyse visuelle).",
      "",
      `Images clés ci-dessous (${Math.min(a.keyframes.length, N_IMG)}/${a.keyframes.length}) — observe le hook, le cadrage, le texte à l'écran, le style. La taille (Ko) est indiquée pour diagnostic : si tu vois « 0 Ko », l'extraction est vide ; si >0 mais image vide chez toi, c'est ton client qui la jette.`,
    ].filter(Boolean);
    const content: Content[] = [{ type: "text", text: lines.join("\n") }];
    for (const kf of a.keyframes.slice(0, N_IMG)) {
      const small = await shrinkDataUri(kf.dataUri);
      const img = dataUriToImage(small);
      if (img && img.type === "image") {
        const kb = Math.round(((small.split(",")[1] || "").length * 3 / 4) / 1024);
        content.push({ type: "text", text: `— image à ${kf.t}s · ${kb} Ko · ${img.mimeType} —` }, img);
      }
    }
    return { content };
  }

  if (name === "list_material") {
    const mats = project.materials;
    if (!mats.length) return { content: [{ type: "text", text: "Aucune matière ajoutée pour l'instant." }] };
    const content: Content[] = [{
      type: "text",
      text: `MATIÈRE — ${mats.length} fichier(s). Pour create_variant, utilise l'"id" EXACT ci-dessous comme segments[].materialId (ce n'est PAS le nom du fichier) :`,
    }];
    for (const m of mats) {
      const meta = m.analysis;
      const desc = m.desc?.trim() ? `« ${m.desc.trim()} »` : "(pas de description)";
      const dims = !meta
        ? ""
        : m.kind === "audio"
          ? ` · ${meta.durationSec ? meta.durationSec.toFixed(1) + "s" : "audio"}`
          : ` · ${meta.width}×${meta.height}${meta.durationSec ? ` · ${meta.durationSec.toFixed(1)}s` : ""}`;
      content.push({ type: "text", text: `• id: ${m.id}  ·  ${m.name} [${m.kind}]${dims} — ${desc}` });
      // Index texte des rushes vidéo (coupes + voix) → Claude sait où couper sans
      // deviner ; get_material(id) pour VOIR un rush précis à la demande.
      if (m.kind === "video" && meta) {
        if (meta.sceneCuts?.length) content.push({ type: "text", text: `    ↳ coupes (s) : ${meta.sceneCuts.slice(0, 30).map((c) => c.toFixed(1)).join(", ")}` });
        if (meta.transcript?.fullText) content.push({ type: "text", text: `    ↳ voix : « ${meta.transcript.fullText.slice(0, 220)} »` });
        content.push({ type: "text", text: `    ↳ get_material("${m.id}") pour voir les images de ce rush.` });
      }
      if (meta?.thumb) {
        const img = dataUriToImage(meta.thumb);
        if (img) content.push(img);
      }
    }
    return { content };
  }

  if (name === "create_variant") {
    if (!project.reference) return { content: [{ type: "text", text: "Ajoute d'abord une référence." }], isError: true };
    if (!project.materials.length) return { content: [{ type: "text", text: "Aucune matière : le user doit ajouter des fichiers dans DuupFlow." }], isError: true };
    const res = await renderVariant(userId, project.id, (args ?? {}) as unknown as EditPlan);
    if ("error" in res) return { content: [{ type: "text", text: `Rendu impossible : ${res.error}` }], isError: true };
    const v = res.variant;
    const content: Content[] = [{
      type: "text",
      text: `✅ Variante créée${v.label ? ` « ${v.label} »` : ""} (id ${v.id}) · durée ${res.durationSec}s. Voici des images du RENDU — vérifie cadrage, rythme, position des captions ; rappelle create_variant pour corriger si besoin.`,
    }];
    for (const kf of res.keyframes) {
      const img = dataUriToImage(kf.dataUri);
      if (img) content.push({ type: "text", text: `— rendu à ${kf.t}s —` }, img);
    }
    if (!res.keyframes.length) {
      // Échec NON silencieux : le rendu a réussi mais l'extraction n'a rien donné.
      if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push({ type: "text", text: "Aperçu (poster) :" }, img); }
      content.push({ type: "text", text: "⚠ Impossible d'extraire les images du rendu (voir logs serveur). La variante est bien enregistrée — réessaie get_variant, ou régénère." });
    }
    return { content };
  }

  if (name === "list_variants") {
    if (!project.variants.length) return { content: [{ type: "text", text: "Aucune variante générée pour l'instant." }] };
    // La plus RÉCENTE en premier (variants est déjà unshift-é à la création).
    const content: Content[] = [{ type: "text", text: `VARIANTES — ${project.variants.length} (de la + récente à la + ancienne ; get_variant pour + de détail) :` }];
    for (const v of project.variants) {
      const dur = v.durationSec ? ` · ${v.durationSec}s` : "";
      const dt = v.createdAt ? ` · ${new Date(v.createdAt).toISOString().replace("T", " ").slice(0, 16)}` : "";
      const from = v.derivedFrom ? ` · dérivée de ${v.derivedFrom}` : "";
      content.push({ type: "text", text: `• id: ${v.id}${v.label ? `  ·  ${v.label}` : ""}${dur}${dt}${from}` });
      if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push(img); }
    }
    return { content };
  }

  if (name === "get_variant") {
    const id = String(args?.variantId || "");
    const v = project.variants.find((x) => x.id === id);
    if (!v) return { content: [{ type: "text", text: `Variante introuvable : ${id}. Vois list_variants pour les id.` }], isError: true };
    const kfs = await variantKeyframes(userId, project.id, v.storedName, 5);
    if (!kfs.length) {
      // Échec explicite (plus de « 0 images » muet) : fichier ancien/absent → régénérer.
      const content: Content[] = [{
        type: "text",
        text: `⚠ Aucune image extractible pour la variante « ${v.label || v.id} » (id ${v.id}). Le fichier est probablement ancien ou absent — RÉGÉNÈRE-la avec create_variant, puis rappelle get_variant sur la NOUVELLE variante.`,
      }];
      if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push({ type: "text", text: "Poster (peut être daté) :" }, img); }
      return { content, isError: true };
    }
    const content: Content[] = [{ type: "text", text: `VARIANTE « ${v.label || v.id} » (id ${v.id}) — ${kfs.length} image(s) du rendu :` }];
    for (const kf of kfs) {
      const img = dataUriToImage(kf.dataUri);
      if (img) content.push({ type: "text", text: `— ${kf.t}s —` }, img);
    }
    return { content };
  }

  if (name === "get_material") {
    const id = String(args?.materialId || "");
    const m = project.materials.find((x) => x.id === id);
    if (!m) return { content: [{ type: "text", text: `Matière introuvable : ${id}. Vois list_material.` }], isError: true };
    if (m.kind === "image") {
      const content: Content[] = [{ type: "text", text: `IMAGE « ${m.name} » (id ${m.id})${m.desc?.trim() ? ` — « ${m.desc.trim()} »` : ""} :` }];
      const img = m.analysis?.thumb ? dataUriToImage(m.analysis.thumb) : null;
      if (img) content.push(img); else content.push({ type: "text", text: "(pas d'aperçu)" });
      return { content };
    }
    if (m.kind === "audio") {
      const d = m.analysis?.durationSec;
      return { content: [{ type: "text", text: `AUDIO « ${m.name} » (id ${m.id})${d ? ` · ${d.toFixed(1)}s` : ""}. À utiliser dans create_variant.audio.` }] };
    }
    const kfs = await materialKeyframes(userId, project.id, m.storedName, 5);
    if (!kfs.length) return { content: [{ type: "text", text: `⚠ Aucune image extractible du rush « ${m.name} » (id ${m.id}).` }], isError: true };
    const content: Content[] = [{ type: "text", text: `RUSH « ${m.name} » (id ${m.id})${m.analysis?.durationSec ? ` · ${m.analysis.durationSec.toFixed(1)}s` : ""} — ${kfs.length} images (timecodes pour tes coupes) :` }];
    for (const kf of kfs) { const img = dataUriToImage(kf.dataUri); if (img) content.push({ type: "text", text: `— ${kf.t}s —` }, img); }
    return { content };
  }

  if (name === "update_variant") {
    const id = String(args?.variantId || "");
    const patch = (args?.patch ?? {}) as Record<string, unknown>;
    const v = project.variants.find((x) => x.id === id);
    if (!v) return { content: [{ type: "text", text: `Variante introuvable : ${id}. Vois list_variants.` }], isError: true };
    if (!v.plan) return { content: [{ type: "text", text: `La variante « ${v.label || id} » n'a pas de plan mémorisé (ancienne) — recrée-la une fois avec create_variant, ensuite update_variant marchera.` }], isError: true };
    // Fusion : les champs du patch écrasent ceux du plan d'origine (un tableau
    // segments/captions fourni REMPLACE l'ancien ; les champs absents sont gardés).
    const merged = { ...v.plan, ...patch } as unknown as EditPlan;
    // Label : celui du patch, sinon auto-suffixe (v2, v3…) pour distinguer les itérations.
    const patchLabel = typeof patch.label === "string" && patch.label.trim() ? patch.label.trim() : "";
    if (!patchLabel) {
      const base = String((v.plan as { label?: string }).label ?? v.label ?? "variante").replace(/\s*\(v\d+\)\s*$/, "");
      const n = project.variants.filter((x) => String(x.label ?? "").replace(/\s*\(v\d+\)\s*$/, "") === base).length + 1;
      merged.label = `${base} (v${n})`;
    }
    const res = await renderVariant(userId, project.id, merged, { derivedFrom: v.id });
    if ("error" in res) return { content: [{ type: "text", text: `Mise à jour impossible : ${res.error}` }], isError: true };
    const nv = res.variant;
    const content: Content[] = [{ type: "text", text: `✅ Mise à jour → NOUVELLE variante « ${nv.label || nv.id} » (id ${nv.id}) · durée ${res.durationSec}s. Images du rendu :` }];
    for (const kf of res.keyframes) { const img = dataUriToImage(kf.dataUri); if (img) content.push({ type: "text", text: `— ${kf.t}s —` }, img); }
    if (!res.keyframes.length) content.push({ type: "text", text: "⚠ Images non extraites (voir logs serveur)." });
    return { content };
  }

  return { content: [{ type: "text", text: `Outil inconnu : ${name}` }], isError: true };
}
