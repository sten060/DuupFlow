// Durable storage for API job outputs — on the Railway persistent volume (via
// OUT_BASE) rather than an external service. Files live under
// OUT_BASE/api-outputs/<userId>/<jobId>/ and are served by the authenticated
// download route (/api/v1/jobs/:id/files/:name). A cleaner (cleanupApiOutputs)
// deletes anything older than the retention window so the volume can't fill up.
//
// IMPORTANT: in production OUT_BASE must point at the Railway VOLUME (a
// persistent dir like /data/…), not /tmp — otherwise async results wouldn't
// survive a restart.

import fs from "fs/promises";
import path from "path";
import { OUT_BASE } from "@/app/dashboard/utils";

const API_DIR = path.join(OUT_BASE, "api-outputs");
const RETENTION_MS = 24 * 60 * 60 * 1000; // 24h

/** Reject anything that could escape the job folder. */
function safeName(name: string): boolean {
  return !!name && !name.includes("/") && !name.includes("\\") && !name.includes("..");
}

/** Save one output buffer under the job's folder. Returns display metadata. */
export async function saveJobOutput(
  userId: string,
  jobId: string,
  filename: string,
  data: Buffer,
): Promise<{ name: string; bytes: number }> {
  const dir = path.join(API_DIR, userId, jobId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), data);
  return { name: filename, bytes: data.length };
}

/** Read a stored output (path-traversal safe). Returns null if missing/expired. */
export async function readJobOutput(userId: string, jobId: string, filename: string): Promise<Buffer | null> {
  if (!safeName(filename) || !safeName(userId) || !safeName(jobId)) return null;
  try {
    return await fs.readFile(path.join(API_DIR, userId, jobId, filename));
  } catch {
    return null;
  }
}

/**
 * Delete API output files older than the retention window (the "auto-cleaner").
 * Walks OUT_BASE/api-outputs/<user>/<job>/* and removes stale files + empty
 * folders. Best-effort — never throws. Returns how many files were deleted.
 */
export async function cleanupApiOutputs(maxAgeMs = RETENTION_MS): Promise<number> {
  const now = Date.now();
  let deleted = 0;
  let userDirs: string[];
  try {
    userDirs = await fs.readdir(API_DIR);
  } catch {
    return 0; // nothing created yet
  }
  for (const u of userDirs) {
    const uDir = path.join(API_DIR, u);
    let jobDirs: string[];
    try { jobDirs = await fs.readdir(uDir); } catch { continue; }
    for (const j of jobDirs) {
      const jDir = path.join(uDir, j);
      let files: string[];
      try { files = await fs.readdir(jDir); } catch { continue; }
      for (const f of files) {
        const fp = path.join(jDir, f);
        try {
          const st = await fs.stat(fp);
          if (now - st.mtimeMs > maxAgeMs) { await fs.unlink(fp); deleted++; }
        } catch {}
      }
      // Remove the job folder if it's now empty.
      try { if ((await fs.readdir(jDir)).length === 0) await fs.rmdir(jDir); } catch {}
    }
    try { if ((await fs.readdir(uDir)).length === 0) await fs.rmdir(uDir); } catch {}
  }
  return deleted;
}
