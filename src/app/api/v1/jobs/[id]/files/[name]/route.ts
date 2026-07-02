// GET /api/v1/jobs/:id/files/:name — download one output of a completed job.
//
// Authenticated with the Bearer API key and scoped to the caller's own job, so
// nobody can read another account's files. Served from the Railway volume.
//
// Example:
//   curl -H "Authorization: Bearer dflw_live_…" \
//     https://duupflow.com/api/v1/jobs/JOB_ID/files/copy.mp4 -o copy.mp4
import path from "path";
import { authenticateApiRequest, apiError } from "@/lib/api-auth";
import { getJob } from "@/lib/api-jobs";
import { readJobOutput } from "@/lib/api-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(req: Request, { params }: { params: { id: string; name: string } }) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;

  // The job must exist and belong to the caller.
  const job = await getJob(auth.actor.userId, params.id);
  if (!job) return apiError(404, "job_not_found", "No job with that id for this account.");

  const name = decodeURIComponent(params.name);
  const buf = await readJobOutput(auth.actor.userId, params.id, name);
  if (!buf) return apiError(404, "file_not_found", "File not found (it may have expired after 24h).");

  const ct = CONTENT_TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
  return new Response(buf, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(buf.length),
    },
  });
}
