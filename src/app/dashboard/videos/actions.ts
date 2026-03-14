"use server";

import fs from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { getOutDirForCurrentUserRSC } from "@/app/dashboard/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { processVideos, videoPrefix, filterFinals } from "./processVideos";

const OUTPUT_BUCKET = "video-outputs";

/* =========================================================
   Server action: duplication (kept for any legacy callers)
   — forms now call /api/duplicate-video directly via fetch
   ========================================================= */

export async function duplicateVideos(formData: FormData) {
  const { channel } = await processVideos(formData);
  redirect(`/dashboard/videos/${channel}?ok=1`);
}

/* ------------------ helpers ------------------ */

/** List videos for a channel from Supabase Storage (Vercel) with filesystem fallback */
async function listFromStorage(userId: string, channelPrefix: string): Promise<string[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .list(userId, { limit: 500, sortBy: { column: "created_at", order: "desc" } });

    if (error || !data) return [];

    const names = data
      .map((f) => f.name)
      .filter((n) => n.startsWith(channelPrefix) && !n.startsWith("."));

    // Return signed URLs valid 1 hour
    return (
      await Promise.all(
        names.map(async (name) => {
          const key = `${userId}/${name}`;
          const { data: su } = await supabase.storage
            .from(OUTPUT_BUCKET)
            .createSignedUrl(key, 3600);
          return su?.signedUrl ?? null;
        })
      )
    ).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

/** Delete videos for a channel from Supabase Storage */
async function clearFromStorage(userId: string, channelPrefix: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .list(userId, { limit: 500 });

    if (!data) return;
    const keys = data
      .map((f) => f.name)
      .filter((n) => n.startsWith(channelPrefix))
      .map((n) => `${userId}/${n}`);

    if (keys.length > 0) {
      await supabase.storage.from(OUTPUT_BUCKET).remove(keys);
    }
  } catch {}
}

/* ------------------ Nettoyage par canal ------------------ */

export async function clearVideosSimple() {
  const { dir, userId } = await getOutDirForCurrentUserRSC();

  // Clear filesystem (local/VPS)
  const names = await fs.readdir(dir).catch(() => []);
  const finalNames = filterFinals(names).filter((n) => n.startsWith(videoPrefix("simple")));
  await Promise.all(finalNames.map((n) => fs.unlink(path.join(dir, n)).catch(() => {})));

  // Clear Supabase Storage (Vercel)
  await clearFromStorage(userId, videoPrefix("simple"));

  redirect("/dashboard/videos/simple?ok=1");
}

export async function clearVideosAdvanced() {
  const { dir, userId } = await getOutDirForCurrentUserRSC();

  const names = await fs.readdir(dir).catch(() => []);
  const finalNames = filterFinals(names).filter((n) => n.startsWith(videoPrefix("advanced")));
  await Promise.all(finalNames.map((n) => fs.unlink(path.join(dir, n)).catch(() => {})));

  await clearFromStorage(userId, videoPrefix("advanced"));

  redirect("/dashboard/videos/advanced?ok=1");
}

/* ------------------ Listing par canal ------------------ */

export async function listOutVideosSimple(): Promise<string[]> {
  const { dir, userId } = await getOutDirForCurrentUserRSC();

  // Try filesystem first (local/VPS with persistent OUT_BASE)
  const fsNames = filterFinals(await fs.readdir(dir).catch(() => [])).filter((n) =>
    n.startsWith(videoPrefix("simple"))
  );
  const fsUrls = fsNames.map(
    (n) => `/out/${userId}/${encodeURIComponent(path.basename(n))}`
  );

  // Merge with Supabase Storage results (Vercel)
  const storageUrls = await listFromStorage(userId, videoPrefix("simple"));

  // Return unique results — storage URLs take priority
  return storageUrls.length > 0 ? storageUrls : fsUrls;
}

export async function listOutVideosAdvanced(): Promise<string[]> {
  const { dir, userId } = await getOutDirForCurrentUserRSC();

  const fsNames = filterFinals(await fs.readdir(dir).catch(() => [])).filter((n) =>
    n.startsWith(videoPrefix("advanced"))
  );
  const fsUrls = fsNames.map(
    (n) => `/out/${userId}/${encodeURIComponent(path.basename(n))}`
  );

  const storageUrls = await listFromStorage(userId, videoPrefix("advanced"));
  return storageUrls.length > 0 ? storageUrls : fsUrls;
}
