// Module-level singleton registry for in-flight image duplications. Lets a client
// that reloaded or left the page re-POST with the same jobId and replay buffered
// progress events — the processing keeps running server-side either way. Mirrors
// the video route's registry (src/app/api/duplicate-video/jobRegistry.ts).
export type ImageJobEntry = {
  events: object[]; // all SSE data events buffered for reconnect replay
  done: boolean;
};

export const imageJobRegistry = new Map<string, ImageJobEntry>();
