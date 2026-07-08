"use client";

import { useRef, useState } from "react";
import { MAX_REFERENCES } from "@/lib/mock-data";
import type { StudioReference } from "@/lib/studio/types";

interface Props {
  references: StudioReference[];
  onAdd: (url: string) => void;
  onAddFile: (file: File) => void;
  onRemove: (id: string) => void;
}

// Petit indicateur d'état par référence.
function StatusPill({ reference }: { reference: StudioReference }) {
  if (reference.status === "analyzing") {
    return (
      <span
        className="studio-spinner !h-4 !w-4 shrink-0"
        role="status"
        aria-label="Analyse de la référence en cours"
      />
    );
  }
  if (reference.status === "error") {
    return (
      <span
        className="shrink-0 text-xs text-[#ff6b8a]"
        title={reference.error ?? "Erreur"}
        aria-label={reference.error ?? "Erreur"}
      >
        ⚠
      </span>
    );
  }
  return (
    <span className="shrink-0 text-xs text-[#4ec5ff]" aria-label="Référence analysée">
      ✓
    </span>
  );
}

// Section 1 — Références : coller des URLs de reels performants (max 3).
// Chaque URL est analysée par le serveur (yt-dlp + vision LLM) → recette virale
// que le générateur reproduit sur les captions/hooks des vidéos de l'user.
export default function ReferencesSection({
  references,
  onAdd,
  onAddFile,
  onRemove,
}: Props) {
  const [value, setValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const full = references.length >= MAX_REFERENCES;

  const add = () => {
    const url = value.trim();
    if (full || !url) return;
    onAdd(url);
    setValue("");
  };

  const pickFile = (list: FileList | null) => {
    if (!list || full || list.length === 0) return;
    onAddFile(list[0]); // une référence à la fois
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-[15px] font-medium text-[#eef0fb]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2e2e60] bg-[#181838] text-xs text-[#9a9ac6]">
            1
          </span>
          Références
        </h2>
        <span className="text-sm text-[#5c5c88]">
          {references.length} / {MAX_REFERENCES}
        </span>
      </div>

      {/* Zone de collage d'URL + dépôt de fichier (drag & drop) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => pickFile(e.target.files)}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
          full
            ? "border-[#2e2e60] opacity-40"
            : dragOver
              ? "border-[#6d5efc] bg-[#12122e]"
              : "border-[#2e2e60] hover:border-[#6d5efc]"
        }`}
      >
        <span aria-hidden className="mb-2 block text-[#6d5efc]">
          🔗
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          disabled={full}
          placeholder="Colle un reel performant"
          aria-label="URL d'un reel de référence"
          className="w-full bg-transparent text-center text-sm text-[#eef0fb] placeholder-[#9a9ac6] outline-none"
        />
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={add}
            disabled={full}
            className="rounded-lg border border-[#2e2e60] px-3 py-1 text-xs text-[#9a9ac6] transition-colors hover:border-[#6d5efc] hover:text-[#eef0fb] disabled:cursor-not-allowed"
          >
            + Ajouter
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={full}
            className="rounded-lg border border-[#2e2e60] px-3 py-1 text-xs text-[#9a9ac6] transition-colors hover:border-[#6d5efc] hover:text-[#eef0fb] disabled:cursor-not-allowed"
          >
            ⬆ Fichier
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#5c5c88]">
          Colle une URL ou glisse le fichier du reel
        </p>
      </div>

      {/* Chips de références */}
      {references.length > 0 && (
        <ul className="mt-3 space-y-2">
          {references.map((ref) => (
            <li
              key={ref.id}
              className="flex items-center gap-2.5 rounded-xl border border-[#232350] bg-[#12122e] px-3.5 py-2.5"
            >
              <StatusPill reference={ref} />
              <span
                className="min-w-0 flex-1 truncate text-sm text-[#eef0fb]"
                title={ref.recipe?.hookStyle ?? ref.url}
              >
                {ref.title}
              </span>
              <button
                type="button"
                onClick={() => onRemove(ref.id)}
                aria-label={`Supprimer la référence ${ref.title}`}
                className="text-[#5c5c88] transition-colors hover:text-[#eef0fb]"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
