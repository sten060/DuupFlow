// Durable storage for API job outputs (Supabase Storage). Video results can't
// live in /tmp (wiped on restart / after 1h) — the client may poll minutes
// later — so completed outputs are uploaded to a private bucket and served via
// short-lived signed URLs.

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "api-outputs";
const SIGNED_URL_TTL = 24 * 60 * 60; // 24h

let _bucketReady = false;

/** Ensure the private outputs bucket exists (idempotent, cached per process). */
export async function ensureBucket(): Promise<void> {
  if (_bucketReady) return;
  const admin = createAdminClient();
  const { error } = await admin.storage.createBucket(BUCKET, { public: false });
  // "already exists" is the expected happy path after the first call ever.
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Storage bucket setup failed: ${error.message}`);
  }
  _bucketReady = true;
}

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
  ".zip": "application/zip",
};

const extOf = (name: string) => {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
};

/**
 * Upload one output buffer and return a signed download URL (24h).
 * Files are namespaced by user + job so nothing collides or leaks across users.
 */
export async function uploadJobOutput(
  userId: string,
  jobId: string,
  filename: string,
  data: Buffer,
): Promise<{ name: string; url: string; bytes: number }> {
  await ensureBucket();
  const admin = createAdminClient();
  const key = `${userId}/${jobId}/${filename}`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(key, data, {
    contentType: CONTENT_TYPES[extOf(filename)] ?? "application/octet-stream",
    upsert: true,
  });
  if (upErr) throw new Error(`Upload failed for "${filename}": ${upErr.message}`);

  const { data: signed, error: sErr } = await admin.storage.from(BUCKET).createSignedUrl(key, SIGNED_URL_TTL);
  if (sErr || !signed) throw new Error(`Signed URL failed for "${filename}": ${sErr?.message}`);

  return { name: filename, url: signed.signedUrl, bytes: data.length };
}
