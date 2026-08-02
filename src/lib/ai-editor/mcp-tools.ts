// src/lib/ai-editor/mcp-tools.ts
//
// Définition + exécution des OUTILS MCP de l'Éditeur IA (séparé de la route pour
// être testable sans l'auth). Lecture seule pour l'instant : donner au Claude du
// user la référence analysée (keyframes EN IMAGES qu'il VOIT + transcript) et la
// matière. La génération viendra avec le moteur de rendu.

import { getLatestProject } from "./store";
import type { Project } from "./store";
import { renderVariant, variantKeyframes } from "./render";
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
            grain: { type: "number", description: "0..1 : grain filmique." },
            vignette: { type: "boolean", description: "Assombrit les bords." },
          },
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
              motion: { type: "string", enum: ["none", "zoomIn", "zoomOut", "panLeft", "panRight"], description: "IMAGES : mouvement (Ken Burns) pour éviter le diaporama figé. Défaut none." },
              motionIntensity: { type: "number", description: "Force du mouvement (0.2-3, défaut 1)." },
              fit: { type: "string", enum: ["contain", "cover", "blurFill"], description: "IMAGES, cadrage : contain (défaut, bandes) ; cover (remplit, recadre) ; blurFill (image centrée sur fond flou — idéal vertical)." },
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
] as const;

/** dataURI "data:image/jpeg;base64,XXX" → bloc image MCP. */
export function dataUriToImage(dataUri: string): Content | null {
  const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { type: "image", data: m[2], mimeType: m[1] };
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
    const lines = [
      `RÉFÉRENCE : ${ref.label} (${ref.source})`,
      `Durée : ${a.durationSec.toFixed(1)}s · ${a.width}×${a.height} · ${a.fps} fps · audio: ${a.hasAudio ? "oui" : "non"}`,
      `Rythme : ${a.pacing.cutCount} coupe(s)${a.pacing.avgCutSec ? ` · ~${a.pacing.avgCutSec}s/plan` : ""}`,
      a.hookText ? `Hook (parlé) : « ${a.hookText} »` : "Hook parlé : (aucune transcription)",
      a.transcript ? `Transcription : ${a.transcript.fullText}` : "Transcription : indisponible (analyse visuelle).",
      "",
      `Images clés ci-dessous (${Math.min(a.keyframes.length, MAX_KEYFRAMES)}/${a.keyframes.length}) — observe le hook, le cadrage, le texte à l'écran, le style.`,
    ];
    const content: Content[] = [{ type: "text", text: lines.join("\n") }];
    for (const kf of a.keyframes.slice(0, MAX_KEYFRAMES)) {
      const img = dataUriToImage(kf.dataUri);
      if (img) content.push({ type: "text", text: `— image à ${kf.t}s —` }, img);
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
      const dims = meta ? ` · ${meta.width}×${meta.height}${meta.durationSec ? ` · ${meta.durationSec.toFixed(1)}s` : ""}` : "";
      content.push({ type: "text", text: `• id: ${m.id}  ·  ${m.name} [${m.kind}]${dims} — ${desc}` });
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
    if (!res.keyframes.length && v.poster) { const img = dataUriToImage(v.poster); if (img) content.push({ type: "text", text: "Aperçu :" }, img); }
    return { content };
  }

  if (name === "list_variants") {
    if (!project.variants.length) return { content: [{ type: "text", text: "Aucune variante générée pour l'instant." }] };
    const content: Content[] = [{ type: "text", text: `VARIANTES — ${project.variants.length} (vignette du 1er frame ; get_variant pour + de détail) :` }];
    for (const v of project.variants) {
      content.push({ type: "text", text: `• id: ${v.id}${v.label ? `  ·  ${v.label}` : ""}` });
      if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push(img); }
    }
    return { content };
  }

  if (name === "get_variant") {
    const id = String(args?.variantId || "");
    const v = project.variants.find((x) => x.id === id);
    if (!v) return { content: [{ type: "text", text: `Variante introuvable : ${id}. Vois list_variants pour les id.` }], isError: true };
    const kfs = await variantKeyframes(userId, project.id, v.storedName, 6);
    const content: Content[] = [{ type: "text", text: `VARIANTE « ${v.label || v.id} » (id ${v.id}) — ${kfs.length} image(s) du rendu :` }];
    for (const kf of kfs) {
      const img = dataUriToImage(kf.dataUri);
      if (img) content.push({ type: "text", text: `— ${kf.t}s —` }, img);
    }
    if (!kfs.length && v.poster) { const img = dataUriToImage(v.poster); if (img) content.push(img); }
    return { content };
  }

  return { content: [{ type: "text", text: `Outil inconnu : ${name}` }], isError: true };
}
