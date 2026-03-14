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
