/**
 * Client-side video probe.
 *
 * Loads the file into a hidden <video> element to read its duration
 * metadata. Used to enforce the 50-second limit BEFORE uploading.
 *
 * IMPORTANT: callers must NOT reject when `decodable` is false. iPhone
 * videos use HEVC/H.265 by default, which Chrome and Firefox cannot
 * decode in a <video> element (only Safari supports it natively).
 * ffmpeg server-side handles HEVC fine, so a `decodable: false` here
 * does NOT mean the upload will fail — it just means we couldn't read
 * metadata in the browser. The `decodable` flag is informational.
 *
 *   - decodable: true  + duration > 0   → normal video, can enforce duration
 *   - decodable: true  + duration = 0   → media loaded but no duration metadata
 *   - decodable: false + duration = 0   → browser can't read (likely HEVC).
 *                                         Skip the duration check, upload
 *                                         anyway, let the server decide.
 *
 * The server has its own ffprobe + 1-frame fallback test for truly
 * broken files (see processVideos.ts probe phase).
 */
export type VideoProbe = {
  decodable: boolean;
  duration: number;
  reason?: "load_error" | "stalled";
};

const PROBE_TIMEOUT_MS = 8000;

export function probeVideoFile(file: File): Promise<VideoProbe> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const url = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      try { URL.revokeObjectURL(url); } catch {}
      video.removeAttribute("src");
      try { video.load(); } catch {}
    };
    const finish = (res: VideoProbe) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(res);
    };

    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      finish({ decodable: true, duration: d });
    };
    video.onerror = () => {
      finish({ decodable: false, duration: 0, reason: "load_error" });
    };

    // Safety net: some malformed files never trigger error nor metadata
    setTimeout(() => finish({ decodable: false, duration: 0, reason: "stalled" }), PROBE_TIMEOUT_MS);

    video.src = url;
  });
}
