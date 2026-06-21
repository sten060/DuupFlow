"use client";

import { useState } from "react";

/**
 * Lazy YouTube embed (façade pattern).
 *
 * Renders only the thumbnail + a play button until the user clicks — the heavy
 * YouTube iframe is loaded on demand, so the page stays fast (good for SEO /
 * Core Web Vitals). Uses youtube-nocookie for a lighter privacy footprint.
 * Responsive 16:9 via aspect-ratio; border + rounded corners match the article.
 */
export default function YouTubeLazy({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black"
      style={{ aspectRatio: "16 / 9" }}
    >
      {open ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={title}
          className="group absolute inset-0 h-full w-full cursor-pointer"
        >
          <img
            src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
            alt=""
            loading="lazy"
            onError={(e) => {
              // Not every video has a maxres thumbnail → fall back to hqdefault.
              const img = e.currentTarget;
              if (!img.src.endsWith("hqdefault.jpg")) {
                img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
              }
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-black/30 transition group-hover:bg-black/20" />
          <span
            className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-xl transition group-hover:scale-105"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 text-white" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
