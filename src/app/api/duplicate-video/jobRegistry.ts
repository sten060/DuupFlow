// ── Server-side job registry ────────────────────────────────────────────────
// Module-level singleton: survives across requests in the same Railway process.
// Shared between the main duplicate-video route (which registers/streams jobs)
// and the /stop route (which signals an explicit cancel). When a client's SSE
// connection drops and reconnects with the same jobId, we replay buffered events
// instead of restarting FFmpeg — so encoding survives a transient disconnect.
//
// Because the encode deliberately survives client disconnect, an explicit Stop
// needs its own out-of-band signal: `abort` is fired by requestStop() and is
// distinct from the request's own lifecycle.
export type JobEntry = {
  events: object[];           // all SSE data events buffered (keepalives excluded)
  done: boolean;
  tmpPaths: string[];         // source temp files — only deleted once job.done = true
  abort?: AbortController;     // fired by requestStop() to actually halt encoding
};

export const jobRegistry = new Map<string, JobEntry>();

/**
 * Explicitly stop a running job's server-side encoding. Returns true if a live
 * job was found and signalled, false otherwise (already done / unknown id).
 */
export function requestStop(jobId: string): boolean {
  const entry = jobRegistry.get(jobId);
  if (!entry || entry.done) return false;
  entry.abort?.abort("stopped");
  return true;
}
