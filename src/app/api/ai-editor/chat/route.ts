// /api/ai-editor/chat — CLAUDE INTÉGRÉ de l'Éditeur IA.
//
// Le user discute avec Claude directement dans DuupFlow, sans connecter son
// propre Claude. Claude tourne ici, avec la clé DuupFlow, et utilise EXACTEMENT
// les outils du MCP (runToolInScope) sur le créateur affiché à l'écran : mêmes
// capacités, mêmes droits, mêmes réponses. Rien à voir avec l'IA automatique.
//
//   GET    → la conversation du projet en cours + volume inclus / solde
//   POST   → { message, images? } : un tour de conversation, renvoyé en direct (SSE)
//            (images = ids reçus de /api/ai-editor/chat/attachments)
//   DELETE → nouvelle conversation
//
// Le tour continue côté serveur même si l'onglet se ferme : la conversation
// est enregistrée à chaque étape, et l'écran la relit (GET, running: true).

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { briefBlock, type EditorScope } from "@/lib/ai-editor/scope";
import { getLatestProject, createProject } from "@/lib/ai-editor/store";
import { builtinTools, runToolInScope, type Content } from "@/lib/ai-editor/mcp-tools";
import { chatContext as context } from "@/lib/ai-editor/chat-context";
import {
  CHAT_MODEL, readChat, writeChat, clearChat, displayLines, isRunning, markRunning,
  emptyUsage, addUsage, allowanceFor, turnBiller, usageCents, userContentWithImages, MAX_CHAT_IMAGES,
  appendUserMessage, LONG_CONTEXT_TOKENS,
} from "@/lib/ai-editor/builtin-chat";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

const MAX_ROUNDS = 25;           // allers-retours outils par message du user
const MAX_MESSAGE_CHARS = 4000;

// Bloc STABLE (mis en cache par préfixe) : ne rien y mettre qui change d'un appel à l'autre.
const SYSTEM_PROMPT = `Tu es Claude, intégré à l'Éditeur IA de DuupFlow. Le user te parle directement dans l'application : tu montes pour lui des variantes de ses vidéos à partir d'une référence (une vidéo qui marche) et de sa matière (ses rushs, images, sons), avec les outils DuupFlow.

DÉROULÉ
- Avant de proposer quoi que ce soit, regarde la référence (get_reference) et la matière (list_material, puis get_material sur les rushs utiles).
- Propose un plan court, puis crée les variantes (create_variant) quand le user est d'accord ou quand sa demande est déjà claire (« fais-m'en 3 »).
- Les variantes que tu crées apparaissent toutes seules dans la page, à côté de cette conversation : inutile de donner des liens. Suis le rendu avec get_render si le user attend le résultat.
- Pour retoucher une variante existante, utilise update_variant.

CRÉATEUR
- Tu travailles pour le créateur affiché à l'écran : tu n'as pas à le choisir, il est indiqué plus bas. Son BRIEF (style de captions, ton, langue, hooks, choses à éviter) s'applique à chaque variante sans que le user ait à le répéter.
- S'il a des images ou des vidéos de référence, lis-les avec get_creator_brief avant de monter.
- Quand le user donne une consigne DURABLE (« retiens que… », « à partir de maintenant… »), enregistre-la avec save_creator_brief.

AUTRES OUTILS
- Le DUPLICATEUR : duplicate_videos / duplicate_images (ticket suivi avec get_duplication), puis send_duplicates_to_editor pour envoyer les copies en matière.
- Ajouter de la matière depuis un lien https direct : add_material (url). Pour un fichier de son ordinateur ou de son Google Drive, le user le dépose lui-même dans la colonne « Matière » (tu ne peux pas aller chercher dans son Drive).
- Google Drive : export_to_drive envoie les variantes finies dans le dossier Drive du créateur (ticket suivi avec get_drive_export). Si Drive n'est pas connecté, appelle drive_status et donne au user le chemin exact.

STYLE
- Réponds dans la langue du user (français par défaut), en le tutoyant.
- Court et clair : pas de pavés, pas de jargon technique, jamais d'id technique (cite les NOMS des fichiers et des variantes).
- Si une demande dépasse ce que les outils savent faire, dis-le honnêtement et propose ce qui s'en rapproche le plus.`;

function creatorContext(scope: EditorScope): string {
  if (scope.workspace) return briefBlock(scope) ?? `CRÉATEUR : « ${scope.workspace.name} »`;
  if (scope.ctx.enabled) return "ESPACE : vue admin du propriétaire (son propre espace, pas un créateur précis). Pas de brief de créateur ici.";
  return "Compte sans créateurs : pas de brief de créateur.";
}

/** Contenu d'outil (MCP) → contenu de résultat d'outil (API Claude). */
function toToolResultContent(content: Content[]): Anthropic.Beta.BetaToolResultBlockParam["content"] {
  return content.map((c) =>
    c.type === "image"
      ? { type: "image" as const, source: { type: "base64" as const, media_type: c.mimeType as "image/jpeg", data: c.data } }
      : { type: "text" as const, text: c.text || "(vide)" },
  );
}

export async function GET(req: NextRequest) {
  const c = await context(req);
  if ("error" in c) return c.error;
  const project = await getLatestProject(c.scope.storeKey);
  const allowance = await allowanceFor(c.ownerId, c.plan);
  if (!project) return NextResponse.json({ lines: [], running: false, allowance });
  const chat = await readChat(c.scope.storeKey, project.id);
  return NextResponse.json({
    projectId: project.id,
    lines: displayLines(chat.messages),
    running: isRunning(c.scope.storeKey, project.id),
    long: (chat.contextTokens ?? 0) > LONG_CONTEXT_TOKENS,
    allowance,
  });
}

export async function DELETE(req: NextRequest) {
  const c = await context(req);
  if ("error" in c) return c.error;
  const project = await getLatestProject(c.scope.storeKey);
  if (project) {
    if (isRunning(c.scope.storeKey, project.id)) return NextResponse.json({ error: "Claude est encore en train de répondre.", code: "BUSY" }, { status: 409 });
    await clearChat(c.scope.storeKey, project.id);
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const c = await context(req);
  if ("error" in c) return c.error;
  const { user, plan, scope, ownerId } = c;

  const body = await req.json().catch(() => null);
  const text = typeof body?.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_CHARS) : "";
  const imageIds: string[] = Array.isArray(body?.images) ? body.images.filter((x: unknown): x is string => typeof x === "string") : [];
  if (!text && !imageIds.length) return NextResponse.json({ error: "Message vide.", code: "EMPTY" }, { status: 400 });
  if (imageIds.length > MAX_CHAT_IMAGES) return NextResponse.json({ error: `${MAX_CHAT_IMAGES} images maximum par message.`, code: "TOO_MANY_IMAGES" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Claude intégré n'est pas configuré sur le serveur.", code: "NOT_CONFIGURED" }, { status: 503 });

  const project = (await getLatestProject(scope.storeKey)) ?? (await createProject(scope.storeKey));
  const storeKey = scope.storeKey;
  // Le verrou est pris AVANT tout await : deux onglets (ou le proprio et un VA
  // sur le même créateur) ne peuvent pas lancer deux tours sur la même
  // conversation. Relâché sur chaque sortie anticipée.
  if (isRunning(storeKey, project.id)) return NextResponse.json({ error: "Claude est encore en train de répondre.", code: "BUSY" }, { status: 409 });
  markRunning(storeKey, project.id, true);
  const release = (res: NextResponse) => { markRunning(storeKey, project.id, false); return res; };

  let messages: Anthropic.Beta.BetaMessageParam[];
  let contextTokens: number | undefined;
  try {
    const allowance = await allowanceFor(ownerId, plan);
    if (!allowance.canSend) {
      return release(NextResponse.json({ error: "Plus de tokens pour Claude intégré : recharge dans « Plan & token » pour continuer.", code: "TOKENS", allowance }, { status: 402 }));
    }
    const content = imageIds.length ? await userContentWithImages(storeKey, project.id, imageIds, text) : text;
    if (!content) return release(NextResponse.json({ error: "Une image jointe est introuvable. Ajoute-la à nouveau.", code: "IMAGE_MISSING" }, { status: 400 }));
    const chat = await readChat(storeKey, project.id);
    messages = appendUserMessage(chat.messages, content);
    contextTokens = chat.contextTokens;
    await writeChat(storeKey, project.id, messages, contextTokens);
  } catch (e) {
    console.error("[ai-editor/chat] préparation du tour :", e);
    return release(NextResponse.json({ error: "Claude n'a pas pu répondre. Réessaie.", code: "ERROR" }, { status: 500 }));
  }

  const tools = builtinTools(!!scope.workspace) as unknown as Anthropic.Beta.BetaToolUnion[];
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    { type: "text", text: creatorContext(scope) },
  ];
  const encoder = new TextEncoder();
  const usage = emptyUsage();
  // Facturation EN TEMPS RÉEL : après chaque appel à Claude, on débite ce que
  // ce tour a coûté depuis le dernier débit (au centime près, sans arrondir
  // chaque appel vers le haut) et l'écran met la pastille de tokens à jour.
  let billedCents = 0;
  let billed = emptyUsage();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      // L'onglet peut se fermer en cours de route : le tour continue quand même.
      const send = (e: Record<string, unknown>) => {
        if (!open) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { open = false; }
      };
      const client = new Anthropic();
      const meta = { projectId: project.id, storeKey, userId: user.id };
      const biller = turnBiller(ownerId, plan, meta);
      const billRound = async () => {
        const cents = usageCents(usage) - billedCents;
        if (cents <= 0) return;
        const roundUsage = {
          input: usage.input - billed.input, output: usage.output - billed.output,
          cacheRead: usage.cacheRead - billed.cacheRead, cacheWrite: usage.cacheWrite - billed.cacheWrite,
          usd: usage.usd - billed.usd,
        };
        billedCents += cents;
        billed = { ...usage };
        await biller.charge(cents, roundUsage).catch((e) => console.error("[ai-editor/chat] facturation :", e));
        send({ type: "allowance", allowance: await biller.allowance().catch(() => null) });
      };
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          // Solde vérifié AVANT chaque appel, pas seulement au début du message :
          // « fais-m'en 10 » avec 500 tokens s'arrête quand il n'y a plus rien.
          if (round > 0) {
            const a = await biller.allowance().catch(() => null);
            if (a && !a.canSend) {
              send({ type: "error", code: "TOKENS_MIDWAY", error: "Plus de tokens : Claude s'arrête ici. Recharge dans « Plan & token » puis demande-lui de continuer." });
              break;
            }
          }
          const s = client.beta.messages.stream({
            model: CHAT_MODEL,
            max_tokens: 32000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default", // refus de sécurité → l'API relance sur un autre modèle
            output_config: { effort: "medium" },
            cache_control: { type: "ephemeral" }, // cache auto de l'historique
            system,
            tools,
            messages,
          } as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming);
          s.on("text", (delta) => send({ type: "text", text: delta }));
          const msg = await s.finalMessage();
          addUsage(usage, msg.model, msg.usage);
          await billRound();
          contextTokens = (msg.usage.input_tokens ?? 0) + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0);
          send({ type: "context", long: contextTokens > LONG_CONTEXT_TOKENS });
          messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
          await writeChat(storeKey, project.id, messages, contextTokens);

          if (msg.stop_reason === "refusal") { send({ type: "error", code: "REFUSED", error: "Claude a refusé cette demande." }); break; }
          if (msg.stop_reason === "pause_turn") continue;
          if (msg.stop_reason === "max_tokens") { send({ type: "error", code: "TOO_LONG", error: "Réponse trop longue, coupée. Reformule en plus court." }); break; }
          const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (!uses.length) break;
          if (round === MAX_ROUNDS - 1) { send({ type: "error", code: "MAX_ROUNDS", error: "Claude a fait beaucoup d'étapes d'un coup : dis-lui « continue » pour qu'il poursuive." }); }

          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const u of uses) {
            send({ type: "action", tool: u.name });
            let out: { content: Content[]; isError?: boolean };
            try {
              out = await runToolInScope(user.id, scope, u.name, (u.input ?? {}) as Record<string, unknown>);
            } catch (e) {
              console.error(`[ai-editor/chat] outil ${u.name} en échec :`, e);
              out = { content: [{ type: "text", text: `Erreur interne de l'outil ${u.name}.` }], isError: true };
            }
            results.push({ type: "tool_result", tool_use_id: u.id, content: toToolResultContent(out.content), ...(out.isError ? { is_error: true } : {}) });
          }
          messages.push({ role: "user", content: results });
          await writeChat(storeKey, project.id, messages, contextTokens);
          send({ type: "round" }); // l'écran rafraîchit variantes et matière
        }
      } catch (e) {
        console.error("[ai-editor/chat] tour en échec :", e);
        const busy = e instanceof Anthropic.RateLimitError;
        send({ type: "error", code: busy ? "RATE_LIMIT" : "ERROR", error: busy ? "Claude est très demandé en ce moment, réessaie dans une minute." : "Claude n'a pas pu répondre. Réessaie." });
      } finally {
        await billRound(); // filet : rien ne reste impayé si une exception a coupé la boucle
        await biller.flush().catch((e) => console.error("[ai-editor/chat] facturation :", e));
        markRunning(storeKey, project.id, false);
        send({ type: "done", cost: usageCents(usage), allowance: await allowanceFor(ownerId, plan).catch(() => null) });
        if (open) try { controller.close(); } catch { /* déjà fermé */ }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
