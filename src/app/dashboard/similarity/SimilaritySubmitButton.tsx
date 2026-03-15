"use client";

import { useFormStatus } from "react-dom";

export function SimilaritySubmitButton() {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        type="submit"
        disabled={pending}
        className={[
          "rounded-lg px-4 py-2 font-medium text-white transition",
          pending
            ? "cursor-not-allowed bg-emerald-700/60"
            : "bg-emerald-600 hover:bg-emerald-500",
        ].join(" ")}
      >
        {pending ? "Analyse en cours…" : "Comparer"}
      </button>

      {pending && (
        <div className="w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-1.5 animate-[progress_2s_ease-in-out_infinite] rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.6)]" />
          </div>
          <p className="mt-1.5 text-center text-xs text-white/55">
            Comparaison en cours, cela peut prendre quelques secondes…
          </p>
        </div>
      )}
    </div>
  );
}
