"use server";

import fs from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { getOutDirsForListing, canDeleteOutputs } from "@/app/dashboard/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { videoPrefix, filterFinals } from "./processVideos";

const OUTPUT_BUCKET = "video-outputs";

/* La server action `duplicateVideos` vivait ici. Supprimée le 2026-08-22 : plus
   aucun appelant (les formulaires passent par /api/duplicate-video), et surtout
   elle appelait processVideos() SANS AUCUN contrôle de quota. Un fichier en
   « use server » expose chacune de ses fonctions exportées comme un point
   d'entrée réseau : c'était donc un contournement complet de la limite mensuelle
   de vidéos. Toute duplication doit passer par /api/duplicate-video, qui réserve
   le quota avant d'encoder. */

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
/* Workspaces : un dossier par créateur ; en vue admin, TOUS les créateurs
   (getOutDirsForListing). Sans workspaces : un seul dossier, comme avant. */

async function clearChannel(channel: "simple" | "advanced", awaitStorage: boolean) {
  if (!(await canDeleteOutputs())) return; // rôle VA : ne supprime rien
  for (const { dir, userId } of await getOutDirsForListing()) {
    const names = await fs.readdir(dir).catch(() => []);
    const finalNames = filterFinals(names).filter((n) => n.startsWith(videoPrefix(channel)));
    await Promise.all(finalNames.map((n) => fs.unlink(path.join(dir, n)).catch(() => {})));
    // Supabase Storage (sans volume persistant)
    const p = clearFromStorage(userId, videoPrefix(channel));
    if (awaitStorage) await p; else void p; // fire-and-forget côté client
  }
}

export async function clearVideosSimple() {
  await clearChannel("simple", true);
  redirect("/dashboard/videos/simple?ok=1");
}

/** Same as clearVideosSimple but returns instead of redirecting — for client components */
export async function clearVideosSimpleAction(): Promise<{ ok: boolean }> {
  try {
    await clearChannel("simple", false);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function clearVideosAdvanced() {
  await clearChannel("advanced", true);
  redirect("/dashboard/videos/advanced?ok=1");
}

/** Same as clearVideosAdvanced but returns instead of redirecting — for client components */
export async function clearVideosAdvancedAction(): Promise<{ ok: boolean }> {
  try {
    await clearChannel("advanced", false);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Supprime des vidéos précises (grille des rendus : bouton corbeille ou
 *  sélection). Mêmes garde-fous que « Vider » : rôle autorisé, et seulement
 *  des noms de fichier nus du bon canal (aucun chemin). */
export async function deleteVideoFilesAction(channel: "simple" | "advanced", names: string[]): Promise<{ ok: boolean; deleted: number }> {
  try {
    if (!(await canDeleteOutputs())) return { ok: false, deleted: 0 };
    const prefix = videoPrefix(channel);
    const wanted = new Set(
      (Array.isArray(names) ? names : []).map((n) => String(n)).filter((n) => n === path.basename(n) && n.startsWith(prefix)).slice(0, 500),
    );
    if (!wanted.size) return { ok: true, deleted: 0 };
    let deleted = 0;
    for (const { dir, userId } of await getOutDirsForListing()) {
      for (const n of wanted) {
        try { await fs.unlink(path.join(dir, n)); deleted++; } catch { /* pas dans ce dossier */ }
      }
      try { await createAdminClient().storage.from(OUTPUT_BUCKET).remove([...wanted].map((n) => `${userId}/${n}`)); } catch { /* sans Storage */ }
    }
    return { ok: true, deleted };
  } catch {
    return { ok: false, deleted: 0 };
  }
}

/* ------------------ Listing par canal ------------------ */

/** Rendus d'un canal, du PLUS RÉCENT au plus ancien (date du fichier), tous
 *  dossiers confondus (vue admin = plusieurs créateurs). Sans tri, readdir
 *  rendait l'ordre alphabétique : un nouveau lot arrivait au milieu ou en bas. */
async function listChannel(channel: "simple" | "advanced"): Promise<string[]> {
  const lists = await Promise.all((await getOutDirsForListing()).map(async ({ dir, userId }) => {
    const fsNames = filterFinals(await fs.readdir(dir).catch(() => [])).filter((n) =>
      n.startsWith(videoPrefix(channel))
    );
    const dated = async (names: string[]) => Promise.all(names.map(async (n) => ({
      url: `/api/out/${userId}/${encodeURIComponent(path.basename(n))}`,
      t: (await fs.stat(path.join(dir, n)).catch(() => null))?.mtimeMs ?? 0,
    })));
    // When a persistent volume is mounted, serve files via authenticated API route
    if (process.env.OUT_BASE && fsNames.length > 0) return dated(fsNames);
    // Fallback: Supabase Storage (no persistent volume) — déjà rendu du plus
    // récent au plus ancien ; on garde cet ordre.
    const storageUrls = await listFromStorage(userId, videoPrefix(channel));
    if (storageUrls.length > 0) return storageUrls.map((url, i) => ({ url, t: Date.now() - i }));
    return dated(fsNames);
  }));
  return lists.flat().sort((a, b) => b.t - a.t).map((x) => x.url);
}

export async function listOutVideosSimple(): Promise<string[]> {
  return listChannel("simple");
}

export async function listOutVideosAdvanced(): Promise<string[]> {
  return listChannel("advanced");
}
