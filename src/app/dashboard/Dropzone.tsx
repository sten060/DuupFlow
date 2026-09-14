// src/app/dashboard/Dropzone.tsx
"use client";

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2); // fallback

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

type Props = {
  /** name du champ côté formulaire (ex: "files") */
  name: string;
  /** accept: "image/*" | "video/*" | ".png,.jpg", etc. */
  accept?: string;
  /** autoriser la sélection multiple */
  multiple?: boolean;
  /** nombre max de fichiers à garder */
  maxFiles?: number;
  /**
   * Optional escape hatch: the parent passes a ref that Dropzone keeps pointed
   * at its internal addFiles(). Lets external sources (e.g. Google Drive import)
   * inject File objects straight into the dropzone — they sync into the hidden
   * <input> exactly like a local drop, so the form POST carries them too.
   */
  addFilesRef?: React.MutableRefObject<((files: File[]) => void) | null>;
  /** Notifie le parent à chaque changement de la liste de fichiers (ajout/suppression). */
  onFilesChange?: (files: File[]) => void;
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
  addFilesRef,
  onFilesChange,
}: Props) {
  const { t } = useTranslation();
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
      onFilesChange?.(next.map((i) => i.file));
    },
    [items, maxFiles, syncInputFiles, onFilesChange]
  );

  // Keep the parent's ref pointed at the latest addFiles so external sources
  // (Google Drive import) can inject files into this dropzone.
  useEffect(() => {
    if (addFilesRef) addFilesRef.current = addFiles;
  }, [addFiles, addFilesRef]);

  /** Suppression d’un fichier */
  const removeOne = useCallback(
    (id: string) => {
      const next = items.filter((i) => i.id !== id);
      setItems(next);
      syncInputFiles(next);
      onFilesChange?.(next.map((i) => i.file));
    },
    [items, syncInputFiles, onFilesChange]
  );

  /** Handlers drop / click */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };
  const onBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Capture files into a plain array BEFORE resetting the input —
    // resetting value="" would otherwise clear the FileList reference.
    const picked = e.target.files ? Array.from(e.target.files) : [];
    // Reset BEFORE addFiles so the subsequent syncInputFiles call
    // (which sets inputRef.current.files = dt.files) is not overwritten.
    e.currentTarget.value = "";
    if (picked.length) addFiles(picked);
  };

  return (
    <div className="space-y-4">
      {/* zone de drop */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center text-[var(--app-text)]
                   hover:border-[var(--app-border-strong)] transition cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <div className="text-lg font-medium">{t("vid.drop.title")}</div>
        <div className="text-sm opacity-70">
          {t("vid.drop.browse")} {maxFiles ? t("vid.drop.max", { max: maxFiles }) : ""}
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
          <div className="text-sm text-[var(--app-text-muted)] mb-2">
            {t("vid.drop.selectedCount", { count: items.length })}
          </div>

          {/* Vignettes au gabarit de l'Éditeur IA : l'image occupe toute la
              tuile, le nom et la croix n'apparaissent qu'au survol. Affichés en
              permanence, ils doublaient la hauteur de chaque carte et
              transformaient une simple liste de fichiers en mur de texte. */}
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((it) => (
              <div
                key={it.id}
                className="group relative aspect-video overflow-hidden rounded-xl border border-[var(--app-border)] bg-black/40"
              >
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
                  <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-white/70">
                    {it.file.name}
                  </div>
                )}

                {/* Voile : les commandes blanches doivent rester lisibles sur
                    une vignette claire. */}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/50 opacity-0 transition group-hover:opacity-100" />

                <button
                  type="button"
                  onClick={() => removeOne(it.id)}
                  className="absolute right-1.5 top-1.5 z-20 grid h-7 w-7 place-items-center rounded-full text-white opacity-0 transition hover:bg-red-500/80 group-hover:opacity-100"
                  style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                  aria-label={t("vid.drop.remove", { name: it.file.name })}
                  title={t("vid.drop.remove", { name: it.file.name })}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>

                <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 z-20 opacity-0 transition group-hover:opacity-100">
                  <span
                    className="block truncate rounded-lg px-2 py-1 text-[11px] font-semibold text-white"
                    style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                  >
                    {it.file.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}