// Next.js instrumentation hook — runs once when the Node.js server starts.
// We use it to pre-warm the FFmpeg binary so the first video request never
// has to wait for binary resolution or download.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getFFmpegBin } = await import(
      "@/app/dashboard/videos/processVideos"
    );
    getFFmpegBin().catch((err: unknown) => {
      // Non-fatal: the route handler will retry and surface any error to the user.
      console.warn("[instrumentation] FFmpeg pre-warm failed:", err);
    });

    // Start the API job worker — polls api_jobs for queued async jobs (video).
    const { startApiWorker } = await import("@/lib/api-worker");
    startApiWorker();

    liftRequestTimeout();

    // One-off ffmpeg speed self-test (logs `[ffmpeg][selftest] …`), delayed so it
    // never competes with the boot itself. FFMPEG_SELFTEST=0 disables it.
    const delay = parseInt(process.env.FFMPEG_SELFTEST_DELAY_MS ?? "60000", 10);
    setTimeout(() => {
      import("@/lib/ffmpeg-selftest").then((m) => m.runFFmpegSelfTest()).catch(() => {});
    }, delay);
  }
}

// Node's http server gives a request 5 min (requestTimeout = 300 000 ms) to be
// received IN FULL, and `next start` never changes it. A multi-GB upload on an
// ordinary connection takes longer → Node drops the socket mid-upload, Railway's
// proxy answers 502 and the app logs nothing. Raise it above Railway's own
// 15-min edge cap so the platform limit is the only one left. `next start` gives
// no hook on its server, so we find it among the process's listening handles
// (retried: the server may not be listening yet when register() runs).
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000;
function liftRequestTimeout(attempt = 0) {
  const handles: unknown[] = (process as any)._getActiveHandles?.() ?? [];
  let patched = 0;
  for (const h of handles) {
    const s = h as { requestTimeout?: number; listening?: boolean };
    if (s && typeof s.requestTimeout === "number" && s.listening && s.requestTimeout !== REQUEST_TIMEOUT_MS) {
      s.requestTimeout = REQUEST_TIMEOUT_MS;
      patched++;
    }
  }
  if (patched) console.log(`[instrumentation] http requestTimeout → ${REQUEST_TIMEOUT_MS / 60000} min (${patched} server(s))`);
  else if (attempt < 10) setTimeout(() => liftRequestTimeout(attempt + 1), 1000);
  else console.warn("[instrumentation] http server not found — uploads stay capped at 5 min by Node");
}
