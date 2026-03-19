"use client";

import { useSyncExternalStore } from "react";
import { subscribe, snapshot, removeJob, VideoJob } from "./jobStore";

function JobBadge({ job }: { job: VideoJob }) {
  const label = job.channel === "simple" ? "Simple" : "Avancé";
  const isError = job.status === "error";
  const isDone = job.status === "done";

  return (
    <div
      className={[
        "rounded-xl border px-3 py-2 text-xs backdrop-blur-md",
        "bg-[rgba(8,12,35,0.92)] shadow-lg",
        isError
          ? "border-red-500/40"
          : isDone
          ? "border-emerald-400/40"
          : "border-indigo-400/30",
      ].join(" ")}
      style={{ minWidth: 200 }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold text-white/90">
          Vidéo {label}
          {isDone && " ✓"}
          {isError && " ✗"}
        </span>
        <button
          type="button"
          onClick={() => removeJob(job.id)}
          className="rounded-full px-1 text-white/40 hover:text-white/80"
          title="Fermer"
        >
          ×
        </button>
      </div>

      {!isDone && !isError && (
        <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-1.5 rounded-full bg-indigo-400 transition-[width] duration-200"
            style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
          />
        </div>
      )}

      <p
        className={[
          "truncate",
          isError ? "text-red-400" : isDone ? "text-emerald-400" : "text-white/60",
        ].join(" ")}
      >
        {isError
          ? job.errorMsg || "Erreur"
          : isDone
          ? "Terminé"
          : job.msg || `${job.progress}%`}
      </p>
    </div>
  );
}

/**
 * Renders a floating overlay showing all active/recent video processing jobs.
 * Lives in the dashboard layout so it persists across page navigation.
 */
export default function GlobalVideoProgress() {
  const jobs = useSyncExternalStore(subscribe, snapshot, () => []);

  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {jobs.map((job) => (
        <JobBadge key={job.id} job={job} />
      ))}
    </div>
  );
}
