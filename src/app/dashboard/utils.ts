import path from "path";
import fs from "fs/promises";
import { createClient } from "@/lib/supabase/server";

const OUT_BASE = process.env.OUT_BASE || path.join(process.cwd(), "public", "out");

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
