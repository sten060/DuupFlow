// Background runner for API video jobs. Reuses the dashboard's processVideos
// pipeline, then uploads the outputs to durable storage and marks the job done.
//
// Runs in-process (not awaited by the request) — fine on Railway, which keeps a
// long-lived Node process alive after the HTTP response is sent. If the process
// restarts mid-job, reapStaleJobs() (in api-jobs.ts) marks it failed so it never
// hangs forever.

import fs from "fs/promises";
import os from "os";
import path from "path";
import { processVideos, type PreDownloadedFile } from "@/app/dashboard/videos/processVideos";
import { updateJob } from "@/lib/api-jobs";
import { uploadJobOutput } from "@/lib/api-storage";

export type VideoJobOpts = {
  jobId: string;
  userId: string;
  srcName: string;
  srcTmpPath: string;
  count: number;
  packs: string;
  country?: string;
  iphoneMeta?: boolean;
};

export async function runVideoDuplicateJob(opts: VideoJobOpts): Promise<void> {
  const { jobId, userId, srcName, srcTmpPath, count, packs, country, iphoneMeta } = opts;
  const workDir = path.join(os.tmpdir(), `api_job_${jobId}`);

  try {
    await updateJob(jobId, { status: "processing", progress: 1, message: "Starting…" });
    await fs.mkdir(workDir, { recursive: true });

    // Drive processVideos in "simple" mode via a synthetic FormData. The source
    // is passed as a pre-downloaded file so no session/upload step is needed.
    const fd = new FormData();
    fd.append("channel", "simple");
    fd.append("mode", "simple");
    fd.append("count", String(count));
    fd.append("packs", packs);
    fd.append("singles", "{}");
    if (country) fd.append("country", country);
    if (iphoneMeta) fd.append("iphoneMeta", "1");

    let lastPct = 0;
    const onProgress = async (pct: number, msg: string) => {
      // Throttle DB writes: only on a ≥5% jump. Cap at 99 until upload is done.
      if (pct - lastPct >= 5) {
        lastPct = pct;
        await updateJob(jobId, { progress: Math.min(99, pct), message: msg }).catch(() => {});
      }
    };

    const pre: PreDownloadedFile[] = [{ name: srcName, tmpPath: srcTmpPath }];
    const res = await processVideos(fd, onProgress, workDir, pre);

    if (!res.outputPaths.length) {
      throw new Error(res.rejectedFiles.length ? res.rejectedFiles.join("; ") : "No valid output was produced.");
    }

    await updateJob(jobId, { progress: 99, message: "Uploading results…" });
    const files: { name: string; url: string; bytes: number }[] = [];
    for (const p of res.outputPaths) {
      const buf = await fs.readFile(p);
      files.push(await uploadJobOutput(userId, jobId, path.basename(p), buf));
    }

    await updateJob(jobId, { status: "completed", progress: 100, message: "Done", result: { files } });
  } catch (e: any) {
    console.error(`[api-video-runner] job ${jobId} failed:`, e?.message);
    await updateJob(jobId, { status: "failed", error: (e?.message || "Processing failed.").slice(0, 500) }).catch(() => {});
  } finally {
    await fs.unlink(srcTmpPath).catch(() => {});
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
