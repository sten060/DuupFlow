// src/lib/ai-editor/render-jobs.ts
//
// ── RENDUS EN TÂCHE DE FOND (« système de ticket ») ──────────────────────────
// Problème résolu : un rendu peut prendre plusieurs minutes (mesuré en prod :
// 251 s pour 50 s de vidéo avec sous-titres). Le client MCP, lui, abandonne au
// bout d'environ une minute — le serveur terminait le travail POUR PERSONNE, et
// chaque relance empilait un rendu fantôme qui occupait une des 2 places de
// rendu jusqu'à bloquer TOUS les outils (« the connector's server isn't
// responding », y compris sur get_reference).
//
// Principe : create_variant lance le rendu et attend un court instant (sous la
// patience du client). Si c'est fini → réponse normale, rien ne change pour les
// petits montages. Sinon → un TICKET, et Claude vient chercher le résultat avec
// get_render (qui patiente lui aussi un peu à chaque appel).
//
// Volontairement EN MÉMOIRE : un redéploiement perd les tickets en cours (le
// serveur redémarre de toute façon, le rendu est perdu avec). La variante, elle,
// est persistée par renderVariant dès qu'elle est prête.

import { renderVariant } from "./render";
import type { EditPlan, OutKeyframe } from "./plan-types";
import type { ProjectVariant } from "./store";

export type RenderJob = {
  id: string;
  userId: string;
  projectId: string;
  label: string;
  startedAt: number;
  finishedAt: number | null;
  status: "running" | "done" | "failed";
  result: { variant: ProjectVariant; keyframes: OutKeyframe[]; durationSec: number } | null;
  error: string | null;
  /** Résolveurs en attente (long polling) réveillés dès la fin du rendu. */
  waiters: Array<() => void>;
};

const JOBS = new Map<string, RenderJob>();
const JOB_TTL_MS = 30 * 60 * 1000; // on garde 30 min : le temps que Claude vienne chercher

function newJobId(): string {
  return `rj_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function sweep(): void {
  const now = Date.now();
  for (const [id, j] of JOBS) {
    if (j.finishedAt && now - j.finishedAt > JOB_TTL_MS) JOBS.delete(id);
  }
}

/** Lance un rendu en tâche de fond et renvoie son ticket immédiatement. */
export function startRenderJob(
  userId: string, projectId: string, plan: EditPlan,
  opts?: { derivedFrom?: string; onDone?: (job: RenderJob) => void | Promise<void> },
): RenderJob {
  sweep();
  const job: RenderJob = {
    id: newJobId(), userId, projectId,
    label: typeof plan.label === "string" ? plan.label : "",
    startedAt: Date.now(), finishedAt: null,
    status: "running", result: null, error: null, waiters: [],
  };
  JOBS.set(job.id, job);

  // Détaché VOLONTAIREMENT (pas de await) : la requête MCP rend la main tout de
  // suite. Aucune exception ne doit remonter ici — elle serait non capturée.
  void (async () => {
    try {
      const res = await renderVariant(userId, projectId, plan, { derivedFrom: opts?.derivedFrom });
      if ("error" in res) { job.status = "failed"; job.error = res.error; }
      else { job.status = "done"; job.result = res; }
    } catch (e) {
      job.status = "failed";
      job.error = `Rendu échoué : ${(e as Error)?.message?.slice(0, 200) ?? "erreur interne"}`;
    } finally {
      job.finishedAt = Date.now();
      if (job.status === "done" && opts?.onDone) { try { await opts.onDone(job); } catch { /* best-effort */ } }
      for (const w of job.waiters.splice(0)) w();
    }
  })();

  return job;
}

export function getRenderJob(id: string): RenderJob | null {
  sweep();
  return JOBS.get(id) ?? null;
}

/** Tickets encore en cours pour ce user (pour guider Claude s'il a perdu l'id). */
export function runningJobsFor(userId: string): RenderJob[] {
  sweep();
  return [...JOBS.values()].filter((j) => j.userId === userId && j.status === "running");
}

/** Attend la fin du rendu, au plus `ms`. Renvoie le job (terminé ou non).
 *  C'est ce qui évite à Claude de rappeler 15 fois : on tient la réponse un
 *  court instant (sous sa limite de patience) puis on répond l'état réel. */
export function waitForJob(job: RenderJob, ms: number): Promise<RenderJob> {
  if (job.status !== "running") return Promise.resolve(job);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const i = job.waiters.indexOf(wake);
      if (i >= 0) job.waiters.splice(i, 1);
      resolve(job);
    }, ms);
    const wake = () => { clearTimeout(timer); resolve(job); };
    job.waiters.push(wake);
  });
}

/** Durée écoulée, formatée pour un message lisible. */
export function jobElapsed(job: RenderJob): string {
  const ms = (job.finishedAt ?? Date.now()) - job.startedAt;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}s`;
}
