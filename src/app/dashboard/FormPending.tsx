"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white
                 flex items-center justify-center gap-2
                 hover:bg-indigo-500 disabled:opacity-90 disabled:cursor-not-allowed"
    >
      {pending && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-r-transparent"
          aria-hidden="true"
        />
      )}
      <span>{pending ? "Duplication…" : (children ?? "Dupliquer")}</span>
    </button>
  );
}

export function PendingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="flex items-center gap-3 rounded-md bg-zinc-900 px-4 py-3 text-white shadow-lg">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-r-transparent" />
        <span>Duplication en cours…</span>
      </div>
    </div>
  );
}