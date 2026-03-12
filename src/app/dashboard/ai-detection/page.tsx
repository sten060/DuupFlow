"use client";

import { useRef, useState, useTransition } from "react";
import { maskAiMetadata, injectAiMetadata } from "./actions";

/* ── small reusable component ── */
function FileDropzone({
  id,
  files,
  onChange,
}: {
  id: string;
  files: File[];
  onChange: (f: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const dropped = Array.from(e.dataTransfer.files);
    onChange(dropped);
  }

  return (
    <div
      className={[
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition",
        drag
          ? "border-amber-400/60 bg-amber-500/5"
          : "border-white/15 bg-white/[0.025] hover:border-white/25",
      ].join(" ")}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        accept="image/*,video/mp4,video/quicktime,video/x-matroska,video/avi,video/webm"
        className="hidden"
        onChange={(e) => onChange(Array.from(e.target.files ?? []))}
      />
      <svg className="h-8 w-8 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 16l4-4 4 4 4-6 4 6" /><rect x="2" y="3" width="20" height="18" rx="3" />
      </svg>
      {files.length === 0 ? (
        <p className="text-sm text-white/40">Déposer ou cliquer pour sélectionner</p>
      ) : (
        <ul className="text-sm text-white/70 space-y-0.5 text-center max-h-24 overflow-auto">
          {files.map((f) => <li key={f.name}>{f.name}</li>)}
        </ul>
      )}
    </div>
  );
}

/* ── main panel ── */
function SwitchPanel({
  mode,
  title,
  subtitle,
  accent,
  icon,
}: {
  mode: "mask" | "inject";
  title: string;
  subtitle: string;
  accent: string;
  icon: React.ReactNode;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<{ ok: boolean; count?: number; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));

    startTransition(async () => {
      setResult(null);
      const res = mode === "mask" ? await maskAiMetadata(fd) : await injectAiMetadata(fd);
      setResult(res);
      if (res.ok) setFiles([]);
    });
  }

  return (
    <div className={`rounded-2xl border bg-white/[0.03] p-6 flex flex-col gap-5 ${accent}`}>
      {/* header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold text-white text-base">{title}</h2>
          <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* dropzone */}
      <FileDropzone id={`drop-${mode}`} files={files} onChange={setFiles} />

      {/* action */}
      <button
        onClick={handleSubmit}
        disabled={pending || !files.length}
        className="h-11 rounded-xl font-medium text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: mode === "mask"
            ? "linear-gradient(90deg,#10b981,#22d3ee)"
            : "linear-gradient(90deg,#f59e0b,#ef4444)",
          color: "#fff",
        }}
      >
        {pending ? "Traitement…" : mode === "mask" ? "Masquer la signature IA" : "Injecter une signature IA"}
      </button>

      {/* feedback */}
      {result && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            result.ok
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-300"
              : "bg-red-500/10 border border-red-500/25 text-red-300"
          }`}
        >
          {result.ok
            ? `✓ ${result.count} fichier${(result.count ?? 0) > 1 ? "s" : ""} traité${(result.count ?? 0) > 1 ? "s" : ""} — fichiers disponibles dans la sortie.`
            : `✗ ${result.error}`}
        </div>
      )}
    </div>
  );
}

/* ── page ── */
export default function AiDetectionPage() {
  return (
    <main className="p-6 space-y-8 max-w-4xl">
      {/* header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Détection IA — Métadonnées
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Manipule les métadonnées de tes fichiers pour contrôler leur signature IA.
          Aucune modification visuelle — uniquement les informations internes du fichier.
        </p>
      </div>

      {/* info banner */}
      <div className="rounded-xl border border-white/10 bg-white/[0.025] px-5 py-4 text-sm text-white/60 flex gap-3 items-start">
        <svg className="h-4 w-4 mt-0.5 shrink-0 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <p>
          Les fichiers traités sont enregistrés dans ton dossier de sortie. Seules les métadonnées sont modifiées —
          le contenu visuel reste identique à 100%.
        </p>
      </div>

      {/* 2 switches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SwitchPanel
          mode="mask"
          title="Masquer la signature IA"
          subtitle="Remplace les métadonnées IA par une identité humaine réaliste (appareil photo, logiciel, photographe)."
          accent="border-emerald-500/20"
          icon={
            <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
          }
        />

        <SwitchPanel
          mode="inject"
          title="Injecter une signature IA"
          subtitle="Ajoute les métadonnées d'une plateforme IA connue (Midjourney, DALL-E, Runway…) dans ton fichier."
          accent="border-amber-500/20"
          icon={
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/><path d="M18 2v4h4"/>
            </svg>
          }
        />
      </div>

      {/* download link */}
      <div className="pt-2">
        <a
          href="/api/out/zip"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] transition"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Télécharger tous les fichiers (ZIP)
        </a>
      </div>
    </main>
  );
}
