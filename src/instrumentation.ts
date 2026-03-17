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
  }
}
