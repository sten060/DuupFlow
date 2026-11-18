"use client";

// « Duplication IA en 1 clic » (BETA).
// Parcours : 1 vidéo déposée → mode (Invisible / Variations) → nombre de copies
// → indications optionnelles → « Dupliquer ». Le serveur analyse, planifie (un
// seul appel Claude), fabrique et vérifie chaque copie (src/lib/ai-dup) ; cet
// écran suit le ticket et remplit la grille au fur et à mesure.
//
// La vidéo est déposée dans un projet conteneur de l'Éditeur IA (même stockage,
// même analyse à l'upload) : /api/ai-auto/session puis /api/ai-editor/material.

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { usePlanGate } from "../../components/PlanGate";
import Link from "next/link";
import { aiDupCost, aiDupTokenEstimateCents, MIN_COPIES, MAX_COPIES, DEFAULT_COPIES, MAX_INDICATIONS_CHARS } from "@/lib/ai-dup/config";
import { formatTokens } from "@/lib/tokens";
import type { AiDupMode } from "@/lib/ai-dup/types";
import type { PublicAiDupJob } from "@/lib/ai-dup/public-job";

import TutorialVideoButton from "../../components/TutorialVideoButton";
import { ModuleHelp } from "../../components/ModuleHelp";
type HistoryItem = {
  id: string; startedAt: number; expiresAt: number; mode: AiDupMode; requested: number;
  done: number; expired: boolean; running: boolean; materialName: string; thumb: string | null;
};

type Mat = {
  id: string;
  name: string;
  kind: "video" | "image" | "audio";
  status?: "analyzing" | "ready" | "failed";
  analysis: { durationSec?: number; thumb?: string | null } | null;
};

// ── VERROU BETA ──────────────────────────────────────────────────────────────
// Fermée aux users tant que NEXT_PUBLIC_AI_AUTO_BETA≠"1" (même verrou que la
// carte d'entrée) : la prod montre « Bientôt disponible », même par l'URL.
const AI_AUTO_OPEN = process.env.NEXT_PUBLIC_AI_AUTO_BETA === "1";

/** Ticket en cours, mémorisé pour survivre à un rechargement de la page. */
const RESUME_KEY = "aiDup.resume";
const readResume = (): { projectId: string; jobId: string } | null => {
  try { return JSON.parse(sessionStorage.getItem(RESUME_KEY) || "null"); } catch { return null; }
};
const writeResume = (v: { projectId: string; jobId: string } | null) => {
  try { if (v) sessionStorage.setItem(RESUME_KEY, JSON.stringify(v)); else sessionStorage.removeItem(RESUME_KEY); } catch { /* stockage indisponible */ }
};

export default function AiDupPage() {
  return AI_AUTO_OPEN ? <AiDupClient /> : <AiDupComingSoon />;
}

function Sparkles({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6 10l.9 2.5L21.5 15l-2.6.9L18 18.5l-.9-2.6L14.5 15l2.6-.5L18 12zM6 13l.8 2.2L9 16l-2.2.8L6 19l-.8-2.2L3 16l2.2-.8L6 13z" />
    </svg>
  );
}

function AiDupComingSoon() {
  const { t } = useTranslation();
  return (
    <main className="grid h-full place-items-center p-8">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-fuchsia-400" style={{ background: "rgba(217,70,239,0.10)", border: "1px solid rgba(217,70,239,0.22)" }}>
          <Sparkles />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--app-text)]">{t("dashboard.videos.aiTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">{t("dashboard.videos.aiSoonDesc")}</p>
        <a href="/dashboard/videos" className="mt-6 inline-block rounded-lg border border-[var(--app-border-strong)] px-4 py-2.5 text-sm font-medium text-[var(--app-text)] hover:bg-[var(--app-surface-2)]">
          {t("dashboard.videos.aiSoonBack")}
        </a>
      </div>
    </main>
  );
}

function AiDupClient() {
  const { t, locale } = useTranslation();
  const { showPlanRequired } = usePlanGate();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [material, setMaterial] = useState<Mat | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<AiDupMode>("variations");
  const [copies, setCopies] = useState(DEFAULT_COPIES);
  const [indications, setIndications] = useState("");
  // Cacher la caption d'origine et la réécrire sur chaque copie (Variations).
  const [replaceCaption, setReplaceCaption] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [job, setJob] = useState<PublicAiDupJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [drive, setDrive] = useState<{ id: string; status: string; done: number; total: number; folderName: string; folderUrl?: string; error?: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tokens IA : offert du mois (partagé avec le Claude intégré) + solde.
  const [allowance, setAllowance] = useState<{ includedLeftCents: number; balanceCents: number; canSend: boolean; unlimited?: boolean } | null>(null);
  const [tokensError, setTokensError] = useState(false);
  // Historique des duplications (sous « Dupliquer ») : revenir sur une
  // grille après « Nouvelle duplication » ou un rechargement.
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  // Suppression : 1er clic sur la croix = demande de confirmation sur la ligne.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const deleteHistory = useCallback(async (id: string) => {
    setDeleting(id);
    setError(null);
    try {
      const r = await fetch(`/api/ai-dup/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setError(d?.error ?? t("dashboard.videos.aiError")); return; }
      setHistory((h) => (h ? h.filter((x) => x.id !== id) : h));
      if (readResume()?.jobId === id) writeResume(null);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }, [t]);
  const refreshHistory = useCallback(async () => {
    const d = await (await fetch("/api/ai-dup/history").catch(() => null))?.json().catch(() => null);
    if (Array.isArray(d?.items)) setHistory(d.items);
  }, []);
  useEffect(() => { if (!job) void refreshHistory(); }, [job, refreshHistory]);
  const openHistory = useCallback(async (id: string) => {
    setOpening(id);
    setError(null);
    try {
      const r = await fetch(`/api/ai-dup/job?id=${encodeURIComponent(id)}`);
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.job) { setError(d?.error ?? t("dashboard.videos.aiError")); return; }
      setDrive(null);
      setJob(d.job);
      if (projectId) writeResume({ projectId, jobId: id });
      document.querySelector("main")?.scrollTo?.({ top: 0 });
      window.scrollTo({ top: 0 });
    } finally {
      setOpening(null);
    }
  }, [projectId, t]);

  const refreshAllowance = useCallback(async () => {
    const d = await (await fetch("/api/ai-dup/allowance").catch(() => null))?.json().catch(() => null);
    if (d?.allowance) setAllowance(d.allowance);
  }, []);
  useEffect(() => { void refreshAllowance(); }, [refreshAllowance]);

  // ── Session : reprise d'un lancement en cours, sinon projet vierge ───────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resume = readResume();
      if (resume) {
        const r = await fetch(`/api/ai-dup/job?id=${encodeURIComponent(resume.jobId)}`).catch(() => null);
        const d = await r?.json().catch(() => null);
        if (!cancelled && r?.ok && d?.job) { setProjectId(resume.projectId); setJob(d.job); return; }
        writeResume(null);
      }
      const res = await fetch("/api/ai-auto/session", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!cancelled && data?.projectId) setProjectId(data.projectId);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Suivi de l'analyse à l'upload (statut de la vidéo) ───────────────────────
  const refreshMaterial = useCallback(async (id: string) => {
    if (!projectId) return;
    const res = await fetch(`/api/ai-editor/project?id=${projectId}`).catch(() => null);
    const p = (await res?.json().catch(() => null))?.project;
    const m = (p?.materials as Mat[] | undefined)?.find((x) => x.id === id);
    if (m) setMaterial(m);
  }, [projectId]);

  useEffect(() => {
    if (!material || material.status === "ready" || material.status === "failed") return;
    const iv = setInterval(() => void refreshMaterial(material.id), 3000);
    return () => clearInterval(iv);
  }, [material, refreshMaterial]);

  // ── Suivi du lancement ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!job || job.finished) return;
    const iv = setInterval(async () => {
      const r = await fetch(`/api/ai-dup/job?id=${encodeURIComponent(job.id)}`).catch(() => null);
      const d = await r?.json().catch(() => null);
      if (d?.job) setJob(d.job);
      else if (r && r.status === 404) { setError(d?.error ?? t("dashboard.videos.aiError")); setJob((j) => (j ? { ...j, finished: true } : j)); }
    }, 2000);
    return () => clearInterval(iv);
  }, [job, t]);

  useEffect(() => { if (job?.finished) void refreshAllowance(); }, [job?.finished, refreshAllowance]);

  useEffect(() => {
    if (!drive || drive.status !== "running") return;
    const iv = setInterval(async () => {
      const d = await (await fetch(`/api/ai-dup/drive?id=${drive.id}`).catch(() => null))?.json().catch(() => null);
      if (d?.status) setDrive((x) => (x ? { ...x, ...d } : x));
    }, 2000);
    return () => clearInterval(iv);
  }, [drive]);

  // ── Upload (1 vidéo ; en redéposer une remplace la précédente) ──────────────
  const upload = useCallback(async (list: FileList | File[]) => {
    const file = Array.from(list).find((f) => f.type.startsWith("video") || /\.(mp4|mov|m4v|webm)$/i.test(f.name));
    if (!file || !projectId) return;
    setError(null);
    setUploading(true);
    if (material) {
      void fetch("/api/ai-editor/material", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, materialId: material.id }) }).catch(() => {});
      setMaterial(null);
    }
    try {
      const form = new FormData();
      form.set("projectId", projectId);
      form.set("file", file);
      const res = await fetch("/api/ai-editor/material", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.material) setError(data?.error || t("dashboard.videos.aiError"));
      else setMaterial(data.material as Mat);
    } catch {
      setError(t("dashboard.videos.aiError"));
    } finally {
      setUploading(false);
    }
  }, [projectId, material, t]);

  // ── Lancement ────────────────────────────────────────────────────────────────
  const launch = useCallback(async () => {
    if (!projectId || !material || material.status !== "ready" || launching) return;
    setError(null);
    setTokensError(false);
    setLaunching(true);
    try {
      const res = await fetch("/api/ai-dup/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, materialId: material.id, mode, copies, indications: mode === "variations" ? indications : "", replaceCaption: mode === "variations" && replaceCaption }),
      });
      const data = await res.json().catch(() => null);
      if (data?.code === "plan_required") { showPlanRequired("ai_auto"); return; }
      if (data?.code === "tokens") { setTokensError(true); void refreshAllowance(); return; }
      if (!res.ok || !data?.job) { setError(data?.error || t("dashboard.videos.aiError")); return; }
      setJob(data.job);
      setDrive(null);
      writeResume({ projectId, jobId: data.job.id });
    } catch {
      setError(t("dashboard.videos.aiError"));
    } finally {
      setLaunching(false);
    }
  }, [projectId, material, mode, copies, indications, replaceCaption, launching, showPlanRequired, refreshAllowance, t]);

  const sendToDrive = useCallback(async () => {
    if (!job) return;
    setError(null);
    const res = await fetch("/api/ai-dup/drive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id }) });
    const d = await res.json().catch(() => null);
    if (!res.ok || !d?.exportId) { setError(d?.error || t("dashboard.videos.aiError")); return; }
    setDrive({ id: d.exportId, status: "running", done: 0, total: job.copies.filter((c) => c.status === "done").length, folderName: d.folderName });
  }, [job, t]);

  const reset = () => { writeResume(null); setJob(null); setDrive(null); setError(null); };

  const hiddenInput = (
    <input ref={fileInputRef} type="file" accept="video/*,.mp4,.mov,.m4v,.webm" className="hidden"
      onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ""; }} />
  );

  // ═══ RÉSULTATS (lancement en cours ou terminé) ══════════════════════════════
  if (job) {
    const done = job.copies.filter((c) => c.status === "done" && !c.expired);
    const stage = job.finished ? (job.status === "failed" ? "failed" : "done") : job.status;
    const zipUrl = `/api/out/zip?files=${encodeURIComponent(done.map((c) => c.fileName).join(","))}`;
    return (
      <main className="relative space-y-6 p-6">
        <PageGlow />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-[var(--app-text)]">{t(`dashboard.videos.aiStage_${stage}`)}</h1>
              <BetaPill />
            </div>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              {t("dashboard.videos.aiReadyCount", { done: done.length, total: job.requested })} · {t(job.mode === "invisible" ? "dashboard.videos.aiModeInvisibleTitle" : "dashboard.videos.aiModeVariationsTitle")}
              {job.finished && job.tokensCents ? <> · {t("dashboard.videos.aiTokensUsed", { tokens: formatTokens(job.tokensCents) })}</> : null}
            </p>
          </div>
          {job.finished && (
            <div className="flex flex-wrap items-center gap-2">
              {done.length > 0 && (
                <>
                  <a href={zipUrl} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={PRIMARY_STYLE}>
                    <DownloadIcon /> {t("dashboard.videos.aiDownloadAll")}
                  </a>
                  <button type="button" onClick={() => void sendToDrive()} disabled={drive?.status === "running"}
                    className="duup-btn inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--app-text)] disabled:opacity-50">
                    <DriveIcon /> {t("dashboard.videos.aiDrive")}
                  </button>
                </>
              )}
              <button type="button" onClick={reset} className="duup-btn rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--app-text-muted)] hover:text-[var(--app-text)]">
                {t("dashboard.videos.aiNewRun")}
              </button>
            </div>
          )}
        </div>

        {/* Progression globale — même barre que la duplication Simple */}
        {!job.finished && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-surface-2)]">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 shadow-[0_0_18px_rgba(99,102,241,.6)] transition-[width] duration-700" style={{ width: `${Math.max(3, job.progress)}%` }} />
          </div>
        )}

        {drive && (
          <p className={`rounded-xl border px-4 py-2.5 text-sm ${drive.status === "failed" ? "border-rose-500/25 bg-rose-500/[0.06] text-rose-400" : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]"}`}>
            {drive.status === "running" && t("dashboard.videos.aiDriveSending", { done: drive.done, total: drive.total })}
            {drive.status === "done" && <>✅ {t("dashboard.videos.aiDriveDone", { folder: drive.folderName })}{drive.folderUrl && <> · <a href={drive.folderUrl} target="_blank" rel="noreferrer" className="font-semibold text-indigo-400 hover:underline">{t("dashboard.videos.aiDriveOpen")}</a></>}</>}
            {drive.status === "failed" && drive.error}
          </p>
        )}

        {job.notices.length > 0 && (
          <ul className="space-y-1.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
            {job.notices.map((n) => <li key={n}>ℹ️ {n}</li>)}
          </ul>
        )}
        {(error || job.error) && <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-sm text-red-400">{error ?? job.error}</p>}

        {/* Grille des copies */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {job.copies.map((c) => (
            <div key={c.index} className="duup-glass duup-glass--carte flex flex-col overflow-hidden rounded-2xl">
              {c.status === "done" && c.url ? (
                <video controls preload="metadata" playsInline className="aspect-[9/16] w-full bg-black object-contain" src={c.url} />
              ) : c.expired ? (
                <div className="flex aspect-[9/16] w-full flex-col items-center justify-center bg-[var(--app-surface-2)] px-4 text-center">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--app-surface)] text-[var(--app-text-faint)]"><ClockIcon /></span>
                  <p className="mt-3 text-xs font-semibold text-[var(--app-text-muted)]">{t("dashboard.videos.aiCopyExpired")}</p>
                  <p className="mt-1 text-[11px] leading-snug text-[var(--app-text-faint)]">{t("dashboard.videos.aiCopyExpiredHint")}</p>
                </div>
              ) : (
                <div className={`flex aspect-[9/16] w-full flex-col items-center justify-center px-4 text-center ${c.status === "discarded" ? "bg-rose-500/[0.05]" : "bg-indigo-500/[0.05]"}`}>
                  {c.status === "discarded"
                    ? <span className="grid h-9 w-9 place-items-center rounded-full bg-rose-500/15 text-rose-400">✕</span>
                    : <span className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />}
                  <p className={`mt-3 text-xs font-semibold ${c.status === "discarded" ? "text-rose-400" : "text-[var(--app-text)]"}`}>{t(`dashboard.videos.aiCopy_${c.status}`)}</p>
                  {c.status === "retrying" && c.retryReason && <p className="mt-1 text-[11px] text-[var(--app-text-faint)]">{c.retryReason}</p>}
                  {c.status === "discarded" && (
                    <p className="mt-1 text-[11px] leading-snug text-[var(--app-text-faint)]">{c.error}<br />{t("dashboard.videos.aiRefunded")}</p>
                  )}
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-[var(--app-text)]">{t("dashboard.videos.aiCopyN", { n: c.index + 1 })}</p>
                  {c.status === "done" && c.url && (
                    <a href={c.url} download={c.fileName ?? undefined} title={t("dashboard.videos.aiDownload")} aria-label={t("dashboard.videos.aiDownload")}
                      className="duup-btn grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)]">
                      <DownloadIcon />
                    </a>
                  )}
                </div>
                {c.summary && <p className="text-[11.5px] leading-snug text-[var(--app-text-muted)]">{c.summary}</p>}
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] text-[var(--app-text-faint)]">{t("dashboard.videos.aiDisclaimer")}</p>
      </main>
    );
  }

  // ═══ RÉGLAGES ════════════════════════════════════════════════════════════════
  const ready = material?.status === "ready";
  const analyzing = !!material && material.status !== "ready" && material.status !== "failed";
  const noTokens = mode === "variations" && (tokensError || allowance?.canSend === false);
  const canLaunch = ready && !launching && !(mode === "variations" && allowance?.canSend === false);

  const modeCard = (m: AiDupMode, icon: React.ReactNode, title: string, desc: string, recommended?: boolean) => (
    <button type="button" onClick={() => setMode(m)} aria-pressed={mode === m} aria-label={`${title} — ${desc}`}
      className={`duup-glass rounded-xl px-4 py-3.5 text-left ${mode === m ? "duup-choix--on" : ""}`}>
      <span className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${mode === m ? "bg-indigo-500/20 text-indigo-400" : "bg-[var(--app-surface-2)] text-[var(--app-text-muted)]"}`}>{icon}</span>
        <span className="text-[13.5px] font-semibold text-[var(--app-text)]">{title}</span>
        {recommended && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">{t("dashboard.videos.aiRecommended")}</span>
        )}
      </span>
      <span className="mt-2 block text-[12px] leading-snug text-[var(--app-text-muted)]">{desc}</span>
    </button>
  );

  return (
    <main className="relative space-y-8 p-6">
      <PageGlow />
      {hiddenInput}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--app-text)]">{t("dashboard.videos.aiHeroTitle")}</h1>
            <BetaPill />
          </div>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{t("dashboard.videos.aiHeroSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Vidéo démo — `aidup-demo` : le parcours de la mise à jour
              (onboarding/UpdateTour.tsx) pointe ce bouton. */}
          <span data-tour-id="aidup-demo">
            <TutorialVideoButton src="/tutorials/tuto-duplication-ia-fr.mp4" poster="/tutorials/tuto-duplication-ia-fr.jpg" title={t("dashboard.videos.aiHeroTitle")} />
          </span>
          <ModuleHelp slug="duplication-ia" />
        </div>
      </div>

      {/* 1. Vidéo */}
      <div
        data-tour-id="aidup-drop"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void upload(e.dataTransfer.files); }}
        onClick={() => !material && !uploading && fileInputRef.current?.click()}
        className={`duup-glass rounded-2xl ${material ? "p-4" : "cursor-pointer px-6 py-10"} ${dragOver ? "duup-choix--on" : ""}`}
      >
        {material ? (
          <div className="flex items-center gap-4">
            {material.analysis?.thumb
              ? <img src={material.analysis.thumb} alt="" className="h-24 w-[54px] shrink-0 rounded-lg bg-black object-cover" />
              : <div className="h-24 w-[54px] shrink-0 rounded-lg bg-[var(--app-surface-2)]" />}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-faint)]">{t("dashboard.videos.aiVideoTitle")}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--app-text)]">{material.name}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold ${ready ? "bg-emerald-500/15 text-emerald-400" : material.status === "failed" ? "bg-rose-500/15 text-rose-400" : "bg-amber-400/15 text-amber-300"}`}>
                  {!ready && material.status !== "failed" && <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />}
                  {ready ? `✓ ${t("dashboard.videos.aiReady")}` : material.status === "failed" ? t("dashboard.videos.aiFailed") : t("dashboard.videos.aiWaitAnalysis")}
                </span>
                {material.analysis?.durationSec ? <span className="text-[var(--app-text-faint)]">{Math.round(material.analysis.durationSec)} s</span> : null}
              </p>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="duup-btn shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)] hover:text-[var(--app-text)]">
              {t("dashboard.videos.aiReplace")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/15 text-indigo-400">
              {uploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <UploadIcon />}
            </span>
            <p className="mt-3 text-[15px] font-semibold text-[var(--app-text)]">{uploading ? t("dashboard.videos.aiUploading") : t("dashboard.videos.aiDrop")}</p>
            <p className="mt-1 text-xs text-[var(--app-text-faint)]">{t("dashboard.videos.aiDropHint")}</p>
          </div>
        )}
      </div>

      <div className="h-px bg-[var(--app-border)]" />

      {/* 2. Mode */}
      <section data-tour-id="aidup-mode">
        <h3 className="text-sm font-semibold text-[var(--app-text)]">{t("dashboard.videos.aiModeTitle")}</h3>
        <p className="mt-0.5 text-[12px] text-[var(--app-text-faint)]">{t("dashboard.videos.aiModeHint")}</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {modeCard("invisible", <EyeOffIcon />, t("dashboard.videos.aiModeInvisibleTitle"), t("dashboard.videos.aiModeInvisibleDesc"))}
          {modeCard("variations", <Sparkles className="h-4 w-4" />, t("dashboard.videos.aiModeVariationsTitle"), t("dashboard.videos.aiModeVariationsDesc"), true)}
        </div>
        {mode === "variations" && (
          <label data-tour-id="aidup-rewrite" className="mt-2.5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 transition hover:border-indigo-400/50">
            <input type="checkbox" className="sr-only" checked={replaceCaption} onChange={(e) => setReplaceCaption(e.target.checked)} />
            <span aria-hidden className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${replaceCaption ? "border-transparent bg-indigo-500" : "border-[var(--app-border-strong)] bg-[var(--app-surface-2)]"}`}>
              <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${replaceCaption ? "translate-x-4" : ""}`} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-[var(--app-text)]">{t("dashboard.videos.aiReplaceCaption")}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-[var(--app-text-muted)]">{t("dashboard.videos.aiReplaceCaptionHint")}</span>
            </span>
          </label>
        )}
      </section>

      {/* 3. Nombre de copies */}
      <section data-tour-id="aidup-copies">
        <h3 className="text-sm font-semibold text-[var(--app-text)]">{t("dashboard.videos.aiCopiesLabel")}</h3>
        <p className="mt-0.5 text-[12px] text-[var(--app-text-faint)]">{t("dashboard.videos.aiCopiesHint")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="inline-flex rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-0.5">
            {COPY_PRESETS.map((n) => (
              <button key={n} type="button" onClick={() => setCopies(n)} aria-pressed={copies === n}
                className={`min-w-[42px] rounded-md px-3 py-1.5 text-sm font-semibold transition ${copies === n ? "bg-indigo-500 text-white shadow-sm" : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex min-w-[220px] flex-1 items-center gap-3">
            <input aria-label={t("dashboard.videos.aiCopiesLabel")} type="range" min={MIN_COPIES} max={MAX_COPIES} value={copies}
              onChange={(e) => setCopies(Number(e.target.value))} className="w-full accent-indigo-500" />
            <input type="number" min={MIN_COPIES} max={MAX_COPIES} value={copies} aria-label={t("dashboard.videos.aiCopiesLabel")}
              onChange={(e) => setCopies(Math.max(MIN_COPIES, Math.min(MAX_COPIES, Math.floor(Number(e.target.value) || MIN_COPIES))))}
              className="w-[72px] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-center text-sm font-semibold text-[var(--app-text)] outline-none focus:border-indigo-400/70" />
          </div>
        </div>
      </section>

      {/* 4. Indications (Variations seulement : en Invisible rien n'est écrit ni dosé) */}
      {mode === "variations" && (
        <section data-tour-id="aidup-indications">
          <div className="flex items-end justify-between gap-3">
            <div>
              <label htmlFor="aidup-ind" className="text-sm font-semibold text-[var(--app-text)]">{t("dashboard.videos.aiIndicationsLabel")}</label>
              <p className="mt-0.5 text-[12px] text-[var(--app-text-faint)]">{t("dashboard.videos.aiIndicationsHint")}</p>
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-[var(--app-text-faint)]">{indications.length}/{MAX_INDICATIONS_CHARS}</span>
          </div>
          {/* Indications pré-écrites : un clic les ajoute au champ, un second
              clic les retire (la pastille reste allumée tant qu'elles y sont). */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {INDICATION_CHIPS.map((k) => {
              const phrase = t(`dashboard.videos.${k}`);
              const on = indications.includes(phrase);
              return (
                <button key={k} type="button" aria-pressed={on}
                  onClick={() => setIndications((cur) => toggleIndication(cur, phrase).slice(0, MAX_INDICATIONS_CHARS))}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${on
                    ? "border-indigo-400/70 bg-indigo-500/15 text-indigo-500"
                    : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-indigo-400/50 hover:text-[var(--app-text)]"}`}>
                  {on ? "✓ " : "+ "}{phrase}
                </button>
              );
            })}
          </div>
          <textarea id="aidup-ind" rows={3} maxLength={MAX_INDICATIONS_CHARS} value={indications} onChange={(e) => setIndications(e.target.value)}
            placeholder={t("dashboard.videos.aiIndicationsPlaceholder")}
            className="mt-3 w-full resize-none rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm leading-relaxed text-[var(--app-text)] placeholder-[var(--app-text-faint)] outline-none transition focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/15" />
        </section>
      )}

      {/* 5. Barre d'action COLLANTE (même barre que la duplication Simple). Le
          bouton est à GAUCHE : le coin bas-droit appartient à la cloche et au
          chat de support. */}
      <div className="sticky bottom-0 z-30 -mx-6 border-t border-[var(--app-border)] px-6 py-3.5"
        style={{ background: "color-mix(in srgb, var(--app-bg) 82%, transparent)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pr-20">
          <button type="button" data-tour-id="aidup-submit" onClick={() => void launch()} disabled={!canLaunch}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${canLaunch ? "text-white" : "duup-btn cursor-not-allowed text-[var(--app-text-muted)]"}`}
            style={canLaunch ? PRIMARY_STYLE : undefined}>
            <Sparkles className="h-4 w-4" />
            {launching ? t("dashboard.videos.aiLaunching") : analyzing ? t("dashboard.videos.aiWaitAnalysis") : t("dashboard.videos.aiLaunch")}
          </button>
          <div className="text-xs leading-relaxed">
            <p className="font-semibold text-[var(--app-text)]">
              {t("dashboard.videos.aiCost", { n: aiDupCost(mode, copies) })}
              <span className="font-normal text-[var(--app-text-muted)]">
                {" · "}
                {mode === "variations"
                  ? t("dashboard.videos.aiTokensEst", { tokens: formatTokens(aiDupTokenEstimateCents(mode, copies)) })
                  : t("dashboard.videos.aiNoTokensNeeded")}
              </span>
            </p>
            {mode === "variations" && allowance && (
              <p className="text-[var(--app-text-faint)]">{allowance.unlimited ? t("dashboard.videos.aiTokensUnlimited") : t("dashboard.videos.aiTokensLeft", { included: formatTokens(allowance.includedLeftCents), balance: formatTokens(allowance.balanceCents) })}</p>
            )}
          </div>
        </div>
        {noTokens && (
          <p className="mt-3 mr-16 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-2.5 text-sm text-amber-200">
            {t("dashboard.videos.aiTokensEmpty")}{" "}
            <Link href="/dashboard/abonnement" className="font-semibold underline">{t("dashboard.videos.aiBuyTokens")}</Link>
          </p>
        )}
        {error && <p className="mt-3 mr-16 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-sm text-red-400">{error}</p>}
      </div>

      {/* 6. Historique : revenir sur une duplication déjà faite. */}
      {history && history.length > 0 && (
        // pr-16 / pb-24 : la liste ne doit jamais finir sous la cloche et le
        // chat de support (coin bas-droit, fixes).
        <section className="pb-24 pr-16">
          <h3 data-tour-id="aidup-history" className="text-sm font-semibold text-[var(--app-text)]">{t("dashboard.videos.aiHistoryTitle")}</h3>
          <p className="mt-0.5 text-[12px] text-[var(--app-text-faint)]">{t("dashboard.videos.aiHistoryHint")}</p>
          <ul className="mt-3 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="duup-glass duup-glass--carte flex items-center gap-3 rounded-xl px-3 py-2.5">
                {h.thumb
                  ? <img src={h.thumb} alt="" className="h-14 w-8 shrink-0 rounded-md bg-black object-cover" />
                  : <div className="h-14 w-8 shrink-0 rounded-md bg-[var(--app-surface-2)]" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--app-text)]">{h.materialName}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[var(--app-text-muted)]">
                    <span>{new Date(h.startedAt).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <span>·</span>
                    <span>{t(h.mode === "invisible" ? "dashboard.videos.aiModeInvisibleTitle" : "dashboard.videos.aiModeVariationsTitle")}</span>
                    <span>·</span>
                    <span>{t("dashboard.videos.aiReadyCount", { done: h.done, total: h.requested })}</span>
                    {h.running && <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-400">{t("dashboard.videos.aiHistoryRunning")}</span>}
                    {h.expired && <span className="rounded-full bg-[var(--app-surface-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-faint)]">{t("dashboard.videos.aiHistoryExpired")}</span>}
                  </p>
                  {!h.running && (
                    <p className="mt-0.5 text-[11px] text-[var(--app-text-faint)]">
                      {t("dashboard.videos.aiHistoryAutoDelete", { date: new Date(h.expiresAt).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" }) })}
                    </p>
                  )}
                </div>
                {confirmDelete === h.id ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs font-medium text-[var(--app-text-muted)]">{t("dashboard.videos.aiHistoryDeleteAsk")}</span>
                    <button type="button" onClick={() => void deleteHistory(h.id)} disabled={deleting === h.id}
                      className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50">
                      {deleting === h.id ? "…" : t("dashboard.videos.aiHistoryDeleteYes")}
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(null)}
                      className="duup-btn rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)]">
                      {t("dashboard.videos.aiHistoryDeleteNo")}
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => void openHistory(h.id)} disabled={opening === h.id}
                      className="duup-btn shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-[var(--app-text)] disabled:opacity-50">
                      {opening === h.id ? "…" : t("dashboard.videos.aiHistoryView")}
                    </button>
                    {!h.running && (
                      <button type="button" onClick={() => setConfirmDelete(h.id)} aria-label={t("dashboard.videos.aiHistoryDelete")} title={t("dashboard.videos.aiHistoryDelete")}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--app-text-faint)] transition hover:bg-rose-500/10 hover:text-rose-500">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/* ── Éléments visuels partagés avec les autres pages de duplication ───────── */

/** Indications pré-écrites (clés i18n), affichées en pastilles. */
const INDICATION_CHIPS = ["aiChipTypo", "aiChipColors", "aiChipShapes", "aiChipShort", "aiChipFunny", "aiChipNoEmoji", "aiChipEnglish", "aiChipNoExtra"];

/** Ajoute la phrase aux indications (séparée par « . ») ou la retire si elle y est. */
function toggleIndication(cur: string, phrase: string): string {
  if (cur.includes(phrase)) {
    return cur.split(phrase).join("").replace(/\s*\.\s*\.+/g, ".").replace(/^\s*\.\s*|\s*\.\s*$/g, "").replace(/\s{2,}/g, " ").trim();
  }
  const base = cur.trim();
  return base ? `${base.replace(/[.\s]+$/, "")}. ${phrase}` : phrase;
}

/** Raccourcis du nombre de copies. */
const COPY_PRESETS = [1, 5, 10, 20, 50];

/** Bouton principal : dégradé indigo + liseré clair + ombre teintée (même
 *  recette que « Dupliquer les vidéos » du mode Simple). */
const PRIMARY_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg,#6366F1,#4F46E5 55%,#4338CA)",
  boxShadow: "0 10px 24px -12px rgba(79,70,229,0.85), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.25)",
};

/** Halo bleu en haut de page (comme Simple / Avancé). */
function PageGlow() {
  return (
    <div className="pointer-events-none fixed left-56 right-0 top-0 h-[500px]"
      style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(99,102,241,.12), transparent 70%)" }} />
  );
}

function BetaPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-fuchsia-500">
      <Sparkles className="h-3 w-3" /> Beta
    </span>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V4M7 9l5-5 5 5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v11M7 10l5 5 5-5M4 18v1a1 1 0 001 1h14a1 1 0 001-1v-1" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10 10 0 0112 5c5 0 9 4.5 10 7a13 13 0 01-3.2 4.2M6.6 6.6A13 13 0 002 12c1 2.5 5 7 10 7a10 10 0 004.4-1" />
    </svg>
  );
}

function DriveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#0F9D58" d="M8 3h8l6 10.5h-8z" />
      <path fill="#FFC107" d="M2 13.5L8 3l4 7-6 10.5z" />
      <path fill="#4285F4" d="M6 20.5l3-5h13l-3 5z" />
    </svg>
  );
}
