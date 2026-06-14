"use client";

import { useSyncExternalStore } from "react";
import { subscribe, snapshot, removeJob } from "./jobStore";
import { removeActiveJob } from "./videoJobResume";

/**
 * Shown when a duplication's live connection drops and the 3 auto-reconnects all
 * fail. The encode keeps running on the server, so this is recoverable: the copies
 * already finished are downloadable here, and "Reprendre" reconnects (via reload →
 * the existing auto-resume) to finish the rest. "Annuler" just dismisses.
 */
export default function InterruptedRecovery({
  jobId,
  onDismiss,
}: {
  jobId: string;
  onDismiss: () => void;
}) {
  const jobs = useSyncExternalStore(subscribe, snapshot, () => []);
  const job = jobs.find((j) => j.id === jobId);
  const files = job?.completedFiles ?? [];

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-300">Connexion interrompue</p>
        <p className="mt-0.5 text-xs text-white/60">
          Ce n'est pas de ta faute — la connexion a été coupée. Ta duplication continue sur nos
          serveurs ; tes copies déjà prêtes sont téléchargeables ci-dessous.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-emerald-400/90">✓ {files.length} copie(s) déjà prête(s)</p>
          <div className="max-h-32 overflow-y-auto rounded-lg bg-white/5 p-1 space-y-1">
            {files.map((f, i) => (
              <a
                key={i}
                href={f.url}
                download={f.name}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] bg-white/[0.08] hover:bg-white/[0.15] text-white/80 transition"
              >
                <span className="shrink-0 text-emerald-400">↓</span>
                <span className="truncate">{f.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-500 text-white transition"
        >
          Reprendre les duplications restantes
        </button>
        <button
          type="button"
          onClick={() => {
            removeActiveJob(jobId);
            removeJob(jobId);
            onDismiss();
          }}
          className="rounded-lg px-3 py-2 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-white/70 border border-white/10 transition"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
