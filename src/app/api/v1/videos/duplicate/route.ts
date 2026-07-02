// POST /api/v1/videos/duplicate — duplicate a video into N unique copies (async).
//
// Video encoding takes minutes, so this endpoint is asynchronous: it stores the
// source, creates a job, kicks off background processing, and returns 202 with a
// job id. Poll GET /api/v1/jobs/:id for status + download URLs.
//
// Input (multipart/form-data):
//   file         the source video (required) — mp4, mov, mkv, avi, webm; ≤ 59 s
//   count        number of copies, 1–10 (default 1)
//   packs        comma list: visual,motion,metadata_technical,pixel_magic (default "visual,motion,metadata_technical")
//   country      ISO code for GPS/location metadata (optional)
//   iphone_meta  "1"/"0" — iPhone-realistic metadata  (optional)
//
// Response: 202 { job_id, status, poll_url }
//
// Example:
//   curl -X POST https://duupflow.com/api/v1/videos/duplicate \
//     -H "Authorization: Bearer dflw_live_…" \
//     -F "file=@clip.mp4" -F "count=3"

import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { authenticateApiRequest, apiError } from "@/lib/api-auth";
import { createJob, countActiveJobs } from "@/lib/api-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const MAX_BYTES = 150 * 1024 * 1024; // 150 MB source cap (MVP)
const MAX_PENDING_JOBS = 10; // per user — bounds queue depth / resource use
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];
const VALID_PACKS = ["visual", "motion", "metadata_technical", "pixel_magic"];

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
  if (!(file instanceof File)) return apiError(400, "missing_file", "No 'file' field found in the request.");

  const ext = (path.extname(file.name) || "").toLowerCase();
  if (!VIDEO_EXTS.includes(ext)) {
    return apiError(415, "unsupported_type", `Unsupported video type '${ext || "unknown"}'. Allowed: ${VIDEO_EXTS.join(", ")}.`);
  }
  if (file.size > MAX_BYTES) {
    return apiError(413, "file_too_large", `File exceeds the ${MAX_BYTES / (1024 * 1024)} MB limit.`);
  }

  // Bound queue depth per user so nobody can flood the worker.
  const active = await countActiveJobs(auth.actor.userId);
  if (active >= MAX_PENDING_JOBS) {
    return apiError(429, "too_many_jobs", `You have ${active} jobs in progress. Wait for some to finish (max ${MAX_PENDING_JOBS} pending).`);
  }

  const count = Math.max(1, Math.min(10, parseInt(String(form.get("count") ?? "1"), 10) || 1));
  const packsRaw = String(form.get("packs") ?? "visual,motion,metadata_technical");
  const packs = packsRaw.split(",").map((s) => s.trim()).filter((p) => VALID_PACKS.includes(p)).join(",") || "visual,motion,metadata_technical";
  const country = (form.get("country") as string) || undefined;
  const iphoneMeta = ["1", "true", "yes", "on"].includes(String(form.get("iphone_meta") ?? "").toLowerCase());

  // Persist the source to /tmp so the background worker can read it after we respond.
  let srcTmpPath: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    srcTmpPath = path.join(os.tmpdir(), `duup_apisrc_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`);
    await fs.writeFile(srcTmpPath, buf);
  } catch (e: any) {
    return apiError(500, "store_failed", "Could not stage the uploaded file.");
  }

  // Create a queued job. The API worker (started in instrumentation.ts) picks it
  // up and processes it — reliable in both dev and prod, unlike detached
  // post-response work. The source path travels in the job params.
  const job = await createJob(auth.actor.userId, "videos.duplicate", {
    count,
    packs,
    country,
    iphoneMeta,
    srcName: file.name,
    srcTmpPath,
  });

  const origin = new URL(req.url).origin;
  return Response.json(
    { job_id: job.id, status: job.status, poll_url: `${origin}/api/v1/jobs/${job.id}` },
    { status: 202 },
  );
}
