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

/* ── Résultats de duplication PAR CRÉATEUR (workspaces Pro & Agence) ──────────
   Le dossier de sortie suit le créateur AFFICHÉ (cookie duup_ws posé par le
   sélecteur, ou en-tête x-duup-ws), avec la même clé que l'Éditeur IA :
   « ws_<id> », ou le dossier historique du propriétaire pour le créateur
   principal. Vue admin (propriétaire, son écran par défaut) : on LIT tous les
   créateurs, on ÉCRIT dans l'espace admin. Sans workspaces : dossier de l'utilisateur,
   exactement comme avant. Les quotas, eux, restent toujours sur la personne. */

type OutKeys = { realUserId: string; write: string; read: string[] };

async function resolveOutKeys(): Promise<OutKeys> {
  const userId = await resolveUserId();
  if (userId === "local") return { realUserId: userId, write: userId, read: [userId] };
  try {
    const [{ getWorkspaceContext }, scope, nh] = await Promise.all([
      import("@/lib/workspaces"),
      import("@/lib/ai-editor/scope"),
      import("next/headers"),
    ]);
    const ctx = await getWorkspaceContext(userId);
    if (!ctx.enabled) return { realUserId: userId, write: userId, read: [userId] };
    let wanted: string | null = null;
    try {
      wanted = scope.normalizeWsChoice(nh.headers().get("x-duup-ws") || nh.cookies().get(scope.WS_COOKIE)?.value);
    } catch { /* hors requête */ }
    const keyOf = (w: { id: string; isDefault: boolean }) => scope.workspaceStoreKey(w, ctx.ownerId);
    if (scope.isAdminChoice(ctx, wanted)) {
      const admin = scope.adminStoreKey(ctx.ownerId);
      const all = Array.from(new Set([admin, ...ctx.workspaces.map(keyOf), ctx.ownerId]));
      return { realUserId: userId, write: admin, read: all };
    }
    const ws = (wanted && wanted !== scope.ADMIN_VIEW ? ctx.workspaces.find((w) => w.id === wanted) : null) ?? ctx.active;
    const key = ws ? keyOf(ws) : `${userId}_noworkspace`;
    return { realUserId: userId, write: key, read: [key] };
  } catch {
    return { realUserId: userId, write: userId, read: [userId] };
  }
}

/** Dossier de sortie (garanti) du créateur affiché.
 *  ⚠️ `userId` = la CLÉ DU DOSSIER (sert aux URL /api/out/<clé>/…), pas
 *  forcément l'id de la personne — utiliser `realUserId` pour tout le reste. */
export async function getOutDirForCurrentUser() {
  const k = await resolveOutKeys();
  const userDir = path.join(OUT_BASE, k.write);
  await fs.mkdir(userDir, { recursive: true });
  return { dir: userDir, userId: k.write, realUserId: k.realUserId };
}

/** Alias RSC (pages/listings) */
export async function getOutDirForCurrentUserRSC() {
  return getOutDirForCurrentUser();
}

/** Tous les dossiers à LISTER : un seul, sauf en vue admin (tous les créateurs). */
export async function getOutDirsForListing(): Promise<{ dir: string; userId: string }[]> {
  const k = await resolveOutKeys();
  return k.read.map((key) => ({ dir: path.join(OUT_BASE, key), userId: key }));
}

/** Un VA produit et télécharge, mais ne supprime rien (règle des rôles) :
 *  false pour un VA, true pour tous les autres comptes. */
export async function canDeleteOutputs(): Promise<boolean> {
  try {
    const userId = await resolveUserId();
    if (userId === "local") return true;
    const { getWorkspaceContext } = await import("@/lib/workspaces");
    const ctx = await getWorkspaceContext(userId);
    return !(ctx.enabled && ctx.role === "va");
  } catch {
    return true;
  }
}

/** Tous les dossiers de sortie que cette personne peut lire (un seul calcul
 *  pour vérifier plusieurs fichiers d'un coup). */
export async function readableOutKeys(userId: string): Promise<Set<string>> {
  const keys = new Set([userId, `${userId}_noworkspace`]);
  try {
    const [{ getWorkspaceContext }, scope] = await Promise.all([import("@/lib/workspaces"), import("@/lib/ai-editor/scope")]);
    const ctx = await getWorkspaceContext(userId);
    if (!ctx.enabled) return keys;
    if (ctx.role === "owner") keys.add(scope.adminStoreKey(ctx.ownerId));
    for (const w of ctx.workspaces) keys.add(scope.workspaceStoreKey(w, ctx.ownerId));
  } catch { /* droits minimum */ }
  return keys;
}

/** Cette personne peut-elle lire le dossier de sortie <key> ? (route /api/out) */
export async function canReadOutKey(userId: string, key: string): Promise<boolean> {
  if (key === userId || key === `${userId}_noworkspace`) return true;
  return (await readableOutKeys(userId)).has(key);
}

/** Expose OUT_BASE so cleanup utilities can scan all user dirs */
export { OUT_BASE };

// Compressor outputs (CMP_ prefix) are kept at least 2 h, whatever retention the
// caller asks for — duplication routes clean with 1 h, and big compression
// batches (videos over 1 GB, slow uploads) need more time to be downloaded.
const COMPRESS_OUTPUT_MIN_MS = 2 * 60 * 60 * 1000;

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
                  const keepMs = f.name.startsWith("CMP_") ? Math.max(maxAgeMs, COMPRESS_OUTPUT_MIN_MS) : maxAgeMs;
                  if (now - stat.mtimeMs > keepMs) { await fs.unlink(fp); deleted++; }
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
