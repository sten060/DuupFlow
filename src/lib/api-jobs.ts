// DuupFlow API async jobs — server-side CRUD over the `api_jobs` table.
// Isolated: touches only the new `api_jobs` table via the service-role client.

import { createAdminClient } from "@/lib/supabase/admin";

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
    .insert({ user_id: userId, type, status: "queued", params })
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

/**
 * Fail any job stuck in `processing` with no update for `staleMs` — covers a
 * server restart that killed an in-flight in-process worker. Best-effort;
 * called opportunistically (e.g. when a client polls).
 */
export async function reapStaleJobs(staleMs = 20 * 60 * 1000): Promise<void> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - staleMs).toISOString();
  await admin
    .from("api_jobs")
    .update({ status: "failed", error: "Job timed out or the server restarted mid-processing.", updated_at: new Date().toISOString() })
    .eq("status", "processing")
    .lt("updated_at", cutoff);
}
