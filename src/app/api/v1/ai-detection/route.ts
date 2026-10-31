// POST /api/v1/ai-detection — remove AI detection from an image (sync) or a
// video (async job).
//
// Strips AI-detection fingerprints (pixel patterns, DCT coefficients, metadata)
// and injects a realistic human identity, using the same masking pipeline as
// the dashboard. Output keeps the original format/resolution and is never
// heavier than the source.
//
// Input (multipart/form-data):
//   file   the source — image (jpg, jpeg, png, webp ≤ 25 MB)
//          or video (mp4, mov, mkv, avi, webm ≤ 150 MB, ≤ 120 s)
//
// Output:
//   image → the cleaned image binary (sync)
//   video → 202 { job_id, status, poll_url } — poll GET /jobs/:id, like
//           /videos/duplicate. ONE output file: metadata stripped + invisible
//           counter-watermark, NO duplication effect (no visual/motion pack).
//
// Example:
//   curl -X POST https://duupflow.com/api/v1/ai-detection \
//     -H "Authorization: Bearer dflw_live_…" \
//     -F "file=@ai_image.png" -o masked.png

import path from "path";
import { authenticateApiRequest, apiError, contentLengthGuard } from "@/lib/api-auth";
import { maskAiImage } from "@/lib/ai-detection-pipeline";
import { runImageOp } from "@/lib/imageProcessingLimiter";
import { incrementUsage } from "@/lib/usage";
import { enqueueVideoJob, VIDEO_EXTS, VIDEO_MAX_BYTES } from "@/lib/api-video-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];

export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;

  // Garde large (vidéo) avant le parse ; la limite image (25 Mo) est
  // vérifiée juste après, une fois le type connu.
  const oversize = contentLengthGuard(req, VIDEO_MAX_BYTES);
  if (oversize) return oversize;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, "invalid_body", "Expected multipart/form-data with a 'file' field.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError(400, "missing_file", "No 'file' field found in the request.");
  }

  const ext = (path.extname(file.name) || "").toLowerCase();
  if (VIDEO_EXTS.includes(ext)) {
    // Vidéo : même chaîne que l'option « Retirer la détection IA » du
    // duplicateur, sur UNE copie et sans aucun pack de duplication.
    return enqueueVideoJob(req, auth.actor.userId, file, "videos.ai_detection", {
      count: 1,
      packs: "",
      removeAiDetection: true,
    });
  }
  if (!IMAGE_EXTS.includes(ext)) {
    return apiError(415, "unsupported_type", `Unsupported type '${ext || "unknown"}'. Allowed: ${[...IMAGE_EXTS, ...VIDEO_EXTS].join(", ")}.`);
  }
  if (file.size > MAX_BYTES) {
    return apiError(413, "file_too_large", `File exceeds the ${MAX_BYTES / (1024 * 1024)} MB limit.`);
  }

  let srcBuf: Buffer;
  try {
    srcBuf = Buffer.from(await file.arrayBuffer());
  } catch {
    return apiError(400, "read_failed", "Could not read the uploaded file.");
  }

  let out: { data: Buffer; outExt: string };
  try {
    out = await runImageOp(() => maskAiImage(srcBuf, ext));
  } catch (e: any) {
    console.error("[api/v1/ai-detection] processing failed:", e?.message);
    return apiError(500, "processing_failed", "AI-signature masking failed.");
  }

  incrementUsage(auth.actor.userId, "ai_signatures", 1).catch(() => {});

  const ct = out.outExt === ".png" ? "image/png" : out.outExt === ".webp" ? "image/webp" : "image/jpeg";
  return new Response(out.data, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `attachment; filename="IMG_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${Math.random().toString(36).slice(2, 8).toUpperCase()}${out.outExt}"` /* jamais le nom du produit */,
      "Content-Length": String(out.data.length),
    },
  });
}
