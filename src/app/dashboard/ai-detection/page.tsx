"use client";

import { useRef, useState, useEffect } from "react";
import { maskAiMetadata, deleteAiFiles } from "./actions";

const MAX_FILES = 30;

/* ── Accordion ── */
function Accordion({
  title, icon, children, borderCls, bgCls, headerTextCls, bodyTextCls,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  borderCls: string;
  bgCls: string;
  headerTextCls: string;
  bodyTextCls: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border ${borderCls} ${bgCls} overflow-hidden`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <span className={`text-sm font-medium ${headerTextCls}`}>{title}</span>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 ${headerTextCls} transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className={`px-5 pb-4 text-sm ${bodyTextCls} border-t ${borderCls}`}>
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

/* ── Preview grid ── */
function FilePreviewGrid({ files }: { files: File[] }) {
  const [previews, setPreviews] = useState<Array<{ url: string; isVideo: boolean; name: string }>>([]);

  useEffect(() => {
    const urls = files.map((f) => ({
      url: URL.createObjectURL(f),
      isVideo: f.type.startsWith("video/"),
      name: f.name,
    }));
    setPreviews(urls);
    return () => urls.forEach((p) => URL.revokeObjectURL(p.url));
  }, [files]);

  if (!files.length) return null;

  const size =
    files.length <= 4 ? 120 :
    files.length <= 9 ? 90 :
    files.length <= 20 ? 68 : 52;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {previews.map((p, i) => (
        <div
          key={i}
          className="relative rounded-lg overflow-hidden bg-white/[0.06] border border-white/10 shrink-0 group"
          style={{ width: size, height: size }}
          title={p.name}
        >
          {p.isVideo ? (
            <div className="flex items-center justify-center h-full">
              <svg
                className="text-white/40"
                style={{ width: size * 0.38, height: size * 0.38 }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              >
                <rect x="3" y="5" width="14" height="14" rx="2" />
                <path d="M17 8l4-2v12l-4-2z" />
              </svg>
            </div>
          ) : (
            <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-end p-1">
            <span className="text-white/80 text-[9px] leading-tight font-mono line-clamp-2 break-all">{p.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Dropzone ── */
function FileDropzone({
  files, onChange, limitError,
}: {
  files: File[];
  onChange: (f: File[]) => void;
  limitError?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    onChange(Array.from(e.dataTransfer.files));
  }

  return (
    <div className="space-y-0">
      <div
        className={[
          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition",
          drag
            ? "border-indigo-400/60 bg-indigo-500/5"
            : limitError
            ? "border-red-500/40 bg-red-500/[0.02]"
            : "border-white/15 bg-white/[0.025] hover:border-white/25",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/quicktime,video/x-matroska,video/avi,video/webm"
          className="hidden"
          onChange={(e) => onChange(Array.from(e.target.files ?? []))}
        />
        <svg className="h-8 w-8 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 16l4-4 4 4 4-6 4 6" />
          <rect x="2" y="3" width="20" height="18" rx="3" />
        </svg>
        {files.length === 0 ? (
          <p className="text-sm text-white/40">Déposer ou cliquer pour sélectionner <span className="text-white/25">(max {MAX_FILES})</span></p>
        ) : (
          <p className="text-sm text-white/60">
            {files.length} fichier{files.length > 1 ? "s" : ""} sélectionné{files.length > 1 ? "s" : ""}
            <span className="text-white/30 ml-2 text-xs">— cliquer pour changer</span>
          </p>
        )}
      </div>

      {limitError && (
        <div className="mt-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-2.5 text-sm text-red-300 flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {limitError}
        </div>
      )}

      {files.length > 0 && <FilePreviewGrid files={files} />}
    </div>
  );
}

/* ── Page principale ── */
export default function AiDetectionPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [limitError, setLimitError] = useState<string>("");
  const [result, setResult] = useState<{ ok: boolean; count?: number; error?: string; limitReached?: boolean } | null>(null);
  const [sessionFiles, setSessionFiles] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleFilesChange(newFiles: File[]) {
    if (newFiles.length > MAX_FILES) {
      setLimitError(
        `Limite dépassée — tu as sélectionné ${newFiles.length} fichiers, le maximum est ${MAX_FILES}. Seuls les ${MAX_FILES} premiers ont été conservés.`
      );
      setFiles(newFiles.slice(0, MAX_FILES));
    } else {
      setLimitError("");
      setFiles(newFiles);
    }
  }

  function handleSubmit() {
    if (!files.length || pending) return;
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));

    setPending(true);
    setResult(null);

    // Timeout: ~4s per file (parallel) + 15s buffer
    const timeoutMs = Math.max(60_000, files.length * 4_000 + 15_000);
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = setTimeout(() => {
      setPending(false);
      setResult({ ok: false, error: "[CLT-003] Délai dépassé — réessaie avec moins de fichiers." });
    }, timeoutMs);

    maskAiMetadata(fd)
      .then((res) => {
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
        setResult(res);
        if (res.ok) {
          setFiles([]);
          setLimitError("");
          if (res.files?.length) setSessionFiles((prev) => [...prev, ...res.files]);
        }
      })
      .catch((err) => {
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
        setResult({ ok: false, error: `[CLT-007] ${err?.message || "Erreur serveur."}` });
      })
      .finally(() => setPending(false));
  }

  function handleDelete() {
    if (!sessionFiles.length || deleting) return;
    setDeleting(true);
    deleteAiFiles(sessionFiles)
      .then(() => setSessionFiles([]))
      .catch(() => {})
      .finally(() => setDeleting(false));
  }

  const downloadUrl = sessionFiles.length
    ? `/api/out/zip?files=${sessionFiles.join(",")}`
    : "/api/out/zip";

  return (
    <main className="p-6 md:p-10 space-y-8 max-w-3xl mx-auto">
      {/* header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Détection IA — Métadonnées
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Efface intégralement les métadonnées IA (EXIF, XMP, IPTC, C2PA) et les remplace par une identité humaine réaliste.
        </p>
      </div>

      {/* notice : détection contenu — accordion */}
      <Accordion
        title="Remarque sur la détection des plateformes"
        borderCls="border-amber-500/20"
        bgCls="bg-amber-500/[0.04]"
        headerTextCls="text-amber-200/80"
        bodyTextCls="text-amber-200/70"
        icon={
          <svg className="h-4 w-4 shrink-0 text-amber-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }
      >
        Ce module supprime toutes les métadonnées IA — y compris les manifestes C2PA utilisés par Meta/Threads.
        Certaines plateformes utilisent aussi une <span className="text-amber-200/90">détection basée sur le contenu visuel</span> (pixels, patterns) indépendante des métadonnées.
        Pour contourner cette couche, utilise le module <strong className="text-amber-200/80">Duplication Images</strong> afin d'appliquer des micro-variations visuelles.
      </Accordion>

      {/* info processus — accordion */}
      <Accordion
        title="Comment ça fonctionne ?"
        borderCls="border-white/10"
        bgCls="bg-white/[0.025]"
        headerTextCls="text-white/55"
        bodyTextCls="text-white/50"
        icon={
          <svg className="h-4 w-4 shrink-0 text-white/35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
        }
      >
        <p>
          Traitement en <strong className="text-white/70">3 étapes</strong> qui simule un workflow photographique humain :
        </p>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li><strong className="text-white/70">Suppression totale</strong> — EXIF, XMP, IPTC, C2PA/JUMBF, tous les manifestes IA effacés.</li>
          <li><strong className="text-white/70">Traitement pixel</strong> — légère simulation de capture photo (flou objectif → bruit capteur → netteté ISP → re-compression JPEG).</li>
          <li><strong className="text-white/70">Injection identité humaine</strong> — appareil photo réaliste, logiciel, photographe, date cohérente.</li>
        </ol>
      </Accordion>

      {/* panel */}
      <div className="rounded-2xl border border-indigo-500/20 bg-white/[0.03] p-6 flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
            <svg className="h-5 w-5 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-white text-base">Masquer la signature IA</h2>
            <p className="text-sm text-white/50 mt-0.5">
              Remplace toutes les métadonnées IA par une identité humaine réaliste — appareil photo, logiciel, photographe, date.
            </p>
          </div>
        </div>

        <FileDropzone files={files} onChange={handleFilesChange} limitError={limitError} />

        <button
          onClick={handleSubmit}
          disabled={pending || !files.length}
          className="h-11 rounded-xl font-medium text-sm transition disabled:opacity-40 disabled:cursor-not-allowed text-white"
          style={{ background: "linear-gradient(90deg,#6366F1,#818CF8)" }}
        >
          {pending ? "Traitement en cours…" : `Masquer la signature IA${files.length ? ` (${files.length} fichier${files.length > 1 ? "s" : ""})` : ""}`}
        </button>

        {result && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              result.ok && !result.limitReached
                ? "bg-indigo-500/10 border border-indigo-500/25 text-indigo-200"
                : result.ok && result.limitReached
                ? "bg-amber-900/30 border border-amber-600/30 text-amber-300"
                : "bg-red-500/10 border border-red-500/25 text-red-300"
            }`}
          >
            {result.ok && !result.limitReached
              ? `✓ ${result.count} fichier${(result.count ?? 0) > 1 ? "s" : ""} traité${(result.count ?? 0) > 1 ? "s" : ""} — métadonnées effacées et réécrites.`
              : result.ok && result.limitReached
              ? `⚠ ${result.error}`
              : `✗ ${result.error}`}
          </div>
        )}
      </div>

      {/* téléchargement + suppression */}
      <div className="space-y-3">
        {sessionFiles.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
              Fichiers traités cette session ({sessionFiles.length})
            </p>
            <ul className="space-y-1">
              {sessionFiles.map((name) => (
                <li key={name} className="flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span className="font-mono text-xs text-white/60">{name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] transition"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {sessionFiles.length > 0
              ? `Télécharger (${sessionFiles.length} fichier${sessionFiles.length > 1 ? "s" : ""})`
              : "Télécharger tous les fichiers (ZIP)"}
          </a>

          {sessionFiles.length > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 bg-red-500/[0.04] hover:bg-red-500/[0.08] transition disabled:opacity-40"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6M9 6V4h6v2" />
              </svg>
              {deleting ? "Suppression…" : `Supprimer les fichiers (${sessionFiles.length})`}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
