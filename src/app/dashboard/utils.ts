import os from "os";
import path from "path";
import fs from "fs/promises";
import { createClient } from "@/lib/supabase/server";

// OUT_BASE must be set via env var.
// On Vercel the filesystem is read-only except /tmp, so we default to /tmp/duupflow.
// On a VPS set OUT_BASE to a persistent directory (e.g. /data/out).
const _out = process.env.OUT_BASE;
const IS_VERCEL = !!process.env.VERCEL;
const OUT_BASE = _out ?? (IS_VERCEL
  ? path.join(os.tmpdir(), "duupflow")
  : path.join(process.cwd(), ["public", "out"].join(path.sep)));

async function resolveUserId(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  } catch {}
  // Fallback dev (sans session)
  return "local";
}

/** Dossier utilisateur (garanti) + création si besoin */
export async function getOutDirForCurrentUser() {
  const userId = await resolveUserId();
  const userDir = path.join(OUT_BASE, userId);
  await fs.mkdir(userDir, { recursive: true });
  return { dir: userDir, userId };
}

/** Alias RSC (pages/listings) */
export async function getOutDirForCurrentUserRSC() {
  return getOutDirForCurrentUser();
}

/** Expose OUT_BASE so cleanup utilities can scan all user dirs */
export { OUT_BASE };

/**
 * Delete all output files (images & videos) older than `maxAgeMs` across
 * every user's subfolder under OUT_BASE.
 * Safe to call fire-and-forget — never throws.
 */
export async function cleanupOldFiles(maxAgeMs = 1 * 60 * 60 * 1000): Promise<number> {
  let deleted = 0;
  const now = Date.now();

  // 1) Output files under OUT_BASE/<userId>/ (the user's generated results).
  try {
    const userDirs = await fs.readdir(OUT_BASE, { withFileTypes: true });
    await Promise.all(
      userDirs
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const dir = path.join(OUT_BASE, e.name);
          let files: import("fs").Dirent[];
          try { files = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
          await Promise.all(
            files
              .filter((f) => f.isFile() && !f.name.startsWith("__in__") && !f.name.endsWith(".part"))
              .map(async (f) => {
                const fp = path.join(dir, f.name);
                try {
                  const stat = await fs.stat(fp);
                  if (now - stat.mtimeMs > maxAgeMs) { await fs.unlink(fp); deleted++; }
                } catch {}
              })
          );
        })
    );
  } catch { /* OUT_BASE not created yet */ }

  // 2) Orphaned source/temp files in the OS temp dir (duup_direct_*, duup_in_*,
  //    duup_probe_*). They're normally deleted when a job finishes, but leak on
  //    crash / restart / abandoned upload — and nothing else ever reclaims them,
  //    slowly filling the container disk. A conservative 6 h floor guarantees we
  //    never delete the source temps of a long-running (but still live) job.
  try {
    const TMP_ORPHAN_MS = Math.max(maxAgeMs, 6 * 60 * 60 * 1000);
    const tmp = os.tmpdir();
    const entries = await fs.readdir(tmp, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((e) => e.isFile() && e.name.startsWith("duup_"))
        .map(async (e) => {
          const fp = path.join(tmp, e.name);
          try {
            const stat = await fs.stat(fp);
            if (now - stat.mtimeMs > TMP_ORPHAN_MS) { await fs.unlink(fp); deleted++; }
          } catch {}
        })
    );
  } catch {}

  return deleted;
}
