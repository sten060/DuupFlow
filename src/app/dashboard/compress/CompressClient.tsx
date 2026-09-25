"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { saveSettings, loadSettings } from "@/lib/formMemory";
import { listCompressed, type CompressedFile } from "./actions";
import { COMPRESS_MAX_FILES, COMPRESS_MAX_TOTAL_BYTES, formatBytes } from "@/lib/compress-limits";
import ClearCompressedButton from "./ClearCompressedButton";
import DriveImportButton from "../components/DriveImportButton";
import DriveSaveButton from "../components/DriveSaveButton";
import DocsDrawer from "../components/DocsDrawer";
import { buildCompressDocs } from "../components/docs-content";

// Batch limits (30 files, 10 GB) — re-checked server-side by /api/compress-sse.
const MAX_FILES = COMPRESS_MAX_FILES;
const MAX_TOTAL_BYTES = COMPRESS_MAX_TOTAL_BYTES;
// Above this total, "download all" skips the in-browser ZIP (which holds every
// file in the tab's memory and crashes it on multi-GB batches) and downloads the
// files one by one instead.
const ZIP_MAX_BYTES = 300 * 1024 * 1024;
// The compression keeps running server-side when the connection drops; the
// client re-attaches by jobId (live retries, then on the next page load).
const RESUME_KEY = "duup_active_compress_job";
const RESUME_MAX_AGE_MS = 60 * 60 * 1000;
const MAX_RECONNECTS = 5;

function saveResume(jobId: string) {
  try { localStorage.setItem(RESUME_KEY, JSON.stringify({ jobId, startedAt: Date.now() })); } catch {}
}
function clearResume() {
  try { localStorage.removeItem(RESUME_KEY); } catch {}
}
function loadResume(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(RESUME_KEY) || "null");
    if (v?.jobId && Date.now() - v.startedAt < RESUME_MAX_AGE_MS) return String(v.jobId);
  } catch {}
  clearResume();
  return null;
}
const IMAGE_RE = /\.(png|jpe?g|webp|heic|heif)$/i;
const VIDEO_RE = /\.(mp4|mov|mkv|avi|webm)$/i;

type Level = "light" | "balanced" | "strong";

type ReadyFile = CompressedFile & { savedPercent?: number; srcBytes?: number; outBytes?: number };


export default function CompressClient({ initialFiles }: { initialFiles: CompressedFile[] }) {
  const { t, locale } = useTranslation();
  const fmtBytes = useCallback((n?: number) => (n && n > 0 ? formatBytes(n, locale) : "—"), [locale]);
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<Level>(() => {
    const s = loadSettings<{ level?: Level }>("compress");
    return s?.level ?? "balanced";
  });
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // One line per failed file (several videos can fail for different reasons).
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);
  // Files refused because the batch would exceed MAX_TOTAL_BYTES.
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  const [persistedFiles, setPersistedFiles] = useState<ReadyFile[]>(() => initialFiles);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);

  /* ---------- file ingest ---------- */
  const ingestFiles = useCallback((incoming: File[]) => {
    const accepted = incoming.filter((f) => IMAGE_RE.test(f.name) || VIDEO_RE.test(f.name) || f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!accepted.length) return;
    // Add files one by one while the batch stays under MAX_TOTAL_BYTES; a file
    // that would overflow it is refused (the others are kept, smaller files
    // after it can still fit).
    const current = files.reduce((s, f) => s + f.size, 0);
    let used = current;
    const kept: File[] = [];
    const refused: string[] = [];
    for (const f of accepted) {
      if (used + f.size > MAX_TOTAL_BYTES) { refused.push(f.name); continue; }
      kept.push(f);
      used += f.size;
    }
    setLimitMsg(refused.length
      ? t("compress.errors.batchTooHeavy", {
          names: refused.map((n) => (locale === "fr" ? `« ${n} »` : `"${n}"`)).join(", "),
          max: fmtBytes(MAX_TOTAL_BYTES),
          left: formatBytes(Math.max(0, MAX_TOTAL_BYTES - used), locale),
        })
      : null);
    if (kept.length) setFiles((prev) => [...prev, ...kept].slice(0, MAX_FILES));
  }, [files, t, locale, fmtBytes]);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (picked.length) ingestFiles(picked);
  }, [ingestFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length) ingestFiles(dropped);
  }, [ingestFiles]);

  const removeAt = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setLimitMsg(null);
  }, []);

  const totalSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  // Preview thumbnails: create one object URL per previewable file, and revoke
  // them when the file set changes / on unmount (avoids leaking blob URLs).
  const previews = useMemo(
    () =>
      files.map((f) => {
        const isVid = VIDEO_RE.test(f.name) || f.type.startsWith("video/");
        const isImg = !isVid && (IMAGE_RE.test(f.name) || f.type.startsWith("image/"));
        const canPreview = (isImg && !/\.(heic|heif)$/i.test(f.name)) || isVid;
        return { isVid, isImg, url: canPreview ? URL.createObjectURL(f) : null as string | null };
      }),
    [files],
  );
  useEffect(() => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previews]);

  /* ---------- selection / download ---------- */
  const toggleSelected = useCallback((url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }, []);

  const allSelected = persistedFiles.length > 0 && selectedUrls.size === persistedFiles.length;
  const toggleSelectAll = useCallback(() => {
    setSelectedUrls((prev) => (prev.size === persistedFiles.length ? new Set() : new Set(persistedFiles.map((f) => f.url))));
  }, [persistedFiles]);

  // Heavy batches: one native download per file (streamed to disk by the browser,
  // nothing held in the tab's memory). Spaced out so browsers don't drop some.
  async function downloadOneByOne(list: ReadyFile[]) {
    for (let i = 0; i < list.length; i++) {
      setDownloadMsg(t("compress.downloadingOneByOne", { done: String(i + 1), total: String(list.length) }));
      const a = document.createElement("a");
      a.href = list[i].url;
      a.download = list[i].name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 800));
    }
    setDownloadMsg(null);
  }

  function downloadFiles(list: ReadyFile[], zipName: string) {
    if (list.length === 1) return downloadOneByOne(list);
    // Unknown size counts as heavy — better a few separate downloads than a crashed tab.
    const heavy = list.some((f) => typeof f.outBytes !== "number")
      || list.reduce((s, f) => s + (f.outBytes ?? 0), 0) > ZIP_MAX_BYTES;
    return heavy ? downloadOneByOne(list) : downloadFilesAsZip(list, zipName);
  }

  async function downloadFilesAsZip(list: ReadyFile[], zipName: string) {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    await Promise.all(list.map(async ({ url, name }) => {
      const res = await fetch(url);
      zip.file(name, await res.arrayBuffer());
    }));
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleStop() {
    // The server job no longer dies with the connection → ask it to stop explicitly.
    const jobId = jobIdRef.current;
    if (jobId) {
      const f = new FormData();
      f.append("jobId", jobId);
      f.append("stop", "1");
      fetch("/api/compress-sse", { method: "POST", body: f }).catch(() => {});
    }
    abortRef.current?.abort("stopped");
    clearResume();
    setProcessing(false);
  }

  /* ---------- SSE stream ---------- */
  // Reads one SSE response to its end. Returns "done" (terminal event received),
  // "stale" (server no longer knows the job) or "dropped" (connection cut early).
  async function consumeStream(res: Response): Promise<"done" | "stale" | "dropped"> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let outcome: "done" | "stale" | "dropped" = "dropped";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.stale) { outcome = "stale"; continue; }
            const pct = evt.percent !== undefined ? 20 + Math.round(evt.percent * 0.8) : undefined;
            if (pct !== undefined) setProgress(pct);
            if (evt.msg && !evt.error) setProgressLabel(evt.msg);
            if (evt.fileReady) {
              setPersistedFiles((prev) =>
                prev.some((f) => f.url === evt.fileReady.url) ? prev : [evt.fileReady, ...prev],
              );
            }
            if (evt.error && !evt.done) {
              const line = evt.msg || t("compress.errors.processingFailed");
              // Replays after a reconnect re-send past events → de-duplicate.
              setFileErrors((prev) => (prev.includes(line) ? prev : [...prev, line]));
            }
            if (evt.error && evt.done) setErrorMsg(evt.msg || t("compress.errors.processingFailed"));
            if (evt.done) {
              outcome = "done";
              setProgress(100);
              setProgressLabel(evt.stopped ? t("compress.stopped") : t("compress.doneMsg"));
              setFiles([]);
            }
          } catch {}
        }
      }
    } catch {
      // network error mid-stream → treated as a drop
    }
    return outcome;
  }

  // Follows a running job until it ends: on a drop, re-attach by jobId (the
  // server replays every buffered event) a few times with backoff.
  async function followJob(jobId: string, first: Response | null, signal: AbortSignal) {
    let res = first;
    for (let attempt = 0; attempt <= MAX_RECONNECTS; attempt++) {
      if (signal.aborted) return;
      if (!res) {
        const f = new FormData();
        f.append("jobId", jobId);
        f.append("reconnectOnly", "1"); // never start a new (file-less) job
        res = await fetch("/api/compress-sse", { method: "POST", body: f, signal }).catch(() => null);
      }
      const outcome = res && res.ok && res.body ? await consumeStream(res) : "dropped";
      res = null;
      if (outcome === "done") { clearResume(); return; }
      if (outcome === "stale") {
        // Job finished (or server restarted) while we were away → reload the list.
        clearResume();
        const list = await listCompressed().catch(() => null);
        if (list) setPersistedFiles(list);
        setProgress(100);
        setProgressLabel(t("compress.doneMsg"));
        return;
      }
      if (signal.aborted) return;
      if (attempt < MAX_RECONNECTS) {
        setProgressLabel(t("compress.reconnecting", { attempt: String(attempt + 1), max: String(MAX_RECONNECTS) }));
        await new Promise((r) => setTimeout(r, Math.min(15_000, 2_000 * (attempt + 1))));
      }
    }
    // Still unreachable: the job keeps running server-side; the resume marker
    // stays so the next page load re-attaches.
    setErrorMsg(t("compress.errors.connectionLost"));
  }

  // On load: re-attach to a compression started before a reload / page leave.
  useEffect(() => {
    const jobId = loadResume();
    if (!jobId) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    jobIdRef.current = jobId;
    setProcessing(true);
    setProgress(20);
    setProgressLabel(t("compress.resuming"));
    followJob(jobId, null, ctrl.signal).finally(() => {
      if (!ctrl.signal.aborted) setProcessing(false);
    });
    return () => ctrl.abort("unmount");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- submit ---------- */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0 || processing) return;
    saveSettings("compress", { level });

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const jobId = crypto.randomUUID();
    jobIdRef.current = jobId;

    setProcessing(true);
    setErrorMsg(null);
    setFileErrors([]);
    setProgress(0);
    setProgressLabel(t("compress.preparing"));

    try {
      // ── 1. Upload each file SEQUENTIALLY (bounds peak RAM on the worker). ──
      const uploads: { uploadId: string; name: string }[] = [];
      let doneUploads = 0;
      // Live upload feedback (bytes sent / total, % and time left): on a
      // multi-GB batch the upload can take many minutes — without it the page
      // looked frozen on "Préparation…".
      const totalBytes = files.reduce((s, f) => s + f.size, 0) || 1;
      let doneBytes = 0;
      const upStart = Date.now();
      for (const file of files) {
        const res = await uploadWithProgress(
          `/api/upload-direct?fileName=${encodeURIComponent(file.name)}`,
          file,
          {
            signal: ctrl.signal,
            onProgress: (frac) => {
              const sent = doneBytes + frac * file.size;
              setProgress(Math.round((sent / totalBytes) * 20));
              const elapsed = (Date.now() - upStart) / 1000;
              const left = elapsed > 5 && sent > 0 ? Math.round((elapsed / sent) * (totalBytes - sent)) : null;
              setProgressLabel(t("compress.uploadingLive", {
                current: String(doneUploads + 1),
                total: String(files.length),
                sent: formatBytes(sent, locale),
                size: formatBytes(totalBytes, locale),
                percent: String(Math.floor((sent / totalBytes) * 100)),
              }) + (left !== null
                ? ` · ${t("compress.timeLeft", { time: left >= 60 ? `${Math.ceil(left / 60)} min` : `${Math.max(1, left)} s` })}`
                : ""));
            },
          },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          // 502/503/504 = Railway's proxy got no answer (server restarting or
          // overloaded) — show something a user can act on, not "HTTP 502".
          throw new Error(j?.error || ([502, 503, 504].includes(res.status)
            ? t("compress.errors.serverUnavailable", { name: file.name })
            : `HTTP ${res.status}`));
        }
        const { uploadId, name } = await res.json();
        doneUploads++;
        doneBytes += file.size;
        setProgress(Math.round((doneBytes / totalBytes) * 20));
        uploads.push({ uploadId, name: name ?? file.name });
      }

      // ── 2. POST to the SSE route. From here the job lives server-side. ──
      setProgress(20);
      setProgressLabel(t("compress.processing"));
      const apiForm = new FormData();
      apiForm.append("jobId", jobId);
      apiForm.append("level", level);
      for (const u of uploads) {
        apiForm.append("directUploadIds", u.uploadId);
        apiForm.append("fileNames", u.name);
      }

      saveResume(jobId);
      const res = await fetch("/api/compress-sse", { method: "POST", body: apiForm, signal: ctrl.signal }).catch((err) => {
        if (ctrl.signal.aborted) throw err;
        return null; // dropped before the first byte → followJob re-attaches
      });
      if (res && !res.ok) {
        clearResume();
        const text = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}`;
        try { msg = JSON.parse(text)?.error || msg; } catch { if (text) msg += `: ${text.slice(0, 120)}`; }
        setErrorMsg(msg);
        return;
      }

      // ── 3. Follow the job (auto-reconnect on drops). ──
      await followJob(jobId, res, ctrl.signal);
    } catch (err: any) {
      if (err?.name === "AbortError" || ctrl.signal.reason === "stopped") {
        // user stopped — nothing to show
      } else {
        setErrorMsg(err?.message || t("compress.errors.processingFailed"));
      }
    } finally {
      setProcessing(false);
    }
  }

  /* ---------- level cards ---------- */
  const LEVELS: { key: Level; label: string; hint: string }[] = [
    { key: "light", label: t("compress.levelLight"), hint: t("compress.levelLightHint") },
    { key: "balanced", label: t("compress.levelBalanced"), hint: t("compress.levelBalancedHint") },
    { key: "strong", label: t("compress.levelStrong"), hint: t("compress.levelStrongHint") },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("compress.title")}</h1>
          <p className="text-sm text-[var(--app-text-muted)] mt-1">{t("compress.subtitle")}</p>
        </div>
        <DocsDrawer docs={buildCompressDocs(t)} />
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source: local browse via the dropzone below, or import from Drive. */}
        <DriveImportButton onFiles={ingestFiles} onError={setErrorMsg} disabled={processing} />

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !processing && inputRef.current?.click()}
          className="group relative rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 transition
                     hover:border-emerald-500/30 cursor-pointer"
        >
          <div className="pointer-events-none select-none text-center py-4">
            <svg viewBox="0 0 24 24" className="mx-auto h-8 w-8 text-emerald-400/70 mb-2" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <p className="text-sm text-[var(--app-text-muted)]">{t("compress.dropzone", { max: String(MAX_FILES) })}</p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*,.heic,.heif,.mov,.mkv"
            multiple
            className="hidden"
            onChange={onPick}
          />

          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {files.map((f, i) => {
                const { isVid, url } = previews[i] ?? { isVid: false, url: null };
                return (
                  <div key={`${f.name}-${i}`} className="relative rounded-lg overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)]">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeAt(i); }}
                      className="absolute top-1 right-1 z-10 inline-flex items-center justify-center h-6 w-6 rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label={t("compress.removeFileAria")}
                    >
                      ×
                    </button>
                    {url && !isVid ? (
                      <img src={url} alt={f.name} className="aspect-video w-full object-cover" />
                    ) : url && isVid ? (
                      <video src={url} className="aspect-video w-full object-cover" muted />
                    ) : (
                      <div className="aspect-video w-full flex items-center justify-center bg-emerald-500/5 text-emerald-300/70 text-[10px] uppercase tracking-wider font-semibold">
                        {f.name.split(".").pop()}
                      </div>
                    )}
                    <div className="px-2 py-1 text-[11px] text-[var(--app-text)] truncate">{f.name}</div>
                    <div className="px-2 pb-1 text-[10px] text-[var(--app-text-faint)]">{fmtBytes(f.size)}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--app-text-muted)]">
            <span>{t("compress.filesCount", { count: String(files.length) })}</span>
          </div>
        </div>

        {/* Live weight gauge — fills as files are added, capped at MAX_TOTAL_BYTES. */}
        {(() => {
          const pct = Math.min(100, (totalSize / MAX_TOTAL_BYTES) * 100);
          const bar = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-gradient-to-r from-emerald-500 to-teal-500";
          return (
            <div className="-mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--app-text-muted)]">{t("compress.gaugeLabel")}</span>
                <span className="font-semibold tabular-nums text-[var(--app-text)]">
                  {formatBytes(totalSize, locale)} / {formatBytes(MAX_TOTAL_BYTES, locale)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--app-surface-2)] overflow-hidden">
                <div className={`h-2 rounded-full transition-all duration-300 ${bar}`} style={{ width: `${pct}%` }} />
              </div>
              {limitMsg && <p className="text-xs text-red-500">{limitMsg}</p>}
            </div>
          );
        })()}

        {/* Level selector */}
        <div>
          <label className="block text-sm font-medium text-[var(--app-text-muted)] mb-2">{t("compress.levelLabel")}</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {LEVELS.map((lv) => {
              const active = level === lv.key;
              return (
                <button
                  key={lv.key}
                  type="button"
                  onClick={() => setLevel(lv.key)}
                  className={[
                    "text-left rounded-xl px-3.5 py-3 border transition-all",
                    active
                      ? "border-emerald-400/40 bg-emerald-500/[0.07] shadow-[0_0_20px_rgba(16,185,129,.12)]"
                      : "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span className={["h-2 w-2 rounded-full", active ? "bg-emerald-400" : "bg-[var(--app-text-faint)]"].join(" ")} />
                    <span className={["text-sm font-semibold", active ? "text-[var(--app-text)]" : "text-[var(--app-text)]"].join(" ")}>{lv.label}</span>
                  </div>
                  <p className="text-xs text-[var(--app-text-faint)] mt-1">{lv.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-[var(--app-surface-2)]" />

        {/* Submit + Stop */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={processing || files.length === 0}
            className={[
              "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
              processing || files.length === 0
                ? "bg-[var(--app-surface-2)] text-[var(--app-text-muted)] cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-[0_4px_20px_rgba(16,185,129,.35)]",
            ].join(" ")}
          >
            {processing ? t("compress.compressing") : t("compress.compressButton")}
          </button>

          {processing && (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition"
            >
              {t("compress.stopButton")}
            </button>
          )}
        </div>

        {/* Progress */}
        {processing && (
          <div className="space-y-1">
            <div className="w-full bg-[var(--app-surface-2)] rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-[var(--app-text-muted)]">{progressLabel}</p>
            {progress >= 20 && progress < 100 && (
              <p className="text-xs text-emerald-300/80">{t("compress.backgroundHint")}</p>
            )}
          </div>
        )}

        {(errorMsg || fileErrors.length > 0) && (
          <div className="text-sm rounded-lg px-4 py-2 border border-red-500/30 bg-red-500/10 text-red-500 font-medium space-y-1">
            {fileErrors.map((m) => <p key={m}>{m}</p>)}
            {errorMsg && <p>{errorMsg}</p>}
          </div>
        )}
      </form>

      {/* Ready files — leave a right gap on wider screens so the download row and
          file list don't sit under the floating notif / chatbot buttons. */}
      {persistedFiles.length > 0 && (
        <div className="space-y-3 lg:mr-28 xl:mr-32">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[var(--app-text)] mr-auto">
              {t("compress.readyToDownload", { count: String(persistedFiles.length) })}
            </p>
            <ClearCompressedButton onCleared={() => { setPersistedFiles([]); setSelectedUrls(new Set()); }} />
            <DriveSaveButton
              files={selectedUrls.size > 0 ? persistedFiles.filter((f) => selectedUrls.has(f.url)) : persistedFiles}
              disabled={processing}
            />
            {selectedUrls.size > 0 && (
              <button
                type="button"
                onClick={() => downloadFiles(persistedFiles.filter((f) => selectedUrls.has(f.url)), "DuupFlow_compressed_selection.zip")}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition"
              >
                {t("common.downloadSelection", { count: String(selectedUrls.size) })}
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadFiles(persistedFiles, "DuupFlow_compressed.zip")}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition"
            >
              {t("compress.downloadAll")}
            </button>
          </div>

          {downloadMsg && <p className="text-xs text-emerald-300/80">{downloadMsg}</p>}

          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] divide-y divide-[var(--app-border)] max-h-96 overflow-y-auto">
            <label className="flex items-center gap-3 px-4 py-2 text-xs text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 accent-emerald-500" />
              <span>{allSelected ? t("common.deselectAll") : t("common.selectAll")}</span>
            </label>
            {persistedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={selectedUrls.has(f.url)}
                  onChange={() => toggleSelected(f.url)}
                  className="h-3.5 w-3.5 accent-emerald-500 shrink-0"
                  aria-label={f.name}
                />
                <span className="text-xs text-[var(--app-text-muted)] truncate flex-1">{f.name}</span>
                {typeof f.savedPercent === "number" && (
                  <span
                    className={[
                      "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded",
                      f.savedPercent > 0
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
                        : "bg-[var(--app-surface-2)] text-[var(--app-text-muted)] border border-[var(--app-border-strong)]",
                    ].join(" ")}
                    title={f.srcBytes ? `${fmtBytes(f.srcBytes)} → ${fmtBytes(f.outBytes)}` : undefined}
                  >
                    {f.savedPercent > 0 ? t("compress.savedBadge", { percent: String(f.savedPercent) }) : t("compress.alreadyOptimal")}
                  </span>
                )}
                <a
                  href={f.url}
                  download={f.name}
                  className="shrink-0 rounded-md px-3 py-1 text-xs font-medium bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-2)] text-[var(--app-text)] transition"
                >
                  {t("compress.downloadSingle")}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
