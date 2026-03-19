/**
 * Module-level singleton for tracking video processing jobs.
 * Lives outside React — survives component unmounts and page navigation.
 * React components subscribe via useSyncExternalStore.
 */

export type JobStatus = "running" | "done" | "error";

export type VideoJob = {
  id: string;
  channel: "simple" | "advanced";
  progress: number; // 0–100
  msg: string;
  status: JobStatus;
  errorMsg?: string;
};

type Listener = () => void;

const jobs = new Map<string, VideoJob>();
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn();
}

export function setJob(job: VideoJob): void {
  jobs.set(job.id, { ...job });
  notify();
}

export function removeJob(id: string): void {
  jobs.delete(id);
  notify();
}

export function getJobs(): VideoJob[] {
  return Array.from(jobs.values());
}

/** For useSyncExternalStore — returns a stable snapshot array */
export function snapshot(): VideoJob[] {
  return Array.from(jobs.values());
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
