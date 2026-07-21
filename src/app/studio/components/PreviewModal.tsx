"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { StudioReel } from "@/lib/studio/types";
import { ThumbBadge } from "./ReelCard";

// Remotion Player = client-only (pas de SSR) : chargé à la volée.
const ReelPlayer = dynamic(() => import("./ReelPlayer"), { ssr: false });

interface Props {
  reel: StudioReel;
  onClose: () => void;
  onDownload: (reel: StudioReel) => void;
  onPublish: (reel: StudioReel) => void;
}

// Modal d'aperçu : lecteur vidéo RÉEL (la variante générée) + infos + actions.
// Fermeture : clic sur le fond, bouton ✕, ou touche Échap.
export default function PreviewModal({ reel, onClose, onDownload, onPublish }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus initial sur le bouton fermer + fermeture à Échap.
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: Array<[string, string]> = [
    ["Format", "9:16 vertical"],
    ["Durée", reel.duration],
    ["Source", reel.source],
    // Extrait choisi par la découpe intelligente dans la brute
    ...(reel.segment ? ([["Extrait", reel.segment]] as Array<[string, string]>) : []),
    ["Fichier", `${reel.fileName} · ${reel.sizeMo} Mo`],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Aperçu de ${reel.variantLabel}`}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#2e2e60] bg-[#0c0c22] shadow-[0_20px_80px_rgba(0,0,0,.6)] sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Lecteur 9:16 — aperçu LIVE (Remotion Player, éditable) si le plan de
            montage est disponible, sinon la vidéo MP4 générée. */}
        <div className="relative aspect-[9/16] w-full bg-black sm:w-2/5 sm:shrink-0">
          {reel.plan ? (
            <ReelPlayer plan={reel.plan} />
          ) : (
            <video
              src={reel.url}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
              aria-label={`Lecture de ${reel.variantLabel}`}
            />
          )}
          <span className="pointer-events-none absolute left-4 top-4">
            <ThumbBadge format={reel.format} />
          </span>
        </div>

        {/* Infos + actions */}
        <div className="relative flex flex-1 flex-col p-6 sm:p-8">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer l'aperçu"
            className="absolute right-5 top-5 text-lg text-[#9a9ac6] transition-colors hover:text-[#eef0fb]"
          >
            ✕
          </button>

          <h2 className="text-2xl font-medium text-[#eef0fb]">
            {reel.variantLabel}
          </h2>
          <p className="mt-1 text-sm text-[#9a9ac6]">
            Prête à publier — aucune retouche
          </p>

          <dl className="mt-6">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-t border-[#232350] py-3 text-sm first:border-t-0"
              >
                <dt className="text-[#9a9ac6]">{label}</dt>
                <dd className="text-[#eef0fb]">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Caption générée par l'IA — prête à coller au moment de publier */}
          {reel.caption && (
            <div className="mt-5 rounded-xl border border-[#232350] bg-[#12122e] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-[#9a9ac6]">
                  Caption
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(reel.caption ?? "")}
                  className="text-xs text-[#b3aaff] transition-colors hover:text-[#eef0fb]"
                >
                  Copier
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#eef0fb]">
                {reel.caption}
              </p>
            </div>
          )}

          <div className="mt-auto space-y-3 pt-8">
            <button
              type="button"
              onClick={() => onDownload(reel)}
              className="w-full rounded-xl py-3 text-[15px] font-medium text-white transition-transform hover:scale-[1.01]"
              style={{
                background: "linear-gradient(135deg,#6d5efc,#4ec5ff)",
                boxShadow: "0 8px 32px rgba(109,94,252,.35)",
              }}
            >
              ⬇ Télécharger le reel
            </button>
            {/* TODO: brancher la publication multi-comptes */}
            <button
              type="button"
              onClick={() => onPublish(reel)}
              className="w-full rounded-xl border border-[#2e2e60] py-3 text-[15px] text-[#eef0fb] transition-colors hover:border-[#6d5efc]"
            >
              ➤ Publier sur mes comptes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
