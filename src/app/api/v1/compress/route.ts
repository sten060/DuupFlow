// POST /api/v1/compress — reduce an image's file size (sync).
//
// Reuses the dashboard's image compressor (compressImage) + the shared sharp
// limiter. Guarantees the output is never heavier than the source (falls back
// to the original bytes otherwise — matching the dashboard behaviour).
//
// Video compression is heavy/async and will land with the async job system;
// video files are rejected here for now with a clear message.
//
// Input (multipart/form-data):
//   file    the source image (required) — png, jpg, jpeg, webp
//   level   "light" | "balanced" | "strong"   (default "balanced")
//
// Output: the compressed image binary. Savings are reported in response headers:
//   X-DuupFlow-Saved-Percent, X-DuupFlow-Original-Bytes, X-DuupFlow-Output-Bytes
//
// Example:
//   curl -X POST https://duupflow.com/api/v1/compress \
//     -H "Authorization: Bearer dflw_live_…" \
//     -F "file=@photo.jpg" -F "level=strong" -o compressed.jpg

import path from "path";
import { authenticateApiRequest, apiError } from "@/lib/api-auth";
import { compressImage, type CompressLevel } from "@/lib/compress-pipeline";
import { runImageOp } from "@/lib/imageProcessingLimiter";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];
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
    return apiError(415, "video_not_supported", "Video compression via the API is coming soon (async). For now this endpoint accepts images only.");
  }
  if (!IMAGE_EXTS.includes(ext)) {
    return apiError(415, "unsupported_type", `Unsupported type '${ext || "unknown"}'. Allowed: ${IMAGE_EXTS.join(", ")}.`);
  }
  if (file.size > MAX_BYTES) {
    return apiError(413, "file_too_large", `File exceeds the ${MAX_BYTES / (1024 * 1024)} MB limit.`);
  }

  const levelRaw = String(form.get("level") ?? "balanced");
  const level: CompressLevel = (["light", "balanced", "strong"] as const).includes(levelRaw as CompressLevel)
    ? (levelRaw as CompressLevel)
    : "balanced";

  let srcBuf: Buffer;
  try {
    srcBuf = Buffer.from(await file.arrayBuffer());
  } catch {
    return apiError(400, "read_failed", "Could not read the uploaded file.");
  }

  let out: { data: Buffer; outExt: string };
  try {
    out = await runImageOp(() => compressImage(srcBuf, ext, level));
  } catch (e: any) {
    console.error("[api/v1/compress] processing failed:", e?.message);
    return apiError(500, "processing_failed", "Image compression failed.");
  }

  // Never heavier than source: fall back to the original bytes (+ its extension).
  const srcBytes = srcBuf.length;
  const useOriginal = out.data.length >= srcBytes;
  const finalData = useOriginal ? srcBuf : out.data;
  const finalExt = useOriginal ? ext : out.outExt;
  const saved = srcBytes > 0 ? Math.max(0, Math.round((1 - finalData.length / srcBytes) * 100)) : 0;

  const ct = finalExt === ".png" ? "image/png" : finalExt === ".webp" ? "image/webp" : "image/jpeg";
  return new Response(finalData, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `attachment; filename="duupflow_compressed${finalExt}"`,
      "Content-Length": String(finalData.length),
      "X-DuupFlow-Saved-Percent": String(saved),
      "X-DuupFlow-Original-Bytes": String(srcBytes),
      "X-DuupFlow-Output-Bytes": String(finalData.length),
    },
  });
}
