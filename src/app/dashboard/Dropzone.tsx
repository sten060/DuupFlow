// src/app/dashboard/Dropzone.tsx
"use client";

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2); // fallback

import React, { useCallback, useMemo, useRef, useState } from "react";

type Props = {
  /** name du champ côté formulaire (ex: "files") */
  name: string;
  /** accept: "image/*" | "video/*" | ".png,.jpg", etc. */
  accept?: string;
  /** autoriser la sélection multiple */
  multiple?: boolean;
  /** nombre max de fichiers à garder */
  maxFiles?: number;
};

type Item = {
  id: string;
  file: File;
  url: string; // URL.createObjectURL pour l’aperçu
};

export default function Dropzone({
  name,
  accept = "*/*",
  multiple = true,
  maxFiles = 25,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const isImage = useMemo(() => accept.startsWith("image"), [accept]);
  const isVideo = useMemo(() => accept.startsWith("video"), [accept]);

  /** Synchronise la liste items -> valeur réelle de l’input.files */
  const syncInputFiles = useCallback((next: Item[]) => {
    const dt = new DataTransfer();
    next.forEach((it) => dt.items.add(it.file));
    if (inputRef.current) inputRef.current.files = dt.files;
  }, []);

  /** Ajout de fichiers (drag, click) */
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);

      // dédupe simple: nom+taille+lastModified
      const keyOf = (f: File) => `${f.name}::${f.size}::${f.lastModified}`;

      const existingKeys = new Set(items.map((i) => keyOf(i.file)));
      const newOnes: Item[] = [];

      for (const f of arr) {
        if (existingKeys.has(keyOf(f))) continue; // déjà présent
        newOnes.push({ id: genId(), file: f, url: URL.createObjectURL(f) });
      }

      let next = [...items, ...newOnes];
      if (maxFiles && next.length > maxFiles) next = next.slice(0, maxFiles);

      setItems(next);
      syncInputFiles(next);
    },
    [items, maxFiles, syncInputFiles]
  );

  /** Suppression d’un fichier */
  const removeOne = useCallback(
    (id: string) => {
      const next = items.filter((i) => i.id !== id);
      setItems(next);
      syncInputFiles(next);
    },
    [items, syncInputFiles]
  );

  /** Handlers drop / click */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };
  const onBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    // on reset la value pour pouvoir rechoisir les mêmes fichiers si besoin
    e.currentTarget.value = "";
  };

  return (
    <div className="space-y-4">
      {/* zone de drop */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="rounded-2xl border border-white/15 bg-white/5 p-6 text-center text-white/80
                   ring-1 ring-inset ring-white/10 hover:bg-white/10 transition cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <div className="text-lg font-medium">Glissez vos fichiers ici</div>
        <div className="text-sm opacity-70">
          ou cliquez pour parcourir {maxFiles ? `(max ${maxFiles})` : ""}
        </div>

        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={onBrowse}
        />
      </div>

      {/* aperçus + bouton supprimer */}
      {items.length > 0 && (
        <>
          <div className="text-sm text-white/70 mb-2">
            {items.length} fichier(s) sélectionné(s)
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30"
              >
                {/* vignette */}
                <div className="aspect-video w-full bg-black/40">
                  {isImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.url}
                      alt={it.file.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {isVideo && (
                    <video
                      src={it.url}
                      className="h-full w-full object-cover"
                      muted
                    />
                  )}
                  {!isImage && !isVideo && (
                    <div className="h-full w-full flex items-center justify-center text-white/60 text-xs">
                      {it.file.name}
                    </div>
                  )}
                </div>

                {/* nom */}
                <div className="px-2 py-1 text-xs text-white/80 truncate">
                  {it.file.name}
                </div>

                {/* bouton supprimer */}
                <button
                  type="button"
                  onClick={() => removeOne(it.id)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 px-2 py-1 text-xs
                             text-white/90 hover:bg-black/80"
                  aria-label={`Retirer ${it.file.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}