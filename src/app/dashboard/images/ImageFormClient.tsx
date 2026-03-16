"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import ToggleChip from "../ToggleChip";

const MAX_FILES = 50;

// Extract filename from Content-Disposition header
function extractFilename(headers: Headers, fallback: string): string {
  const cd = headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

function downloadBlob(blobUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

type ReadyFile = { blobUrl: string; filename: string };

type Props = {
  initialImages: string[];
};

export default function ImageFormClient({ initialImages: _ }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [readyFiles, setReadyFiles] = useState<ReadyFile[]>([]);
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

  function downloadAll() {
    readyFiles.forEach(({ blobUrl, filename }) => downloadBlob(blobUrl, filename));
  }

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
    setReadyFiles([]);
    setProgressLabel(`Démarrage — 0 / ${imageFiles.length} images…`);

    const errs: string[] = [];

    try {
      await withConcurrency(
        imageFiles,
        2, // 2 concurrent — sequential processing on server
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

            const blob = await res.blob();
            const filename = extractFilename(res.headers, file.name);
            const blobUrl = URL.createObjectURL(blob);

            // Add to ready list immediately — client downloads when they want
            flushSync(() => {
              setReadyFiles((prev) => [...prev, { blobUrl, filename }]);
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

        {/* Errors */}
        {done && errors.length > 0 && (
          <div className="text-sm rounded-lg px-4 py-2 bg-red-900/40 text-red-300">
            {errors.length} erreur(s) : {errors.join(" · ")}
          </div>
        )}
      </form>

      {/* Ready files — shown as they arrive, outside the form */}
      {readyFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white/80">
              Prêts à télécharger ({readyFiles.length})
            </p>
            <button
              type="button"
              onClick={downloadAll}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-fuchsia-600 hover:bg-fuchsia-500 text-white transition"
            >
              Tout télécharger
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 max-h-80 overflow-y-auto">
            {readyFiles.map(({ blobUrl, filename }, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-xs text-white/70 truncate flex-1">{filename}</span>
                <a
                  href={blobUrl}
                  download={filename}
                  className="shrink-0 rounded-md px-3 py-1 text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition"
                >
                  Télécharger
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
