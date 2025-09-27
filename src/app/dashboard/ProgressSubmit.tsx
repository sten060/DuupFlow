"use client";

import { useFormStatus } from "react-dom";

export default function ProgressSubmit({ children = "Dupliquer" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="relative w-full rounded-xl bg-indigo-600/90 px-5 py-3 text-white
                 shadow-lg shadow-indigo-800/30 transition-all
                 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400/50
                 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span className="font-semibold">{pending ? "Duplication en cours…" : children}</span>

      {/* barre de progression indéterminée */}
      {pending && (
        <span className="pointer-events-none absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full bg-white/10">
          <span className="absolute -left-1/3 h-full w-1/3 animate-[progress_1.2s_ease-in-out_infinite] rounded-full bg-white/60" />
        </span>
      )}

      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(0); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </button>
  );
}