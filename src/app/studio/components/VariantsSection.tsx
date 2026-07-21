"use client";

import { MAX_VARIANTS, MIN_VARIANTS } from "@/lib/mock-data";

interface Props {
  variants: number;
  onChange: (value: number) => void;
}

// Section 3 — Nombre de variantes : slider 1–10. Nouveau modèle "1 reel depuis
// N contenus" → ce n'est plus "par vidéo", c'est le nombre de variantes du reel.
export default function VariantsSection({ variants, onChange }: Props) {
  const fill =
    ((variants - MIN_VARIANTS) / (MAX_VARIANTS - MIN_VARIANTS)) * 100;

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-medium text-[#eef0fb]">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2e2e60] bg-[#181838] text-xs text-[#9a9ac6]">
          3
        </span>
        Nombre de variantes
      </h2>

      <div className="flex items-center gap-4">
        <input
          type="range"
          min={MIN_VARIANTS}
          max={MAX_VARIANTS}
          value={variants}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Nombre de variantes du reel"
          style={{ "--fill": `${fill}%` } as React.CSSProperties}
          className="flex-1"
        />
        <span className="w-6 text-right text-xl font-medium text-[#eef0fb]">
          {variants}
        </span>
      </div>

      <p className="mt-2 text-sm text-[#5c5c88]">
        → 1 reel · {variants} variante{variants > 1 ? "s" : ""}
      </p>
    </section>
  );
}
