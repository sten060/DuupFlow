// src/app/dashboard/ProgressSubmit.tsx
"use client";
import { useFormStatus } from "react-dom";

export default function ProgressSubmit({ label = "Traitement en cours…" }:{
  label?: string;
}) {
  const { pending } = useFormStatus();

  if (!pending) return null;

  return (
    <div className="mt-4">
      <div className="h-2 w-full overflow-hidden rounded bg-white/10">
        <div className="h-2 w-full animate-[progress_1.2s_linear_infinite] bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-indigo-400"
             style={{ transformOrigin: "0 0" }} />
      </div>
      <p className="mt-2 text-xs text-white/70">{label}</p>
    </div>
  );
}