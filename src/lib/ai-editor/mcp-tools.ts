// src/lib/ai-editor/mcp-tools.ts
//
// Définition + exécution des OUTILS MCP de l'Éditeur IA (séparé de la route pour
// être testable sans l'auth). Lecture seule pour l'instant : donner au Claude du
// user la référence analysée (keyframes EN IMAGES qu'il VOIT + transcript) et la
// matière. La génération viendra avec le moteur de rendu.

import { getLatestProject } from "./store";
import type { Project } from "./store";
import { renderVariant } from "./render";
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
      "Assemble UNE variante vidéo à partir de la matière du user selon TON plan de montage : une suite de segments (coupés dans les fichiers de matière) + des captions optionnelles. C'est toi le monteur : choisis l'ordre, les timings et les textes pour reproduire la structure de la référence. Appelle-le plusieurs fois pour plusieurs variantes. (v1 : vidéo sans son.)",
    inputSchema: {
      type: "object",
      properties: {
        aspect: { type: "string", enum: ["9:16", "1:1", "16:9"], description: "Format (défaut 9:16)." },
        segments: {
          type: "array",
          description: "Plans à enchaîner, dans l'ordre.",
          items: {
            type: "object",
            properties: {
              materialId: { type: "string", description: "L'\"id\" EXACT d'un fichier renvoyé par list_material (champ « id: … »). PAS le nom du fichier ni l'UUID du nom." },
              startSec: { type: "number", description: "début de la coupe dans le fichier (s)." },
              endSec: { type: "number", description: "fin de la coupe (s). Pour une image : durée d'affichage." },
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
              position: { type: "string", enum: ["top", "center", "bottom"] },
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
    description: "Liste les variantes déjà générées pour le dernier projet (avec vignette).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
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
    const content: Content[] = [{ type: "text", text: `✅ Variante créée${v.label ? ` « ${v.label} »` : ""} (id ${v.id}). Visible et téléchargeable dans l'Éditeur IA de DuupFlow.` }];
    if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push({ type: "text", text: "Aperçu :" }, img); }
    return { content };
  }

  if (name === "list_variants") {
    if (!project.variants.length) return { content: [{ type: "text", text: "Aucune variante générée pour l'instant." }] };
    const content: Content[] = [{ type: "text", text: `VARIANTES — ${project.variants.length} :` }];
    for (const v of project.variants) {
      content.push({ type: "text", text: `• ${v.label || v.id}` });
      if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push(img); }
    }
    return { content };
  }

  return { content: [{ type: "text", text: `Outil inconnu : ${name}` }], isError: true };
}
