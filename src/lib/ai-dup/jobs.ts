// src/lib/ai-dup/jobs.ts
//
// ── TICKET DE FABRICATION « DUPLICATION IA EN 1 CLIC » ───────────────────────
// Un lancement = un ticket (« aid_… ») qui tourne en tâche de fond :
//   analyse (une fois par vidéo, mise en cache) → plan (1 appel Claude)
//   → copies fabriquées COPIES_IN_PARALLEL à la fois → terminé.
// Le client suit `progress` et l'état de chaque copie (grille qui se remplit).
//
// Quota : le coût du lancement (aiDupCost) est RÉSERVÉ avant de commencer ;
// chaque copie écartée rend sa part. Même règle que le reste de l'app.
//
// Registre EN MÉMOIRE, comme les tickets de rendu et de duplication : un
// redéploiement perd les tickets en cours (les copies déjà finies restent dans
// le dossier du créateur).

import { getProject, materialAbsPath } from "@/lib/ai-editor/store";
import { reserveUsage, releaseUsage, logUsageEvent } from "@/lib/usage";
import { isUserOnFreePlan } from "@/lib/plan-gate";
import { maxVideoHeightForPlan } from "@/lib/plans";
import {
  AI_DUP_COST_PER_COPY, aiDupCost, MIN_COPIES, MAX_COPIES, MAX_INDICATIONS_CHARS,
  COPIES_IN_PARALLEL, JOB_TTL_MS, JOB_ID_PREFIX, MAX_RETRIES_PER_COPY,
} from "./config";
import { analyzeForDuplication } from "./analyze";
import { planCopies } from "./planner";
import { replaceTarget } from "./replace-caption";
import { produceCopy } from "./produce";
import { summarizeCopy } from "./summary";
import { verifyCopy, repairCopy, type VerifyProblem } from "./verify";
import { aiDupBilling, allowanceFor } from "./billing";
import { creatorOutDir } from "@/lib/creator-out-dir";
import { saveHistory, loadHistory } from "./history";
import fs from "fs/promises";
import path from "path";
import type { AiDupAnalysis, AiDupJob, AiDupMode, AiDupPlan, CopyResult } from "./types";

const g = globalThis as unknown as { __aiDupJobs?: Map<string, AiDupJob>; __aiDupAnalyses?: Map<string, AiDupAnalysis> };
const JOBS = (g.__aiDupJobs ??= new Map());
/** Analyse mise en cache par vidéo : relancer 10 copies de la même vidéo ne
 *  repaie pas l'inspection Gemini. */
const ANALYSES = (g.__aiDupAnalyses ??= new Map());

function sweep() {
  const now = Date.now();
  for (const [k, j] of JOBS) if (j.finishedAt && now - j.finishedAt > JOB_TTL_MS) JOBS.delete(k);
}

export function getAiDupJob(id: string, storeKey: string): AiDupJob | null {
  sweep();
  const j = JOBS.get(id);
  return j && j.storeKey === storeKey ? j : null;
}

/** Oublie un ticket TERMINÉ (après suppression par le user). false s'il
 *  tourne encore : on ne supprime pas une duplication en cours. */
export function forgetAiDupJob(id: string, storeKey: string): boolean {
  const j = JOBS.get(id);
  if (!j || j.storeKey !== storeKey) return true;
  if (!j.finishedAt) return false;
  JOBS.delete(id);
  return true;
}

/** Ticket en mémoire, sinon relu dans l'historique (après « Nouvelle
 *  duplication », expiration du ticket ou redémarrage du serveur). */
export async function findAiDupJob(id: string, storeKey: string): Promise<AiDupJob | null> {
  return getAiDupJob(id, storeKey) ?? (await loadHistory(id, storeKey))?.job ?? null;
}

/** Raison lisible par le user d'un refus de vérification. */
const PROBLEM_LABEL: Record<VerifyProblem, string> = {
  text_unreadable: "texte peu lisible",
  text_on_face: "texte sur le visage",
  covers_original: "texte sur un élément de la vidéo d'origine",
  text_outside_safe_zone: "texte sous l'interface TikTok/Reels",
  visual_defect: "défaut d'image",
  original_visible: "ancienne caption encore visible",
  file_broken: "fichier défectueux",
};
const problemsLabel = (p: VerifyProblem[]) => p.map((x) => PROBLEM_LABEL[x] ?? x).join(", ") || "contrôle échoué";

/** Traduit les écarts du plan en messages courts pour le user (dédoublonnés). */
function noticesFor(a: AiDupAnalysis, plan: AiDupPlan, mode: AiDupMode, replaceCaption: boolean): string[] {
  if (mode === "invisible") return [];
  const out: string[] = [];
  if (replaceCaption && a.burnedCaption.present) {
    const { reason } = replaceTarget(a);
    const rewritten = plan.copies.filter((c) => c.texts.some((t) => t.replaces)).length;
    if (reason) out.push(`Caption d'origine gardée telle quelle : ${reason}.`);
    else if (rewritten < plan.copies.length) out.push(`Caption d'origine réécrite sur ${rewritten}/${plan.copies.length} copies (les autres la gardent, faute de place ou de reformulation valable).`);
  }
  const c = plan.corrections.join("\n");
  if (!a.inspected) out.push("L'analyse visuelle n'a pas abouti : aucun texte n'a été ajouté, les copies varient par le cadrage, la vitesse et les couleurs.");
  else if (/aucune zone libre|ne tient dans aucune zone libre/.test(c)) out.push("Il n'y avait pas assez de place libre pour ajouter certains textes sans couvrir un visage ou le texte d'origine : ils ont été retirés.");
  if (/Claude indisponible|plan de secours/.test(c)) out.push("L'IA n'a pas répondu à temps : les copies ont été préparées sans caption générée.");
  if (/sous-titres refusés \(pas de voix/.test(c)) out.push("Pas de sous-titres possibles sur cette vidéo (pas de voix détectée, sous-titres déjà présents ou vidéo trop courte).");
  if (/limite de textes à l'écran/.test(c)) out.push("Certains textes ont été retirés pour ne jamais dépasser 2 textes à l'écran.");
  return out;
}

export type StartError = { error: string; code: "bad_request" | "not_found" | "not_ready" | "plan_required" | "quota" | "tokens" };

export async function startAiDupJob(input: {
  userId: string;
  storeKey: string;
  projectId: string;
  materialId: string;
  mode: AiDupMode;
  copies: number;
  indications?: string;
  /** Cacher et réécrire la caption d'origine (mode Variations). */
  replaceCaption?: boolean;
  /** Brief du créateur actif (ai-editor/scope.ts → briefBlock). */
  brief: string | null;
  /** Qui paie les tokens Claude (propriétaire du compte) et son plan. */
  payerId: string;
  plan: string | null;
}): Promise<{ job: AiDupJob } | StartError> {
  if (input.mode !== "invisible" && input.mode !== "variations") return { error: "Mode inconnu.", code: "bad_request" };
  const mode: AiDupMode = input.mode;
  const copies = Math.floor(Number(input.copies));
  if (!Number.isFinite(copies) || copies < MIN_COPIES || copies > MAX_COPIES) {
    return { error: `Choisis entre ${MIN_COPIES} et ${MAX_COPIES} copies.`, code: "bad_request" };
  }
  if (await isUserOnFreePlan(input.userId)) return { error: "Ton plan gratuit ne permet pas de créer des copies.", code: "plan_required" };

  const project = await getProject(input.storeKey, input.projectId);
  const material = project?.materials.find((m) => m.id === input.materialId);
  if (!project || !material) return { error: "Vidéo introuvable.", code: "not_found" };
  if (material.kind !== "video") return { error: "Ce fichier n'est pas une vidéo.", code: "bad_request" };
  if (material.status !== "ready" || !material.analysis) return { error: "La vidéo est encore en cours d'analyse.", code: "not_ready" };

  // Variations = appels Claude → il faut de l'offert ou du solde AVANT de
  // réserver le quota (même règle que le Claude intégré).
  if (mode === "variations") {
    const a = await allowanceFor(input.payerId, input.plan).catch(() => null);
    if (!a?.canSend) return { error: "Plus de tokens IA ce mois-ci : recharge dans « Plan & token », ou utilise le mode Invisible (sans IA).", code: "tokens" };
  }

  const cost = aiDupCost(mode, copies);
  const reservation = await reserveUsage(input.userId, "videos", cost);
  if (!reservation.allowed) return { error: reservation.message ?? "Quota de vidéos atteint.", code: "quota" };

  const job: AiDupJob = {
    id: `${JOB_ID_PREFIX}${Math.random().toString(36).slice(2, 10)}`,
    userId: input.userId,
    storeKey: input.storeKey,
    projectId: input.projectId,
    request: { materialId: input.materialId, mode, copies, indications: String(input.indications ?? "").slice(0, MAX_INDICATIONS_CHARS), replaceCaption: mode === "variations" && !!input.replaceCaption },
    status: "analyzing",
    progress: 2,
    reservedUnits: cost,
    releasedUnits: 0,
    plan: null,
    notices: [],
    copies: Array.from({ length: copies }, (_, i): CopyResult => ({ index: i, status: "queued", attempts: 0 })),
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
  };
  JOBS.set(job.id, job);
  const historyMeta = { materialName: material.name, thumb: material.analysis?.thumb ?? null };
  void saveHistory(job, historyMeta);

  const unit = AI_DUP_COST_PER_COPY[mode];
  const release = async (units: number) => {
    if (units <= 0) return;
    job.releasedUnits += units;
    await releaseUsage(input.userId, "videos", units, reservation.trialCredit).catch(() => {});
  };

  const billing = mode === "variations"
    ? aiDupBilling(input.payerId, input.plan, { jobId: job.id, storeKey: input.storeKey, actorId: input.userId, copies, label: material.name })
    : null;

  void (async () => {
    const matPath = materialAbsPath(input.storeKey, input.projectId, material.storedName);
    try {
      // 1. Analyse (une fois par vidéo).
      const key = `${input.storeKey}:${input.projectId}:${material.id}`;
      let analysis = ANALYSES.get(key);
      if (!analysis) {
        analysis = await analyzeForDuplication(material, matPath);
        // Analyse incomplète (inspection ratée) : pas de cache, le prochain
        // lancement retentera.
        if (analysis.inspected) ANALYSES.set(key, analysis);
      }
      job.progress = 10;

      // 2. Plan des N copies (un seul appel Claude ; aucun en mode Invisible).
      job.status = "planning";
      const seed = `${job.id}`;
      job.plan = await planCopies({ analysis, request: job.request, brief: input.brief, seed, onUsage: billing?.onUsage });
      job.notices = noticesFor(analysis, job.plan, mode, !!job.request.replaceCaption);
      job.progress = 15;

      // 3. Fabrication, COPIES_IN_PARALLEL à la fois.
      job.status = "producing";
      const maxShortEdge = maxVideoHeightForPlan(reservation.plan);
      let next = 0, finished = 0;
      const outDir = creatorOutDir(input.storeKey);
      const worker = async () => {
        while (next < job.plan!.copies.length) {
          let copy = job.plan!.copies[next++];
          const res = job.copies[copy.index];
          // Fabrication → vérification ; en cas d'échec, UNE version corrigée
          // (repairCopy) est refaite, puis la copie est écartée.
          for (let attempt = 0; attempt <= MAX_RETRIES_PER_COPY; attempt++) {
            res.attempts = attempt + 1;
            let failure: { problems: VerifyProblem[]; reason: string } | null = null;
            let fileName: string | null = null;
            try {
              const out = await produceCopy({
                storeKey: input.storeKey, projectId: input.projectId,
                materialId: material.id, materialName: material.name, materialPath: matPath,
                analysis: analysis!, copy, maxShortEdge,
                onStage: (st) => { res.status = st; },
              });
              fileName = out.fileName;
              res.status = "verifying";
              const v = await verifyCopy(path.join(outDir, out.fileName), copy, analysis!, undefined, billing ?? undefined);
              res.check = v.note;
              if (v.ok) {
                job.plan!.copies[copy.index] = copy;
                Object.assign(res, { status: "done", fileName: out.fileName, sizeBytes: out.sizeBytes, summary: summarizeCopy(copy, out.deviceLabel), error: undefined });
                void logUsageEvent(input.userId, "videos", unit, { storeKey: input.storeKey, origin: "ai_auto", label: material.name });
                break;
              }
              failure = { problems: v.problems, reason: problemsLabel(v.problems) };
            } catch (e) {
              failure = { problems: ["file_broken"], reason: (e as Error).message.slice(0, 200) };
            }
            // Copie refusée : le fichier ne doit pas rester dans la bibliothèque.
            if (fileName) await fs.rm(path.join(outDir, fileName), { force: true }).catch(() => {});
            console.warn(`[ai-dup] ${job.id} copie ${copy.index + 1} essai ${attempt + 1} refusé : ${failure.reason}`);
            if (attempt < MAX_RETRIES_PER_COPY) {
              const fix = repairCopy(copy, failure.problems, analysis!, attempt + 1);
              copy = fix.copy;
              Object.assign(res, { status: "retrying", retryReason: `${failure.reason} → ${fix.change}` });
            } else {
              Object.assign(res, { status: "discarded", error: failure.reason });
              await release(unit);
            }
          }
          finished++;
          job.progress = Math.round(15 + (85 * finished) / job.copies.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(COPIES_IN_PARALLEL, job.copies.length) }, worker));

      const done = job.copies.filter((c) => c.status === "done").length;
      job.status = done ? "done" : "failed";
      if (!done) job.error = job.copies.find((c) => c.error)?.error ?? "Aucune copie n'a pu être fabriquée.";
    } catch (e) {
      job.status = "failed";
      job.error = (e as Error).message.slice(0, 300) || "Échec inattendu.";
      console.error(`[ai-dup] ${job.id} échec :`, e);
      // Tout ce qui n'a pas été fabriqué est rendu.
      const notDone = job.copies.filter((c) => c.status !== "done" && c.status !== "discarded").length;
      for (const c of job.copies) if (c.status !== "done" && c.status !== "discarded") c.status = "discarded";
      await release(notDone * unit);
    } finally {
      if (billing) {
        await billing.flush().catch((e) => console.error(`[ai-dup] ${job.id} facturation :`, e));
        job.tokensCents = billing.totalCents();
      }
      job.progress = 100;
      job.finishedAt = Date.now();
      await saveHistory(job, historyMeta);
    }
  })();

  return { job };
}
