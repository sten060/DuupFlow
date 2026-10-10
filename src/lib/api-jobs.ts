// DuupFlow API async jobs — server-side CRUD over the `api_jobs` table.
// Isolated: touches only the new `api_jobs` table via the service-role client.

import { createAdminClient } from "@/lib/supabase/admin";
import { RETENTION_MS } from "@/lib/api-storage";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type ApiJob = {
  id: string;
  user_id: string;
  type: string;
  status: JobStatus;
  progress: number;
  message: string | null;
  params: Record<string, unknown>;
  result: unknown | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

const SELECT = "id, user_id, type, status, progress, message, params, result, error, created_at, updated_at, expires_at";

/** Create a queued job. */
export async function createJob(userId: string, type: string, params: Record<string, unknown>): Promise<ApiJob> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_jobs")
    // Set expiry explicitly so it always matches the file retention window
    // (rather than relying on the table's default).
    .insert({ user_id: userId, type, status: "queued", params, expires_at: new Date(Date.now() + RETENTION_MS).toISOString() })
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as ApiJob;
}

/** Count a user's in-flight jobs (queued or processing) — for the pending cap. */
export async function countActiveJobs(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("api_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["queued", "processing"]);
  return count ?? 0;
}

/** Fetch one job, scoped to its owner (so users can't read others' jobs). */
export async function getJob(userId: string, jobId: string): Promise<ApiJob | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("api_jobs").select(SELECT).eq("id", jobId).eq("user_id", userId).maybeSingle();
  return (data as ApiJob | null) ?? null;
}

/** Patch a job's mutable fields (status/progress/message/result/error). */
export async function updateJob(
  jobId: string,
  patch: Partial<Pick<ApiJob, "status" | "progress" | "message" | "result" | "error">>,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("api_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", jobId);
}

/** Delete job rows past their expiry (their files are cleaned separately). */
export async function cleanupExpiredJobs(): Promise<void> {
  const admin = createAdminClient();
  await admin.from("api_jobs").delete().lt("expires_at", new Date().toISOString());
}

/** Nombre max de passages d'un job avant échec définitif (1er essai + reprises). */
export const MAX_JOB_ATTEMPTS = 4;

/**
 * Remet un job en file pour un nouvel essai, pas avant `delayMs`. Les essais
 * déjà faits et l'heure de reprise vivent dans `params` (aucune migration).
 */
export async function requeueJob(job: { id: string; params: Record<string, unknown> }, delayMs: number, message: string): Promise<void> {
  const admin = createAdminClient();
  const attempts = Number(job.params?.attempts ?? 0) + 1;
  const { error } = await admin
    .from("api_jobs")
    .update({
      status: "queued",
      progress: 0,
      message,
      params: { ...job.params, attempts, not_before: new Date(Date.now() + delayMs).toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    // Seul un job en cours se remet en file : jamais un job déjà terminé entre-temps.
    .eq("status", "processing");
  if (error) throw new Error(error.message);
}

/**
 * Jobs bloqués en `processing` sans nouvelles depuis `staleMs` — un redémarrage
 * du serveur a tué le worker en plein travail. Avant : échec direct. Désormais
 * on les REMET EN FILE (la source est sur le volume, elle a survécu), et on
 * n'échoue qu'après MAX_JOB_ATTEMPTS passages. Best-effort.
 */
// 5 min : le runner donne signe de vie toutes les 60 s (heartbeat), même quand
// il attend son créneau. 5 min de silence = process réellement mort.
export async function reapStaleJobs(staleMs = 5 * 60 * 1000): Promise<void> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - staleMs).toISOString();
  const { data } = await admin
    .from("api_jobs")
    .select("id, params")
    .eq("status", "processing")
    .lt("updated_at", cutoff)
    .limit(50);
  for (const j of (data ?? []) as { id: string; params: Record<string, unknown> }[]) {
    const attempts = Number(j.params?.attempts ?? 0) + 1;
    if (attempts < MAX_JOB_ATTEMPTS) {
      await requeueJob(j, 0, "Server restarted — job requeued automatically.").catch(() => {});
    } else {
      await admin
        .from("api_jobs")
        .update({ status: "failed", error: "Job timed out or the server restarted mid-processing.", updated_at: new Date().toISOString() })
        .eq("id", j.id)
        .eq("status", "processing");
    }
  }
}
