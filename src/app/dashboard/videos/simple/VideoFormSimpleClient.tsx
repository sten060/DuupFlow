// src/app/dashboard/videos/simple/VideoFormSimpleClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Dropzone from "../../Dropzone";
import InfoTooltip from "@/app/dashboard/components/InfoTooltip";
import CountrySelect from "@/app/dashboard/components/CountrySelect";
import { setJob, addCompletedFile, removeJob, subscribe, snapshot } from "../jobStore";
import { saveActiveJob, removeActiveJob } from "../videoJobResume";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { saveSettings, loadSettings } from "@/lib/formMemory";
import { pushNotification } from "../../components/notificationStore";
import InterruptedRecovery from "../InterruptedRecovery";
import DurationInfoButton from "../DurationInfoButton";
import { useTranslation } from "@/lib/i18n/context";
import { probeVideoFile } from "@/lib/video/probe";
import LimitReachedModal from "@/app/dashboard/components/LimitReachedModal";
import UpgradePlanModal from "@/app/dashboard/components/UpgradePlanModal";

function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-white/70">
        <span>{label ?? t("vid.progress.label")}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div className="h-2.5 rounded-full bg-indigo-500 shadow-[0_0_18px_rgba(99,102,241,.6)] transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function GlowCard({
  title,
  right,
  children,
  dense = false,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <section
      className={[
        "relative rounded-2xl border border-white/[0.08]",
        "bg-white/[0.03] backdrop-blur-xl",
        dense ? "p-3" : "p-5",
      ].join(" ")}
    >
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between">
          {title ? <h3 className="text-sm font-medium leading-none text-white/80">{title}</h3> : <span />}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-3 text-sm">
      <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-white/15 transition">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
        <span className={["absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition", checked ? "translate-x-4 bg-sky-400 shadow-[0_0_10px_rgba(99,179,237,.9)]" : "bg-white/70"].join(" ")} />
      </span>
      <span className="text-white/85">{label}</span>
    </label>
  );
}

function SubmitWithProgress({ pending }: { pending: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4">
      <button
        type="submit"
        data-tour-id="video-submit"
        disabled={pending}
        className={[
          "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
          pending ? "bg-white/10 text-white/50 cursor-not-allowed" : "bg-gradient-to-r from-indigo-500 to-sky-500 text-white hover:shadow-[0_4px_20px_rgba(99,102,241,.35)]",
        ].join(" ")}
      >
        {pending ? t("dashboard.videosSimple.duplicating") : t("dashboard.videosSimple.duplicateButton")}
      </button>
    </div>
  );
}

/* ---------- Packs ---------- */
type PackKey =
  | "metadata"
  | "metadata_technical"
  | "pixel_magic"
  | "audio"
  | "motion"
  | "visual";

// Labels, hints and help text live in the i18n dictionaries
// (dashboard.videosSimple.packs.*) so they follow the user's EN/FR choice
// instead of being hard-coded in French.
const NO_VISUAL_PACKS: PackKey[] = ["metadata", "metadata_technical", "pixel_magic", "audio"];
const VISUAL_PACKS: PackKey[] = ["motion", "visual"];

function PackCard({
  name,
  label,
  hint,
  help,
  selected,
  onToggle,
}: {
  name: PackKey;
  label: string;
  hint: string;
  help: string;
  selected: boolean;
  onToggle: (n: PackKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(name)}
      className={[
        "group rounded-xl border px-4 py-3 text-left transition-all",
        selected
          ? "border-indigo-400/30 bg-indigo-500/10"
          : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <div className="font-medium text-sm text-white/85 inline-flex items-center gap-2">
        {label}
        <InfoTooltip><span className="whitespace-pre-line">{help}</span></InfoTooltip>
      </div>
      <div className="text-xs text-white/45 mt-0.5">{hint}</div>
    </button>
  );
}

/* ---------- Helpers ---------- */
// getVideoDuration replaced by probeVideoFile() from @/lib/video/probe.ts.
// The shared helper also reports whether the browser could decode the file,
// but we INTENTIONALLY do not act on that flag — iPhone HEVC videos fail to
// load in <video> on Chrome/Firefox yet are valid server-side.

/* ---------- Composant principal (SIMPLE) ---------- */
export default function VideoFormSimpleClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [limitPlan, setLimitPlan] = useState<"free" | "solo" | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [interruptedJobId, setInterruptedJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({
    metadata: false,
    metadata_technical: false,
    pixel_magic: false,
    audio: false,
    motion: false,
    visual: false,
  });
  const packsSelected = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  const [flip, setFlip] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [country, setCountry] = useState("");
  const [iphoneMeta, setIphoneMeta] = useState(false);

  const [rotEnabled, setRotEnabled] = useState(false);
  const [rotMin, setRotMin] = useState(-5);
  const [rotMax, setRotMax] = useState(5);

  const [dimEnabled, setDimEnabled] = useState(false);
  const [dimW, setDimW] = useState(1.0);
  const [dimH, setDimH] = useState(1.0);

  const singlesJSON = JSON.stringify({
    flip,
    reverse,
    rotation: { enabled: rotEnabled, min_deg: rotMin, max_deg: rotMax },
    dims: { enabled: dimEnabled, w_factor: dimW, h_factor: dimH },
  });

  // Restore the user's last-used settings (remembered per module).
  useEffect(() => {
    const s = loadSettings<{ count?: number; packs?: string[]; flip?: boolean; reverse?: boolean; country?: string; iphoneMeta?: boolean }>("videoSimple");
    if (!s) return;
    if (Array.isArray(s.packs)) {
      setSelected((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[k] = s.packs!.includes(k);
        return next;
      });
    }
    if (typeof s.flip === "boolean") setFlip(s.flip);
    if (typeof s.reverse === "boolean") setReverse(s.reverse);
    if (typeof s.country === "string") setCountry(s.country);
    if (typeof s.iphoneMeta === "boolean") setIphoneMeta(s.iphoneMeta);
    if (typeof s.count === "number" && formRef.current) {
      const el = formRef.current.elements.namedItem("count");
      if (el instanceof HTMLInputElement) el.value = String(s.count);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg(null);
    setProgress(0);
    setProgressMsg(t("dashboard.videosSimple.preparing"));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Register job in global store so progress persists across page navigation
    const jobId = Math.random().toString(36).slice(2, 8);
    let keepResume = false;     // keep the resume marker if the job ends interrupted (recoverable)
    setInterruptedJobId(null);  // clear any previous recovery panel
    setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: t("dashboard.videosSimple.preparing"), status: "running", ctrl });

    try {
      const rawForm = new FormData(e.currentTarget);
      const uploadedFiles = rawForm.getAll("files") as File[];
      // Remember these settings for next time.
      saveSettings("videoSimple", {
        count: Math.max(1, Number(rawForm.get("count")) || 1),
        packs: packsSelected,
        flip, reverse, country, iphoneMeta,
      });

      // Client-side size guard — 5 GB max per file
      const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
      const oversized = uploadedFiles.filter(f => f.size > MAX_FILE_BYTES);
      if (oversized.length > 0) {
        const names = oversized.map(f => f.name).join(", ");
        const errMsg = `[CLT-006] ${t("vid.err.tooLarge", { names })}`;
        setErrorMsg(errMsg);
        setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
        setProcessing(false);
        return;
      }

      // All files go directly to Railway — reliable, no Supabase size limits
      let apiForm: FormData;
      if (uploadedFiles.length > 0 && uploadedFiles[0].size > 0) {
        setProgressMsg(t("vid.upload.start", { total: uploadedFiles.length }));
        setProgress(0);

        // PARALLEL uploads, bounded to 4 at a time. One-by-one before was safe
        // but slow — each file waited a full round-trip to the US-West server.
        // /api/upload-direct buffers each body in RAM, so we CAP concurrency:
        // 4 × file_size peak RAM is trivial on the 24 GB container, while
        // overlapping the latency gaps makes the upload phase far faster.
        setProgressMsg(t("dashboard.videosSimple.sendingVideos", { count: uploadedFiles.length }));
        // Adaptive: 4 in parallel normally (fast), but 2 when a file is large
        // (> 1 GB) — /api/upload-direct buffers each whole file in RAM, so this
        // caps peak upload memory regardless of file size.
        const UPLOAD_CONCURRENCY = uploadedFiles.some((f) => f.size > 1024 * 1024 * 1024) ? 2 : 4;
        const directUploadIds: string[] = new Array(uploadedFiles.length);
        const perFile: number[] = new Array(uploadedFiles.length).fill(0);
        let completedUploads = 0;
        let nextUploadIndex = 0;
        const uploadWorker = async () => {
          while (true) {
            const i = nextUploadIndex++;
            if (i >= uploadedFiles.length) return;
            const file = uploadedFiles[i];
            // Client-side duration check. We do NOT reject on probe.decodable=false:
            // iPhone HEVC can't decode in a <video> on Chrome/Firefox, but ffmpeg
            // handles it server-side (which has its own probe + 1-frame fallback).
            const probe = await probeVideoFile(file);
            if (probe.duration > 50) {
              const e = new Error(t("dashboard.videosCommon.durationExceeded", { name: file.name, max: 50, dur: Math.round(probe.duration) }));
              (e as Error & { validation?: boolean }).validation = true;
              throw e;
            }
            const uploadRes = await uploadWithProgress(
              `/api/upload-direct?fileName=${encodeURIComponent(file.name)}`,
              file,
              {
                signal: ctrl.signal,
                onProgress: (frac) => {
                  perFile[i] = frac;
                  const overall = perFile.reduce((a, b) => a + b, 0) / uploadedFiles.length;
                  setProgress(Math.round(overall * 30)); // upload phase = 0–30%
                },
              },
            );
            if (!uploadRes.ok) {
              const j = await uploadRes.json().catch(() => ({}));
              throw new Error(j?.error || `[CLT-006] Erreur upload direct HTTP ${uploadRes.status}`);
            }
            const { uploadId } = await uploadRes.json();
            directUploadIds[i] = uploadId as string; // keep order aligned with fileNames
            perFile[i] = 1;
            completedUploads++;
            setProgressMsg(t("dashboard.videosSimple.uploadProgress", { done: completedUploads, total: uploadedFiles.length }));
            setProgress(Math.round((perFile.reduce((a, b) => a + b, 0) / uploadedFiles.length) * 30));
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(UPLOAD_CONCURRENCY, uploadedFiles.length) }, uploadWorker)
        );

        setProgress(30);
        setProgressMsg(t("dashboard.videosSimple.sendingToServer"));

        apiForm = new FormData();
        for (const key of ["channel", "mode", "singles", "count", "packs", "country", "iphoneMeta"]) {
          const v = rawForm.get(key);
          if (v !== null) apiForm.append(key, v);
        }
        for (const id of directUploadIds) apiForm.append("directUploadIds", id);
        for (const f of uploadedFiles) apiForm.append("fileNames", f.name);
        apiForm.append("jobId", jobId);
      } else {
        // No files or empty — send as-is (fallback / local dev)
        apiForm = rawForm;
      }

      // Files are uploaded and the encode is about to start server-side — persist
      // the job so progress resumes if the user reloads or leaves the page.
      saveActiveJob(jobId, "simple");

      // ── SSE phase with automatic reconnection ────────────────────────────────
      // Files are already on Railway (directUploadIds) so re-POSTing is free —
      // no re-upload needed. On a transient network drop we retry up to 3 times.
      const MAX_SSE_RETRIES = 3;
      let sseAttempt = 0;
      // "Tu peux quitter la page" toast — pushed ONCE, the moment the server
      // actually starts ENCODING (synced with the visible "Encodage X/Y" so the
      // user sees it; not during upload, which can't survive a reload).
      let reassured = false;

      sseLoop: while (true) {
        if (sseAttempt > 0) {
          const delay = sseAttempt * 3000; // 3 s → 6 s → 9 s
          const reconnMsg = t("vid.sse.reconnecting", { attempt: sseAttempt, max: MAX_SSE_RETRIES });
          setProgressMsg(reconnMsg);
          setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: reconnMsg, status: "running" });
          await new Promise(r => setTimeout(r, delay));
          if (ctrl.signal.aborted) throw new DOMException("Aborted", "AbortError");
        }

        let sseError: unknown = null;

        try {
          const res = await fetch("/api/duplicate-video", {
            method: "POST",
            body: apiForm,
            signal: ctrl.signal,
          });

          if (!res.ok || !res.body) {
            const text = await res.text().catch(() => "");
            let code = res.status >= 500 ? "VID-002" : "VID-001";
            let parsed: any = null;
            try { parsed = JSON.parse(text); code = parsed?.code || code; } catch {}
            // Monthly limit reached → friendly upgrade modal (no badge / inline error).
            if (parsed?.limitReached) {
              removeJob(jobId);
              setLimitPlan(parsed.plan === "solo" ? "solo" : "free");
              setProcessing(false);
              return;
            }
            const errMsg = `[${code}] ${t("vid.err.generic")}`;
            setErrorMsg(errMsg);
            setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
            setProcessing(false);
            return;
          }

          // Read Server-Sent Events stream.
          // An inactivity watchdog aborts the fetch if no chunk arrives for 12 min.
          const INACTIVITY_MS = 12 * 60 * 1000;
          let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
          const resetInactivity = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => ctrl.abort("timeout"), INACTIVITY_MS);
          };

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let receivedDone = false;

          resetInactivity();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              resetInactivity();
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split("\n");
              buf = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                try {
                  const evt = JSON.parse(line.slice(6));
                  // Encoding has visibly started → now tell the user they can leave.
                  if (!reassured && typeof evt.msg === "string" && evt.msg.includes("Encodage")) {
                    reassured = true;
                    pushNotification({
                      kind: "info",
                      title: t("dashboard.videosCommon.canLeaveTitle"),
                      body: t("dashboard.videosCommon.canLeaveBody"),
                      duration: 7000,
                    });
                  }
                  // Remap 0-100% from server to 30-100% in UI (0-30% was upload)
                  const pct = evt.percent !== undefined ? 30 + Math.round(evt.percent * 0.7) : undefined;
                  if (pct !== undefined) setProgress(pct);
                  if (evt.msg) setProgressMsg(evt.msg);
                  if (pct !== undefined || evt.msg) {
                    setJob({ id: jobId, type: "video", channel: "simple", progress: pct ?? 0, msg: evt.msg ?? "", status: "running" });
                  }
                  if (evt.fileReady) {
                    addCompletedFile(jobId, evt.fileReady);
                  }
                  if (evt.error) {
                    const code = evt.code || "VID-004";
                    const errMsg = `[${code}] ${evt.msg || t("vid.err.ffmpeg")}`;
                    setErrorMsg(errMsg);
                    setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
                    setProcessing(false);
                    return;
                  }
                  if (evt.done) {
                    receivedDone = true;
                    if (evt.warning) {
                      setErrorMsg(evt.warning);
                      setJob({ id: jobId, type: "video", channel: "simple", progress: 100, msg: evt.warning, status: "done" });
                    } else {
                      setJob({ id: jobId, type: "video", channel: "simple", progress: 100, msg: "Done", status: "done" });
                    }
                    setTimeout(() => removeJob(jobId), 6000);
                    router.refresh();
                    return;
                  }
                } catch {}
              }
            }
          } finally {
            if (inactivityTimer) clearTimeout(inactivityTimer);
          }

          if (receivedDone) break sseLoop;
          // Stream closed without done event — treat as recoverable network drop
          sseError = new Error("stream_closed_no_done");

        } catch (err: any) {
          if (err?.name === "AbortError") throw err; // stop/timeout/navigation — never retry
          sseError = err;
        }

        sseAttempt++;
        if (sseAttempt > MAX_SSE_RETRIES) {
          if ((sseError as Error)?.message === "stream_closed_no_done") {
            // Connection lost, but the encode keeps running server-side — don't
            // dead-end. Keep the resume marker and show the recovery panel.
            keepResume = true;
            setInterruptedJobId(jobId);
            setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: t("dashboard.videosCommon.interruptedTitle"), status: "interrupted" });
            router.refresh();
          } else {
            throw sseError; // exhausted retries → outer catch → CLT-005
          }
          break sseLoop;
        }
        // else: loop again after backoff delay
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (ctrl.signal.reason === "timeout") {
          const errMsg = `[CLT-003] ${t("vid.err.timeout")}`;
          setErrorMsg(errMsg);
          setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
        } else if (ctrl.signal.reason === "stopped") {
          // Stop button clicked — job is already marked stopped by stopJob(), keep it
        } else {
          // User navigated away or cancelled — remove from store silently
          removeJob(jobId);
        }
      } else {
        const rawMsg = (err as Error)?.message || "";
        console.error("[duplicate-video] client error:", rawMsg); // keep diagnostics for support
        const lower = rawMsg.toLowerCase();
        // Detect the client-side size guard by its error CODE (locale-independent —
        // the message itself is now translated) plus the Supabase storage phrase.
        const isStorageSize = rawMsg.includes("CLT-006") || lower.includes("maximum allowed size");
        // Client-side validation (duration > 50 s) carries a `validation` flag and an
        // already-localized, actionable message — show it as-is.
        const isValidation = (err as { validation?: boolean })?.validation === true;
        const errMsg = isStorageSize
          ? (rawMsg.includes("CLT-006") ? rawMsg : `[CLT-006] ${rawMsg}`)
          : isValidation
          ? rawMsg
          : t("dashboard.videosCommon.errorGeneric");
        setErrorMsg(errMsg);
        setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
        if (!isStorageSize && !isValidation) router.refresh(); // surface partial successes in the file list
      }
    } finally {
      setProcessing(false);
      // Stop persisting the job UNLESS it was interrupted (recoverable): keep the
      // marker so "Reprendre"/reload re-attaches. (On a reload this finally never
      // runs anyway, so a normal in-flight job also survives for resume.)
      if (!keepResume) removeActiveJob(jobId);
    }
  }

  // Mirror a job that resumed in the global store (e.g. after a reload) so the
  // big inline bar comes back too — not just the floating badge bottom-right.
  const storeJobs = useSyncExternalStore(subscribe, snapshot, () => []);
  const resumedJob = storeJobs.find((j) => j.channel === "simple" && j.status === "running");
  const busy = processing || !!resumedJob;
  const shownProgress = processing ? progress : resumedJob ? resumedJob.progress : null;
  const shownMsg = processing ? progressMsg : resumedJob ? resumedJob.msg : "";

  return (
    <>
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-extrabold tracking-tight">{t("dashboard.videosSimple.title")}</h1>
      <DurationInfoButton />
    </div>
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="channel" value="simple" />
      <input type="hidden" name="mode" value="simple" />
      <input type="hidden" name="singles" value={singlesJSON} />
      {country && <input type="hidden" name="country" value={country} />}
      {iphoneMeta && <input type="hidden" name="iphoneMeta" value="1" />}

      {/* Dropzone — seul élément avec bordure */}
      <div data-tour-id="video-dropzone" className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
        <Dropzone name="files" accept="video/*" multiple maxFiles={40} />
        <div data-tour-id="video-copies" className="max-w-xs">
          <label className="block text-sm font-medium text-white/70 mb-1.5">{t("dashboard.videosSimple.copiesLabel")}</label>
          <input type="number" name="count" min={1} defaultValue={1} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/90" />
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* Packs */}
      <div data-tour-id="video-packs">
        <input type="hidden" name="packs" value={packsSelected.join(",")} />
        <h3 className="text-sm font-semibold text-white/90 mb-3">{t("dashboard.videosSimple.packsTitle")} <span className="text-white/40 font-normal">{t("dashboard.videosSimple.packsCumulative")}</span></h3>

        <p className="text-xs font-medium text-indigo-300/60 uppercase tracking-wide mb-2">{t("dashboard.videosSimple.noVisualChange")}</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {NO_VISUAL_PACKS.map((k) => (
            <PackCard
              key={k}
              name={k}
              label={t(`dashboard.videosSimple.packs.${k}.label`)}
              hint={t(`dashboard.videosSimple.packs.${k}.hint`)}
              help={t(`dashboard.videosSimple.packs.${k}.help`)}
              selected={selected[k]}
              onToggle={(n) => setSelected((s) => ({ ...s, [n]: !s[n] }))}
            />
          ))}
        </div>

        <p className="text-xs font-medium text-indigo-300/60 uppercase tracking-wide mb-2">{t("dashboard.videosSimple.withVisualChange")}</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {VISUAL_PACKS.map((k) => (
            <PackCard
              key={k}
              name={k}
              label={t(`dashboard.videosSimple.packs.${k}.label`)}
              hint={t(`dashboard.videosSimple.packs.${k}.hint`)}
              help={t(`dashboard.videosSimple.packs.${k}.help`)}
              selected={selected[k]}
              onToggle={(n) => setSelected((s) => ({ ...s, [n]: !s[n] }))}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* Options */}
      <div>
        <h3 className="text-sm font-semibold text-white/90 mb-3">{t("dashboard.videosSimple.optionsTitle")}</h3>
        <div className="flex flex-wrap items-end gap-4">
          <Toggle checked={flip} onChange={setFlip} label={t("vid.opt.flip")} />
          <Toggle checked={reverse} onChange={setReverse} label={t("vid.opt.reverse")} />
          <div className="flex-1 min-w-[200px] max-w-xs">
            <label className="block text-sm font-medium text-white/70 mb-1">{t("dashboard.videosSimple.countryLabel")}</label>
            <CountrySelect
              name="country_select"
              value={country}
              onChange={setCountry}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/90"
            />
          </div>
          <Toggle checked={iphoneMeta} onChange={setIphoneMeta} label={`⚡ ${t("dashboard.videosSimple.iphoneMetaLabel")}`} />
          <InfoTooltip>{t("dashboard.videosSimple.iphoneMetaHint")}</InfoTooltip>
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      <SubmitWithProgress pending={busy} />

      {busy && shownProgress !== null && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-[width] duration-200"
              style={{ width: `${Math.max(0, Math.min(100, shownProgress))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-white/50">{shownMsg || t("vid.progress.percent", { percent: shownProgress })}</p>
        </div>
      )}

      {interruptedJobId ? (
        <InterruptedRecovery jobId={interruptedJobId} onDismiss={() => setInterruptedJobId(null)} />
      ) : errorMsg ? (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-2 text-sm text-red-400">
          {errorMsg}
        </p>
      ) : null}
    </form>

      {/* Monthly video limit reached → friendly upgrade modal, then the usual
          plan picker (UpgradePlanModal). */}
      <LimitReachedModal
        open={limitPlan !== null && !showUpgrade}
        plan={limitPlan ?? "free"}
        resource="videos"
        onClose={() => setLimitPlan(null)}
        onUpgrade={() => setShowUpgrade(true)}
      />
      <UpgradePlanModal
        open={showUpgrade}
        currentPlan={limitPlan ?? "free"}
        onClose={() => { setShowUpgrade(false); setLimitPlan(null); }}
      />
    </>
  );
}