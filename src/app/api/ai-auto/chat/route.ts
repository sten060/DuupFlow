// POST /api/ai-auto/chat
//
// ── LE CERVEAU DU MODULE « IA AUTOMATIQUE » ──────────────────────────────────
// Claude (côté serveur, clé DuupFlow) reçoit l'analyse de chaque fichier
// uploadé, pose son diagnostic, négocie le plan de duplication avec le user,
// puis — sur accord explicite — déclenche la fabrication via l'outil
// generate_duplicates (menu fermé : il ne peut lancer QUE ce que le moteur
// sait faire, avec les bornes de src/lib/ai-auto/variation.ts).
//
// Garde-fous coût/quota :
//  - historique tronqué (MAX_MESSAGES) et messages bornés en taille ;
//  - chaque copie rendue = 1 « vidéo » du quota, RÉSERVÉE avant le rendu
//    (même règle que /api/ai-editor/generate) ; échec de rendu → restitution.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getProject, getLatestProject } from "@/lib/ai-editor/store";
import type { Project, ProjectMaterial } from "@/lib/ai-editor/store";
import { startRenderJob } from "@/lib/ai-editor/render-jobs";
import { reserveUsage, releaseUsage, logUsageEvent } from "@/lib/usage";
import { buildVariationPlans } from "@/lib/ai-auto/variation";
import type { VariationRequest } from "@/lib/ai-auto/variation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = "claude-opus-5";
const MAX_MESSAGES = 30;        // tours conservés (les plus récents)
const MAX_MSG_CHARS = 4000;     // taille max d'un message user
const MAX_COPIES_PER_FILE = 6;
const MAX_TOTAL_COPIES = 12;

// ── Prompt système (bloc STABLE → mis en cache par préfixe) ─────────────────
const SYSTEM_PROMPT = `Tu es le Directeur de duplication de DuupFlow, un outil que des créateurs utilisent pour reposter LEURS PROPRES vidéos sur plusieurs comptes. Les plateformes flaguent le « contenu non original » quand elles reconnaissent une copie : ta mission est de produire, pour chaque fichier du user, des duplications réellement différenciées qui gardent la qualité de l'original.

DÉROULÉ D'UNE SESSION
1. Dès le premier message, fais un DIAGNOSTIC PAR FICHIER à partir des analyses fournies : ce que contient la vidéo, ce qui la rend facile ou difficile à dupliquer, et ce que tu proposes pour elle.
2. Propose un plan par fichier avec le nombre de copies souhaité par le user (il peut le changer en discutant).
3. Ajuste selon ses retours.
4. UNIQUEMENT quand le user donne son accord explicite (« go », « ok lance », « c'est bon »…), appelle l'outil generate_duplicates — une seule fois par accord. N'appelle JAMAIS cet outil sans accord explicite dans le dernier message du user.

TES LEVIERS (menu fermé — tu ne peux rien promettre d'autre)
- Micro-décalages de timeline : les bords de la vidéo sont rognés différemment sur chaque copie, toute la ligne de temps se décale.
- Recadrage léger décentré (zoom de quelques %), différent par copie.
- Miroir horizontal — à REFUSER (allowMirror=false) si du texte est lisible à l'écran (captions incrustées, panneaux, pseudo).
- Micro-variation de vitesse (±3 %, inaudible) — à REFUSER (allowSpeed=false) si une musique très reconnaissable est au premier plan.
- Variations de colorimétrie et grain, sous le seuil du visible.
Chaque copie combine plusieurs leviers tirés différemment, et chaque fichier rendu reçoit ensuite une identité propre (métadonnées, poids). Choisis l'intensité : "light" (compte sain, prudence), "normal" (défaut), "strong" (contenus déjà flaggés).

TES LIMITES (dis-les honnêtement, ne promets jamais l'inverse)
- Tu ne sais PAS effacer un texte incrusté dans l'image.
- Tu ne remontes pas le propos : pas de réordonnancement, pas de coupes éditoriales, pas de contenu généré ni d'assets externes.
- Si un fichier se prête mal à la duplication (très court, image fixe…), dis-le et propose l'alternative la plus utile.

STYLE
- Réponds dans la langue du user (français par défaut), en le tutoyant.
- Court et structuré : un point par fichier, en citant le NOM du fichier (jamais son id technique).
- Zéro jargon technique : parle de « copies », « cadrage », « couleurs » — jamais de pipeline, rendu, plan de montage, id.
- Texte simple avec des tirets si besoin — jamais de tableaux ni de titres markdown (l'interface affiche du texte brut).
- Après avoir lancé la fabrication, confirme et indique que les duplications apparaissent au fur et à mesure dans le panneau de résultats, prêtes à télécharger.`;

// ── Outil : le SEUL pont entre la conversation et l'usine ───────────────────
const GENERATE_TOOL: Anthropic.Beta.BetaTool = {
  name: "generate_duplicates",
  description:
    "Lance la fabrication des duplications validées avec le user. À n'appeler qu'après son accord explicite. " +
    "Chaque copie consomme 1 vidéo du quota du user. Les rendus tournent en tâche de fond et apparaissent dans son panneau de résultats.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        description: "Un élément par fichier à dupliquer.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["materialId", "copies", "intensity", "allowMirror", "allowSpeed"],
          properties: {
            materialId: { type: "string", description: "Id du fichier (champ id des analyses fournies)." },
            copies: { type: "integer", description: `Entre 1 et ${MAX_COPIES_PER_FILE} (borné côté serveur).` },
            intensity: { type: "string", enum: ["light", "normal", "strong"] },
            allowMirror: { type: "boolean", description: "false si du texte est lisible à l'écran." },
            allowSpeed: { type: "boolean", description: "false si une musique signature est au premier plan." },
          },
        },
      },
    },
  },
};

/** Résume la matière pour le prompt (bloc VOLATIL — après le bloc caché). */
function describeMaterials(project: Project, copies: Map<string, number>): string {
  if (project.materials.length === 0) return "Aucun fichier uploadé pour l'instant — demande au user d'en ajouter.";
  return project.materials
    .map((m) => {
      const a = m.analysis;
      const lines: string[] = [
        `• id="${m.id}" — « ${m.name} » [${m.kind}] — statut: ${m.status ?? "ready"} — copies souhaitées par le user: ${copies.get(m.id) ?? 3}`,
      ];
      if (a) {
        lines.push(`  ${a.width}×${a.height}${a.durationSec ? ` · ${a.durationSec.toFixed(1)} s` : ""}${a.hasAudio === false ? " · SANS son" : ""}${a.sceneCuts?.length ? ` · ${a.sceneCuts.length} coupe(s) de scène` : ""}`);
        if (a.transcript?.fullText) lines.push(`  Paroles: « ${a.transcript.fullText.slice(0, 300)}${a.transcript.fullText.length > 300 ? "…" : ""} »`);
        const segs = (a.segments ?? []).slice(0, 4).map((s) => (s as { desc?: string; description?: string }).desc || (s as { description?: string }).description).filter(Boolean);
        if (segs.length) lines.push(`  Contenu visuel: ${segs.join(" / ").slice(0, 400)}`);
        if (a.notes?.length) lines.push(`  Notes d'analyse: ${a.notes.join(" · ").slice(0, 300)}`);
      } else if (m.status === "analyzing") {
        lines.push("  (analyse en cours — le diagnostic complet arrivera dans un instant)");
      }
      return lines.join("\n");
    })
    .join("\n");
}

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatFile = { materialId: string; copies: number };

/** Exécute generate_duplicates : quota réservé, plans construits, rendus lancés. */
async function execGenerate(
  userId: string,
  project: Project,
  rawInput: unknown,
): Promise<{ text: string; isError: boolean; launched: number }> {
  const input = rawInput as { items?: VariationRequest[] };
  const items = Array.isArray(input?.items) ? input.items : [];
  if (items.length === 0) return { text: "Aucun fichier dans la demande.", isError: true, launched: 0 };

  const byId = new Map<string, ProjectMaterial>(project.materials.map((m) => [m.id, m]));
  const valid: VariationRequest[] = [];
  const problems: string[] = [];
  for (const it of items) {
    const mat = byId.get(String(it.materialId));
    if (!mat) { problems.push(`Fichier introuvable: ${it.materialId}`); continue; }
    if (mat.status !== "ready" || !mat.analysis) { problems.push(`« ${mat.name} » n'est pas encore analysé — attends que son statut passe à prêt.`); continue; }
    if (mat.kind !== "video") { problems.push(`« ${mat.name} » n'est pas une vidéo.`); continue; }
    valid.push({ ...it, copies: Math.max(1, Math.min(MAX_COPIES_PER_FILE, Math.floor(Number(it.copies) || 1))) });
  }
  if (valid.length === 0) return { text: `Rien à lancer. ${problems.join(" ")}`, isError: true, launched: 0 };

  let total = valid.reduce((s, it) => s + it.copies, 0);
  if (total > MAX_TOTAL_COPIES) return { text: `${total} copies demandées — le maximum par session est ${MAX_TOTAL_COPIES}. Réduis et reviens vers le user.`, isError: true, launched: 0 };

  // Quota : réservation AVANT le rendu (même règle que le mode intégré de
  // l'Éditeur IA). Échec de rendu → restitution unité par unité.
  const reservation = await reserveUsage(userId, "videos", total);
  if (!reservation.allowed) {
    return { text: `Quota atteint : ${reservation.message ?? "limite de vidéos du plan atteinte."} Informe le user (il peut passer sur un plan supérieur).`, isError: true, launched: 0 };
  }

  let launched = 0;
  for (const it of valid) {
    const mat = byId.get(it.materialId)!;
    try {
      const plans = buildVariationPlans(mat, it);
      for (const plan of plans) {
        startRenderJob(userId, project.id, plan, {
          onDone: async () => { await logUsageEvent(userId, "videos", 1); },
          onFailed: async () => { await releaseUsage(userId, "videos", 1, reservation.trialCredit); },
        });
        launched++;
      }
    } catch (e) {
      problems.push((e as Error).message);
    }
  }
  // Copies jamais lancées (fichier en échec) : on rend la réservation tout de suite.
  if (launched < total) await releaseUsage(userId, "videos", total - launched, reservation.trialCredit);

  const summary = valid.map((it) => `${byId.get(it.materialId)!.name}: ${it.copies}`).join(", ");
  return {
    text: `${launched} rendu(s) lancé(s) (${summary}). Chaque rendu prend quelques minutes ; les duplications apparaissent au fur et à mesure dans le panneau de résultats du user.${problems.length ? ` Problèmes: ${problems.join(" ")}` : ""}`,
    isError: launched === 0,
    launched,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "IA non configurée : ajoute ANTHROPIC_API_KEY aux variables d'environnement." }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { projectId?: string; messages?: ChatMessage[]; files?: ChatFile[] } | null;
  const projectId = String(body?.projectId || "");
  if (!projectId) return NextResponse.json({ error: "Session manquante." }, { status: 400 });

  // Repli sur le dernier projet du user si l'id fourni est introuvable : en dev,
  // le double-montage React peut créer deux sessions et désynchroniser l'id du
  // client de celui qui porte réellement la matière. Le repli garantit qu'on
  // travaille toujours sur le projet vivant du user.
  const project = (await getProject(user.id, projectId)) ?? (await getLatestProject(user.id));
  if (!project) return NextResponse.json({ error: "Session introuvable." }, { status: 404 });

  const copies = new Map<string, number>((body?.files ?? []).map((f) => [String(f.materialId), Math.max(1, Math.min(MAX_COPIES_PER_FILE, Number(f.copies) || 3))]));

  const history = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MSG_CHARS) }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Message manquant." }, { status: 400 });
  }

  const client = new Anthropic();
  const apiMessages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  let launched = 0;

  try {
    // Boucle d'outils : au plus 3 allers-retours (diagnostic → fabrication → confirmation).
    for (let round = 0; round < 3; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        // Repli serveur : si le modèle décline (safety), l'API rejoue la même
        // requête sur un modèle de repli dans le même appel.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: `FICHIERS DE LA SESSION (analyses DuupFlow) :\n${describeMaterials(project, copies)}` },
        ],
        tools: [GENERATE_TOOL],
        messages: apiMessages,
      });

      if (response.stop_reason === "refusal") {
        return NextResponse.json({ reply: "Je ne peux pas t'aider sur cette demande précise. Reformule, ou repartons du plan de duplication de tes fichiers.", launched });
      }

      if (response.stop_reason === "tool_use") {
        apiMessages.push({ role: "assistant", content: response.content });
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const r = await execGenerate(user.id, project, block.input);
          launched += r.launched;
          results.push({ type: "tool_result", tool_use_id: block.id, content: r.text, is_error: r.isError });
        }
        apiMessages.push({ role: "user", content: results });
        continue;
      }

      const reply = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text).join("\n").trim();
      return NextResponse.json({ reply: reply || "…", launched });
    }
    return NextResponse.json({ reply: `C'est lancé — ${launched} duplication(s) en fabrication. Elles apparaissent au fur et à mesure dans le panneau de résultats.`, launched });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error(`[ai-auto/chat] API Claude en erreur (${e.status}):`, e.message);
      return NextResponse.json({ error: e.status === 429 ? "L'IA est très demandée, réessaie dans quelques secondes." : "L'IA a rencontré une erreur, réessaie." }, { status: 502 });
    }
    console.error("[ai-auto/chat] échec:", e);
    return NextResponse.json({ error: "Erreur inattendue, réessaie." }, { status: 500 });
  }
}
