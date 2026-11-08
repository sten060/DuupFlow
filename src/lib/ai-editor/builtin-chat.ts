// src/lib/ai-editor/builtin-chat.ts
//
// CLAUDE INTÉGRÉ de l'Éditeur IA — tout ce qui n'est pas la boucle elle-même :
//   • la conversation, rangée avec le projet (chat.json) : elle survit à un
//     rechargement et suit le créateur affiché (un projet = un créateur) ;
//   • la facturation : chaque mois un volume INCLUS selon le plan, puis débit
//     sur le solde de tokens (1 token = 1 centime d'€). Toujours payé par le
//     PROPRIÉTAIRE du compte (un VA consomme le volume de son propriétaire).
//
// Le MCP reste disponible pour qui préfère son propre Claude : ici, c'est la
// clé DuupFlow qui paie, d'où le volume inclus + tokens au-delà.
//
// Volume inclus et marge : provisoires, réglables sans redéploiement de code
//   AI_EDITOR_CHAT_INCLUDED_CENTS = "solo:300,pro:800,agency:2000"
//   AI_EDITOR_CHAT_MARKUP         = 2   (2 = 50 % de marge ; 1 = prix coûtant)

import fs from "fs/promises";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { projectPaths } from "./store";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchBalanceCents, recordTransaction } from "@/lib/tokens-server";

export const CHAT_MODEL = "claude-sonnet-5-5";
export const LEDGER_REASON = "ai_editor_chat";
/** Solde minimum (centimes) pour lancer un message une fois le volume inclus épuisé. */
export const MIN_BALANCE_CENTS = 10;

/* ── Conversation ─────────────────────────────────────────────────────────── */

// contextTokens = taille de ce que Claude a relu au dernier appel : sert à
// suggérer une nouvelle conversation quand elle devient chère.
export type StoredChat = { messages: Anthropic.Beta.BetaMessageParam[]; updatedAt: number; contextTokens?: number };

/** Au-delà, chaque message relit un gros historique (images comprises) et
 *  coûte nettement plus cher : l'écran suggère « Nouvelle conversation ». */
export const LONG_CONTEXT_TOKENS = 100_000;

function chatFile(storeKey: string, projectId: string) {
  return path.join(projectPaths(storeKey, projectId).dir, "chat.json");
}

export async function readChat(storeKey: string, projectId: string): Promise<StoredChat> {
  try {
    const c = JSON.parse(await fs.readFile(chatFile(storeKey, projectId), "utf8")) as StoredChat;
    return Array.isArray(c.messages) ? c : { messages: [], updatedAt: 0 };
  } catch {
    return { messages: [], updatedAt: 0 };
  }
}

export async function writeChat(storeKey: string, projectId: string, messages: Anthropic.Beta.BetaMessageParam[], contextTokens?: number) {
  const file = chatFile(storeKey, projectId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ messages, updatedAt: Date.now(), contextTokens } satisfies StoredChat), "utf8");
  await fs.rename(tmp, file);
}

export async function clearChat(storeKey: string, projectId: string) {
  await fs.unlink(chatFile(storeKey, projectId)).catch(() => {});
  await fs.rm(chatMediaDir(storeKey, projectId), { recursive: true, force: true }).catch(() => {});
}

/* ── Images jointes ───────────────────────────────────────────────────────────
 * Le user peut joindre des images à un message (pas de vidéos). L'écran les
 * réduit avant l'envoi (1568 px max) ; elles sont rangées avec le projet et
 * envoyées à Claude dans le message. Elles comptent dans les tokens d'entrée,
 * donc dans le coût facturé (avec la marge) — rien à ajouter à la main.
 * Dans la conversation enregistrée, chaque image est suivie d'un repère texte
 * « [image jointe <id>] » : l'écran s'en sert pour réafficher la vignette. */

export const MAX_CHAT_IMAGES = 6;
export const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;
const IMG_ID_RE = /^[a-z0-9]{10}$/;
const IMG_MARK_RE = /^\[image jointe ([a-z0-9]{10})\]$/;

function chatMediaDir(storeKey: string, projectId: string) {
  return path.join(projectPaths(storeKey, projectId).dir, "chat-media");
}

/** Type réel d'après les premiers octets (on ne croit pas l'extension). */
export function imageMime(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export async function saveChatImage(storeKey: string, projectId: string, buf: Buffer): Promise<string | null> {
  const mime = imageMime(buf);
  if (!mime || buf.length > MAX_CHAT_IMAGE_BYTES) return null;
  const id = Math.random().toString(36).slice(2, 12).padEnd(10, "0");
  const dir = chatMediaDir(storeKey, projectId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, id), buf);
  return id;
}

export async function readChatImage(storeKey: string, projectId: string, id: string): Promise<{ buf: Buffer; mime: string } | null> {
  if (!IMG_ID_RE.test(id)) return null;
  try {
    const buf = await fs.readFile(path.join(chatMediaDir(storeKey, projectId), id));
    const mime = imageMime(buf);
    return mime ? { buf, mime } : null;
  } catch { return null; }
}

/** Blocs à mettre dans le message du user : image + repère, puis le texte. */
export async function userContentWithImages(storeKey: string, projectId: string, ids: string[], text: string): Promise<Anthropic.Beta.BetaContentBlockParam[] | null> {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const id of ids) {
    const img = await readChatImage(storeKey, projectId, id);
    if (!img) return null;
    blocks.push({ type: "image", source: { type: "base64", media_type: img.mime as "image/jpeg", data: img.buf.toString("base64") } });
    blocks.push({ type: "text", text: `[image jointe ${id}]` });
  }
  if (text) blocks.push({ type: "text", text });
  return blocks;
}

/**
 * Ajoute le nouveau message du user à un historique qui peut avoir été coupé
 * en plein tour (solde épuisé, erreur, réponse trop longue) :
 *  • un appel d'outil resté sans réponse reçoit un résultat « interrompu »
 *    (sinon l'API refuse toute la conversation) ;
 *  • si le dernier message est déjà du user (résultats d'outils), on y ajoute
 *    le nouveau contenu plutôt que d'enchaîner deux messages du user.
 */
export function appendUserMessage(history: Anthropic.Beta.BetaMessageParam[], content: string | Anthropic.Beta.BetaContentBlockParam[]): Anthropic.Beta.BetaMessageParam[] {
  const messages = [...history];
  const last = messages[messages.length - 1];
  if (last?.role === "assistant" && Array.isArray(last.content)) {
    const pending = last.content.filter((b) => b.type === "tool_use") as Anthropic.Beta.BetaToolUseBlockParam[];
    if (pending.length) {
      messages.push({ role: "user", content: pending.map((u) => ({ type: "tool_result" as const, tool_use_id: u.id, content: "Interrompu avant d'avoir été exécuté.", is_error: true })) });
    }
  }
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = typeof content === "string" ? [{ type: "text", text: content }] : content;
  const tail = messages[messages.length - 1];
  if (tail?.role === "user") {
    const prev: Anthropic.Beta.BetaContentBlockParam[] = typeof tail.content === "string" ? [{ type: "text", text: tail.content }] : tail.content;
    messages[messages.length - 1] = { role: "user", content: [...prev, ...blocks] };
  } else {
    messages.push({ role: "user", content: typeof content === "string" ? content : blocks });
  }
  return messages;
}

/** Ce que l'écran affiche : les messages du user, le texte de Claude et ses actions. */
export type ChatLine =
  | { role: "user"; text: string; images?: string[] }
  | { role: "assistant"; text: string }
  | { role: "action"; tool: string };

export function displayLines(messages: Anthropic.Beta.BetaMessageParam[]): ChatLine[] {
  const out: ChatLine[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push(m.role === "user" ? { role: "user", text: m.content } : { role: "assistant", text: m.content });
      continue;
    }
    if (m.role === "user" && m.content.some((b) => b.type === "image")) {
      // Message avec images jointes : une seule bulle (vignettes + texte).
      const images: string[] = [];
      const texts: string[] = [];
      for (const b of m.content) {
        if (b.type !== "text") continue;
        const mark = IMG_MARK_RE.exec(b.text.trim());
        if (mark) images.push(mark[1]);
        else if (b.text.trim()) texts.push(b.text);
      }
      out.push({ role: "user", text: texts.join("\n"), images });
      continue;
    }
    for (const b of m.content) {
      if (b.type === "text" && b.text.trim()) out.push(m.role === "user" ? { role: "user", text: b.text } : { role: "assistant", text: b.text });
      else if (b.type === "tool_use") out.push({ role: "action", tool: b.name });
    }
  }
  return out;
}

/* ── Tours en cours (un seul à la fois par projet) ────────────────────────── */

// Chaque tour en cours garde un AbortController : le bouton « Arrêter » de
// l'écran (POST /api/ai-editor/chat/stop) le déclenche, ce qui coupe l'appel à
// Claude en plein milieu et fait sortir la boucle d'outils.
type Run = { at: number; abort: AbortController };
const g = globalThis as unknown as { __duupChatRuns?: Map<string, Run> };
const running = (g.__duupChatRuns ??= new Map<string, Run>());
const runKey = (storeKey: string, projectId: string) => `${storeKey}/${projectId}`;
export function isRunning(storeKey: string, projectId: string) { return running.has(runKey(storeKey, projectId)); }
/** Prend (on) ou rend (off) le verrou du tour. Renvoie le signal d'arrêt du tour. */
export function markRunning(storeKey: string, projectId: string, on: boolean): AbortSignal | null {
  if (!on) { running.delete(runKey(storeKey, projectId)); return null; }
  const run = { at: Date.now(), abort: new AbortController() };
  running.set(runKey(storeKey, projectId), run);
  return run.abort.signal;
}
/** Demande l'arrêt du tour en cours. false s'il n'y en a pas. */
export function stopRun(storeKey: string, projectId: string): boolean {
  const run = running.get(runKey(storeKey, projectId));
  if (!run) return false;
  run.abort.abort();
  return true;
}

/* ── Coût ─────────────────────────────────────────────────────────────────── */

// $ par million de tokens (tarifs API Anthropic). Écriture cache 5 min = 1,25 × l'entrée.
const PRICES: Record<string, { in: number; out: number; cacheRead: number }> = {
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2 },
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2 },
};
// Modèle inconnu (repli après un refus) : on facture au tarif le plus haut connu.
const FALLBACK_PRICE = { in: 10, out: 50, cacheRead: 1 };

export type TurnUsage = { input: number; cacheWrite: number; cacheRead: number; output: number; usd: number };

export function emptyUsage(): TurnUsage { return { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, usd: 0 }; }

export function addUsage(acc: TurnUsage, model: string, u: { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
  // Par préfixe : l'API peut renvoyer un id daté (« claude-sonnet-5-5-2026… »).
  const known = Object.keys(PRICES).find((k) => model === k || model.startsWith(`${k}-`));
  if (!known) console.warn(`[ai-editor/chat] modèle sans tarif connu : ${model} — tarif de repli`);
  const p = known ? PRICES[known] : FALLBACK_PRICE;
  const input = u.input_tokens ?? 0, output = u.output_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0, cacheRead = u.cache_read_input_tokens ?? 0;
  acc.input += input; acc.output += output; acc.cacheWrite += cacheWrite; acc.cacheRead += cacheRead;
  acc.usd += (input * p.in + cacheWrite * p.in * 1.25 + cacheRead * p.cacheRead + output * p.out) / 1e6;
}

function markup(): number {
  // ×2 = 50 % de marge (décision Sten, 2026-11-03) : 1 € de Claude payé à
  // Anthropic est facturé 2 € au user. Réglable sans code via l'env.
  const m = Number(process.env.AI_EDITOR_CHAT_MARKUP ?? "2");
  return Number.isFinite(m) && m > 0 ? m : 2;
}

/** Coût facturé en centimes d'€ (1 $ ≈ 1 € : volontairement simple). */
export function usageCents(u: TurnUsage): number {
  return Math.ceil(u.usd * 100 * markup());
}

/* ── Volume inclus + tokens ───────────────────────────────────────────────── */

const DEFAULT_INCLUDED: Record<string, number> = { solo: 300, pro: 800, agency: 2000, starter: 300 };

export function includedCentsForPlan(plan: string | null): number {
  const env = process.env.AI_EDITOR_CHAT_INCLUDED_CENTS;
  const table = { ...DEFAULT_INCLUDED };
  if (env) for (const part of env.split(",")) {
    const [k, v] = part.split(":").map((x) => x.trim());
    if (k && Number.isFinite(Number(v))) table[k] = Number(v);
  }
  return plan ? table[plan] ?? 0 : 0;
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Volume inclus déjà consommé ce mois-ci (somme des lignes du journal).
 *  Paginé : Supabase plafonne une requête à 1 000 lignes. */
async function includedUsedThisMonth(ownerId: string): Promise<number> {
  const db = createAdminClient();
  const PAGE = 1000;
  let total = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("ai_token_ledger")
      .select("metadata")
      .eq("user_id", ownerId)
      .eq("reason", LEDGER_REASON)
      .gte("created_at", monthStartIso())
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    total += (data ?? []).reduce((s, r) => s + (Number((r.metadata as { includedCents?: number } | null)?.includedCents) || 0), 0);
    if (!data || data.length < PAGE) return total;
  }
}

export type Allowance = { includedCents: number; includedLeftCents: number; balanceCents: number; canSend: boolean };

export async function allowanceFor(ownerId: string, plan: string | null): Promise<Allowance> {
  const included = includedCentsForPlan(plan);
  const [used, balance] = await Promise.all([includedUsedThisMonth(ownerId), fetchBalanceCents(ownerId).catch(() => 0)]);
  const left = Math.max(0, included - used);
  return { includedCents: included, includedLeftCents: left, balanceCents: balance, canSend: left > 0 || balance >= MIN_BALANCE_CENTS };
}

/**
 * Facturation d'UN tour (un message du user), appel après appel :
 *   • la part prise sur le volume INCLUS reste en mémoire et s'écrit en UNE
 *     ligne de journal à la fin du tour (sinon 25 lignes « 0 token » par
 *     message noieraient les recharges dans l'historique du user) ;
 *   • la part payée en TOKENS est débitée tout de suite (le solde réel bouge,
 *     la pastille aussi), avec la part incluse en attente dans la même ligne ;
 *   • allowance() tient compte de la part incluse pas encore écrite.
 * Si le solde ne couvre pas tout (dernier appel après épuisement), on prend ce
 * qu'il y a : l'appel est fait, c'est le suivant qui sera bloqué.
 */
export function turnBiller(ownerId: string, plan: string | null, meta: Record<string, unknown>) {
  let pendingIncluded = 0;
  let pendingUsage = emptyUsage();
  const sumUsage = (a: TurnUsage, b: TurnUsage): TurnUsage => ({ input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite, usd: a.usd + b.usd });

  async function write(fromBalance: number) {
    if (pendingIncluded <= 0 && fromBalance <= 0) return;
    let charged = fromBalance;
    const metadata = { ...meta, model: CHAT_MODEL, includedCents: pendingIncluded, costCents: pendingIncluded + fromBalance, usage: { ...pendingUsage, usd: Math.round(pendingUsage.usd * 10000) / 10000 } };
    let r = await recordTransaction({ userId: ownerId, deltaCents: -charged, reason: LEDGER_REASON, metadata: { ...metadata, chargedCents: charged } });
    if (!r.ok && charged > 0) {
      // Solde bougé entre-temps : on retente avec ce qu'il reste vraiment.
      charged = Math.max(0, Math.min(charged, r.balanceCents));
      r = await recordTransaction({ userId: ownerId, deltaCents: -charged, reason: LEDGER_REASON, metadata: { ...metadata, chargedCents: charged } });
    }
    if (!r.ok) console.error("[ai-editor/chat] facturation échouée :", r.error);
    pendingIncluded = 0;
    pendingUsage = emptyUsage();
  }

  return {
    /** Ce qui reste, part incluse en attente déduite. */
    async allowance(): Promise<Allowance> {
      const a = await allowanceFor(ownerId, plan);
      const left = Math.max(0, a.includedLeftCents - pendingIncluded);
      return { ...a, includedLeftCents: left, canSend: left > 0 || a.balanceCents >= MIN_BALANCE_CENTS };
    },
    /** Facture `cents` (coût d'un appel, marge comprise). */
    async charge(cents: number, u: TurnUsage) {
      if (cents <= 0) return;
      const a = await allowanceFor(ownerId, plan);
      const left = Math.max(0, a.includedLeftCents - pendingIncluded);
      const fromIncluded = Math.min(cents, left);
      pendingIncluded += fromIncluded;
      pendingUsage = sumUsage(pendingUsage, u);
      const fromBalance = Math.min(cents - fromIncluded, a.balanceCents);
      if (fromBalance > 0 || cents - fromIncluded > 0) await write(fromBalance);
    },
    /** Fin du tour : écrit la part incluse restée en attente. */
    async flush() { await write(0); },
  };
}
