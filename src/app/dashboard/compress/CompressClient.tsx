"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { saveSettings, loadSettings } from "@/lib/formMemory";
import type { CompressedFile } from "./actions";
import ClearCompressedButton from "./ClearCompressedButton";
import DriveImportButton from "../components/DriveImportButton";
import DriveSaveButton from "../components/DriveSaveButton";

const MAX_FILES = 30;
const IMAGE_RE = /\.(png|jpe?g|webp|heic|heif)$/i;
const VIDEO_RE = /\.(mp4|mov|mkv|avi|webm)$/i;

type Level = "light" | "balanced" | "strong";

type ReadyFile = CompressedFile & { savedPercent?: number; srcBytes?: number; outBytes?: number };

function fmtBytes(n?: number): string {
  if (!n || n <= 0) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function CompressClient({ initialFiles }: { initialFiles: CompressedFile[] }) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<Level>(() => {
    const s = loadSettings<{ level?: Level }>("compress");
    return s?.level ?? "balanced";
  });
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [persistedFiles, setPersistedFiles] = useState<ReadyFile[]>(() => initialFiles);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ---------- file ingest ---------- */
  const ingestFiles = useCallback((incoming: File[]) => {
    const accepted = incoming.filter((f) => IMAGE_RE.test(f.name) || VIDEO_RE.test(f.name) || f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!accepted.length) return;
    setFiles((prev) => [...prev, ...accepted].slice(0, MAX_FILES));
  }, []);

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

  function handleStop() {
    abortRef.current?.abort("stopped");
    setProcessing(false);
  }

  /* ---------- submit ---------- */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0 || processing) return;
    saveSettings("compress", { level });

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const jobId = Math.random().toString(36).slice(2, 8);

    setProcessing(true);
    setErrorMsg(null);
    setProgress(0);
    setProgressLabel(t("compress.preparing"));

    try {
      // ── 1. Upload each file SEQUENTIALLY (bounds peak RAM on the worker). ──
      const uploads: { uploadId: string; name: string }[] = [];
      let doneUploads = 0;
      for (const file of files) {
        const res = await uploadWithProgress(
          `/api/upload-direct?fileName=${encodeURIComponent(file.name)}`,
          file,
          {
            signal: ctrl.signal,
            onProgress: (frac) => setProgress(Math.round(((doneUploads + frac) / files.length) * 20)),
          },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
        const { uploadId, name } = await res.json();
        doneUploads++;
        setProgress(Math.round((doneUploads / files.length) * 20));
        setProgressLabel(t("compress.uploadProgress", { done: String(doneUploads), total: String(files.length) }));
        uploads.push({ uploadId, name: name ?? file.name });
      }

      // ── 2. POST to the SSE route. ──
      setProgress(20);
      setProgressLabel(t("compress.processing"));
      const apiForm = new FormData();
      apiForm.append("jobId", jobId);
      apiForm.append("level", level);
      for (const u of uploads) {
        apiForm.append("directUploadIds", u.uploadId);
        apiForm.append("fileNames", u.name);
      }

      const res = await fetch("/api/compress-sse", { method: "POST", body: apiForm, signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}`;
        try { msg = JSON.parse(text)?.error || msg; } catch { if (text) msg += `: ${text.slice(0, 120)}`; }
        setErrorMsg(msg);
        return;
      }

      // ── 3. Read the SSE stream. ──
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let receivedDone = false;
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
            const pct = evt.percent !== undefined ? 20 + Math.round(evt.percent * 0.8) : undefined;
            if (pct !== undefined) setProgress(pct);
            if (evt.msg) setProgressLabel(evt.msg);
            if (evt.fileReady) {
              setPersistedFiles((prev) =>
                prev.some((f) => f.url === evt.fileReady.url) ? prev : [evt.fileReady, ...prev],
              );
            }
            if (evt.error && !evt.done) {
              setErrorMsg(`[CMP] ${evt.msg || t("compress.errors.processingFailed")}`);
            }
            if (evt.done) {
              receivedDone = true;
              setProgress(100);
              setProgressLabel(evt.stopped ? t("compress.stopped") : t("compress.doneMsg"));
              setFiles([]);
            }
          } catch {}
        }
      }
      if (!receivedDone) setErrorMsg(t("compress.errors.noResponse"));
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
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("compress.title")}</h1>
        <p className="text-sm text-white/50 mt-1">{t("compress.subtitle")}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source: local browse via the dropzone below, or import from Drive. */}
        <DriveImportButton onFiles={ingestFiles} onError={setErrorMsg} disabled={processing} />

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !processing && inputRef.current?.click()}
          className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition
                     hover:border-emerald-500/30 cursor-pointer"
        >
          <div className="pointer-events-none select-none text-center py-4">
            <svg viewBox="0 0 24 24" className="mx-auto h-8 w-8 text-emerald-400/70 mb-2" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <p className="text-sm text-white/70">{t("compress.dropzone", { max: String(MAX_FILES) })}</p>
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
                  <div key={`${f.name}-${i}`} className="relative rounded-lg overflow-hidden border border-white/10 bg-white/5">
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
                    <div className="px-2 py-1 text-[11px] text-white/80 truncate">{f.name}</div>
                    <div className="px-2 pb-1 text-[10px] text-white/40">{fmtBytes(f.size)}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/60">
            <span>{t("compress.filesCount", { count: String(files.length) })}</span>
            <span>•</span>
            <span>{fmtBytes(totalSize)}</span>
          </div>
        </div>

        {/* Level selector */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">{t("compress.levelLabel")}</label>
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
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span className={["h-2 w-2 rounded-full", active ? "bg-emerald-400" : "bg-white/20"].join(" ")} />
                    <span className={["text-sm font-semibold", active ? "text-white" : "text-white/80"].join(" ")}>{lv.label}</span>
                  </div>
                  <p className="text-xs text-white/45 mt-1">{lv.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Submit + Stop */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={processing || files.length === 0}
            className={[
              "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
              processing || files.length === 0
                ? "bg-white/10 text-white/50 cursor-not-allowed"
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
            <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-white/50">{progressLabel}</p>
          </div>
        )}

        {errorMsg && (
          <div className="text-sm rounded-lg px-4 py-2 bg-red-900/40 text-red-300">{errorMsg}</div>
        )}
      </form>

      {/* Ready files */}
      {persistedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white/80 mr-auto">
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
                onClick={() => downloadFilesAsZip(persistedFiles.filter((f) => selectedUrls.has(f.url)), "DuupFlow_compressed_selection.zip")}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition"
              >
                {t("common.downloadSelection", { count: String(selectedUrls.size) })}
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadFilesAsZip(persistedFiles, "DuupFlow_compressed.zip")}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition"
            >
              {t("compress.downloadAll")}
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 max-h-96 overflow-y-auto">
            <label className="flex items-center gap-3 px-4 py-2 text-xs text-white/60 hover:bg-white/[0.03] cursor-pointer">
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
                <span className="text-xs text-white/70 truncate flex-1">{f.name}</span>
                {typeof f.savedPercent === "number" && (
                  <span
                    className={[
                      "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded",
                      f.savedPercent > 0
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
                        : "bg-white/10 text-white/50 border border-white/15",
                    ].join(" ")}
                    title={f.srcBytes ? `${fmtBytes(f.srcBytes)} → ${fmtBytes(f.outBytes)}` : undefined}
                  >
                    {f.savedPercent > 0 ? t("compress.savedBadge", { percent: String(f.savedPercent) }) : t("compress.alreadyOptimal")}
                  </span>
                )}
                <a
                  href={f.url}
                  download={f.name}
                  className="shrink-0 rounded-md px-3 py-1 text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition"
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
