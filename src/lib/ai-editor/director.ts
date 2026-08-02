// src/lib/ai-editor/director.ts
//
// « Directeur » de l'Éditeur IA — le mode INTÉGRÉ (0 connexion pour le user).
// Alors que le serveur MCP laisse le Claude DU USER faire le montage, ce module
// fait tourner l'IA CÔTÉ SERVEUR : il regarde les keyframes de la référence +
// la matière, et produit N « plans de montage » (EditPlan) que le moteur de
// rendu exécute. Le user clique juste « Générer ».
//
// Modèle : Groq (TEXTE) — réutilise GROQ_API_KEY déjà présente (transcription).
// Le compte Groq n'expose pas de modèle vision → le directeur travaille à partir
// de l'analyse TEXTUELLE de la référence (hook, transcript, rythme) + des
// descriptions de matière. C'est suffisant pour composer un plan de montage
// (quel plan, quel ordre, quel hook). Les keyframes restent réservées au mode MCP
// (le Claude du user est multimodal et les VOIT). Coût quasi nul (petit JSON).
// Dégradation douce : si l'IA échoue, plan heuristique (matière + hook en caption).

import { getProject } from "./store";
import type { Project, ProjectMaterial } from "./store";
import { renderVariant } from "./render";
import type { EditPlan, EditSegment } from "./render";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
// Modèle texte Groq (surchargeable). Llama 3.3 70B = solide + JSON mode.
const GROQ_DIRECTOR_MODEL = process.env.GROQ_DIRECTOR_MODEL || "llama-3.3-70b-versatile";

const DEFAULT_COUNT = 2;
const MAX_COUNT = 3;

/** Durée exploitable d'une matière (vidéo → analyse ; image → libre). */
function materialDuration(m: ProjectMaterial): number | null {
  return m.kind === "video" ? m.analysis?.durationSec ?? null : null;
}

/** Décrit la matière en texte pour le prompt (ids EXACTS que l'IA doit citer). */
function describeMaterials(mats: ProjectMaterial[]): string {
  return mats
    .map((m) => {
      const dur = materialDuration(m);
      const dims = m.analysis ? `${m.analysis.width}×${m.analysis.height}` : "?";
      const desc = m.desc?.trim() ? m.desc.trim() : "(pas de description)";
      return `- id="${m.id}" [${m.kind}] ${dims}${dur != null ? ` durée=${dur.toFixed(1)}s` : ""} — ${desc}`;
    })
    .join("\n");
}

/** Construit le prompt texte (réf analysée + matière décrite + consignes JSON). */
function buildUserPrompt(project: Project, count: number): string {
  const ref = project.reference!;
  const a = ref.analysis;
  return [
    `RÉFÉRENCE à reproduire : « ${ref.label} »`,
    `Durée ${a.durationSec.toFixed(1)}s · ${a.width}×${a.height} · rythme ${a.pacing.cutCount} coupe(s)${a.pacing.avgCutSec ? ` (~${a.pacing.avgCutSec}s/plan)` : ""}.`,
    a.hookText ? `Hook parlé de la réf : « ${a.hookText} »` : null,
    a.transcript ? `Transcription de la réf : ${a.transcript.fullText.slice(0, 800)}` : null,
    "",
    `MATIÈRE du user (utilise UNIQUEMENT ces ids) :`,
    describeMaterials(project.materials),
    "",
    `Produis EXACTEMENT ${count} variante(s) DISTINCTES qui reproduisent la STRUCTURE de la référence ` +
      `(hook fort dès la 1re seconde, même rythme) avec la matière du user.`,
    `Réponds en JSON STRICT : {"variants":[{"label":"...","aspect":"9:16","segments":[{"materialId":"...","startSec":0,"endSec":2}],"captions":[{"text":"...","startSec":0,"endSec":2,"position":"bottom"}]}]}.`,
    `Règles : n'utilise QUE les ids fournis ; pour une vidéo, 0 ≤ startSec < endSec ≤ durée ; durée totale ≈ celle de la référence ; ` +
      `mets un hook accrocheur (inspiré de celui de la réf, reformulé) en 1re caption ; captions courtes ; varie les hooks entre variantes.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Extrait un objet JSON même si l'IA l'enrobe de texte / code-fences. */
function parseJsonLoose(raw: string): unknown {
  const cleaned = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try { return JSON.parse(cleaned.slice(s, e + 1)); } catch { /* fall through */ }
    }
    return null;
  }
}

/** Nettoie/borne un plan brut de l'IA en EditPlan sûr (ids réels, temps bornés). */
function sanitizePlan(raw: unknown, mats: ProjectMaterial[], idx: number): EditPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const byId = new Map(mats.map((m) => [m.id, m]));

  const rawSegs = Array.isArray(r.segments) ? r.segments : [];
  const segments: EditSegment[] = [];
  for (const s of rawSegs) {
    if (!s || typeof s !== "object") continue;
    const so = s as Record<string, unknown>;
    const mat = byId.get(String(so.materialId));
    if (!mat) continue;
    const dur = materialDuration(mat);
    let start = Number.isFinite(Number(so.startSec)) ? Math.max(0, Number(so.startSec)) : undefined;
    let end = Number.isFinite(Number(so.endSec)) ? Number(so.endSec) : undefined;
    if (dur != null) {
      if (start != null) start = Math.min(start, Math.max(0, dur - 0.2));
      if (end != null) end = Math.min(end, dur);
    }
    if (start != null && end != null && end <= start) end = start + 1;
    segments.push({ materialId: mat.id, startSec: start, endSec: end });
  }
  // Repli : aucun segment valide → enchaîne toute la matière.
  if (segments.length === 0) {
    for (const m of mats) segments.push({ materialId: m.id });
  }
  if (segments.length === 0) return null;

  const aspect = r.aspect === "1:1" || r.aspect === "16:9" ? r.aspect : "9:16";
  const rawCaps = Array.isArray(r.captions) ? r.captions : [];
  const captions = rawCaps
    .filter((c) => c && typeof c === "object" && typeof (c as Record<string, unknown>).text === "string")
    .map((c) => {
      const co = c as Record<string, unknown>;
      const pos = co.position === "top" || co.position === "center" ? co.position : "bottom";
      return {
        text: String(co.text).slice(0, 120),
        startSec: Number.isFinite(Number(co.startSec)) ? Number(co.startSec) : 0,
        endSec: Number.isFinite(Number(co.endSec)) ? Number(co.endSec) : 2.5,
        position: pos as "top" | "center" | "bottom",
      };
    })
    .slice(0, 8);

  const label = typeof r.label === "string" && r.label.trim() ? r.label.trim().slice(0, 60) : `Variante ${idx + 1}`;
  return { aspect: aspect as EditPlan["aspect"], segments, captions, label };
}

/** Plan de secours (sans IA) : enchaîne la matière + le hook de la réf en caption. */
function heuristicPlan(project: Project, idx: number): EditPlan {
  const mats = project.materials;
  const segments: EditSegment[] = mats.map((m) => ({ materialId: m.id }));
  const hook = project.reference?.analysis.hookText?.slice(0, 90);
  const captions = hook ? [{ text: hook, startSec: 0, endSec: 2.5, position: "bottom" as const }] : [];
  return { aspect: "9:16", segments, captions, label: `Variante ${idx + 1}` };
}

/** Appelle Groq vision → tableau de plans bruts (ou null si indispo/échec). */
async function askGroqForPlans(project: Project, count: number): Promise<unknown[] | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_DIRECTOR_MODEL,
        temperature: 0.6,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Tu es un monteur expert de vidéos courtes verticales (TikTok/Reels). On te donne l'analyse d'une vidéo de RÉFÉRENCE (rythme, hook, transcription) et la MATIÈRE brute d'un créateur (rushes décrits). Tu produis des plans de montage qui REPRODUISENT la structure gagnante de la référence avec la matière fournie. Tu réponds UNIQUEMENT en JSON valide, sans texte autour.",
          },
          { role: "user", content: buildUserPrompt(project, count) },
        ],
      }),
    });
    if (!res.ok) {
      console.warn("[ai-editor/director] Groq HTTP", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = parseJsonLoose(content) as { variants?: unknown[] } | null;
    if (parsed && Array.isArray(parsed.variants)) return parsed.variants;
    if (Array.isArray(parsed)) return parsed;
    return null;
  } catch (e) {
    console.warn("[ai-editor/director] Groq échec:", (e as Error)?.message);
    return null;
  }
}

export type DirectResult = { variants: { id: string; label?: string; poster: string | null }[]; usedAI: boolean };

/**
 * Génère `count` variantes pour un projet, côté serveur (mode intégré).
 * Retourne les variantes réellement rendues (peut être < count si des rendus
 * échouent). `usedAI` = false si on a dû retomber sur le plan heuristique.
 */
export async function directVariants(
  userId: string,
  projectId: string,
  count = DEFAULT_COUNT,
): Promise<DirectResult | { error: string }> {
  const n = Math.max(1, Math.min(MAX_COUNT, Math.floor(count) || DEFAULT_COUNT));
  const project = await getProject(userId, projectId);
  if (!project) return { error: "Projet introuvable." };
  if (!project.reference) return { error: "Ajoute d'abord une référence." };
  if (!project.materials.length) return { error: "Ajoute d'abord de la matière (au moins un fichier)." };

  // 1) L'IA propose des plans ; sinon repli heuristique.
  const rawPlans = await askGroqForPlans(project, n);
  const usedAI = !!(rawPlans && rawPlans.length);

  const plans: EditPlan[] = [];
  if (usedAI) {
    for (let i = 0; i < rawPlans!.length && plans.length < n; i++) {
      const p = sanitizePlan(rawPlans![i], project.materials, plans.length);
      if (p) plans.push(p);
    }
  }
  // Complète (ou remplace) avec des plans heuristiques pour atteindre n.
  while (plans.length < n) plans.push(heuristicPlan(project, plans.length));

  // 2) Rendu séquentiel (ffmpeg ; évite de saturer le CPU en parallèle).
  const out: DirectResult["variants"] = [];
  for (const plan of plans) {
    const r = await renderVariant(userId, projectId, plan);
    if ("variant" in r) out.push({ id: r.variant.id, label: r.variant.label, poster: r.variant.poster });
    else console.warn("[ai-editor/director] rendu échoué:", r.error);
  }

  if (!out.length) return { error: "Aucune variante n'a pu être rendue. Réessaie." };
  return { variants: out, usedAI };
}
