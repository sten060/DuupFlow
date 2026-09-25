// Module-level singleton registry for in-flight compression jobs. Lets a client
// that reloaded, left the page or lost its connection re-POST with the same
// jobId and replay buffered progress events — the processing keeps running
// server-side either way (only an explicit Stop aborts it).
// Mirrors the image route's registry (src/app/api/duplicate-image-sse/jobRegistry.ts).
export type CompressJobEntry = {
  events: object[]; // all SSE data events buffered for reconnect replay
  done: boolean;
  userId: string;   // owner — reconnect / stop are refused for anyone else
  abort: AbortController; // fired only by an explicit Stop request
};

export const compressJobRegistry = new Map<string, CompressJobEntry>();
