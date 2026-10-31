// Mise en file d'un job vidéo API — partagée par POST /videos/duplicate et
// POST /ai-detection (vidéo). Mêmes limites, même stockage, même réponse 202 :
// les deux endpoints ne peuvent pas diverger.

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { apiError } from "@/lib/api-auth";
import { createJob, countActiveJobs } from "@/lib/api-jobs";
import { API_SOURCES_DIR } from "@/lib/api-storage";

export const VIDEO_MAX_BYTES = 150 * 1024 * 1024; // 150 MB
const MAX_PENDING_JOBS = 100; // par compte
export const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];

export type VideoJobType = "videos.duplicate" | "videos.ai_detection";

export async function enqueueVideoJob(
  req: Request,
  userId: string,
  file: File,
  type: VideoJobType,
  params: { count: number; packs: string; country?: string; iphoneMeta?: boolean; removeAiDetection?: boolean },
): Promise<Response> {
  const ext = (path.extname(file.name) || "").toLowerCase();
  if (!VIDEO_EXTS.includes(ext)) {
    return apiError(415, "unsupported_type", `Unsupported video type '${ext || "unknown"}'. Allowed: ${VIDEO_EXTS.join(", ")}.`);
  }
  if (file.size > VIDEO_MAX_BYTES) {
    return apiError(413, "file_too_large", `File exceeds the ${VIDEO_MAX_BYTES / (1024 * 1024)} MB limit.`);
  }

  // Bound queue depth per user so nobody can flood the worker.
  const active = await countActiveJobs(userId);
  if (active >= MAX_PENDING_JOBS) {
    return apiError(429, "too_many_jobs", `You have ${active} jobs in progress. Wait for some to finish (max ${MAX_PENDING_JOBS} pending).`);
  }

  // Source sur le volume persistant (pas /tmp, vidé par un redéploiement) pour
  // que le worker la retrouve quel que soit le temps d'attente du job.
  let srcTmpPath: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.mkdir(API_SOURCES_DIR, { recursive: true });
    srcTmpPath = path.join(API_SOURCES_DIR, `duup_apisrc_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`);
    await fs.writeFile(srcTmpPath, buf);
  } catch {
    return apiError(500, "store_failed", "Could not stage the uploaded file.");
  }

  const job = await createJob(userId, type, { ...params, srcName: file.name, srcTmpPath });
  const origin = new URL(req.url).origin;
  return Response.json(
    { job_id: job.id, status: job.status, poll_url: `${origin}/api/v1/jobs/${job.id}` },
    { status: 202 },
  );
}
