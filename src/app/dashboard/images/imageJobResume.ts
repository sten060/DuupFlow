/**
 * Resume in-flight IMAGE duplications after a page reload or the user leaving.
 *
 * Mirrors videoJobResume: the /api/duplicate-image-sse route runs the processing
 * inside the response stream's start() with NO abort tied to the request, and now
 * keeps a per-jobId registry that buffers progress events + supports reconnect. So
 * client-side we just:
 *   1. remember the active jobId in localStorage while a job runs, and
 *   2. on the next page load, re-POST with that jobId to stream live progress back
 *      into the global store (no re-upload, no re-processing).
 */
import { setJob, addCompletedFile, removeJob } from "../videos/jobStore";

export type PersistedImageJob = { jobId: string; startedAt: number };

const KEY = "duup_active_image_jobs";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 h safety — never resurrect something ancient

function read(): PersistedImageJob[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(list: PersistedImageJob[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

/** Record a job as in-flight (call once processing has started server-side). */
export function saveActiveImageJob(jobId: string): void {
  const list = read().filter((j) => j.jobId !== jobId);
  list.push({ jobId, startedAt: Date.now() });
  write(list);
}

/** Forget a job (call when it reaches a terminal state in this tab). */
export function removeActiveImageJob(jobId: string): void {
  write(read().filter((j) => j.jobId !== jobId));
}

/** Active jobs worth resuming on load (drops stale entries older than 1 h). */
export function loadActiveImageJobs(): PersistedImageJob[] {
  const now = Date.now();
  const fresh = read().filter((j) => now - j.startedAt < MAX_AGE_MS);
  if (fresh.length !== read().length) write(fresh);
  return fresh;
}

// Guard against double-attaching the same job within one page load.
const attaching = new Set<string>();

export type ResumeStrings = { resuming: string; finished: string; errorGeneric: string };

/**
 * Re-attach to a running image job and stream its buffered + live progress into
 * the global store. Resolves when the job reaches a terminal state.
 */
export async function reattachImageJob(jobId: string, strings: ResumeStrings): Promise<void> {
  if (attaching.has(jobId)) return;
  attaching.add(jobId);

  // Show the badge immediately so the user sees we picked the job back up.
  setJob({ id: jobId, type: "image", channel: "image", progress: 0, msg: strings.resuming, status: "running" });

  try {
    const form = new FormData();
    form.append("jobId", jobId);
    form.append("reconnectOnly", "1"); // never start a new (file-less) job
    const res = await fetch("/api/duplicate-image-sse", { method: "POST", body: form });
    if (!res.ok || !res.body) { removeActiveImageJob(jobId); removeJob(jobId); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let evt: any;
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }

        if (evt.fileReady) addCompletedFile(jobId, evt.fileReady);

        if (evt.stale) {
          setJob({ id: jobId, type: "image", channel: "image", progress: 100, msg: strings.finished, status: "done" });
          removeActiveImageJob(jobId);
          setTimeout(() => removeJob(jobId), 6000);
          return;
        }
        if (evt.error) {
          const msg = evt.msg || strings.errorGeneric;
          setJob({ id: jobId, type: "image", channel: "image", progress: 0, msg, status: "error", errorMsg: msg });
          removeActiveImageJob(jobId);
          return;
        }
        if (evt.done) {
          setJob({ id: jobId, type: "image", channel: "image", progress: 100, msg: strings.finished, status: "done" });
          removeActiveImageJob(jobId);
          setTimeout(() => removeJob(jobId), 6000);
          return;
        }
        if (evt.percent !== undefined || evt.msg) {
          // Mirror the form's scale (upload was 0–20%, processing 20–100%).
          const pct = evt.percent !== undefined ? 20 + Math.round(evt.percent * 0.8) : 0;
          setJob({ id: jobId, type: "image", channel: "image", progress: Math.max(0, Math.min(100, pct)), msg: evt.msg ?? "", status: "running" });
        }
      }
    }
    // Stream ended without a terminal event — stop tracking to avoid a resume loop.
    removeActiveImageJob(jobId);
  } catch {
    removeActiveImageJob(jobId);
  } finally {
    attaching.delete(jobId);
  }
}
