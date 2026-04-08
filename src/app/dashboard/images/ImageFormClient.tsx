"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import ToggleChip from "../ToggleChip";
import { setJob, addCompletedFile, removeJob, stopJob } from "../videos/jobStore";
import ClearImagesButton from "./ClearImagesButton";
import { useTranslation } from "@/lib/i18n/context";

const MAX_FILES = 50;

// Compress image client-side before upload: PNG/large → JPEG ≤3000px.
// Reduces a 15MB PNG to ~300KB — 50× smaller upload, instant processing.
function compressForUpload(file: File): Promise<File> {
  const MAX_DIM = 3000;
  const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
  const isLarge = file.size > 1.5 * 1024 * 1024; // >1.5 MB
  if (!isPng && !isLarge) return Promise.resolve(file);

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const name = file.name.replace(/\.[^.]+$/, ".jpeg");
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

type Props = {
  initialImages: string[];
};

export default function ImageFormClient({ initialImages }: Props) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Persisted download list: initialized from server files, grows as new jobs complete.
  // Survives job cleanup and page navigation (server re-populates via initialImages).
  const [persistedFiles, setPersistedFiles] = useState<{ url: string; name: string }[]>(
    () => initialImages.map((url) => ({
      url,
      name: decodeURIComponent(url.split("/").pop() ?? url),
    }))
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);


  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setFiles((prev) =>
      [...prev, ...picked].filter((f) => f.type.startsWith("image/")).slice(0, MAX_FILES)
    );
    e.target.value = "";
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    if (!dropped.length) return;
    setFiles((prev) =>
      [...prev, ...dropped].filter((f) => f.type.startsWith("image/")).slice(0, MAX_FILES)
    );
  }, []);

  const removeAt = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const totalSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  function handleStop() {
    if (activeJobId) stopJob(activeJobId);
    abortRef.current?.abort("stopped");
    setProcessing(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0) return;

    const formData = new FormData(e.currentTarget);
    const count = Math.max(1, parseInt(String(formData.get("count") ?? "1"), 10));
    const fundamentals = formData.has("fundamentals");
    const visuals = formData.has("visuals");
    const semi = formData.has("semi");
    const reverse = formData.has("reverse");
    const iphoneMeta = formData.get("iphoneMeta") === "1";
    const country = (formData.get("country") as string) || "";

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const jobId = Math.random().toString(36).slice(2, 8);
    setActiveJobId(jobId);
    setJob({ id: jobId, type: "image", channel: "image", progress: 0, msg: t("dashboard.images.preparing"), status: "running", ctrl });

    setProcessing(true);
    setErrorMsg(null);
    setProgress(0);
    setProgressLabel(t("dashboard.images.compressing", { count: String(imageFiles.length) }));

    try {
      // ── 1. Compress + upload all images in parallel ──────────────────────
      let completedUploads = 0;
      const directUploadIds = await Promise.all(
        imageFiles.map(async (file) => {
          const compressed = await compressForUpload(file);
          const uploadRes = await fetch(
            `/api/upload-direct?fileName=${encodeURIComponent(compressed.name)}`,
            { method: "POST", body: compressed, signal: ctrl.signal },
          );
          if (!uploadRes.ok) {
            const j = await uploadRes.json().catch(() => ({}));
            throw new Error(j?.error || `[CLT-006] Erreur upload HTTP ${uploadRes.status}`);
          }
          const { uploadId } = await uploadRes.json();
          completedUploads++;
          setProgressLabel(t("dashboard.images.uploadProgress", { done: String(completedUploads), total: String(imageFiles.length) }));
          setProgress(Math.round((completedUploads / imageFiles.length) * 20));
          return uploadId as string;
        })
      );

      // ── 2. POST to SSE route ─────────────────────────────────────────────
      setProgress(20);
      setProgressLabel(t("dashboard.images.processingImages"));
      setJob({ id: jobId, type: "image", channel: "image", progress: 20, msg: t("dashboard.images.processingLabel"), status: "running" });

      const apiForm = new FormData();
      apiForm.append("count", String(count));
      if (fundamentals) apiForm.append("fundamentals", "1");
      if (visuals)      apiForm.append("visuals", "1");
      if (semi)         apiForm.append("semi", "1");
      if (reverse)      apiForm.append("reverse", "1");
      if (iphoneMeta)   apiForm.append("iphoneMeta", "1");
      if (country)      apiForm.append("country", country);
      for (const id of directUploadIds) apiForm.append("directUploadIds", id);
      for (const f of imageFiles)       apiForm.append("fileNames", f.name);

      const res = await fetch("/api/duplicate-image-sse", {
        method: "POST",
        body: apiForm,
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}`;
        try { const j = JSON.parse(text); msg = j?.error || msg; } catch { if (text) msg += `: ${text.slice(0, 120)}`; }
        const errMsg = `[IMG-002] ${msg}`;
        setErrorMsg(errMsg);
        setJob({ id: jobId, type: "image", channel: "image", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
        return;
      }

      // ── 3. Read SSE stream ───────────────────────────────────────────────
      const INACTIVITY_MS = 10 * 60 * 1000; // 10 min
      let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
      const resetInactivity = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => ctrl.abort("timeout"), INACTIVITY_MS);
      };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let receivedDone = false;

      resetInactivity();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          resetInactivity();
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              // Remap 0–100% server → 20–100% UI (0–20% was upload)
              const pct = evt.percent !== undefined ? 20 + Math.round(evt.percent * 0.8) : undefined;
              if (pct !== undefined) setProgress(pct);
              if (evt.msg) setProgressLabel(evt.msg);
              if (pct !== undefined || evt.msg) {
                setJob({ id: jobId, type: "image", channel: "image", progress: pct ?? 0, msg: evt.msg ?? "", status: "running" });
              }
              if (evt.fileReady) {
                addCompletedFile(jobId, evt.fileReady);
                setPersistedFiles((prev) =>
                  prev.some((f) => f.url === evt.fileReady.url)
                    ? prev
                    : [...prev, evt.fileReady]
                );
              }
              if (evt.error) {
                const errMsg = `[IMG-003] ${evt.msg || "Erreur traitement image"}`;
                setErrorMsg(errMsg);
                setJob({ id: jobId, type: "image", channel: "image", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
                return;
              }
              if (evt.done) {
                receivedDone = true;
                setJob({ id: jobId, type: "image", channel: "image", progress: 100, msg: t("dashboard.images.done"), status: "done" });
                setTimeout(() => removeJob(jobId), 8000);
                setFiles([]);
                return;
              }
            } catch {}
          }
        }
      } finally {
        if (inactivityTimer) clearTimeout(inactivityTimer);
      }

      if (!receivedDone) {
        const errMsg = "[CLT-004] Le serveur n'a pas répondu. Réessayez.";
        setErrorMsg(errMsg);
        setJob({ id: jobId, type: "image", channel: "image", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (ctrl.signal.reason === "timeout") {
          const errMsg = "[CLT-003] Délai dépassé — traitement trop long.";
          setErrorMsg(errMsg);
          setJob({ id: jobId, type: "image", channel: "image", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
        } else if (ctrl.signal.reason === "stopped") {
          // Stop button clicked — job already marked stopped by stopJob()
        } else {
          removeJob(jobId);
        }
      } else {
        const errMsg = `[CLT-005] Erreur réseau — ${err?.message || "connexion interrompue."}`;
        setErrorMsg(errMsg);
        setJob({ id: jobId, type: "image", channel: "image", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t("dashboard.images.title")}</h1>
      <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-6" autoComplete="off">
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !processing && inputRef.current?.click()}
          className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition
                     hover:border-fuchsia-500/30 cursor-pointer"
          aria-label="Zone de dépôt"
        >
          <div className="pointer-events-none select-none">
            <p className="text-sm text-white/70">
              {t("dashboard.images.dropzone", { max: String(MAX_FILES) })}
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            name="files"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPick}
          />

          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {files.map((f, i) => {
                const url = URL.createObjectURL(f);
                return (
                  <div key={`${f.name}-${i}`} className="relative rounded-lg overflow-hidden border border-white/10 bg-white/5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAt(i);
                        URL.revokeObjectURL(url);
                      }}
                      className="absolute top-1 right-1 z-10 inline-flex items-center justify-center h-6 w-6 rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="Supprimer"
                    >
                      ×
                    </button>
                    <img
                      src={url}
                      alt={f.name}
                      className="aspect-video w-full object-cover"
                      onLoad={() => URL.revokeObjectURL(url)}
                    />
                    <div className="px-2 py-1 text-[11px] text-white/80 truncate">{f.name}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/60">
            <span>{t("dashboard.images.filesCount", { count: String(files.length) })}</span>
            <span>•</span>
            <span>{t("dashboard.images.fileSize", { size: (totalSize / (1024 * 1024)).toFixed(2) })}</span>
          </div>
        </div>

        {/* Copies */}
        <div className="max-w-[200px]">
          <label className="block text-sm font-medium text-white/70 mb-1">{t("dashboard.images.copiesLabel")}</label>
          <input
            type="number"
            name="count"
            min={1}
            defaultValue={1}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/90"
          />
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Localisation + Priorité algorithme */}
        <div className="max-w-md">
          <label className="block text-sm font-medium text-white/70 mb-1.5">{t("dashboard.images.countryLabel")} <span className="text-white/30">{t("dashboard.images.countryOptional")}</span></label>
          <input
            type="text"
            name="country"
            placeholder={t("dashboard.images.countryPlaceholder")}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/25"
          />
        </div>

        {/* Priorité d'algorithme */}
        <ToggleChip name="iphoneMeta" value="1" label={`⚡ ${t("dashboard.images.iphoneMetaLabel")}`} hint={t("dashboard.images.iphoneMetaHint")} accent="pink" />

        <div className="h-px bg-white/[0.06]" />

        {/* Filtres */}
        <div>
          <h3 className="text-sm font-semibold text-white/90 mb-3">{t("dashboard.images.filtersTitle")} <span className="text-white/40 font-normal">{t("dashboard.images.filtersCumulative")}</span></h3>

          <p className="text-xs font-medium text-fuchsia-300/60 uppercase tracking-wide mb-2">{t("dashboard.images.noVisualChange")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
            <ToggleChip name="fundamentals" value="1" label={t("dashboard.images.fundamentalsLabel")} hint={t("dashboard.images.fundamentalsHint")} defaultChecked accent="pink" />
            <ToggleChip name="reverse" value="1" label={t("dashboard.images.reverseLabel")} hint={t("dashboard.images.reverseHint")} accent="pink" />
          </div>

          <p className="text-xs font-medium text-fuchsia-300/60 uppercase tracking-wide mb-2">{t("dashboard.images.withVisualChange")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <ToggleChip name="visuals" value="1" label={t("dashboard.images.visualsLabel")} hint={t("dashboard.images.visualsHint")} accent="pink" />
            <ToggleChip name="semi" value="1" label={t("dashboard.images.semiLabel")} hint={t("dashboard.images.semiHint")} defaultChecked accent="pink" />
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
                : "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white hover:shadow-[0_4px_20px_rgba(192,38,211,.35)]",
            ].join(" ")}
          >
            {processing ? t("dashboard.images.duplicating") : t("dashboard.images.duplicateButton")}
          </button>

          {processing && (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition"
            >
              {t("dashboard.images.stopButton")}
            </button>
          )}
        </div>

        {/* Progress bar */}
        {processing && (
          <div className="space-y-1">
            <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-white/50">{progressLabel}</p>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="text-sm rounded-lg px-4 py-2 bg-red-900/40 text-red-300">
            {errorMsg}
          </div>
        )}
      </form>

      {/* Ready files — shown as they arrive via SSE and persist across navigation */}
      {persistedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white/80 mr-auto">
              {t("dashboard.images.readyToDownload", { count: String(persistedFiles.length) })}
            </p>
            <ClearImagesButton onCleared={() => setPersistedFiles([])} />
            <button
              type="button"
              onClick={async () => {
                const JSZip = (await import("jszip")).default;
                const zip = new JSZip();
                await Promise.all(
                  persistedFiles.map(async ({ url, name }) => {
                    const res = await fetch(url);
                    const buf = await res.arrayBuffer();
                    zip.file(name, buf);
                  })
                );
                const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "DuupFlow_images.zip";
                a.click();
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-fuchsia-600 hover:bg-fuchsia-500 text-white transition"
            >
              {t("dashboard.images.downloadAll")}
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 max-h-80 overflow-y-auto">
            {persistedFiles.map(({ url, name }, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-xs text-white/70 truncate flex-1">{name}</span>
                <a
                  href={url}
                  download={name}
                  className="shrink-0 rounded-md px-3 py-1 text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition"
                >
                  {t("dashboard.images.downloadSingle")}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
