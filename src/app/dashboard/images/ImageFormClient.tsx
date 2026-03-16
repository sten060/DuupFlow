"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import ToggleChip from "../ToggleChip";

const MAX_FILES = 50;

// Trigger a browser file download from a blob
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Small delay before revoking so the download has time to start
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Extract filename from Content-Disposition header
function extractFilename(headers: Headers, fallback: string): string {
  const cd = headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

// Run `fn` on each item with at most `concurrency` in-flight at once.
async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  onItemDone: (done: number, total: number) => void
) {
  const total = items.length;
  let done = 0;
  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) return;
      await fn(item);
      done++;
      onItemDone(done, total);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
}

type Props = {
  initialImages: string[];
};

export default function ImageFormClient({ initialImages: _ }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [downloaded, setDownloaded] = useState<string[]>([]); // filenames downloaded this session
  const [done, setDone] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0) return;

    const formData = new FormData(e.currentTarget);
    const count = String(formData.get("count") ?? "1");
    const fundamentals = formData.has("fundamentals");
    const visuals = formData.has("visuals");
    const semi = formData.has("semi");
    const reverse = formData.has("reverse");

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));

    setProcessing(true);
    setErrors([]);
    setDone(false);
    setDownloaded([]);
    setProgressLabel(`Démarrage — 0 / ${imageFiles.length} images…`);

    const errs: string[] = [];

    try {
      await withConcurrency(
        imageFiles,
        2, // 2 concurrent max — sequential processing on server
        async (file) => {
          const fd = new FormData();
          fd.append("files", file);
          fd.append("count", count);
          if (fundamentals) fd.append("fundamentals", "1");
          if (visuals) fd.append("visuals", "1");
          if (semi) fd.append("semi", "1");
          if (reverse) fd.append("reverse", "1");

          try {
            const res = await fetch("/api/duplicate-image", { method: "POST", body: fd });

            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              errs.push(`${file.name}: ${j?.error ?? "erreur inconnue"}`);
              return;
            }

            // Download immediately — no need to wait for all images
            const blob = await res.blob();
            const filename = extractFilename(res.headers, file.name);
            triggerDownload(blob, filename);

            flushSync(() => {
              setDownloaded((prev) => [...prev, filename]);
            });
          } catch {
            errs.push(`${file.name}: erreur réseau`);
          }
        },
        (doneCount, total) => {
          flushSync(() => {
            setProgress(Math.round((doneCount / total) * 100));
            setProgressLabel(`${doneCount} / ${total} images traitées…`);
          });
        }
      );
    } finally {
      setErrors(errs);
      setProcessing(false);
      setProgress(100);
      setDone(true);
      setFiles([]);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-6" autoComplete="off">
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !processing && inputRef.current?.click()}
          className="group relative rounded-xl border border-white/15 bg-gradient-to-br from-white/5 to-fuchsia-950/20 p-4 ring-inset transition
                     hover:ring-2 hover:ring-fuchsia-500/50 cursor-pointer"
          aria-label="Zone de dépôt"
        >
          <div className="pointer-events-none select-none">
            <p className="text-sm text-white/70">
              Glissez vos fichiers ici ou cliquez pour parcourir (max {MAX_FILES})
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
            <span>{files.length} fichier(s)</span>
            <span>•</span>
            <span>{(totalSize / (1024 * 1024)).toFixed(2)} Mo</span>
            <span>•</span>
            <span
              className="underline"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Sélect. fichiers
            </span>
          </div>
        </div>

        {/* Filters */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-white/90 mb-1">Filtres</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ToggleChip name="fundamentals" value="1" label="Filtres fondamentaux" hint="up/downscale, qualité, chroma, ICC, EXIF/XMP…" defaultChecked />
            <ToggleChip name="visuals" value="1" label="Filtres visuels" hint="brightness, saturation, gamma, contrast, hue…" />
            <ToggleChip name="semi" value="1" label="Semi-visuels" hint="kernel aléatoire, micro-crop, léger resize" defaultChecked />
            <ToggleChip name="reverse" value="1" label="Reverse (miroir horizontal)" hint="Miroir horizontal de l'image. Cumulable avec les packs." />
          </div>
        </fieldset>

        {/* Copies */}
        <div className="max-w-xs">
          <label className="block text-sm font-medium mb-2 text-white/80">Nombre de copies</label>
          <input
            type="number"
            name="count"
            min={1}
            defaultValue={1}
            className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={processing || files.length === 0}
          className={`rounded-lg px-4 py-2 text-white transition ${
            processing || files.length === 0
              ? "bg-gray-600/60 cursor-not-allowed"
              : "bg-fuchsia-600 hover:bg-fuchsia-500"
          }`}
        >
          {processing ? "Duplication en cours…" : "Dupliquer les images"}
        </button>

        {/* Progress bar */}
        {processing && (
          <div className="space-y-1">
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-fuchsia-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-white/60">{progressLabel}</p>
          </div>
        )}

        {/* Result feedback */}
        {done && !processing && (
          <div className={`text-sm rounded-lg px-4 py-2 ${errors.length > 0 ? "bg-red-900/40 text-red-300" : "bg-emerald-900/40 text-emerald-300"}`}>
            {errors.length === 0
              ? `✓ ${downloaded.length} image(s) téléchargée(s) directement.`
              : `Terminé : ${downloaded.length} ok · ${errors.length} erreur(s) : ${errors.join(" · ")}`}
          </div>
        )}

        {/* Live download log */}
        {(processing || (done && downloaded.length > 0)) && downloaded.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1 max-h-48 overflow-y-auto">
            <p className="text-xs font-semibold text-white/60 mb-2">Téléchargements en cours</p>
            {downloaded.map((name, i) => (
              <p key={i} className="text-xs text-emerald-400">✓ {name}</p>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
