// POST /api/v1/ai-detection — mask the AI signature of an image.
//
// Strips AI-detection fingerprints (pixel patterns, DCT coefficients, metadata)
// and injects a realistic human identity, using the same masking pipeline as
// the dashboard. Output keeps the original format/resolution and is never
// heavier than the source.
//
// Video masking is heavy/async and will land with the async job system; video
// files are rejected here for now.
//
// Input (multipart/form-data):
//   file   the source image (required) — jpg, jpeg, png, webp
//
// Output: the masked image binary.
//
// Example:
//   curl -X POST https://duupflow.com/api/v1/ai-detection \
//     -H "Authorization: Bearer dflw_live_…" \
//     -F "file=@ai_image.png" -o masked.png

import path from "path";
import { authenticateApiRequest, apiError } from "@/lib/api-auth";
import { maskAiImage } from "@/lib/ai-detection-pipeline";
import { runImageOp } from "@/lib/imageProcessingLimiter";
import { incrementUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];

export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;

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
    return apiError(415, "video_not_supported", "Video AI-signature masking via the API is coming soon (async). For now this endpoint accepts images only.");
  }
  if (!IMAGE_EXTS.includes(ext)) {
    return apiError(415, "unsupported_type", `Unsupported type '${ext || "unknown"}'. Allowed: ${IMAGE_EXTS.join(", ")}.`);
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
      "Content-Disposition": `attachment; filename="duupflow_masked${out.outExt}"`,
      "Content-Length": String(out.data.length),
    },
  });
}
