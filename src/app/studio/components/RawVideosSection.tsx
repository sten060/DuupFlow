"use client";

import { useRef, useState } from "react";
import { MAX_RAW_VIDEOS } from "@/lib/mock-data";
import type { UploadedVideo } from "@/lib/studio/types";

export interface PendingUpload {
  tempId: string;
  name: string;
}

interface Props {
  videos: UploadedVideo[];
  pending: PendingUpload[]; // uploads en cours (probe ffmpeg côté serveur)
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onNote: (id: string, note: string) => void; // note libre par contenu
}

function isImage(v: UploadedVideo): boolean {
  return v.kind === "image";
}

// Section 2 — Contenus : le user ajoute des vidéos ET des images (upload réel,
// clic ou drag & drop), chacune avec une NOTE libre ("elle avant", "la glow-up")
// que l'IA interprète pour assembler le reel. Tous les contenus servent au MÊME
// reel + ses variantes (fini "N vidéos = N reels").
export default function RawVideosSection({ videos, pending, onFiles, onRemove, onNote }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const count = videos.length + pending.length;
  const full = count >= MAX_RAW_VIDEOS;

  const pick = (list: FileList | null) => {
    if (!list || full) return;
    onFiles(Array.from(list));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-[15px] font-medium text-[#eef0fb]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2e2e60] bg-[#181838] text-xs text-[#9a9ac6]">
            2
          </span>
          Contenus
        </h2>
        <span className="text-sm text-[#5c5c88]">
          {count} / {MAX_RAW_VIDEOS}
        </span>
      </div>
      <p className="mb-4 text-xs text-[#7a7aa6]">
        Vidéos ou images — tout sert au même reel. Décris chaque contenu (ex :
        « elle avant », « la glow-up »).
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm,image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
        multiple
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => pick(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files);
        }}
        disabled={full}
        aria-label="Ajouter des contenus (vidéos ou images)"
        className={`w-full rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
          full
            ? "cursor-not-allowed border-[#2e2e60] opacity-40"
            : dragOver
              ? "border-[#6d5efc] bg-[#12122e]"
              : "border-[#2e2e60] hover:border-[#6d5efc] hover:bg-[#0e0e26]"
        }`}
      >
        <span aria-hidden className="mb-2 block text-lg text-[#6d5efc]">
          ⬆
        </span>
        <span className="text-sm text-[#9a9ac6]">Glisse tes vidéos ou images ici</span>
      </button>

      {count > 0 && (
        <ul className="mt-3 space-y-2">
          {videos.map((video) => (
            <li
              key={video.id}
              className="rounded-xl border border-[#232350] bg-[#12122e] px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="text-xs text-[#5c5c88]">
                  {isImage(video) ? "🖼" : "🎞"}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-sm text-[#eef0fb]"
                  title={`${video.name} · ${video.durationLabel} · ${video.sizeMo} Mo`}
                >
                  {video.name}
                </span>
                <span className="text-[11px] text-[#5c5c88]">
                  {isImage(video) ? "image" : video.durationLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(video.id)}
                  aria-label={`Supprimer ${video.name}`}
                  className="text-[#5c5c88] transition-colors hover:text-[#eef0fb]"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                value={video.note ?? ""}
                onChange={(e) => onNote(video.id, e.target.value)}
                placeholder="Décris ce contenu (ex : « elle avant »)"
                className="mt-2 w-full rounded-lg border border-[#2e2e60] bg-[#0a0a1e] px-2.5 py-1.5 text-[13px] text-[#eef0fb] outline-none placeholder:text-[#5c5c88] focus:border-[#6d5efc]"
              />
            </li>
          ))}
          {pending.map((p) => (
            <li
              key={p.tempId}
              className="flex items-center gap-2.5 rounded-xl border border-[#232350] bg-[#12122e] px-3.5 py-2.5 opacity-70"
            >
              <span
                className="studio-spinner !h-4 !w-4 shrink-0"
                role="status"
                aria-label={`Analyse de ${p.name} en cours`}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-[#9a9ac6]">
                {p.name}
              </span>
              <span className="text-xs text-[#5c5c88]">Analyse…</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
