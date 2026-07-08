"use client";

import { MAX_VARIANTS, MIN_VARIANTS } from "@/lib/mock-data";

interface Props {
  variants: number;
  videoCount: number;
  onChange: (value: number) => void;
}

// Section 3 — Variantes par vidéo : slider 1–10 + total live.
export default function VariantsSection({ variants, videoCount, onChange }: Props) {
  const total = videoCount * variants;
  // Position du remplissage du slider (variable CSS lue par studio.css).
  const fill =
    ((variants - MIN_VARIANTS) / (MAX_VARIANTS - MIN_VARIANTS)) * 100;

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-medium text-[#eef0fb]">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2e2e60] bg-[#181838] text-xs text-[#9a9ac6]">
          3
        </span>
        Variantes par vidéo
      </h2>

      <div className="flex items-center gap-4">
        <input
          type="range"
          min={MIN_VARIANTS}
          max={MAX_VARIANTS}
          value={variants}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Nombre de variantes par vidéo"
          style={{ "--fill": `${fill}%` } as React.CSSProperties}
          className="flex-1"
        />
        <span className="w-6 text-right text-xl font-medium text-[#eef0fb]">
          {variants}
        </span>
      </div>

      <p className="mt-2 text-sm text-[#5c5c88]">
        → {total} reel{total > 1 ? "s" : ""} au total
      </p>
    </section>
  );
}
