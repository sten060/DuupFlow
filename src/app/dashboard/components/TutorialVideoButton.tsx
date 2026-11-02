"use client";

// Pastille « Voir la vidéo » (tutos des modules). Au clic : la vidéo s'ouvre au
// centre de l'écran, tout le reste est flouté. Échap ou clic à côté = fermer.
// Style de la pastille (texture + néon qui tourne sur le bord) : .tuto-pill
// dans globals.css. Vidéos : public/tutorials/ (720p, son, faststart).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/lib/i18n/context";

export default function TutorialVideoButton({ src, poster, title }: { src: string; poster?: string; title?: string }) {
  const fr = useLocale() === "fr";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  const label = fr ? "Voir la vidéo" : "Watch the video";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="tuto-pill" aria-label={title ? `${label} — ${title}` : label}>
        <span className="tuto-pill__icon" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
        {label}
      </button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title ?? label}>
          {/* Fond flouté : tout le dashboard derrière */}
          <div className="absolute inset-0 bg-black/45 backdrop-blur-xl" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-[860px]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={fr ? "Fermer" : "Close"}
              className="absolute -top-11 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
            <video
              src={src}
              poster={poster}
              controls
              autoPlay
              playsInline
              className="aspect-video w-full rounded-2xl bg-black shadow-[0_30px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
