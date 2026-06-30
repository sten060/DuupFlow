// Module-level singleton registry for in-flight compression jobs. Lets a client
// that reloaded or left the page re-POST with the same jobId and replay buffered
// progress events — the processing keeps running server-side either way.
// Mirrors the image route's registry (src/app/api/duplicate-image-sse/jobRegistry.ts).
export type CompressJobEntry = {
  events: object[]; // all SSE data events buffered for reconnect replay
  done: boolean;
};

export const compressJobRegistry = new Map<string, CompressJobEntry>();
