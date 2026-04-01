// src/app/(dashboard)/videos/advanced/VideoFormAdvancedClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Dropzone from "../../Dropzone";
import InfoTooltip from "@/app/dashboard/components/InfoTooltip";
import { setJob, addCompletedFile, removeJob } from "../jobStore";
import {
  getTemplates,
  saveTemplate,
  deleteTemplate,
  migrateTemplatesFromLocal,
} from "./templateActions";
import type { Template } from "./templateActions";

/* ============= UI helpers (sobre / bleu) ============= */
function Card({
  title,
  right,
  children,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="relative">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between">
          {title ? (
            <h3 className="text-sm font-semibold text-white/90">{title}</h3>
          ) : (
            <div />
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function SubmitWithProgress({ pending }: { pending: boolean }) {
  return (
    <div className="mt-6">
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg px-4 py-2 font-medium text-white transition ${
          pending ? "cursor-not-allowed bg-sky-500/50" : "bg-sky-500 hover:bg-sky-400"
        }`}
      >
        {pending ? "Duplication…" : "Générer"}
      </button>
    </div>
  );
}

/* ================== Définition des filtres ================== */
type Group = "Métadonnées" | "Visuel" | "Mouvement" | "Techniques" | "Audio" | "Options";

type Ctrl = {
  key: string;
  label: string;
  group: Group;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  type?: "toggle" | "dims";
  hint?: string;
};

const CONTROLS: Ctrl[] = [
  // Métadonnées
  { key: "meta_creation_time", label: "Date de création", group: "Métadonnées", min: 0, max: 1, type: "toggle", hint: "Activé = date aléatoire" },
  { key: "meta_encoder", label: "Encodeur / Logiciel", group: "Métadonnées", min: 0, max: 1, type: "toggle", hint: "Activé = logiciel aléatoire" },
  { key: "meta_brand", label: "Brand / Format container", group: "Métadonnées", min: 0, max: 1, type: "toggle" },
  { key: "meta_uid", label: "Identifiant unique (UID)", group: "Métadonnées", min: 0, max: 1, type: "toggle" },
  // Options
  { key: "flip", label: "Flip (vertical)", group: "Options", min: 0, max: 1, type: "toggle" },
  { key: "reverse", label: "Reverse (miroir horizontal)", group: "Options", min: 0, max: 1, type: "toggle" },

  // Neutral values: sat/con/gam → 1.0 (no change), brightness → 0.0, hue → 0.0
  // Setting defaults to neutral ensures enabling a filter without changing values = no effect.
  { key: "saturation", label: "Saturation", group: "Visuel", min: 0.99, max: 1.01, step: 0.001 },
  { key: "contrast",   label: "Contraste",  group: "Visuel", min: 0.99, max: 1.01, step: 0.001 },
  { key: "brightness", label: "Luminosité", group: "Visuel", min: -0.01, max: 0.01, step: 0.001 },
  { key: "gamma",      label: "Gamma",      group: "Visuel", min: 0.99, max: 1.01, step: 0.001 },
  { key: "hue_rad",    label: "Teinte (Hue)", unit: "rad", group: "Visuel", min: -0.05, max: 0.05, step: 0.005 },
  { key: "vignette",   label: "Vignette (angle)", unit: "rad", group: "Visuel", min: 0.0, max: 0.1, step: 0.005 },
  { key: "noise",      label: "Grain (Noise)", group: "Visuel", min: 0, max: 4, step: 1 },
  { key: "lens_k",     label: "Correction optique (k)", group: "Visuel", min: -0.05, max: 0.05, step: 0.001 },
  { key: "unsharp",    label: "Netteté douce", group: "Visuel", min: 0, max: 0.3, step: 0.1 },

  // Neutral values: speed/zoom → 1.0 (no change). Default 0.0 would freeze/hide the video.
  { key: "speed",        label: "Vitesse", unit: "x", group: "Mouvement", min: 0.98, max: 1.02, step: 0.001 },
  { key: "zoom",         label: "Zoom",    unit: "x", group: "Mouvement", min: 0.98, max: 1.02, step: 0.001 },
  { key: "pixelshift",   label: "Pixel shift", unit: "px", group: "Mouvement", min: 0, max: 0, step: 1 },
  { key: "rotation_deg", label: "Rotation", unit: "°", group: "Mouvement", min: 0, max: 0, step: 0.1 },
  { key: "fps",          label: "Framerate", unit: "fps", group: "Mouvement", min: 0, max: 0, step: 0.1 },

  { key: "dimensions_wh", label: "Dimensions", group: "Techniques", unit: "%", min: 0, max: 0, step: 0.1, type: "dims" },
  { key: "border_px", label: "Bordure (pad)", unit: "px", group: "Techniques", min: 0, max: 0, step: 1 },
  { key: "vbitrate",  label: "Bitrate vidéo", unit: "kb/s", group: "Techniques", min: 9000, max: 12000, step: 50 },
  { key: "gop",       label: "GOP", unit: "frames", group: "Techniques", min: 240, max: 300, step: 1 },
  { key: "cut_start", label: "Cut start", unit: "s", group: "Techniques", min: 0, max: 0, step: 0.1 },
  { key: "cut_end",   label: "Cut end", unit: "s", group: "Techniques", min: 0, max: 0, step: 0.1 },

  { key: "volume_db",  label: "Volume",         unit: "dB",  group: "Audio", min: 0, max: 0, step: 0.1 },
  { key: "afreq_hz",   label: "Waveform shift", unit: "Hz",  group: "Audio", min: 0, max: 0, step: 1 },
  { key: "abitrate_k", label: "Bitrate audio",  unit: "kb/s", group: "Audio", min: 0, max: 0, step: 16 },
];

type RangeState = Record<string, { enabled: boolean; min: number; max: number }>;

// Legacy localStorage key — used only for one-time migration to Supabase
const TKEY_BASE = "duupflow_video_templates_v5";
function tKey(userId: string) { return `${TKEY_BASE}_${userId}`; }
const MIGRATED_KEY = "duupflow_templates_migrated_v1";

/** ==== Bornes "dures" (FFmpeg safe) pour validation UI ==== */
const LIMITS: Record<
  string,
  { lo: number; hi: number; label?: string }
> = {
  brightness: { lo: -1, hi: 1, label: "neutre 0 — subtil : −0.01 → +0.01" },
  saturation: { lo: 0, hi: 3, label: "neutre 1.0 — subtil : 0.99 → 1.01" },
  contrast:   { lo: 0, hi: 3, label: "neutre 1.0 — subtil : 0.99 → 1.01" },
  gamma:      { lo: 0.1, hi: 3, label: "neutre 1.0 — subtil : 0.99 → 1.01" },
  hue_rad:    { lo: -Math.PI, hi: Math.PI, label: "neutre 0 — subtil : −0.05 → +0.05" },
  vignette:   { lo: 0, hi: Math.PI, label: "subtil : 0 → 0.1" },
  noise:      { lo: 0, hi: 64, label: "subtil : 0 → 4" },
  lens_k:     { lo: -1, hi: 1, label: "neutre 0 — subtil : −0.05 → +0.05" },
  unsharp:    { lo: 0, hi: 5, label: "subtil : 0 → 0.3" },

  speed:        { lo: 0.5, hi: 2, label: "neutre 1.0 — subtil : 0.98 → 1.02" },
  zoom:         { lo: 0.5, hi: 3, label: "neutre 1.0 — subtil : 0.98 → 1.02" },
  pixelshift:   { lo: 0, hi: 200, label: "0 à 200 px" },
  rotation_deg: { lo: -180, hi: 180, label: "−180 à +180 °" },
  fps:          { lo: 10, hi: 60, label: "10 à 60 fps" },

  border_px:  { lo: 0, hi: 200, label: "0 à 200 px" },
  vbitrate:   { lo: 500, hi: 50000, label: "500 à 50000 kb/s" },
  gop:        { lo: 10, hi: 300, label: "10 à 300" },
  cut_start:  { lo: 0, hi: 9e9, label: "≥ 0 s" },
  cut_end:    { lo: 0, hi: 9e9, label: "≥ 0 s (et > start + 0.05)" },

  volume_db:  { lo: -30, hi: 30, label: "−30 à +30 dB" },
  afreq_hz:   { lo: 20, hi: 16000, label: "20 à 16000 Hz" },
  abitrate_k: { lo: 32, hi: 320, label: "32 à 320 kb/s" },
};

/* ============ Infos packs (infobulles) ============ */
const HELP_ADVANCED: Record<Group, React.ReactNode> = {
  "Métadonnées": (
    <div>
      Active individuellement chaque métadonnée à injecter. Si aucun bouton n'est activé, les métadonnées originales sont préservées.
    </div>
  ),
  Visuel: (
    <div>
      <b>Valeurs subtiles (imperceptibles)</b><br />
      Saturation/Contraste/Gamma&nbsp;: <b>0.99 → 1.01</b> (neutre&nbsp;1.0) •
      Luminosité&nbsp;: <b>−0.01 → +0.01</b> (neutre&nbsp;0) •
      Hue&nbsp;: <b>−0.05 → +0.05</b> •
      Vignette&nbsp;: <b>0 → 0.1</b> •
      Grain&nbsp;: <b>0 → 4</b> •
      k&nbsp;: <b>−0.05 → +0.05</b> •
      Netteté&nbsp;: <b>0 → 0.3</b>.
    </div>
  ),
  Mouvement: (
    <div>
      Vitesse (x) <b>0.98 → 1.02</b> (neutre&nbsp;1.0) • Zoom <b>0.98 → 1.02</b> • Pixel shift <b>0 → 4</b> •
      Rotation <b>−1 → +1</b> • FPS <b>24 → 30</b>.
    </div>
  ),
  Techniques: (
    <div>
      Dimensions (W/H %) <b>−10 → +10</b> • Bordure <b>0 → 40</b> •
      Bitrate vidéo <b>8 000 → 12 000</b> • GOP <b>48 → 60</b> •
      Cut&nbsp;: <b>to ≥ start + 0.05s</b>.
    </div>
  ),
  Audio: (
    <div>
      Volume <b>−6 → +6</b> dB • EQ peak (f) <b>50 → 12000</b> Hz •
      Bitrate audio <b>96 → 256</b> kb/s (AAC).
    </div>
  ),
  Options: (
    <div>
      <b>Flip</b> : vertical. <b>Reverse</b> : miroir horizontal. <b>Localisation</b> : pays injecté dans les métadonnées. <b>Priorité d'algorithme</b> : métadonnées iPhone réalistes.
    </div>
  ),
};

/* ========================= Page ========================= */
export default function VideoFormAdvancedClient() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [ranges, setRanges] = useState<RangeState>(() =>
    Object.fromEntries(CONTROLS.map((c) => [c.key, { enabled: false, min: c.min, max: c.max }]))
  );

  // Dimensions
  const [dimsEnabled, setDimsEnabled] = useState(false);
  const [dimW, setDimW] = useState(0);
  const [dimH, setDimH] = useState(0);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplName, setTplName] = useState("");
  const [userId, setUserId] = useState<string>("");

  // Stealth mode
  const [stealthMode, setStealthMode] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const uid = user?.id ?? "local";
      setUserId(uid);

      // ── One-time migration: push localStorage templates to Supabase ──
      if (uid !== "local") {
        try {
          const migKey = `${MIGRATED_KEY}_${uid}`;
          if (!localStorage.getItem(migKey)) {
            const raw = localStorage.getItem(tKey(uid));
            if (raw) {
              const local: Template[] = JSON.parse(raw);
              if (local.length > 0) {
                await migrateTemplatesFromLocal(local);
              }
            }
            localStorage.setItem(migKey, "1");
          }
        } catch {}
      }

      // ── Load templates from Supabase ──
      const tpls = await getTemplates();
      setTemplates(tpls);
    });
  }, []);

  const onSaveTpl = async () => {
    const name = tplName.trim();
    if (!name) return;
    const snapshot: RangeState = {
      ...ranges,
      dim_w: { enabled: dimsEnabled, min: dimW, max: dimW },
      dim_h: { enabled: dimsEnabled, min: dimH, max: dimH },
    };
    await saveTemplate(name, snapshot);
    setTemplates(await getTemplates());
    setTplName("");
  };

  const onLoadTpl = (t: Template) => {
    setRanges(t.ranges);
    setDimsEnabled(Boolean(t.ranges.dim_w?.enabled || t.ranges.dim_h?.enabled));
    setDimW(Number(t.ranges.dim_w?.min ?? 0));
    setDimH(Number(t.ranges.dim_h?.min ?? 0));
  };

  const onDeleteTpl = async (name: string) => {
    await deleteTemplate(name);
    setTemplates(await getTemplates());
  };

  const onResetAll = () => {
    setRanges(Object.fromEntries(CONTROLS.map((c) => [c.key, { enabled: false, min: c.min, max: c.max }])));
    setDimsEnabled(false);
    setDimW(0);
    setDimH(0);
  };

  const groups = useMemo(() => {
    const wanted: Group[] = ["Métadonnées", "Visuel", "Mouvement", "Techniques", "Audio", "Options"];
    return wanted.filter((g) => CONTROLS.some((c) => c.group === g));
  }, []);

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g, false]))
  );

  function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      const url = URL.createObjectURL(file);
      video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration); };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      video.src = url;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProcessing(true);
    setSubmitError(null);
    setProgress(0);
    setProgressMsg("Préparation…");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Register job in global store so progress persists across page navigation
    const jobId = Math.random().toString(36).slice(2, 8);
    setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: "Préparation…", status: "running", ctrl });

    try {
      const rawForm = new FormData(e.currentTarget);
      const uploadedFiles = rawForm.getAll("files") as File[];

      // Client-side size guard — 5 GB max per file
      const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
      const oversized = uploadedFiles.filter(f => f.size > MAX_FILE_BYTES);
      if (oversized.length > 0) {
        const names = oversized.map(f => f.name).join(", ");
        throw new Error(`[CLT-006] Fichier(s) trop volumineux (max 5 Go) : ${names}`);
      }

      // All files go directly to Railway — reliable, no Supabase size limits
      let apiForm: FormData;
      if (uploadedFiles.length > 0 && uploadedFiles[0].size > 0) {
        setProgressMsg(`Envoi vidéos (0/${uploadedFiles.length})…`);
        setProgress(0);

        // Parallel uploads + duration checks (all files simultaneously)
        setProgressMsg(`Envoi de ${uploadedFiles.length} vidéo(s)…`);
        let completedUploads = 0;
        const directUploadIds = await Promise.all(
          uploadedFiles.map(async (file) => {
            // Client-side duration check (50 s max)
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
        for (const key of ["channel", "mode", "advancedRanges", "count"]) {
          const v = rawForm.get(key);
          if (v !== null) apiForm.append(key, v);
        }
        for (const id of directUploadIds) apiForm.append("directUploadIds", id);
        for (const f of uploadedFiles) apiForm.append("fileNames", f.name);
        apiForm.append("jobId", jobId);
      } else {
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
          setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: reconnMsg, status: "running" });
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
            setSubmitError(errMsg);
            setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
            setProcessing(false);
            return;
          }

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
                  const pct = evt.percent !== undefined ? 30 + Math.round(evt.percent * 0.7) : undefined;
                  if (pct !== undefined) setProgress(pct);
                  if (evt.msg) setProgressMsg(evt.msg);
                  if (pct !== undefined || evt.msg) {
                    setJob({ id: jobId, type: "video", channel: "advanced", progress: pct ?? 0, msg: evt.msg ?? "", status: "running" });
                  }
                  if (evt.fileReady) {
                    addCompletedFile(jobId, evt.fileReady);
                  }
                  if (evt.error) {
                    const code = evt.code || "VID-004";
                    const errMsg = `[${code}] ${evt.msg || "Erreur FFmpeg"}`;
                    setSubmitError(errMsg);
                    setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
                    setProcessing(false);
                    return;
                  }
                  if (evt.done) {
                    receivedDone = true;
                    if (evt.warning) {
                      setSubmitError(evt.warning);
                      setJob({ id: jobId, type: "video", channel: "advanced", progress: 100, msg: evt.warning, status: "done" });
                    } else {
                      setJob({ id: jobId, type: "video", channel: "advanced", progress: 100, msg: "Terminé", status: "done" });
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
          sseError = new Error("stream_closed_no_done");

        } catch (err: any) {
          if (err?.name === "AbortError") throw err;
          sseError = err;
        }

        sseAttempt++;
        if (sseAttempt > MAX_SSE_RETRIES) {
          if ((sseError as Error)?.message === "stream_closed_no_done") {
            const errMsg = "[CLT-004] Le serveur n'a pas répondu à temps. Réessayez avec une vidéo plus courte.";
            setSubmitError(errMsg);
            setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
          } else {
            throw sseError;
          }
          break sseLoop;
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (ctrl.signal.reason === "timeout") {
          const errMsg = "[CLT-003] Délai dépassé — la vidéo est trop longue ou le serveur est surchargé.";
          setSubmitError(errMsg);
          setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
        } else if (ctrl.signal.reason === "stopped") {
          // Stop button clicked — job is already marked stopped by stopJob(), keep it
        } else {
          removeJob(jobId);
        }
      } else {
        const rawMsg = (err as Error)?.message || "";
        const isStorageSize = rawMsg.toLowerCase().includes("trop volumineux") || rawMsg.toLowerCase().includes("maximum allowed size");
        const errMsg = isStorageSize
          ? `[CLT-006] ${rawMsg}`
          : `[CLT-005] Erreur réseau — ${rawMsg || "connexion interrompue. Réessayez."}`;
        setSubmitError(errMsg);
        setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
      }
    } finally {
      setProcessing(false);
    }
  }

  const serialRanges: RangeState = {
    ...ranges,
    dim_w: { enabled: dimsEnabled, min: dimW, max: dimW },
    dim_h: { enabled: dimsEnabled, min: dimH, max: dimH },
  };

  /* ---- helpers validation ---- */
  const inLimit = (key: string, n: number) => {
    const lim = LIMITS[key];
    if (!lim || !Number.isFinite(n)) return true;
    return n >= lim.lo && n <= lim.hi;
  };

  const errorMsg = (key: string, min: number, max: number): string | null => {
    const lim = LIMITS[key];
    if (!lim) return null;
    if (min > max) return "Min doit être ≤ Max.";
    if (!inLimit(key, min) || !inLimit(key, max)) {
      return `Hors bornes : ${lim.label ?? `${lim.lo} à ${lim.hi}`}`;
    }
    // règle spéciale cut_end ≥ cut_start + 0.05 si les deux activés
    if (key === "cut_end") {
      const s = ranges["cut_start"];
      if (s?.enabled && s.min !== undefined && max !== undefined && max < s.min + 0.05) {
        return "Cut end doit être ≥ start + 0.05 s.";
      }
    }
    return null;
  };

  const inputClass = (bad: boolean) =>
    [
      "w-1/2 rounded-md border bg-transparent px-2 py-1 text-sm",
      bad
        ? "border-red-400/70 focus:outline-none focus:ring-2 focus:ring-red-400/50"
        : "border-white/15 focus:outline-none focus:ring-2 focus:ring-sky-400/40",
    ].join(" ");

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="channel" value="advanced" />
      <input type="hidden" name="mode" value="advanced" />
      <input type="hidden" name="advancedRanges" value={JSON.stringify(serialRanges)} />
      {/* Dropzone + Copies */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
        <Dropzone name="files" accept="video/*" multiple maxFiles={40} />
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-white/70 mb-1.5">Nombre de copies</label>
          <input
            type="number"
            name="count"
            min={1}
            defaultValue={1}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/90"
          />
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* Groupes de filtres */}
      {groups.map((g) => (
        <Card
          key={g}
          title={
            <span className="inline-flex items-center gap-2">
              {g}
              <InfoTooltip>{HELP_ADVANCED[g]}</InfoTooltip>
            </span>
          }
          right={
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}
              className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              {open[g] ? "Replier" : "Déplier"}
            </button>
          }
        >
          {open[g] && (
            <div
              className="mt-1 grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
            >
              {CONTROLS.filter((c) => c.group === g).map((c) => {
                // Dimensions
                if (c.type === "dims") {
                  const key = "dimensions_wh";
                  const limText = "Conseil : −10 % → +10 %";
                  return (
                    <div
                      key={key}
                      className={`rounded-xl border p-3 ${
                        dimsEnabled ? "border-sky-300 bg-sky-400/10" : "border-white/15 bg-white/[.03]"
                      }`}
                    >
                      <label className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">Dimensions — Width × Height</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-white/60">%</span>
                          <input
                            type="checkbox"
                            checked={dimsEnabled}
                            onChange={(e) => setDimsEnabled(e.target.checked)}
                          />
                        </div>
                      </label>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={0.1}
                          value={dimW}
                          onChange={(e) => setDimW(Number(e.target.value))}
                          className={inputClass(false)}
                          placeholder="W %"
                        />
                        <input
                          type="number"
                          step={0.1}
                          value={dimH}
                          onChange={(e) => setDimH(Number(e.target.value))}
                          className={inputClass(false)}
                          placeholder="H %"
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-white/60">{limText}</div>
                    </div>
                  );
                }

                // Ranges classiques + erreurs
                const v = ranges[c.key];
                const isToggle = c.type === "toggle";

                const lim = LIMITS[c.key];
                const bad =
                  !isToggle &&
                  v.enabled &&
                  (v.min > v.max ||
                    (lim && (v.min < lim.lo || v.max > lim.hi)) ||
                    (c.key === "cut_end" &&
                      v.enabled &&
                      ranges["cut_start"]?.enabled &&
                      v.max < (ranges["cut_start"]?.min ?? 0) + 0.05));

                const msg = !isToggle && v.enabled ? errorMsg(c.key, v.min, v.max) : null;

                return (
                  <div
                    key={c.key}
                    className={`rounded-xl border p-3 ${
                      v.enabled
                        ? bad
                          ? "border-red-400/70 bg-red-400/10"
                          : "border-sky-300 bg-sky-400/10"
                        : "border-white/15 bg-white/[.03]"
                    }`}
                  >
                    <label className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{c.label}</span>
                      <div className="flex items-center gap-2">
                        {c.unit && <span className="text-[11px] text-white/60">{c.unit}</span>}
                        <input
                          type="checkbox"
                          checked={v.enabled}
                          onChange={(e) =>
                            setRanges((r) => ({ ...r, [c.key]: { ...r[c.key], enabled: e.target.checked } }))
                          }
                        />
                      </div>
                    </label>

                    {isToggle ? (
                      <div className="text-[11px] text-white/60">Activé</div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step={c.step ?? 1}
                            value={v.min}
                            onChange={(e) =>
                              setRanges((r) => ({ ...r, [c.key]: { ...r[c.key], min: Number(e.target.value) } }))
                            }
                            className={inputClass(
                              v.enabled && lim ? v.min < lim.lo || v.min > lim.hi : false
                            )}
                            placeholder="Min"
                          />
                          <input
                            type="number"
                            step={c.step ?? 1}
                            value={v.max}
                            onChange={(e) =>
                              setRanges((r) => ({ ...r, [c.key]: { ...r[c.key], max: Number(e.target.value) } }))
                            }
                            className={inputClass(
                              v.enabled && lim ? v.max < lim.lo || v.max > lim.hi : false
                            )}
                            placeholder="Max"
                          />
                        </div>

                        <div className="mt-1 text-[11px]">
                          {msg ? (
                            <span className="text-red-400">{msg}</span>
                          ) : lim ? (
                            <span className="text-white/55">
                              Bornes conseillées : {lim.label ?? `${lim.lo} à ${lim.hi}`}
                            </span>
                          ) : (
                            <span className="text-white/55">—</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Localisation + Priorité algorithme — in Métadonnées group */}
              {g === "Métadonnées" && (
                <>
                  <div className="col-span-full flex flex-wrap items-end gap-4 mt-1">
                    <div className="flex-1 min-w-[200px] max-w-xs">
                      <label className="block text-sm font-medium text-white/70 mb-1">Localisation pays</label>
                      <input
                        type="text"
                        name="country"
                        placeholder="Ex: France, États-Unis, Japon…"
                        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/90 placeholder:text-white/25"
                      />
                    </div>
                    <label className="inline-flex cursor-pointer select-none items-center gap-3 text-sm py-1.5">
                      <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-white/15 transition">
                        <input type="checkbox" name="iphoneMeta" value="1" className="sr-only peer" />
                        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white/70 peer-checked:translate-x-4 peer-checked:bg-sky-400 peer-checked:shadow-[0_0_10px_rgba(56,189,248,.9)] transition" />
                      </span>
                      <span className="text-white/85">⚡ Priorité d'algorithme</span>
                    </label>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      ))}

      {/* Templates + Reset */}
      <Card title="Templates">
        <div className="flex flex-wrap gap-2">
          <input
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            placeholder="Nom de la template…"
            className="min-w-[220px] flex-1 rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onSaveTpl}
            className="rounded-lg bg-sky-500 px-3 py-2 text-sm text-white hover:bg-sky-400"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={onResetAll}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            Reset filtres
          </button>
        </div>

        <TemplatesList templates={templates} onLoad={onLoadTpl} onDelete={onDeleteTpl} />
      </Card>

      <SubmitWithProgress pending={processing} />

      {processing && progress !== null && (
        <div className="mt-2">
          <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
            <div
              className="h-2 bg-sky-500 transition-[width] duration-200"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-white/70">{progressMsg || `Progression… ${progress}%`}</p>
        </div>
      )}

      {submitError && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {submitError}
        </p>
      )}
    </form>
  );
}

/* ================= Templates UI ================= */
function TemplatesList({
  templates,
  onLoad,
  onDelete,
}: {
  templates: Template[];
  onLoad: (t: Template) => void;
  onDelete: (n: string) => void;
}) {
  if (templates.length === 0) return <p className="text-sm text-white/55">Aucune template.</p>;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {templates.map((t) => (
        <span
          key={t.name}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm"
        >
          <button type="button" onClick={() => onLoad(t)} className="underline" title="Charger">
            {t.name}
          </button>
          <button
            type="button"
            onClick={() => onDelete(t.name)}
            className="rounded-full bg-white/10 px-2 hover:bg-white/20"
            title="Supprimer"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}