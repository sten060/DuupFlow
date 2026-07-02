"use client";

// Reusable Google Drive import via the Google Picker + `drive.file` scope.
//
// Why this design (see memory: duupflow-next-update):
//  • `drive.file` is per-file, NON-restricted → no months-long Google CASA
//    security audit, unlike `drive.readonly`.
//  • The Picker hands us only the files the user explicitly selects. We then
//    download their bytes client-side with the short-lived access token and
//    return plain File objects — so they flow straight into the SAME upload
//    pipeline the dropzone already uses (no server token storage, no refresh).
//
// Requires (public, shipped to the browser):
//   NEXT_PUBLIC_GOOGLE_CLIENT_ID   — OAuth Web client ID
//   NEXT_PUBLIC_GOOGLE_API_KEY     — API key restricted to Picker + Drive API

import { useCallback, useEffect, useRef, useState } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
// Project number — lets the Picker grant drive.file access to the picked files.
const APP_ID = CLIENT_ID.split("-")[0] || "";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

const MIME_TYPES = [
  "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/x-matroska", "video/webm", "video/x-msvideo",
].join(",");

type DriveDoc = { id: string; name: string; mimeType: string; sizeBytes?: number };

/** Thrown when the user dismisses the Google auth popup — a cancel, not a failure.
 *  Callers swallow it and reset silently instead of surfacing an error. */
class DriveCancelled extends Error {
  constructor() { super("cancelled"); this.name = "DriveCancelled"; }
}

/** Run async tasks with bounded concurrency (parallel, but capped). */
async function runPool<T>(items: T[], limit: number, task: (item: T, index: number) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await task(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/** Download one picked Drive file's bytes → a File object (drive.file grants this).
 *  Aborts if the download stalls (timeout scales with file size) so a single
 *  hung transfer can never freeze the whole import. */
async function downloadDriveFile(doc: DriveDoc, token: string): Promise<File> {
  const ctrl = new AbortController();
  const sizeMB = (doc.sizeBytes || 0) / (1024 * 1024);
  // 45 s base + ~2.5 s/MB, capped at 12 min. A 200 MB video → ~8 min budget.
  const timeoutMs = Math.min(12 * 60_000, Math.max(45_000, Math.round(45_000 + sizeMB * 2500)));
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal },
    );
    if (!res.ok) throw new Error(`Drive download failed (${res.status}) for "${doc.name}"`);
    const blob = await res.blob();
    return new File([blob], doc.name, { type: doc.mimeType || blob.type });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read a video's duration (seconds) straight from Drive's metadata — works for
 * ANY codec (incl. iPhone HEVC the browser can't decode), and WITHOUT downloading
 * the file. Returns null when Drive hasn't computed it (then we can't pre-check).
 */
async function fetchVideoDurationSec(fileId: string, token: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=videoMediaMetadata(durationMillis)`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const ms = Number(data?.videoMediaMetadata?.durationMillis);
    return Number.isFinite(ms) && ms > 0 ? ms / 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Upload one blob into the user's Drive via multipart files.create.
 * `drive.file` grants creating new files — and writing into a folder the user
 * selected via the Picker (parents=[folderId]). No extra scope/audit needed.
 */
async function uploadBlobToDrive(
  blob: Blob,
  name: string,
  token: string,
  folderId?: string,
): Promise<void> {
  const metadata: Record<string, unknown> = { name };
  if (folderId) metadata.parents = [folderId];
  const body = new FormData();
  body.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  body.append("file", blob);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body },
  );
  if (!res.ok) throw new Error(`Drive upload failed (${res.status}) for "${name}"`);
}

export function useDrivePicker() {
  const [loading, setLoading] = useState(false);
  const pickerLoaded = useRef(false);
  const gsiLoaded = useRef(false);
  const configured = Boolean(CLIENT_ID && API_KEY);

  // Pre-load the SDKs so the first click is snappy.
  useEffect(() => {
    if (!configured) return;
    loadScript("https://accounts.google.com/gsi/client").then(() => { gsiLoaded.current = true; }).catch(() => {});
    loadScript("https://apis.google.com/js/api.js")
      .then(() => new Promise<void>((r) => (window as any).gapi.load("picker", () => r())))
      .then(() => { pickerLoaded.current = true; })
      .catch(() => {});
  }, [configured]);

  const getToken = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) return reject(new Error("Google Identity not loaded"));
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp?.error) return reject(new Error(resp.error));
          resolve(resp.access_token as string);
        },
        // Fires when the consent popup is closed by the user or fails to open.
        // Without this the Promise would hang forever, leaving the button stuck
        // on "Ouverture de Drive…" until a page refresh. Treat it as a cancel.
        error_callback: () => reject(new DriveCancelled()),
      });
      client.requestAccessToken({ prompt: "" });
    });
  }, []);

  const openPicker = useCallback((token: string): Promise<DriveDoc[]> => {
    return new Promise((resolve, reject) => {
      const google = (window as any).google;
      const P = google?.picker;
      if (!P) return reject(new Error("Picker not loaded"));

      // Multiple views → tabs in the Picker's left nav. The visual theme stays
      // Google's, but WHAT is shown (recents, type filters, folders, shared) is ours.
      const GRID = P.DocsViewMode?.GRID;

      // Récents — last files the user touched, filtered to images + videos.
      const recent = new P.DocsView(P.ViewId.RECENTLY_PICKED).setMimeTypes(MIME_TYPES);
      // Images only / Vidéos only.
      const imagesView = new P.DocsView(P.ViewId.DOCS_IMAGES);
      const videosView = new P.DocsView(P.ViewId.DOCS_VIDEOS);
      if (GRID) { imagesView.setMode(GRID); videosView.setMode(GRID); }
      // Mon Drive — navigable par dossiers, fichiers de l'utilisateur.
      const myDrive = new P.DocsView(P.ViewId.DOCS)
        .setMimeTypes(MIME_TYPES)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setOwnedByMe(true);
      // Partagés avec moi.
      const shared = new P.DocsView(P.ViewId.DOCS)
        .setMimeTypes(MIME_TYPES)
        .setIncludeFolders(true)
        .setOwnedByMe(false);

      const picker = new P.PickerBuilder()
        .enableFeature(P.Feature.MULTISELECT_ENABLED)
        .setDeveloperKey(API_KEY)
        .setAppId(APP_ID)
        .setOAuthToken(token)
        .setLocale("fr")
        .setTitle("Choisir un fichier")
        .addView(recent)
        .addView(imagesView)
        .addView(videosView)
        .addView(myDrive)
        .addView(shared)
        .setCallback((data: any) => {
          const action = data[P.Response.ACTION];
          if (action === P.Action.PICKED) {
            const docs = (data[P.Response.DOCUMENTS] || []).map((d: any) => ({
              id: d[P.Document.ID],
              name: d[P.Document.NAME],
              mimeType: d[P.Document.MIME_TYPE],
              sizeBytes: Number(d[P.Document.SIZE_BYTES]) || undefined,
            }));
            resolve(docs);
          } else if (action === P.Action.CANCEL) {
            resolve([]);
          }
        })
        .build();
      picker.setVisible(true);
    });
  }, []);

  // Ensure both SDKs are ready even if the user clicked before pre-load finished.
  const ensureSDK = useCallback(async () => {
    if (!gsiLoaded.current) { await loadScript("https://accounts.google.com/gsi/client"); gsiLoaded.current = true; }
    if (!pickerLoaded.current) {
      await loadScript("https://apis.google.com/js/api.js");
      await new Promise<void>((r) => (window as any).gapi.load("picker", () => r()));
      pickerLoaded.current = true;
    }
  }, []);

  // Open the Picker in folder-selection mode → returns the chosen folder id
  // (or null if the user cancels). drive.file then lets us write into it.
  const pickFolder = useCallback((token: string): Promise<{ id: string; name: string } | null> => {
    return new Promise((resolve, reject) => {
      const google = (window as any).google;
      const P = google?.picker;
      if (!P) return reject(new Error("Picker not loaded"));
      const FOLDER_MIME = "application/vnd.google-apps.folder";
      // Mon Drive (dossiers) + Partagés avec moi → two tabs.
      const myFolders = new P.DocsView(P.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setMimeTypes(FOLDER_MIME)
        .setOwnedByMe(true);
      const sharedFolders = new P.DocsView(P.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setMimeTypes(FOLDER_MIME)
        .setOwnedByMe(false);
      const picker = new P.PickerBuilder()
        .setDeveloperKey(API_KEY)
        .setAppId(APP_ID)
        .setOAuthToken(token)
        .setLocale("fr")
        .setTitle("Choisir un dossier de destination")
        .setSelectableMimeTypes(FOLDER_MIME)
        .addView(myFolders)
        .addView(sharedFolders)
        .setCallback((data: any) => {
          const action = data[P.Response.ACTION];
          if (action === P.Action.PICKED) {
            const d = (data[P.Response.DOCUMENTS] || [])[0];
            resolve(d ? { id: d[P.Document.ID], name: d[P.Document.NAME] } : null);
          } else if (action === P.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    });
  }, []);

  /**
   * Full flow: get token → open Picker → download picked files as File objects.
   * onProgress(done, total) fires as each file finishes downloading.
   */
  const pickFromDrive = useCallback(
    async (
      onProgress?: (done: number, total: number) => void,
      opts?: { maxVideoSec?: number },
    ): Promise<{ files: File[]; failedNames: string[]; tooLongNames: string[] }> => {
      if (!configured) throw new Error("Google Drive non configuré (clé API / client ID manquant).");
      setLoading(true);
      try {
        await ensureSDK();
        let token: string;
        try {
          token = await getToken();
        } catch (e) {
          if (e instanceof DriveCancelled) return { files: [], failedNames: [], tooLongNames: [] };
          throw e;
        }
        const picked = await openPicker(token);
        if (picked.length === 0) return { files: [], failedNames: [], tooLongNames: [] };

        // Pre-flight duration gate: read each video's duration from Drive metadata
        // (works for HEVC) and drop the too-long ones BEFORE downloading.
        const tooLongNames: string[] = [];
        let docs = picked;
        if (opts?.maxVideoSec && opts.maxVideoSec > 0) {
          const checks = await Promise.all(
            picked.map(async (d) => {
              if (!(d.mimeType || "").startsWith("video/")) return { d, keep: true };
              const dur = await fetchVideoDurationSec(d.id, token);
              return { d, keep: dur === null || dur <= opts.maxVideoSec! };
            }),
          );
          docs = [];
          for (const c of checks) {
            if (c.keep) docs.push(c.d);
            else tooLongNames.push(c.d.name);
          }
        }
        if (docs.length === 0) return { files: [], failedNames: [], tooLongNames };

        // Adaptive concurrency: big files (videos) would thrash browser memory
        // if 4 download at once → cap to 2. Small files (images) stay at 4.
        const hasLarge = docs.some((d) => (d.sizeBytes || 0) > 25 * 1024 * 1024);
        const concurrency = hasLarge ? 2 : 4;
        const slots: (File | null)[] = new Array(docs.length).fill(null);
        const failedNames: string[] = [];
        let done = 0;
        onProgress?.(0, docs.length);
        await runPool(docs, concurrency, async (doc, idx) => {
          try {
            slots[idx] = await downloadDriveFile(doc, token);
          } catch (e) {
            // Download failed (timeout on a large file, network, etc.) — never
            // drop it silently: report the name back so the UI can warn.
            console.error("[drive] download failed:", (e as Error).message);
            failedNames.push(doc.name);
          }
          onProgress?.(++done, docs.length);
        });
        return { files: slots.filter(Boolean) as File[], failedNames, tooLongNames };
      } finally {
        setLoading(false);
      }
    },
    [configured, getToken, openPicker, ensureSDK],
  );

  /**
   * Save ready files (server URLs) into a Drive folder the user picks.
   * Fetches each file's bytes (same-origin, authed), then uploads to Drive.
   * Returns counts. Throws only if the user cancels folder selection.
   * onProgress(done, total) fires as each upload completes.
   */
  const saveToDrive = useCallback(
    async (
      items: { url: string; name: string }[],
      onProgress?: (done: number, total: number) => void,
    ): Promise<{ ok: number; failed: number; folderName: string }> => {
      if (!configured) throw new Error("Google Drive non configuré (clé API / client ID manquant).");
      if (items.length === 0) return { ok: 0, failed: 0, folderName: "" };
      setLoading(true);
      try {
        await ensureSDK();
        let token: string;
        try {
          token = await getToken();
        } catch (e) {
          if (e instanceof DriveCancelled) return { ok: 0, failed: 0, folderName: "" };
          throw e;
        }
        const folder = await pickFolder(token);
        if (!folder) return { ok: 0, failed: 0, folderName: "" }; // user cancelled

        let ok = 0;
        let failed = 0;
        let done = 0;
        onProgress?.(0, items.length);
        // Upload up to 3 files concurrently.
        await runPool(items, 3, async (it) => {
          try {
            const res = await fetch(it.url);
            if (!res.ok) throw new Error(`fetch ${res.status}`);
            const blob = await res.blob();
            await uploadBlobToDrive(blob, it.name, token, folder.id);
            ok++;
          } catch (e) {
            console.error("[drive] upload failed:", (e as Error).message);
            failed++;
          }
          onProgress?.(++done, items.length);
        });
        return { ok, failed, folderName: folder.name };
      } finally {
        setLoading(false);
      }
    },
    [configured, getToken, pickFolder, ensureSDK],
  );

  return { pickFromDrive, saveToDrive, loading, configured };
}
