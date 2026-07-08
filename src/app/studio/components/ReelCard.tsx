"use client";

import type { ReelFormat, StudioReel } from "@/lib/studio/types";

// Badge de format sur les vignettes.
export function ThumbBadge({ format }: { format: ReelFormat }) {
  const talking = format === "Talking";
  return (
    <span
      className="rounded-full px-3 py-1 text-xs backdrop-blur-sm"
      style={
        talking
          ? { background: "rgba(109,94,252,.2)", color: "#b3aaff" }
          : { background: "rgba(78,197,255,.16)", color: "#4ec5ff" }
      }
    >
      {format}
    </span>
  );
}

// Tuile placeholder pendant la génération (spinner).
export function LoadingTile() {
  return (
    <div
      aria-label="Reel en cours de génération"
      className="flex aspect-[9/16] items-center justify-center rounded-xl border border-[#232350] bg-[#12122e]"
    >
      <span className="studio-spinner" role="status" aria-live="polite" />
    </div>
  );
}

interface ReelCardProps {
  reel: StudioReel;
  onPreview: (reel: StudioReel) => void;
  onDownload: (reel: StudioReel) => void;
  onPublish: (reel: StudioReel) => void;
}

// Carte reel : vignette 9:16 = 1ʳᵉ frame de la VRAIE vidéo générée
// (preload metadata). Clic = aperçu ; footer Télécharger/Publier.
export default function ReelCard({
  reel,
  onPreview,
  onDownload,
  onPublish,
}: ReelCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#232350] bg-[#12122e]">
      {/* Vignette 9:16 — clic = aperçu */}
      <button
        type="button"
        onClick={() => onPreview(reel)}
        aria-label={`Prévisualiser ${reel.variantLabel} — ${reel.hook}`}
        className="group relative block aspect-[9/16] w-full text-left"
        style={{ background: "linear-gradient(180deg,#181838 0%,#101028 100%)" }}
      >
        {/* #t=0.1 force le navigateur à décoder une frame pour la vignette */}
        <video
          src={`${reel.url}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute left-3 top-3">
          <ThumbBadge format={reel.format} />
        </span>
        <span className="absolute right-3 top-3 rounded bg-black/40 px-1.5 text-sm text-[#d9dbf3]">
          {reel.duration}
        </span>

        {/* Play */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl text-white/80 drop-shadow transition-transform group-hover:scale-110"
        >
          ▶
        </span>

        {/* Hook en overlay bas */}
        <span className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 text-[15px] text-[#eef0fb]">
          {reel.hook}
        </span>
      </button>

      {/* Footer actions */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => onDownload(reel)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#2e2e60] py-2 text-sm text-[#b3aaff] transition-colors hover:border-[#6d5efc] hover:text-[#eef0fb]"
        >
          <span aria-hidden>⬇</span> Télécharger
        </button>
        <button
          type="button"
          onClick={() => onPublish(reel)}
          aria-label={`Publier ${reel.variantLabel} sur mes comptes`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2e2e60] text-[#9a9ac6] transition-colors hover:border-[#6d5efc] hover:text-[#eef0fb]"
        >
          <span aria-hidden>➤</span>
        </button>
      </div>
    </article>
  );
}
