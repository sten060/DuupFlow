// POST /api/v1/videos/duplicate — duplicate a video into N unique copies (async).
//
// Video encoding takes minutes, so this endpoint is asynchronous: it stores the
// source, creates a job, kicks off background processing, and returns 202 with a
// job id. Poll GET /api/v1/jobs/:id for status + download URLs.
//
// Input (multipart/form-data):
//   file         the source video (required) — mp4, mov, mkv, avi, webm; ≤ 120 s, ≤ 150 MB
//   count        number of copies, 1–10 (default 1)
//   packs        comma list: visual,motion,metadata_technical,pixel_magic (default "visual,motion,metadata_technical")
//   country      ISO code for GPS/location metadata (optional)
//   iphone_meta  "1"/"0" — iPhone-realistic metadata  (optional)
//   remove_ai_detection "1"/"0" — invisible per-copy counter-watermark (optional)
//
// Response: 202 { job_id, status, poll_url }
//
// Example:
//   curl -X POST https://duupflow.com/api/v1/videos/duplicate \
//     -H "Authorization: Bearer dflw_live_…" \
//     -F "file=@clip.mp4" -F "count=3"

import { authenticateApiRequest, apiError, contentLengthGuard } from "@/lib/api-auth";
import { enqueueVideoJob, VIDEO_MAX_BYTES } from "@/lib/api-video-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const VALID_PACKS = ["visual", "motion", "metadata_technical", "pixel_magic"];

export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;

  const oversize = contentLengthGuard(req, VIDEO_MAX_BYTES);
  if (oversize) return oversize;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, "invalid_body", "Expected multipart/form-data with a 'file' field.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return apiError(400, "missing_file", "No 'file' field found in the request.");

  const count = Math.max(1, Math.min(10, parseInt(String(form.get("count") ?? "1"), 10) || 1));
  const packsRaw = String(form.get("packs") ?? "visual,motion,metadata_technical");
  const packs = packsRaw.split(",").map((s) => s.trim()).filter((p) => VALID_PACKS.includes(p)).join(",") || "visual,motion,metadata_technical";
  const country = (form.get("country") as string) || undefined;
  const iphoneMeta = ["1", "true", "yes", "on"].includes(String(form.get("iphone_meta") ?? "").toLowerCase());
  const removeAiDetection = ["1", "true", "yes", "on"].includes(String(form.get("remove_ai_detection") ?? "").toLowerCase());

  return enqueueVideoJob(req, auth.actor.userId, file, "videos.duplicate", { count, packs, country, iphoneMeta, removeAiDetection });
}
