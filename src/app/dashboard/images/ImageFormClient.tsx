"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ToggleChip from "../ToggleChip";

type Props = {
  action: (formData: FormData) => Promise<void>;
  maxFiles?: number;
};

function SubmitWithProgress({ pending }: { pending: boolean }) {
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg px-4 py-2 text-white transition ${
          pending
            ? "bg-gray-600/60 cursor-not-allowed"
            : "bg-fuchsia-600 hover:bg-fuchsia-500"
        }`}
      >
        {pending ? "Duplication en cours…" : "Dupliquer les images"}
      </button>

      {pending && (
        <div className="w-full bg-white/10 rounded-full h-2.5 mt-3 overflow-hidden">
          <div className="h-2.5 w-3/4 rounded-full animate-pulse bg-fuchsia-500/70" />
        </div>
      )}
    </>
  );
}

export default function ImageFormClient({ action, maxFiles = 25 }: Props) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  // sync <input type="file" name="files"> with our state
  useEffect(() => {
    if (!inputRef.current) return;
    const dt = new DataTransfer();
    for (const f of files.slice(0, maxFiles)) dt.items.add(f);
    inputRef.current.files = dt.files;
  }, [files, maxFiles]);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setFiles((prev) => {
      const next = [...prev, ...picked].filter((f) => f.type.startsWith("image/"));
      return next.slice(0, maxFiles);
    });
    e.target.value = "";
  }, [maxFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    if (!dropped.length) return;
    setFiles((prev) => {
      const next = [...prev, ...dropped].filter((f) => f.type.startsWith("image/"));
      return next.slice(0, maxFiles);
    });
  }, [maxFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeAt = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const totalSize = useMemo(
    () => files.reduce((s, f) => s + f.size, 0),
    [files]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProcessing(true);
    try {
      await action(new FormData(e.currentTarget));
      router.push("/dashboard/images?ok=1");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-6" autoComplete="off">
      {/* Drop area */}
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="group relative rounded-xl border border-white/15 bg-gradient-to-br from-white/5 to-fuchsia-950/20 p-4 ring-inset transition
                   hover:ring-2 hover:ring-fuchsia-500/50 cursor-pointer"
        onClick={() => inputRef.current?.click()}
        aria-label="Zone de dépôt"
      >
        <div className="pointer-events-none select-none">
          <p className="text-sm text-white/70">
            Glissez vos fichiers ici ou cliquez pour parcourir (max {maxFiles})
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
                    title="Supprimer"
                  >
                    ×
                  </button>

                  <img
                    src={url}
                    alt={f.name}
                    className="aspect-video w-full object-cover"
                    onLoad={() => URL.revokeObjectURL(url)}
                  />

                  <div className="px-2 py-1 text-[11px] text-white/80 truncate">
                    {f.name}
                  </div>
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
          <span className="underline" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
            Sélect. fichiers
          </span>
        </div>
      </div>

      {/* Toggles */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-white/90 mb-1">Filtres</legend>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ToggleChip
            name="fundamentals"
            value="1"
            label="Filtres fondamentaux"
            hint="up/downscale, qualité, chroma, ICC, EXIF/XMP…"
            defaultChecked
          />
          <ToggleChip
            name="visuals"
            value="1"
            label="Filtres visuels"
            hint="brightness, saturation, gamma, contrast, hue…"
          />
          {/* ⚠️ le nom DOIT être 'semi' pour matcher actions.ts */}
          <ToggleChip
            name="semi"
            value="1"
            label="Semi-visuels"
            hint="kernel aléatoire, micro-crop, léger resize"
            defaultChecked
          />
<ToggleChip
  name="reverse"
  value="1"
  label="Reverse (miroir horizontal)"
  hint="Miroir horizontal de l’image. Cumulable avec les packs."
/>
        </div>
      </fieldset>

      {/* Copies */}
      <div className="max-w-xs">
        <label className="block text-sm font-medium mb-2 text-white/80">
          Nombre de copies
        </label>
        <input
          type="number"
          name="count"
          min={1}
          defaultValue={1}
          className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90"
        />
      </div>

      <SubmitWithProgress pending={processing} />
    </form>
  );
}