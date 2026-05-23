/**
 * Client-side video pre-check.
 *
 * Loads the file into a hidden <video> element to verify the browser
 * (and therefore ffmpeg server-side too, in 99% of cases) can decode it.
 *
 * We use the same metadata-loading trick as the original getVideoDuration
 * helper, but distinguish three outcomes:
 *
 *   - decodable: true  + duration > 0   → normal video, OK
 *   - decodable: false + duration = 0   → browser couldn't read the file at all
 *                                         (corrupt, unsupported codec like ProRes,
 *                                         truncated upload, wrong extension)
 *   - decodable: true  + duration = 0   → media loaded but no duration metadata
 *                                         (rare; some HEVC variants). We let it
 *                                         pass — the server's fallback 1-frame
 *                                         test will catch real garbage.
 *
 * The pre-check saves the user a round-trip + the awkward server-side
 * "Aucune vidéo valide" error when their file is obviously broken.
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
