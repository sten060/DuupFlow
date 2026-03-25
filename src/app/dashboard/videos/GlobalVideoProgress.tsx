"use client";

import { useSyncExternalStore, useState } from "react";
import { subscribe, snapshot, removeJob, stopJob, Job } from "./jobStore";
import JSZip from "jszip";

async function downloadAllAsZip(files: { name: string; url: string }[], label: string) {
  const zip = new JSZip();
  await Promise.all(
    files.map(async (f) => {
      const res = await fetch(f.url);
      const blob = await res.blob();
      zip.file(f.name, blob);
    })
  );
  const content = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  a.download = `DuupFlow_${label}_${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function JobBadge({ job }: { job: Job }) {
  const isError   = job.status === "error";
  const isDone    = job.status === "done";
  const isStopped = job.status === "stopped";
  const isRunning = job.status === "running";
  const hasFiles  = job.completedFiles.length > 0;
  const [zipping, setZipping] = useState(false);

  const typeLabel =
    job.type === "image"
      ? "Images"
      : job.channel === "simple"
      ? "Vidéo Simple"
      : "Vidéo Avancé";

  const statusIcon = isDone ? " ✓" : isError ? " ✗" : isStopped ? " ■" : "";

  const handleDownloadAll = async () => {
    setZipping(true);
    try {
      await downloadAllAsZip(job.completedFiles, typeLabel.replace(/\s/g, "_"));
    } finally {
      setZipping(false);
    }
  };

  return (
    <div
      className={[
        "rounded-xl border px-3 py-2 text-xs backdrop-blur-md",
        "bg-[rgba(8,12,35,0.92)] shadow-lg",
        isError
          ? "border-red-500/40"
          : isDone
          ? "border-emerald-400/40"
          : isStopped
          ? "border-amber-500/40"
          : "border-indigo-400/30",
      ].join(" ")}
      style={{ minWidth: 220, maxWidth: 300 }}
    >
      {/* Header row */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold text-white/90">
          {typeLabel}{statusIcon}
        </span>
        <div className="flex items-center gap-1">
          {isRunning && (
            <button
              type="button"
              onClick={() => stopJob(job.id)}
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-950/70 hover:bg-red-900 border border-red-700/40 text-red-300 transition"
              title="Arrêter les duplications"
            >
              ■ Arrêter
            </button>
          )}
          <button
            type="button"
            onClick={() => removeJob(job.id)}
            className="rounded-full px-1 text-white/40 hover:text-white/80"
            title="Fermer"
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress bar — only while running */}
      {isRunning && (
        <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-1.5 rounded-full bg-indigo-400 transition-[width] duration-200"
            style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
          />
        </div>
      )}

      {/* Status message */}
      <p
        className={[
          "truncate text-[11px]",
          isError   ? "text-red-400"
          : isDone  ? "text-emerald-400"
          : isStopped ? "text-amber-400"
          : "text-white/60",
        ].join(" ")}
      >
        {isError
          ? job.errorMsg || "Erreur"
          : isDone
          ? `Terminé — ${job.completedFiles.length} fichier(s)`
          : isStopped
          ? job.msg
          : job.msg || `${job.progress}%`}
      </p>

      {/* Completed files list — shown when stopped or done */}
      {hasFiles && (isStopped || isDone) && (
        <div className="mt-2 space-y-1">
          {/* Download all as ZIP */}
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={zipping}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold bg-indigo-600/70 hover:bg-indigo-500/80 disabled:opacity-50 disabled:cursor-wait border border-indigo-400/30 text-white transition"
          >
            {zipping ? (
              <>
                <span className="animate-spin">⟳</span>
                Préparation ZIP…
              </>
            ) : (
              <>
                ↓ Tout télécharger ({job.completedFiles.length})
              </>
            )}
          </button>

          {/* Individual file links */}
          <div className="space-y-1 max-h-36 overflow-y-auto rounded-lg bg-white/5 p-1">
            {job.completedFiles.map((f, i) => (
              <a
                key={i}
                href={f.url}
                download={f.name}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] bg-white/8 hover:bg-white/15 text-white/75 truncate transition"
              >
                <span className="shrink-0 text-emerald-400">↓</span>
                <span className="truncate">{f.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Floating overlay showing all active/recent video and image processing jobs.
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


function JobBadge({ job }: { job: Job }) {
  const isError   = job.status === "error";
  const isDone    = job.status === "done";
  const isStopped = job.status === "stopped";
  const isRunning = job.status === "running";
  const hasFiles  = job.completedFiles.length > 0;

  const typeLabel =
    job.type === "image"
      ? "Images"
      : job.channel === "simple"
      ? "Vidéo Simple"
      : "Vidéo Avancé";

  const statusIcon = isDone ? " ✓" : isError ? " ✗" : isStopped ? " ■" : "";

  return (
    <div
      className={[
        "rounded-xl border px-3 py-2 text-xs backdrop-blur-md",
        "bg-[rgba(8,12,35,0.92)] shadow-lg",
        isError
          ? "border-red-500/40"
          : isDone
          ? "border-emerald-400/40"
          : isStopped
          ? "border-amber-500/40"
          : "border-indigo-400/30",
      ].join(" ")}
      style={{ minWidth: 220, maxWidth: 300 }}
    >
      {/* Header row */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold text-white/90">
          {typeLabel}{statusIcon}
        </span>
        <div className="flex items-center gap-1">
          {isRunning && (
            <button
              type="button"
              onClick={() => stopJob(job.id)}
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-950/70 hover:bg-red-900 border border-red-700/40 text-red-300 transition"
              title="Arrêter les duplications"
            >
              ■ Arrêter
            </button>
          )}
          <button
            type="button"
            onClick={() => removeJob(job.id)}
            className="rounded-full px-1 text-white/40 hover:text-white/80"
            title="Fermer"
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress bar — only while running */}
      {isRunning && (
        <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-1.5 rounded-full bg-indigo-400 transition-[width] duration-200"
            style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
          />
        </div>
      )}

      {/* Status message */}
      <p
        className={[
          "truncate text-[11px]",
          isError   ? "text-red-400"
          : isDone  ? "text-emerald-400"
          : isStopped ? "text-amber-400"
          : "text-white/60",
        ].join(" ")}
      >
        {isError
          ? job.errorMsg || "Erreur"
          : isDone
          ? `Terminé — ${job.completedFiles.length} fichier(s)`
          : isStopped
          ? job.msg
          : job.msg || `${job.progress}%`}
      </p>

      {/* Completed files list — shown when stopped or done */}
      {hasFiles && (isStopped || isDone) && (
        <div className="mt-2 space-y-1 max-h-36 overflow-y-auto rounded-lg bg-white/5 p-1">
          {job.completedFiles.map((f, i) => (
            <a
              key={i}
              href={f.url}
              download={f.name}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] bg-white/8 hover:bg-white/15 text-white/75 truncate transition"
            >
              <span className="shrink-0 text-emerald-400">↓</span>
              <span className="truncate">{f.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Floating overlay showing all active/recent video and image processing jobs.
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
