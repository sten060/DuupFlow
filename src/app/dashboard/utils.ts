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
export async function cleanupOldFiles(maxAgeMs = 2 * 60 * 60 * 1000): Promise<number> {
  let deleted = 0;
  try {
    const base = OUT_BASE;
    let userDirs: import("fs").Dirent[];
    try {
      userDirs = await fs.readdir(base, { withFileTypes: true });
    } catch {
      return 0; // base dir doesn't exist yet
    }
    const now = Date.now();
    await Promise.all(
      userDirs
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const dir = path.join(base, e.name);
          let files: import("fs").Dirent[];
          try { files = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
          await Promise.all(
            files
              .filter((f) => f.isFile() && !f.name.startsWith("__in__") && !f.name.endsWith(".part"))
              .map(async (f) => {
                const fp = path.join(dir, f.name);
                try {
                  const stat = await fs.stat(fp);
                  if (now - stat.mtimeMs > maxAgeMs) {
                    await fs.unlink(fp);
                    deleted++;
                  }
                } catch {}
              })
          );
        })
    );
  } catch {}
  return deleted;
}
