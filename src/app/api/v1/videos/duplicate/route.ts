// POST /api/v1/videos/duplicate — duplicate a video into N unique copies (async).
//
// Video encoding takes minutes, so this endpoint is asynchronous: it stores the
// source, creates a job, kicks off background processing, and returns 202 with a
// job id. Poll GET /api/v1/jobs/:id for status + download URLs.
//
// Input (multipart/form-data):
//   file         the source video (required) — mp4, mov, mkv, avi, webm; ≤ 120 s, ≤ 150 MB
//   count        number of copies, 1–10 (default 1)
//   mode         "simple" (default) or "advanced"
//   packs        simple mode — comma list: visual,motion,metadata_technical,pixel_magic (default "visual,motion,metadata_technical")
//   advanced_ranges  advanced mode (required) — JSON { setting: { enabled?, min?, max? } }, keys in ADVANCED_RANGE_KEYS;
//                a value drawn in [min, max] per copy, clamped by the engine (same as the dashboard's advanced mode)
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
import { enqueueVideoJob, VIDEO_MAX_BYTES, ADVANCED_RANGE_KEYS, type AdvancedRanges } from "@/lib/api-video-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const VALID_PACKS = ["visual", "motion", "metadata_technical", "pixel_magic"];

/** Parse + valide `advanced_ranges` : clés connues seulement, nombres finis. */
function parseAdvancedRanges(raw: string): { ranges: AdvancedRanges } | { error: string } {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return { error: "'advanced_ranges' must be valid JSON." }; }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { error: "'advanced_ranges' must be a JSON object." };
  const unknown = Object.keys(obj).filter((k) => !(ADVANCED_RANGE_KEYS as readonly string[]).includes(k));
  if (unknown.length) return { error: `Unknown advanced_ranges key(s): ${unknown.join(", ")}. Allowed: ${ADVANCED_RANGE_KEYS.join(", ")}.` };
  const ranges: AdvancedRanges = {};
  for (const [key, v] of Object.entries(obj as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return { error: `advanced_ranges.${key} must be an object { enabled?, min?, max? }.` };
    const r = v as Record<string, unknown>;
    const entry: AdvancedRanges[string] = { enabled: r.enabled !== false }; // présent = activé, sauf enabled:false
    for (const b of ["min", "max"] as const) {
      if (r[b] === undefined) continue;
      const n = Number(r[b]);
      if (!Number.isFinite(n)) return { error: `advanced_ranges.${key}.${b} must be a number.` };
      entry[b] = n;
    }
    ranges[key] = entry;
  }
  if (!Object.values(ranges).some((r) => r.enabled)) return { error: "Advanced mode needs at least one enabled setting in 'advanced_ranges'." };
  return { ranges };
}

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
  const modeRaw = String(form.get("mode") ?? "simple").toLowerCase();
  if (modeRaw !== "simple" && modeRaw !== "advanced") return apiError(400, "invalid_mode", "'mode' must be 'simple' or 'advanced'.");
  let advancedRanges: AdvancedRanges | undefined;
  if (modeRaw === "advanced") {
    const parsed = parseAdvancedRanges(String(form.get("advanced_ranges") ?? ""));
    if ("error" in parsed) return apiError(400, "invalid_advanced_ranges", parsed.error);
    advancedRanges = parsed.ranges;
  }
  const packsRaw = String(form.get("packs") ?? "visual,motion,metadata_technical");
  const packs = packsRaw.split(",").map((s) => s.trim()).filter((p) => VALID_PACKS.includes(p)).join(",") || "visual,motion,metadata_technical";
  const country = (form.get("country") as string) || undefined;
  const iphoneMeta = ["1", "true", "yes", "on"].includes(String(form.get("iphone_meta") ?? "").toLowerCase());
  const removeAiDetection = ["1", "true", "yes", "on"].includes(String(form.get("remove_ai_detection") ?? "").toLowerCase());

  return enqueueVideoJob(req, auth.actor.userId, file, "videos.duplicate", { count, packs, country, iphoneMeta, removeAiDetection, mode: modeRaw, advancedRanges });
}
