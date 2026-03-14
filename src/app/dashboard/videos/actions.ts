"use server";

import fs from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { getOutDirForCurrentUserRSC } from "@/app/dashboard/utils";
import { processVideos, videoPrefix, filterFinals } from "./processVideos";

/* =========================================================
   Server action: duplication (kept for any legacy callers)
   — forms now call /api/duplicate-video directly via fetch
   ========================================================= */

export async function duplicateVideos(formData: FormData) {
  const channel = await processVideos(formData);
  redirect(`/dashboard/videos/${channel}?ok=1`);
}

/* ------------------ Nettoyage par canal ------------------ */

export async function clearVideosSimple() {
  const { dir } = await getOutDirForCurrentUserRSC();
  const names = await fs.readdir(dir).catch(() => []);
  const finalNames = filterFinals(names).filter((n) => n.startsWith(videoPrefix("simple")));
  await Promise.all(finalNames.map((n) => fs.unlink(path.join(dir, n)).catch(() => {})));
  redirect("/dashboard/videos/simple?ok=1");
}

export async function clearVideosAdvanced() {
  const { dir } = await getOutDirForCurrentUserRSC();
  const names = await fs.readdir(dir).catch(() => []);
  const finalNames = filterFinals(names).filter((n) => n.startsWith(videoPrefix("advanced")));
  await Promise.all(finalNames.map((n) => fs.unlink(path.join(dir, n)).catch(() => {})));
  redirect("/dashboard/videos/advanced?ok=1");
}

/* ------------------ Listing par canal ------------------ */

export async function listOutVideosSimple(): Promise<string[]> {
  const { dir, userId } = await getOutDirForCurrentUserRSC();
  const finals = filterFinals(await fs.readdir(dir));
  return finals
    .filter((n) => n.startsWith(videoPrefix("simple")))
    .map((n) => `/out/${userId}/${encodeURIComponent(path.basename(n))}`);
}

export async function listOutVideosAdvanced(): Promise<string[]> {
  const { dir, userId } = await getOutDirForCurrentUserRSC();
  const finals = filterFinals(await fs.readdir(dir));
  return finals
    .filter((n) => n.startsWith(videoPrefix("advanced")))
    .map((n) => `/out/${userId}/${encodeURIComponent(path.basename(n))}`);
}
