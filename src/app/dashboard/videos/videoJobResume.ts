/**
 * Resume in-flight video duplications after a page reload or the user leaving.
 *
 * The encode runs on the Railway server independently of the browser: the
 * /api/duplicate-video route runs processVideos() inside the response stream's
 * start() with NO abort tied to the request, and keeps a per-jobId registry that
 * buffers progress events + supports reconnect. So all we need client-side is to:
 *   1. remember the active jobId(s) in localStorage while a job runs, and
 *   2. on the next page load, re-POST with that jobId to stream live progress
 *      back into the global store (no re-upload, no re-encode).
 */
import { setJob, addCompletedFile, removeJob } from "./jobStore";

type Channel = "simple" | "advanced";
export type PersistedJob = { jobId: string; channel: Channel; startedAt: number };

const KEY = "duup_active_video_jobs";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 h safety — never resurrect something ancient

function read(): PersistedJob[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(list: PersistedJob[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

/** Record a job as in-flight (call once the encode has started server-side). */
export function saveActiveJob(jobId: string, channel: Channel): void {
  const list = read().filter((j) => j.jobId !== jobId);
  list.push({ jobId, channel, startedAt: Date.now() });
  write(list);
}

/** Forget a job (call when it reaches a terminal state in this tab). */
export function removeActiveJob(jobId: string): void {
  write(read().filter((j) => j.jobId !== jobId));
}

/** Active jobs worth resuming on load (drops stale entries older than 1 h). */
export function loadActiveJobs(): PersistedJob[] {
  const now = Date.now();
  const fresh = read().filter((j) => now - j.startedAt < MAX_AGE_MS);
  if (fresh.length !== read().length) write(fresh);
  return fresh;
}

// Guard against double-attaching the same job within one page load
// (e.g. React StrictMode invokes mount effects twice in dev).
const attaching = new Set<string>();

/**
 * Re-attach to a running job and stream its buffered + live progress into the
 * global store. Resolves when the job reaches a terminal state.
 */
export async function reattachJob(jobId: string, channel: Channel): Promise<void> {
  if (attaching.has(jobId)) return;
  attaching.add(jobId);

  // Show the badge immediately so the user sees we picked the job back up.
  setJob({ id: jobId, type: "video", channel, progress: 0, msg: "Reprise du suivi…", status: "running" });

  try {
    const form = new FormData();
    form.append("jobId", jobId);
    form.append("reconnectOnly", "1"); // never start a new (file-less) job
    const res = await fetch("/api/duplicate-video", { method: "POST", body: form });
    if (!res.ok || !res.body) { removeActiveJob(jobId); removeJob(jobId); return; }

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
          // Finished (and aged out of the registry) while we were away — the
          // generated copies are already in the user's library.
          setJob({ id: jobId, type: "video", channel, progress: 100, msg: "Terminé ✔", status: "done" });
          removeActiveJob(jobId);
          setTimeout(() => removeJob(jobId), 6000);
          return;
        }
        if (evt.error) {
          const msg = evt.msg || "Une erreur est survenue lors de la duplication. Réessayez avec les fichiers manquants.";
          setJob({ id: jobId, type: "video", channel, progress: 0, msg, status: "error", errorMsg: msg });
          removeActiveJob(jobId);
          return;
        }
        if (evt.done) {
          setJob({ id: jobId, type: "video", channel, progress: 100, msg: evt.warning || "Terminé ✔", status: "done" });
          removeActiveJob(jobId);
          setTimeout(() => removeJob(jobId), 6000);
          return;
        }
        if (evt.percent !== undefined || evt.msg) {
          // Mirror the form's scale (upload was 0–30%, encode 30–100%).
          const pct = evt.percent !== undefined ? 30 + Math.round(evt.percent * 0.7) : 0;
          setJob({ id: jobId, type: "video", channel, progress: Math.max(0, Math.min(100, pct)), msg: evt.msg ?? "", status: "running" });
        }
      }
    }
    // Stream ended without a terminal event — stop tracking to avoid a resume loop.
    removeActiveJob(jobId);
  } catch {
    // Network blip during reattach — drop persistence; any finished copies are
    // safe on the volume and show up in the library.
    removeActiveJob(jobId);
  } finally {
    attaching.delete(jobId);
  }
}
