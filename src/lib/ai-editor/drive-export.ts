// src/lib/ai-editor/drive-export.ts
//
// EXPORT DES VARIANTES VERS GOOGLE DRIVE — serveur → Drive du propriétaire.
//
// Toutes les variantes partent dans UN dossier : « DuupFlow variantes », créé
// automatiquement dans le Drive du propriétaire du compte quand il a cliqué
// « Connecter Google Drive » (google-drive-oauth.ts). Aucune répartition ici :
// c'est Claude qui trie ensuite avec son propre connecteur Drive, grâce aux ids
// Drive renvoyés par le ticket. Le nom de chaque fichier commence par le
// créateur (« Léa — … ») pour que le tri soit évident.
//
// Même modèle que les rendus (render-jobs.ts) : l'export tourne en tâche de
// fond, export_to_drive renvoie un ticket (« dx_… »), get_drive_export le suit.
// Registre en mémoire (mono-réplica, comme les rendus) — gardé 2 h.
//
// Envoi « resumable » par blocs de 16 Mo avec reprise : une coupure réseau sur
// une grosse vidéo ne fait pas tout recommencer.

import fs from "fs/promises";
import path from "path";
import { getProject, projectPaths } from "./store";
import { cleanFileName } from "./file-name";
import { ownerDriveAccess, ownerDriveToken, ensureCreatorFolder, driveFolderUrl, DriveNotConnectedError, DRIVE_FOLDER_NAME } from "@/lib/google-drive-oauth";

function explainDriveError(status: number, body: string): string {
  if (/storageQuotaExceeded|quotaExceeded/i.test(body)) return "Le Google Drive du compte est plein : libère de l'espace puis relance l'export.";
  if (status === 401 || status === 403) return "Google Drive refuse l'accès : reconnecte Google Drive dans DuupFlow → Paramètres.";
  if (status === 404) return `Le dossier « ${DRIVE_FOLDER_NAME} » est introuvable : relance l'export, il sera recréé.`;
  if (status === 429) return "Google Drive limite le débit pour l'instant : réessaie dans une minute.";
  return `Erreur Google Drive (${status}) : ${body.slice(0, 200)}`;
}

const CHUNK = 16 * 1024 * 1024; // multiple de 256 Kio (exigence Drive)
const JOB_TTL_MS = 2 * 60 * 60 * 1000;

export type ExportedFile = {
  variantId: string;
  name: string;
  status: "pending" | "uploading" | "done" | "failed";
  driveFileId?: string;
  webViewLink?: string;
  error?: string;
};

export type DriveExportJob = {
  id: string;
  storeKey: string;
  ownerId: string;
  userId: string;
  projectId: string;
  creator: string | null;
  /** Le créateur (workspace) : ses exports vont dans « <Créateur> — DuupFlow ». */
  workspace: { id: string; name: string } | null;
  folderId: string;
  folderName: string;
  status: "running" | "done" | "failed";
  files: ExportedFile[];
  startedAt: number;
  finishedAt?: number;
  error?: string;
};

// globalThis : survit au rechargement à chaud en dev (sinon les tickets se perdent).
const g = globalThis as unknown as { __duupDriveExports?: Map<string, DriveExportJob> };
const JOBS = (g.__duupDriveExports ??= new Map());

function sweep() {
  const now = Date.now();
  for (const [id, j] of JOBS) if (j.finishedAt && now - j.finishedAt > JOB_TTL_MS) JOBS.delete(id);
}

export function getDriveExport(id: string): DriveExportJob | null {
  sweep();
  return JOBS.get(id) ?? null;
}

export function driveExportsFor(storeKey: string): DriveExportJob[] {
  sweep();
  return [...JOBS.values()].filter((j) => j.storeKey === storeKey).sort((a, b) => b.startedAt - a.startedAt);
}

/** Lance l'export en tâche de fond et renvoie le ticket tout de suite. */
export async function startDriveExport(opts: {
  storeKey: string;
  /** Propriétaire du compte : c'est SON Drive qui reçoit les fichiers. */
  ownerId: string;
  userId: string;
  projectId: string;
  variantIds: string[];
  creator: string | null;
  workspace: { id: string; name: string } | null;
}): Promise<DriveExportJob | { error: string }> {
  // Connexion + dossier vérifiés AVANT de lancer : message clair tout de suite.
  let folderId: string;
  let folderName: string;
  try {
    const dest = await destinationFolder(opts.ownerId, opts.workspace);
    folderId = dest.folderId;
    folderName = dest.folderName;
  } catch (e) {
    return { error: (e as Error).message };
  }
  const project = await getProject(opts.storeKey, opts.projectId);
  if (!project) return { error: "Projet introuvable." };

  const wanted = opts.variantIds.length ? opts.variantIds : project.variants.map((v) => v.id);
  const unknown = wanted.filter((id) => !project.variants.some((v) => v.id === id));
  if (unknown.length) return { error: `Variante(s) introuvable(s) dans ce projet : ${unknown.join(", ")}. Appelle list_variants pour les ids exacts.` };
  if (!wanted.length) return { error: "Aucune variante à exporter dans ce projet." };

  // Nom = celui affiché dans la galerie / au téléchargement (même règle).
  const usedNames = new Set<string>();
  const files: ExportedFile[] = wanted.map((variantId) => {
    const idx = project.variants.findIndex((v) => v.id === variantId);
    const v = project.variants[idx];
    let base = cleanFileName(v.label || "") || `variante-${idx + 1}`;
    let n = 2;
    while (usedNames.has(base)) base = `${cleanFileName(v.label || "") || `variante-${idx + 1}`} (${n++})`;
    usedNames.add(base);
    // Dans le dossier du créateur, le nom de la variante suffit ; dans le dossier
    // général, on préfixe le créateur pour que le tri reste évident.
    const prefix = opts.creator && !opts.workspace ? `${cleanFileName(opts.creator)} — ` : "";
    return { variantId, name: `${prefix}${base}.mp4`, status: "pending" };
  });

  const job: DriveExportJob = {
    id: `dx_${Math.random().toString(36).slice(2, 10)}`,
    storeKey: opts.storeKey,
    ownerId: opts.ownerId,
    userId: opts.userId,
    projectId: opts.projectId,
    creator: opts.creator,
    workspace: opts.workspace,
    folderId,
    folderName,
    status: "running",
    files,
    startedAt: Date.now(),
  };
  JOBS.set(job.id, job);

  void runExport(job).catch((e) => {
    job.status = "failed";
    job.error = (e as Error)?.message ?? "Export interrompu.";
    job.finishedAt = Date.now();
    console.error(`[drive-export] ${job.id} échec dur`, e);
  });
  return job;
}

async function runExport(job: DriveExportJob): Promise<void> {
  const dir = projectPaths(job.storeKey, job.projectId).variantsDir;
  const project = await getProject(job.storeKey, job.projectId);
  for (const f of job.files) {
    f.status = "uploading";
    try {
      const v = project?.variants.find((x) => x.id === f.variantId);
      if (!v) throw new Error("Variante disparue du projet.");
      const filePath = path.join(dir, v.storedName);
      if (!filePath.startsWith(dir)) throw new Error("Chemin invalide.");
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) throw new Error("Fichier expiré (les variantes rendues sont effacées après un délai) : relance le rendu puis l'export.");
      // Jeton redemandé à chaque fichier : un long export dépasse l'heure de validité.
      const access = await destinationFolder(job.ownerId, job.workspace);
      job.folderId = access.folderId; // recréé si supprimé entre-temps
      job.folderName = access.folderName;
      const out = await uploadResumable(access.token, filePath, stat.size, {
        name: f.name,
        parents: [job.folderId],
        mimeType: "video/mp4",
        description: `DuupFlow${job.creator ? ` · créateur « ${job.creator} »` : ""} · variante ${f.variantId}`,
        appProperties: { duupflowVariantId: f.variantId, ...(job.creator ? { duupflowCreator: job.creator.slice(0, 100) } : {}) },
      });
      f.driveFileId = out.id;
      f.webViewLink = out.webViewLink;
      f.status = "done";
      console.log(`[drive-export] ${job.id} · ${f.name} → ${out.id}`);
    } catch (e) {
      f.status = "failed";
      f.error = (e as Error)?.message ?? "Envoi échoué.";
      console.error(`[drive-export] ${job.id} · ${f.name} échoué :`, f.error);
      // Configuration / quota : inutile d'essayer les fichiers suivants.
      if (e instanceof DriveNotConnectedError || /Drive du compte est plein|reconnecte Google Drive/i.test(f.error)) {
        for (const rest of job.files) if (rest.status === "pending") { rest.status = "failed"; rest.error = f.error; }
        break;
      }
    }
  }
  // Au moins un fichier envoyé = export « terminé » (les échecs restent détaillés
  // fichier par fichier) ; aucun = échec, avec la première cause.
  job.status = job.files.some((f) => f.status === "done") ? "done" : "failed";
  if (job.status === "failed") job.error = job.files.find((f) => f.error)?.error;
  job.finishedAt = Date.now();
}

/** Envoi « resumable » Drive, par blocs, avec reprise sur coupure. */
async function uploadResumable(
  token: string,
  filePath: string,
  size: number,
  meta: Record<string, unknown>,
): Promise<{ id: string; webViewLink?: string }> {
  const init = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify(meta),
    },
  );
  if (!init.ok) throw new Error(explainDriveError(init.status, await init.text().catch(() => "")));
  const session = init.headers.get("location");
  if (!session) throw new Error("Google Drive n'a pas ouvert de session d'envoi.");

  const fh = await fs.open(filePath, "r");
  try {
    let offset = 0;
    let retries = 0;
    while (offset < size) {
      const len = Math.min(CHUNK, size - offset);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, offset);
      let res: Response;
      try {
        res = await fetch(session, {
          method: "PUT",
          headers: { "Content-Length": String(len), "Content-Range": `bytes ${offset}-${offset + len - 1}/${size}` },
          body: buf,
        });
      } catch (e) {
        if (++retries > 4) throw new Error(`Connexion à Google Drive perdue : ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 1500 * retries));
        offset = await resumeOffset(session, size, offset);
        continue;
      }
      if (res.status === 308) {
        // Bloc accepté : Drive dit jusqu'où il a reçu (Range: bytes=0-N).
        const range = res.headers.get("range");
        offset = range ? Number(range.split("-")[1]) + 1 : offset + len;
        retries = 0;
        continue;
      }
      if (res.ok) return (await res.json()) as { id: string; webViewLink?: string };
      if (res.status >= 500 && ++retries <= 4) {
        await new Promise((r) => setTimeout(r, 1500 * retries));
        offset = await resumeOffset(session, size, offset);
        continue;
      }
      throw new Error(explainDriveError(res.status, await res.text().catch(() => "")));
    }
    // Taille 0 ou dernier bloc sans corps de réponse : on interroge la session.
    const fin = await fetch(session, { method: "PUT", headers: { "Content-Range": `bytes */${size}` } });
    if (fin.ok) return (await fin.json()) as { id: string; webViewLink?: string };
    throw new Error(explainDriveError(fin.status, await fin.text().catch(() => "")));
  } finally {
    await fh.close();
  }
}

/** Après une coupure : demande à Drive combien d'octets il a vraiment reçus. */
async function resumeOffset(session: string, size: number, fallback: number): Promise<number> {
  try {
    const res = await fetch(session, { method: "PUT", headers: { "Content-Range": `bytes */${size}` } });
    if (res.status === 308) {
      const range = res.headers.get("range");
      return range ? Number(range.split("-")[1]) + 1 : 0;
    }
  } catch { /* on repart de la dernière position connue */ }
  return fallback;
}

/** Résumé lisible d'un ticket, pour Claude. */
export function describeDriveExport(job: DriveExportJob): string {
  const done = job.files.filter((f) => f.status === "done");
  const icon = (f: ExportedFile) => (f.status === "done" ? "✅" : f.status === "failed" ? "❌" : f.status === "uploading" ? "⏫" : "⏸");
  const lines = job.files.map((f) =>
    `  ${icon(f)} ${f.name}` +
    (f.driveFileId ? ` — driveFileId: ${f.driveFileId}${f.webViewLink ? ` (${f.webViewLink})` : ""}` : "") +
    (f.error ? ` — ${f.error}` : ""),
  );
  const head =
    job.status === "running"
      ? `EXPORT ${job.id} EN COURS — ${done.length}/${job.files.length} fichier(s) envoyé(s). Rappelle get_drive_export avec ce ticket dans quelques secondes.`
      : job.status === "done"
        ? `EXPORT ${job.id} TERMINÉ — ${done.length}/${job.files.length} fichier(s) dans « ${job.folderName} » (dossier ${job.folderId} — ${driveFolderUrl(job.folderId)}).`
        : `EXPORT ${job.id} ÉCHOUÉ — ${job.error ?? "voir le détail"}`;
  const tail = done.length
    ? `\n\nLes fichiers sont dans le dossier Drive du créateur. Pour les ranger ailleurs, déplace-les avec ton connecteur Google Drive en utilisant les driveFileId ci-dessus (dossier source « ${job.folderName} », id ${job.folderId}).`
    : "";
  return `${head}\n${lines.join("\n")}${tail}`;
}


/** Où va l'export : le dossier du créateur, ou le dossier général (comptes sans créateurs). */
async function destinationFolder(ownerId: string, workspace: { id: string; name: string } | null): Promise<{ token: string; folderId: string; folderName: string }> {
  if (workspace) {
    const { token } = await ownerDriveToken(ownerId);
    return ensureCreatorFolder(ownerId, workspace, token);
  }
  const a = await ownerDriveAccess(ownerId);
  return { token: a.token, folderId: a.folderId, folderName: DRIVE_FOLDER_NAME };
}
