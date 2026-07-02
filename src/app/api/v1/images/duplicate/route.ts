// POST /api/v1/images/duplicate — duplicate an image into N unique copies.
//
// Reuses the exact same pipeline as the dashboard (processImage) + the shared
// concurrency limiter (runImageOp) so the API can never out-compete the
// dashboard for resources.
//
// Input  (multipart/form-data):
//   file           the source image (required)
//   count          number of copies, 1–20 (default 1)
//   fundamentals   "1"/"0" — metadata randomisation (default on)
//   semi           "1"/"0" — imperceptible pixel tweak    (default on)
//   visuals        "1"/"0" — subtle visual shift          (default off)
//   reverse        "1"/"0" — horizontal mirror            (default off)
//   iphone_meta    "1"/"0" — inject iPhone-realistic EXIF (default off)
//   country        ISO code for GPS/location metadata     (optional)
//
// Output:
//   count == 1  → the image binary (image/jpeg|png|webp)
//   count  > 1  → a zip of the copies (application/zip)
//
// Example:
//   curl -X POST https://duupflow.com/api/v1/images/duplicate \
//     -H "Authorization: Bearer dflw_live_…" \
//     -F "file=@photo.jpg" -F "count=3" -o copies.zip

import path from "path";
import { authenticateApiRequest, apiError } from "@/lib/api-auth";
import { processImage } from "@/lib/image-pipeline";
import { runImageOp } from "@/lib/imageProcessingLimiter";
import { incrementUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const MAX_COPIES = 20;
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB source cap
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".heif"];

const parseBool = (v: FormDataEntryValue | null, def: boolean): boolean => {
  if (v === null) return def;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
};

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

  const ext = (path.extname(file.name) || ".jpg").toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) {
    return apiError(415, "unsupported_type", `Unsupported image type '${ext}'. Allowed: ${IMAGE_EXTS.join(", ")}.`);
  }
  if (file.size > MAX_BYTES) {
    return apiError(413, "file_too_large", `File exceeds the ${MAX_BYTES / (1024 * 1024)} MB limit.`);
  }

  const count = Math.max(1, Math.min(MAX_COPIES, parseInt(String(form.get("count") ?? "1"), 10) || 1));
  const flags = {
    fundamentals: parseBool(form.get("fundamentals"), true),
    semi: parseBool(form.get("semi"), true),
    visuals: parseBool(form.get("visuals"), false),
    reverse: parseBool(form.get("reverse"), false),
  };
  const opts = {
    country: (form.get("country") as string) || undefined,
    iphoneMeta: parseBool(form.get("iphone_meta"), false),
  };

  let srcBuf: Buffer;
  try {
    srcBuf = Buffer.from(await file.arrayBuffer());
  } catch {
    return apiError(400, "read_failed", "Could not read the uploaded file.");
  }

  // Process every copy through the SHARED limiter (bounds total sharp ops across
  // the API + dashboard → protects the box from overload).
  let copies: { data: Buffer; outExt: string }[];
  try {
    copies = await Promise.all(
      Array.from({ length: count }, () => runImageOp(() => processImage(srcBuf, ext, flags, opts))),
    );
  } catch (e: any) {
    console.error("[api/v1/images/duplicate] processing failed:", e?.message);
    return apiError(500, "processing_failed", "Image processing failed.");
  }

  // Record usage against the account (analytics + usage_tracking). Fire-and-forget.
  incrementUsage(auth.actor.userId, "images", count).catch(() => {});

  // Single copy → return the image directly. Multiple → return a zip.
  if (copies.length === 1) {
    const { data, outExt } = copies[0];
    const ct = outExt === ".png" ? "image/png" : outExt === ".webp" ? "image/webp" : "image/jpeg";
    return new Response(data, {
      headers: {
        "Content-Type": ct,
        "Content-Disposition": `attachment; filename="duupflow_copy${outExt}"`,
        "Content-Length": String(data.length),
      },
    });
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  copies.forEach((c, i) => zip.file(`copy_${i + 1}${c.outExt}`, c.data));
  const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  return new Response(zipBuf, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="duupflow_copies.zip"`,
      "Content-Length": String(zipBuf.length),
    },
  });
}
