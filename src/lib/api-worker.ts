// DuupFlow API job worker. A single in-process poller (started from
// instrumentation.ts on server boot) claims queued jobs from `api_jobs` and
// runs them ONE AT A TIME.
//
// Why a poller instead of processing inside the request: detached
// "fire-and-forget" work after an HTTP response is unreliable (it stalls in
// `next dev` and is fragile in prod). A standalone interval on the long-lived
// Node process runs reliably in both. Serial processing also caps API video
// load to one ffmpeg job at a time → protects the box from OOM.

import { createAdminClient } from "@/lib/supabase/admin";
import { reapStaleJobs } from "@/lib/api-jobs";
import { runVideoDuplicateJob } from "@/lib/api-video-runner";

type ClaimedJob = { id: string; user_id: string; type: string; params: Record<string, any> };

/** Atomically claim the oldest queued job (queued → processing). */
async function claimNextJob(): Promise<ClaimedJob | null> {
  const admin = createAdminClient();
  const { data: next } = await admin
    .from("api_jobs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!next) return null;

  // Claim only if still queued — guards against a double-pick.
  const { data: claimed } = await admin
    .from("api_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", (next as { id: string }).id)
    .eq("status", "queued")
    .select("id, user_id, type, params")
    .maybeSingle();
  return (claimed as ClaimedJob | null) ?? null;
}

async function processJob(job: ClaimedJob): Promise<void> {
  const p = job.params || {};
  if (job.type === "videos.duplicate") {
    await runVideoDuplicateJob({
      jobId: job.id,
      userId: job.user_id,
      srcName: p.srcName,
      srcTmpPath: p.srcTmpPath,
      count: p.count ?? 1,
      packs: p.packs ?? "visual,motion,metadata_technical",
      country: p.country,
      iphoneMeta: p.iphoneMeta,
    });
  } else {
    console.error(`[api-worker] unknown job type: ${job.type}`);
  }
}

let _started = false;
let _busy = false;
let _ticks = 0;

/** Start the poller once. Safe to call repeatedly. */
export function startApiWorker(): void {
  if (_started) return;
  _started = true;
  setInterval(async () => {
    if (_busy) return; // one job at a time
    _busy = true;
    try {
      // Reap stranded jobs every ~2 min.
      if (_ticks++ % 30 === 0) await reapStaleJobs().catch(() => {});
      const job = await claimNextJob();
      if (job) await processJob(job);
    } catch (e: any) {
      console.error("[api-worker] loop error:", e?.message);
    } finally {
      _busy = false;
    }
  }, 4000);
  console.log("[api-worker] started");
}
