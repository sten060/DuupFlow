// src/app/(dashboard)/videos/advanced/VideoFormAdvancedClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Dropzone from "../../Dropzone";
import DriveImportButton from "@/app/dashboard/components/DriveImportButton";
import InfoTooltip from "@/app/dashboard/components/InfoTooltip";
import CountrySelect from "@/app/dashboard/components/CountrySelect";
import { setJob, addCompletedFile, removeJob, subscribe, snapshot } from "../jobStore";
import { saveActiveJob, removeActiveJob } from "../videoJobResume";
import { pushNotification } from "../../components/notificationStore";
import InterruptedRecovery from "../InterruptedRecovery";
import DurationInfoButton from "../DurationInfoButton";
import TikTokGuideButton from "../TikTokGuideButton";
import { useTranslation } from "@/lib/i18n/context";
import { probeVideoFile } from "@/lib/video/probe";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import LimitReachedModal from "@/app/dashboard/components/LimitReachedModal";
import QuotaWarningModal from "@/app/dashboard/components/QuotaWarningModal";
import UpgradePlanModal from "@/app/dashboard/components/UpgradePlanModal";
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
  const { t } = useTranslation();
  return (
    <div className="mt-6">
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg px-4 py-2 font-medium text-white transition ${
          pending ? "cursor-not-allowed bg-sky-500/50" : "bg-sky-500 hover:bg-sky-400"
        }`}
      >
        {pending ? t("dashboard.videosAdvanced.duplicating") : t("dashboard.videosAdvanced.generateButton")}
      </button>
    </div>
  );
}

/* ================== Définition des filtres ================== */
type Group = "Tags" | "Visuel" | "Mouvement" | "Mouvement poussé" | "Techniques" | "Audio" | "Options";

type Ctrl = {
  key: string;
  label: string;
  group: Group;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  type?: "toggle" | "dims" | "force";
  hint?: string;
};

const CONTROLS: Ctrl[] = [
  // Métadonnées
  { key: "meta_creation_time", label: "Date de création", group: "Tags", min: 0, max: 1, type: "toggle", hint: "Activé = date aléatoire" },
  { key: "meta_encoder", label: "Encodeur / Logiciel", group: "Tags", min: 0, max: 1, type: "toggle", hint: "Activé = logiciel aléatoire" },
  { key: "meta_brand", label: "Brand / Format container", group: "Tags", min: 0, max: 1, type: "toggle" },
  { key: "meta_uid", label: "Identifiant unique (UID)", group: "Tags", min: 0, max: 1, type: "toggle" },
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

  // Mouvement poussé — single "force" slider (0–100) per effect. The force is stored
  // in `.min`; the server maps it to safe, time-varying ffmpeg expressions.
  { key: "dyn_crop",    label: "Recadrage dynamique", group: "Mouvement poussé", min: 0, max: 100, step: 1, type: "force" },
  { key: "prog_rotate", label: "Rotation progressive", group: "Mouvement poussé", min: 0, max: 100, step: 1, type: "force" },
  { key: "prog_zoom",   label: "Zoom progressif",      group: "Mouvement poussé", min: 0, max: 100, step: 1, type: "force" },
  { key: "shake",       label: "Shake léger",          group: "Mouvement poussé", min: 0, max: 100, step: 1, type: "force" },

  { key: "dimensions_wh", label: "Dimensions", group: "Techniques", unit: "%", min: 0, max: 0, step: 0.1, type: "dims" },
  { key: "border_px", label: "Bordure (pad)", unit: "px", group: "Techniques", min: 0, max: 0, step: 1 },
  { key: "vbitrate",  label: "Bitrate vidéo", unit: "kb/s", group: "Techniques", min: 9000, max: 12000, step: 50 },
  { key: "gop",       label: "GOP", unit: "frames", group: "Techniques", min: 240, max: 300, step: 1 },
  { key: "cut_start", label: "Cut start", unit: "s", group: "Techniques", min: 0, max: 0, step: 0.1 },
  { key: "cut_end",   label: "Cut end", unit: "s", group: "Techniques", min: 0, max: 0, step: 0.1 },

  { key: "volume_db",  label: "Volume",         unit: "dB",  group: "Audio", min: 0, max: 0, step: 0.1 },
  { key: "afreq_hz",   label: "Waveform shift", unit: "Hz",  group: "Audio", min: 0, max: 0, step: 1 },
  { key: "abitrate_k", label: "Bitrate audio",  unit: "kb/s", group: "Audio", min: 0, max: 0, step: 16 },
  { key: "pitch",      label: "Pitch (tonalité)", unit: "demi-tons", group: "Audio", min: 0, max: 0, step: 0.5 },
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

  // Mouvement poussé — force 0–100 (mapped to safe bounds server-side)
  dyn_crop:     { lo: 0, hi: 100 },
  prog_rotate:  { lo: 0, hi: 100 },
  prog_zoom:    { lo: 0, hi: 100 },
  shake:        { lo: 0, hi: 100 },
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
  pitch:      { lo: -6, hi: 6, label: "−6 à +6 demi-tons" },
};

/* ============ Infos packs (infobulles) ============ */
// Stable i18n token for each filter group (group display names stay French in
// the data model but are localized at render via t("vid.group.<token>")).
const GROUP_TOKEN: Record<Group, string> = {
  Tags: "tags",
  Visuel: "visual",
  Mouvement: "motion",
  "Mouvement poussé": "motionPro",
  Techniques: "technical",
  Audio: "audio",
  Options: "options",
};

/* Default range state: every control off; force controls default to 50. */
function makeDefaultRanges(): RangeState {
  return Object.fromEntries(
    CONTROLS.map((c) => [c.key, { enabled: false, min: c.type === "force" ? 50 : c.min, max: c.max }]),
  );
}

/* ============ Built-in templates (offered by default) ============ */
// TikTok anti-detection presets. Built primarily on "Mouvement poussé" (changes the
// framing/motion the algorithm sees frame-by-frame) + temporal de-sync (cut/speed) +
// mirror (HARD). No metadata/gop/bitrate/fps/stretch — those don't help content
// detection. Force lives in `.min`; classic controls use min/max ranges (randomized
// per copy). Loaded read-only; users can tweak then save their own copy.
const BUILTIN_TEMPLATES: Template[] = [
  {
    // SOFT — high edge of imperceptible: present & effective, no visible degradation.
    name: "TikTok SOFT",
    ranges: {
      cut_start:   { enabled: true, min: 0.10, max: 0.30 }, // invisible temporal de-sync
      cut_end:     { enabled: true, min: 0.10, max: 0.30 },
      speed:       { enabled: true, min: 0.98, max: 1.02 }, // ±2% timing + audio tempo (inaudible)
      pitch:       { enabled: true, min: -0.5, max: 0.5  }, // tiny pitch shift (borderline audible)
      dyn_crop:    { enabled: true, min: 22,   max: 22   }, // slow drift, ~1.08 reframe
      prog_zoom:   { enabled: true, min: 18,   max: 18   }, // gentle Ken-Burns
      prog_rotate: { enabled: true, min: 18,   max: 18   }, // ~1.4° sweep
      dim_h:       { enabled: true, min: 2,    max: 2    }, // light height stretch (~slimmer), shifts aspect a hair
      // shake intentionally OFF — it is the only effect the eye catches.
    },
  },
  {
    // HARD — visibly transformed but subject stays clearly recognizable & publishable.
    name: "TikTok HARD",
    ranges: {
      cut_start:   { enabled: true, min: 0.15, max: 0.50 }, // lighter than before (was 0.40–1.00)
      cut_end:     { enabled: true, min: 0.15, max: 0.50 },
      speed:       { enabled: true, min: 0.95, max: 1.05 }, // ±5% timing + audio tempo
      pitch:       { enabled: true, min: -1.5, max: 1.5  }, // subtle but effective (floor 0.75 st); tempo+EQ back it up
      dyn_crop:    { enabled: true, min: 70,   max: 70   }, // strong drift + reframe
      prog_zoom:   { enabled: true, min: 45,   max: 45   },
      prog_rotate: { enabled: true, min: 70,   max: 70   }, // ~2.4° sweep
      shake:       { enabled: true, min: 1,    max: 1    }, // barely-there (force 1)
      dim_h:       { enabled: true, min: 4,    max: 4    }, // light height stretch
      volume_db:   { enabled: true, min: -3,   max: 3    }, // audio fingerprint disruption
      afreq_hz:    { enabled: true, min: 300,  max: 3000 }, // EQ peak shift
      noise:       { enabled: true, min: 2,    max: 3    }, // light grain — frame-hash hedge
      saturation:  { enabled: true, min: 0.95, max: 1.05 }, // visible grade shift (HARD only)
      contrast:    { enabled: true, min: 0.96, max: 1.04 },
      hue_rad:     { enabled: true, min: -0.04, max: 0.04 },
      // mirror (reverse) intentionally NOT preset — advised via a tip on load (text-safe only).
    },
  },
];

/* ========================= Page ========================= */
export default function VideoFormAdvancedClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [limitPlan, setLimitPlan] = useState<"free" | "solo" | null>(null);
  const [quotaWarn, setQuotaWarn] = useState<{ current: number; limit: number; plan: "free" | "solo" } | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const dzAddRef = useRef<((files: File[]) => void) | null>(null);
  const [interruptedJobId, setInterruptedJobId] = useState<string | null>(null);
  const [ranges, setRanges] = useState<RangeState>(() =>
    makeDefaultRanges()
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

  const onLoadTpl = (tpl: Template) => {
    // Merge over defaults so partial templates (e.g. built-ins that only set a few
    // keys) load cleanly and any not-yet-known keys fall back to "off".
    setRanges({ ...makeDefaultRanges(), ...tpl.ranges });
    setDimsEnabled(Boolean(tpl.ranges.dim_w?.enabled || tpl.ranges.dim_h?.enabled));
    setDimW(Number(tpl.ranges.dim_w?.min ?? 0));
    setDimH(Number(tpl.ranges.dim_h?.min ?? 0));
    // Built-in preset → gentle tip: mirror is the strongest extra lever but flips text.
    if (BUILTIN_TEMPLATES.some((b) => b.name === tpl.name)) {
      pushNotification({
        kind: "info",
        title: t("dashboard.videosAdvanced.mirrorHintTitle"),
        body: t("dashboard.videosAdvanced.mirrorHintBody"),
        duration: 9000,
      });
    }
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

  // Deep-link target for the TikTok announcement (pop-up / notif / What's New):
  // when the URL ends with #tiktok-templates, scroll to + briefly flash the
  // Templates section (where the SOFT/HARD chips live).
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#tiktok-templates") return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const el = document.getElementById("tiktok-templates");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("duup-tiktok-flash");
        setTimeout(() => el.classList.remove("duup-tiktok-flash"), 2600);
        return;
      }
      if (tries++ < 15) timer = setTimeout(tick, 200); // retry until the section mounts
    };
    timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, []);

  const groups = useMemo(() => {
    const wanted: Group[] = ["Tags", "Visuel", "Mouvement", "Mouvement poussé", "Techniques", "Audio", "Options"];
    return wanted.filter((g) => CONTROLS.some((c) => c.group === g));
  }, []);

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g, false]))
  );

  // getVideoDuration replaced by probeVideoFile() from @/lib/video/probe.ts
  // (also detects un-decodable files so we fail fast with a clear message
  // instead of getting VID-004 on the server).

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProcessing(true);
    setSubmitError(null);
    setProgress(0);
    setProgressMsg(t("dashboard.videosAdvanced.preparing"));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Register job in global store so progress persists across page navigation
    const jobId = Math.random().toString(36).slice(2, 8);
    let keepResume = false;     // keep the resume marker if the job ends interrupted (recoverable)
    setInterruptedJobId(null);  // clear any previous recovery panel
    setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: t("dashboard.videosAdvanced.preparing"), status: "running", ctrl });

    try {
      const rawForm = new FormData(e.currentTarget);
      const uploadedFiles = rawForm.getAll("files") as File[];

      // Client-side size guard — 5 GB max per file
      const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
      const oversized = uploadedFiles.filter(f => f.size > MAX_FILE_BYTES);
      if (oversized.length > 0) {
        const names = oversized.map(f => f.name).join(", ");
        throw new Error(`[CLT-006] ${t("vid.err.tooLarge", { names })}`);
      }

      // All files go directly to Railway — reliable, no Supabase size limits
      let apiForm: FormData;
      if (uploadedFiles.length > 0 && uploadedFiles[0].size > 0) {
        setProgressMsg(t("vid.upload.startCount", { total: uploadedFiles.length }));
        setProgress(0);

        // PARALLEL uploads, bounded to 4 at a time. One-by-one before was safe
        // but slow — each file waited a full round-trip to the US-West server.
        // /api/upload-direct buffers each body in RAM, so we CAP concurrency:
        // 4 × file_size peak RAM is trivial on the 24 GB container, while
        // overlapping the latency gaps makes the upload phase far faster.
        setProgressMsg(t("dashboard.videosAdvanced.sendingVideos", { count: uploadedFiles.length }));
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
            if (probe.duration > 59) {
              const e = new Error(t("dashboard.videosCommon.durationExceeded", { name: file.name, max: 59, dur: Math.round(probe.duration) }));
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
            setProgressMsg(t("dashboard.videosAdvanced.uploadProgress", { done: completedUploads, total: uploadedFiles.length }));
            setProgress(Math.round((perFile.reduce((a, b) => a + b, 0) / uploadedFiles.length) * 30));
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(UPLOAD_CONCURRENCY, uploadedFiles.length) }, uploadWorker)
        );

        setProgress(30);
        setProgressMsg(t("dashboard.videosAdvanced.sendingToServer"));

        apiForm = new FormData();
        for (const key of ["channel", "mode", "advancedRanges", "count", "country", "iphoneMeta"]) {
          const v = rawForm.get(key);
          if (v !== null) apiForm.append(key, v);
        }
        for (const id of directUploadIds) apiForm.append("directUploadIds", id);
        for (const f of uploadedFiles) apiForm.append("fileNames", f.name);
        apiForm.append("jobId", jobId);
      } else {
        apiForm = rawForm;
      }

      // Files are uploaded and the encode is about to start server-side — persist
      // the job so progress resumes if the user reloads or leaves the page.
      saveActiveJob(jobId, "advanced");

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
            // Clean, generic message — never surface raw server text to the user
            // (mirrors the simple form).
            const errMsg = `[${code}] ${t("vid.err.generic")}`;
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
                    const errMsg = `[${code}] ${evt.msg || t("vid.err.ffmpeg")}`;
                    setSubmitError(errMsg);
                    setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
                    setProcessing(false);
                    return;
                  }
                  if (evt.done) {
                    receivedDone = true;
                    if (evt.usageWarning) setQuotaWarn(evt.usageWarning);
                    if (evt.warning) {
                      setSubmitError(evt.warning);
                      setJob({ id: jobId, type: "video", channel: "advanced", progress: 100, msg: evt.warning, status: "done" });
                    } else {
                      setJob({ id: jobId, type: "video", channel: "advanced", progress: 100, msg: "Done", status: "done" });
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
            // Connection lost, but the encode keeps running server-side — don't
            // dead-end. Keep the resume marker and show the recovery panel.
            keepResume = true;
            setInterruptedJobId(jobId);
            setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: t("dashboard.videosCommon.interruptedTitle"), status: "interrupted" });
            router.refresh();
          } else {
            throw sseError;
          }
          break sseLoop;
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (ctrl.signal.reason === "timeout") {
          const errMsg = `[CLT-003] ${t("vid.err.timeout")}`;
          setSubmitError(errMsg);
          setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
        } else if (ctrl.signal.reason === "stopped") {
          // Stop button clicked — job is already marked stopped by stopJob(), keep it
        } else {
          removeJob(jobId);
        }
      } else {
        const rawMsg = (err as Error)?.message || "";
        console.error("[duplicate-video] client error:", rawMsg); // keep diagnostics for support
        const lower = rawMsg.toLowerCase();
        // Detect the client-side size guard by its error CODE (locale-independent —
        // the message itself is now translated) plus the Supabase storage phrase.
        const isStorageSize = rawMsg.includes("CLT-006") || lower.includes("maximum allowed size");
        // Client-side validation (duration > 59 s) carries a `validation` flag and an
        // already-localized, actionable message — show it as-is.
        const isValidation = (err as { validation?: boolean })?.validation === true;
        const errMsg = isStorageSize
          ? (rawMsg.includes("CLT-006") ? rawMsg : `[CLT-006] ${rawMsg}`)
          : isValidation
          ? rawMsg
          : t("dashboard.videosCommon.errorGeneric");
        setSubmitError(errMsg);
        setJob({ id: jobId, type: "video", channel: "advanced", progress: 0, msg: errMsg, status: "error", errorMsg: errMsg });
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

  const limLabel = (key: string) => (LIMITS[key] ? t(`vid.lim.${key}`) : "");

  const errorMsg = (key: string, min: number, max: number): string | null => {
    const lim = LIMITS[key];
    if (!lim) return null;
    if (min > max) return t("vid.valid.minLeMax");
    if (!inLimit(key, min) || !inLimit(key, max)) {
      return t("vid.valid.outOfRange", { range: limLabel(key) });
    }
    // règle spéciale cut_end ≥ cut_start + 0.05 si les deux activés
    if (key === "cut_end") {
      const s = ranges["cut_start"];
      if (s?.enabled && s.min !== undefined && max !== undefined && max < s.min + 0.05) {
        return t("vid.valid.cutEnd");
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

  // Mirror a job that resumed in the global store (e.g. after a reload) so the
  // big inline bar comes back too — not just the floating badge bottom-right.
  const storeJobs = useSyncExternalStore(subscribe, snapshot, () => []);
  const resumedJob = storeJobs.find((j) => j.channel === "advanced" && j.status === "running");
  const busy = processing || !!resumedJob;
  const shownProgress = processing ? progress : resumedJob ? resumedJob.progress : null;
  const shownMsg = processing ? progressMsg : resumedJob ? resumedJob.msg : "";

  return (
    <>
    <style>{`@keyframes duupTiktokFlash{0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,0)}30%{box-shadow:0 0 0 3px rgba(56,189,248,.55),0 0 32px rgba(56,189,248,.25)}}.duup-tiktok-flash{animation:duupTiktokFlash 1.3s ease-in-out 2}`}</style>
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-extrabold tracking-tight">{t("dashboard.videosAdvanced.title")}</h1>
      <div className="flex items-center gap-2">
        <TikTokGuideButton />
        <DurationInfoButton />
      </div>
    </div>
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="channel" value="advanced" />
      <input type="hidden" name="mode" value="advanced" />
      <input type="hidden" name="advancedRanges" value={JSON.stringify(serialRanges)} />
      {/* Dropzone + Copies */}
      <div data-tour-id="vadv-dropzone" className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
        <DriveImportButton accept="video" maxVideoSec={59} onFiles={(fs) => dzAddRef.current?.(fs)} />
        <Dropzone name="files" accept="video/*" multiple maxFiles={40} addFilesRef={dzAddRef} />
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-white/70 mb-1.5">{t("dashboard.videosAdvanced.copiesLabel")}</label>
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
      <div data-tour-id="vadv-settings" className="space-y-6">
      {groups.map((g) => (
        <Card
          key={g}
          title={
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}
              className="inline-flex items-center gap-2 cursor-pointer select-none"
            >
              {t(`vid.group.${GROUP_TOKEN[g]}`)}
              <InfoTooltip><span className="whitespace-pre-line">{t(`vid.help.${GROUP_TOKEN[g]}`)}</span></InfoTooltip>
              <span className="text-[10px] text-white/40">{open[g] ? "▲" : "▼"}</span>
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
                  const limText = t("vid.dims.hint");
                  return (
                    <div
                      key={key}
                      className={`rounded-xl border p-3 ${
                        dimsEnabled ? "border-sky-300 bg-sky-400/10" : "border-white/15 bg-white/[.03]"
                      }`}
                    >
                      <label className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{t("vid.dims.label")}</span>
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

                // Mouvement poussé — curseur de force unique (0–100)
                if (c.type === "force") {
                  const fv = ranges[c.key];
                  const val = Number(fv?.min ?? 50);
                  return (
                    <div
                      key={c.key}
                      className={`rounded-xl border p-3 ${
                        fv?.enabled ? "border-sky-300 bg-sky-400/10" : "border-white/15 bg-white/[.03]"
                      }`}
                    >
                      <label className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{t(`vid.ctrl.${c.key}.label`)}</span>
                        <input
                          type="checkbox"
                          checked={!!fv?.enabled}
                          onChange={(e) =>
                            setRanges((r) => ({ ...r, [c.key]: { ...r[c.key], enabled: e.target.checked } }))
                          }
                        />
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={val}
                        disabled={!fv?.enabled}
                        onChange={(e) =>
                          setRanges((r) => ({
                            ...r,
                            [c.key]: { ...r[c.key], min: Number(e.target.value), max: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-sky-400 disabled:opacity-40"
                      />
                      <div className="mt-1 flex justify-between text-[11px] text-white/55">
                        <span>{t("vid.force.subtle")}</span>
                        <span className="text-white/80">{val}</span>
                        <span>{t("vid.force.strong")}</span>
                      </div>
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
                      <span className="text-sm font-medium">{t(`vid.ctrl.${c.key}.label`)}</span>
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
                      <div className="text-[11px] text-white/60">{t("vid.ctrl.enabled")}</div>
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
                              {t("vid.range.recommended", { range: limLabel(c.key) })}
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

              {/* Localisation — in Tags group */}
              {g === "Tags" && (
                <div className="col-span-full flex flex-wrap items-end gap-4 mt-1">
                  <div className="flex-1 min-w-[200px] max-w-xs">
                    <label className="block text-sm font-medium text-white/70 mb-1">{t("dashboard.videosAdvanced.countryLabel")}</label>
                    <CountrySelect
                      name="country"
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/90"
                    />
                  </div>
                </div>
              )}

              {/* Priorité algorithme — in Options group */}
              {g === "Options" && (
                <div className="col-span-full flex flex-wrap items-end gap-4 mt-1">
                  <label className="inline-flex cursor-pointer select-none items-center gap-3 text-sm py-1.5">
                    <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-white/15 transition">
                      <input type="checkbox" name="iphoneMeta" value="1" className="sr-only peer" />
                      <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white/70 peer-checked:translate-x-4 peer-checked:bg-sky-400 peer-checked:shadow-[0_0_10px_rgba(56,189,248,.9)] transition" />
                    </span>
                    <span className="text-white/85">⚡ {t("dashboard.videosAdvanced.iphoneMetaLabel")}</span>
                  </label>
                  <InfoTooltip>{t("dashboard.videosAdvanced.iphoneMetaHint")}</InfoTooltip>
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
      </div>

      {/* Templates + Reset — anchor target for the TikTok announcement deep-link */}
      <div id="tiktok-templates" className="scroll-mt-24 rounded-2xl">
      <Card title={t("dashboard.videosAdvanced.templatesTitle")}>
        <div className="flex flex-wrap gap-2">
          <input
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            placeholder={t("dashboard.videosAdvanced.templatePlaceholder")}
            className="min-w-[220px] flex-1 rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onSaveTpl}
            className="rounded-lg bg-sky-500 px-3 py-2 text-sm text-white hover:bg-sky-400"
          >
            {t("dashboard.videosAdvanced.saveTemplate")}
          </button>
          <button
            type="button"
            onClick={onResetAll}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            {t("dashboard.videosAdvanced.resetFilters")}
          </button>
        </div>

        <TemplatesList builtins={BUILTIN_TEMPLATES} templates={templates} onLoad={onLoadTpl} onDelete={onDeleteTpl} />
      </Card>
      </div>

      <div data-tour-id="vadv-submit">
        <SubmitWithProgress pending={busy} />
      </div>

      {busy && shownProgress !== null && (
        <div className="mt-2">
          <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
            <div
              className="h-2 bg-sky-500 transition-[width] duration-200"
              style={{ width: `${Math.max(0, Math.min(100, shownProgress))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-white/70">{shownMsg || t("vid.progress.percent", { percent: shownProgress })}</p>
        </div>
      )}

      {interruptedJobId ? (
        <InterruptedRecovery jobId={interruptedJobId} onDismiss={() => setInterruptedJobId(null)} />
      ) : submitError ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {submitError}
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
      {/* Gentle 80% heads-up (free/solo) — same design, non-blocking. */}
      <QuotaWarningModal
        open={quotaWarn !== null && limitPlan === null && !showUpgrade}
        plan={quotaWarn?.plan ?? "free"}
        resource="videos"
        current={quotaWarn?.current ?? 0}
        limit={quotaWarn?.limit ?? 0}
        onClose={() => setQuotaWarn(null)}
        onUpgrade={() => { setLimitPlan(quotaWarn?.plan ?? "free"); setShowUpgrade(true); setQuotaWarn(null); }}
      />
    </>
  );
}

/* ================= Templates UI ================= */
function TemplatesList({
  builtins,
  templates,
  onLoad,
  onDelete,
}: {
  builtins: Template[];
  templates: Template[];
  onLoad: (t: Template) => void;
  onDelete: (n: string) => void;
}) {
  const { t: tr } = useTranslation();

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {builtins.map((t) => (
        <button
          key={t.name}
          type="button"
          onClick={() => onLoad(t)}
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-sm hover:bg-sky-400/20"
          title={tr("vid.tpl.load")}
        >
          <span aria-hidden>★</span>
          {t.name}
        </button>
      ))}
      {templates.map((t) => (
        <span
          key={t.name}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm"
        >
          <button type="button" onClick={() => onLoad(t)} className="underline" title={tr("vid.tpl.load")}>
            {t.name}
          </button>
          <button
            type="button"
            onClick={() => onDelete(t.name)}
            className="rounded-full bg-white/10 px-2 hover:bg-white/20"
            title={tr("vid.tpl.delete")}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}