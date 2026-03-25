/**
 * Module-level singleton for tracking video/image processing jobs.
 * Lives outside React — survives component unmounts and page navigation.
 * React components subscribe via useSyncExternalStore.
 */

export type JobStatus = "running" | "done" | "error" | "stopped";
export type JobType   = "video" | "image";

export type CompletedFile = { name: string; url: string };

export type Job = {
  id: string;
  type: JobType;
  channel: string;   // "simple" | "advanced" for video; "image" for images
  progress: number;  // 0–100
  msg: string;
  status: JobStatus;
  errorMsg?: string;
  completedFiles: CompletedFile[];
  ctrl?: AbortController; // stored so GlobalJobProgress can stop it
};

/** @deprecated alias kept for backwards compatibility */
export type VideoJob = Job;

type Listener = () => void;

const jobs = new Map<string, Job>();
const listeners = new Set<Listener>();

// Stable snapshot — only replaced when the store mutates.
let _snapshot: Job[] = [];

function notify() {
  _snapshot = Array.from(jobs.values());
  for (const fn of listeners) fn();
}

/**
 * Upsert a job. Preserves existing completedFiles and ctrl if not provided.
 */
export function setJob(
  job: Omit<Job, "completedFiles" | "ctrl"> & {
    completedFiles?: CompletedFile[];
    ctrl?: AbortController;
  }
): void {
  const existing = jobs.get(job.id);
  jobs.set(job.id, {
    completedFiles: job.completedFiles ?? existing?.completedFiles ?? [],
    ctrl: job.ctrl ?? existing?.ctrl,
    ...job,
  });
  notify();
}

/**
 * Append a completed file to a job (called as each file finishes server-side).
 */
export function addCompletedFile(id: string, file: CompletedFile): void {
  const job = jobs.get(id);
  if (!job) return;
  // Deduplicate by URL — prevents duplicate entries when SSE reconnects and replays events
  if (job.completedFiles.some(f => f.url === file.url)) return;
  jobs.set(id, { ...job, completedFiles: [...job.completedFiles, file] });
  notify();
}

/**
 * Stop a running job: fire AbortController + mark as "stopped".
 * The form component's catch block must check signal.reason === "stopped".
 */
export function stopJob(id: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.ctrl?.abort("stopped");
  const n = job.completedFiles.length;
  jobs.set(id, {
    ...job,
    status: "stopped",
    msg: n > 0
      ? `Arrêté — ${n} fichier(s) prêt(s)`
      : "Arrêté",
  });
  notify();
}

export function removeJob(id: string): void {
  jobs.delete(id);
  notify();
}

export function getJobs(): Job[] {
  return _snapshot;
}

/** For useSyncExternalStore — returns a stable snapshot array */
export function snapshot(): Job[] {
  return _snapshot;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
