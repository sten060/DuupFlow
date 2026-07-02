// GET /api/v1/jobs/:id — poll an async job's status + result.
//
// While running:  { status: "queued"|"processing", progress, message }
// When done:      { status: "completed", result: { files: [{ name, url, bytes }] } }
// On failure:     { status: "failed", error }
//
// Download each file via its `url` with your Bearer key. Files are kept 16h.
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

  // Build download URLs from the stored filenames, using this request's origin.
  // Each URL is served by the authenticated download route (needs the Bearer key).
  let result: unknown = null;
  if (job.status === "completed" && job.result && typeof job.result === "object") {
    const origin = new URL(req.url).origin;
    const raw = (job.result as { files?: { name: string; bytes: number }[] }).files ?? [];
    result = {
      files: raw.map((f) => ({
        name: f.name,
        bytes: f.bytes,
        url: `${origin}/api/v1/jobs/${job.id}/files/${encodeURIComponent(f.name)}`,
      })),
    };
  }

  return Response.json({
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    message: job.message,
    result,
    error: job.status === "failed" ? job.error : null,
    created_at: job.created_at,
  });
}
