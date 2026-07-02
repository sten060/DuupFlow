// GET /api/v1/jobs/:id — poll an async job's status + result.
//
// While running:  { status: "queued"|"processing", progress, message }
// When done:      { status: "completed", result: { files: [{ name, url, bytes }] } }
// On failure:     { status: "failed", error }
//
// Download URLs in `result.files` are signed and valid for 24h.
//
// Example:
//   curl -H "Authorization: Bearer dflw_live_…" https://duupflow.com/api/v1/jobs/JOB_ID
import { authenticateApiRequest, apiError } from "@/lib/api-auth";
import { getJob, reapStaleJobs } from "@/lib/api-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Critical: Next caches internal fetches (incl. the Supabase client's) by
// default → a polled job would read stale "queued" even after completion.
export const fetchCache = "force-no-store";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;

  // Opportunistically fail jobs stranded by a mid-processing restart.
  reapStaleJobs().catch(() => {});

  const job = await getJob(auth.actor.userId, params.id);
  if (!job) return apiError(404, "job_not_found", "No job with that id for this account.");

  return Response.json({
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    message: job.message,
    result: job.status === "completed" ? job.result : null,
    error: job.status === "failed" ? job.error : null,
    created_at: job.created_at,
  });
}
