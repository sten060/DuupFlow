// src/app/dashboard/videos/simple/VideoFormSimpleClient.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Dropzone from "../../Dropzone";
import InfoTooltip from "@/app/dashboard/components/InfoTooltip";
import { setJob, addCompletedFile, removeJob } from "../jobStore";

function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-white/70">
        <span>{label ?? "Progression"}</span>
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
  return (
    <div className="flex items-center gap-4">
      <button
        type="submit"
        disabled={pending}
        className={[
          "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
          pending ? "bg-white/10 text-white/50 cursor-not-allowed" : "bg-gradient-to-r from-indigo-500 to-sky-500 text-white hover:shadow-[0_4px_20px_rgba(99,102,241,.35)]",
        ].join(" ")}
      >
        {pending ? "Duplication en cours…" : "Dupliquer les vidéos"}
      </button>
    </div>
  );
}

/* ---------- Packs + Aide ---------- */
const PACKS: Record<
  "metadata" | "audio" | "motion" | "visual" | "technical",
  { label: string; hint: string; filters: string[] }
> = {
  metadata: { label: "Métadonnées", hint: "Titres/encodage neutre", filters: [] },
  audio:     { label: "Audio",      hint: "volume / petite EQ / bitrate", filters: ["volume", "waveformshift", "audiobitrate"] },
  motion:    { label: "Mouvement",  hint: "zoom, légère rotation",         filters: ["speed", "zoom", "rotation", "pixelshift"] },
  visual:    { label: "Visuels",    hint: "EQ, hue, unsharp, grain",       filters: ["eq", "hue", "unsharp", "noise", "vignette", "lens"] },
  technical: { label: "Technique",  hint: "bitrate vidéo, GOP, fps",       filters: ["bitrate", "gop", "profile", "fps"] },
};

const PACK_HELP: Record<keyof typeof PACKS, React.ReactNode> = {
  metadata: (
    <div>
      Aucune altération visuelle/son. Sortie MP4 H.264/AAC, yuv420p, faststart (lecture web rapide).
    </div>
  ),
  visual: (
    <div>
      Variations imperceptibles (tirées aléatoirement) :<br />
      Luminosité ±3% • Contraste ±5% • Saturation ±5% • Gamma ±3% •
      Hue ±3° • Unsharp très doux (0.3) • Grain fin (alls=2).<br />
      Aucune modification visible — uniquement des variations sub-perceptuelles.
    </div>
  ),
  motion: (
    <div>
      Modifications infimes non visuelles :<br />
      Zoom 1.01×–1.04× • Micro panoramique 0–10% • Vitesse ±1–3% (audio synchronisé).<br />
      Imperceptible à l&apos;œil, suffisant pour diversifier l&apos;empreinte numérique.
    </div>
  ),
  technical: (
    <div>
      Bitrate vidéo 10–12.5 Mb/s • GOP 230–340 • Profil H.264 (baseline/main/high) •
      Niveaux 5.0–6.0 • FPS aléatoire parmi 23.976/24/25/29.97/30/59.94/60.
    </div>
  ),
  audio: (
    <div>
      Volume ±2 dB • Petit <i>EQ peak</i> aléatoire (100–8 000 Hz, +1.5 dB) •
      Bitrate audio 96–192 kb/s. Reste discret.
    </div>
  ),
};

function PackCard({
  name,
  label,
  hint,
  selected,
  onToggle,
}: {
  name: keyof typeof PACKS;
  label: string;
  hint: string;
  selected: boolean;
  onToggle: (n: keyof typeof PACKS) => void;
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
        <InfoTooltip>{PACK_HELP[name]}</InfoTooltip>
      </div>
      <div className="text-xs text-white/45 mt-0.5">{hint}</div>
    </button>
  );
}

/* ---------- Helpers ---------- */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration); };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(0); }; // unknown → allow
    video.src = url;
  });
}

/* ---------- Composant principal (SIMPLE) ---------- */
export default function VideoFormSimpleClient() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({
    metadata: true,
    audio: false,
    motion: false,
    visual: false,
    technical: false,
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg(null);
    setProgress(0);
    setProgressMsg("Préparation…");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Register job in global store so progress persists across page navigation
    const jobId = Math.random().toString(36).slice(2, 8);
    setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: "Préparation…", status: "running", ctrl });

    try {
      const rawForm = new FormData(e.currentTarget);
      const uploadedFiles = rawForm.getAll("files") as File[];

      // Client-side size guard — 5 GB max per file
      const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
      const oversized = uploadedFiles.filter(f => f.size > MAX_FILE_BYTES);
      if (oversized.length > 0) {
        const names = oversized.map(f => f.name).join(", ");
        const errMsg = `[CLT-006] Fichier(s) trop volumineux (max 5 Go) : ${names}`;
        setErrorMsg(errMsg);
        setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
        setProcessing(false);
        return;
      }

      // All files go directly to Railway — reliable, no Supabase size limits
      let apiForm: FormData;
      if (uploadedFiles.length > 0 && uploadedFiles[0].size > 0) {
        setProgressMsg(`Envoi vidéo 1/${uploadedFiles.length}…`);
        setProgress(0);

        // Parallel uploads + duration checks (all files simultaneously)
        setProgressMsg(`Envoi de ${uploadedFiles.length} vidéo(s)…`);
        let completedUploads = 0;
        const directUploadIds = await Promise.all(
          uploadedFiles.map(async (file) => {
            // Client-side duration check (50 s max) — no server round-trip needed
            const duration = await getVideoDuration(file);
            if (duration > 50) {
              throw new Error(
                `La vidéo "${file.name}" dépasse 50 secondes (${Math.round(duration)}s). ` +
                `Durée maximum autorisée : 50 s. Veuillez rogner la vidéo avant de continuer.`
              );
            }

            // Upload directly to Railway server
            const uploadRes = await fetch(
              `/api/upload-direct?fileName=${encodeURIComponent(file.name)}`,
              { method: "POST", body: file, signal: ctrl.signal },
            );
            if (!uploadRes.ok) {
              const j = await uploadRes.json().catch(() => ({}));
              throw new Error(j?.error || `[CLT-006] Erreur upload direct HTTP ${uploadRes.status}`);
            }
            const { uploadId } = await uploadRes.json();
            completedUploads++;
            setProgressMsg(`${completedUploads}/${uploadedFiles.length} vidéo(s) envoyée(s)…`);
            setProgress(Math.round((completedUploads / uploadedFiles.length) * 30));
            return uploadId as string;
          })
        );

        setProgress(30);
        setProgressMsg("Envoi au serveur…");

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

      // ── SSE phase with automatic reconnection ────────────────────────────────
      // Files are already on Railway (directUploadIds) so re-POSTing is free —
      // no re-upload needed. On a transient network drop we retry up to 3 times.
      const MAX_SSE_RETRIES = 3;
      let sseAttempt = 0;

      sseLoop: while (true) {
        if (sseAttempt > 0) {
          const delay = sseAttempt * 3000; // 3 s → 6 s → 9 s
          const reconnMsg = `Reconnexion (${sseAttempt}/${MAX_SSE_RETRIES})…`;
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
            let msg = `HTTP ${res.status}`;
            let code = res.status >= 500 ? "VID-002" : "VID-001";
            try { const j = JSON.parse(text); msg = j?.error || msg; code = j?.code || code; } catch { if (text) msg += `: ${text.slice(0, 120)}`; }
            const errMsg = `[${code}] ${msg}`;
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
                    const errMsg = `[${code}] ${evt.msg || "Erreur FFmpeg"}`;
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
                      setJob({ id: jobId, type: "video", channel: "simple", progress: 100, msg: "Terminé", status: "done" });
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
            const errMsg = "[CLT-004] Le serveur n'a pas répondu à temps. Réessayez avec une vidéo plus courte.";
            setErrorMsg(errMsg);
            setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
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
          const errMsg = "[CLT-003] Délai dépassé — la vidéo est trop longue ou le serveur est surchargé.";
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
        const isStorageSize = rawMsg.toLowerCase().includes("trop volumineux") || rawMsg.toLowerCase().includes("maximum allowed size");
        const errMsg = isStorageSize
          ? `[CLT-006] ${rawMsg}`
          : `[CLT-005] Erreur réseau — ${rawMsg || "connexion interrompue. Réessayez."}`;
        setErrorMsg(errMsg);
        setJob({ id: jobId, type: "video", channel: "simple", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="channel" value="simple" />
      <input type="hidden" name="mode" value="simple" />
      <input type="hidden" name="singles" value={singlesJSON} />
      {country && <input type="hidden" name="country" value={country} />}
      {iphoneMeta && <input type="hidden" name="iphoneMeta" value="1" />}

      {/* Dropzone — seul élément avec bordure */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
        <Dropzone name="files" accept="video/*" multiple maxFiles={40} />
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-white/70 mb-1.5">Nombre de copies</label>
          <input type="number" name="count" min={1} defaultValue={1} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/90" />
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* Packs */}
      <div>
        <input type="hidden" name="packs" value={packsSelected.join(",")} />
        <h3 className="text-sm font-semibold text-white/90 mb-3">Packs <span className="text-white/40 font-normal">(cumulables)</span></h3>

        <p className="text-xs font-medium text-indigo-300/60 uppercase tracking-wide mb-2">Sans modification visuelle</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          {(["metadata", "audio"] as (keyof typeof PACKS)[]).map((k) => (
            <PackCard
              key={k}
              name={k}
              label={PACKS[k].label}
              hint={PACKS[k].hint}
              selected={selected[k]}
              onToggle={(n) => setSelected((s) => ({ ...s, [n]: !s[n] }))}
            />
          ))}
        </div>

        <p className="text-xs font-medium text-indigo-300/60 uppercase tracking-wide mb-2">Avec modification visuelle</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {(["motion", "technical", "visual"] as (keyof typeof PACKS)[]).map((k) => (
            <PackCard
              key={k}
              name={k}
              label={PACKS[k].label}
              hint={PACKS[k].hint}
              selected={selected[k]}
              onToggle={(n) => setSelected((s) => ({ ...s, [n]: !s[n] }))}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* Options */}
      <div>
        <h3 className="text-sm font-semibold text-white/90 mb-3">Options</h3>
        <div className="flex flex-wrap items-end gap-4">
          <Toggle checked={flip} onChange={setFlip} label="Flip (vertical)" />
          <Toggle checked={reverse} onChange={setReverse} label="Reverse (miroir horizontal)" />
          <div className="flex-1 min-w-[200px] max-w-xs">
            <label className="block text-sm font-medium text-white/70 mb-1">Localisation pays</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Ex: France, États-Unis, Japon…"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/90 placeholder:text-white/25"
            />
          </div>
          <Toggle checked={iphoneMeta} onChange={setIphoneMeta} label="⚡ Priorité d'algorithme" />
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      <SubmitWithProgress pending={processing} />

      {processing && progress !== null && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-[width] duration-200"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-white/50">{progressMsg || `Progression… ${progress}%`}</p>
        </div>
      )}

      {errorMsg && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-2 text-sm text-red-400">
          {errorMsg}
        </p>
      )}
    </form>
  );
}