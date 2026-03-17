// src/app/(dashboard)/videos/advanced/VideoFormAdvancedClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Dropzone from "../../Dropzone";
import InfoTooltip from "@/app/dashboard/components/InfoTooltip";

/* ============= UI helpers (sobre / bleu) ============= */
function Card({
  title,
  right,
  children,
}: {
  title?: React.ReactNode;   // ✅ accepte texte ou JSX
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="
        relative rounded-2xl border border-white/10 bg-white/[.035] p-4
        shadow-[inset_0_1px_0_rgba(255,255,255,.06)]
        hover:shadow-[inset_0_1px_0_rgba(255,255,255,.08),_0_0_28px_rgba(90,150,255,.18)]
        transition
      "
      style={{ backdropFilter: 'blur(8px)' }}
    >
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
    <div className="sticky bottom-0 left-0 right-0 z-10 mt-6">
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[linear-gradient(135deg,_rgba(35,80,180,.22),_rgba(75,140,255,.12))] p-3 backdrop-blur shadow-[0_0_34px_rgba(80,150,255,.22)]">
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
    </div>
  );
}

/* ================== Définition des filtres ================== */
type Group = "Visuel" | "Mouvement" | "Techniques" | "Audio" | "Boutons";

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
  { key: "flip", label: "Flip (vertical)", group: "Boutons", min: 0, max: 1, type: "toggle" },
  { key: "reverse", label: "Reverse (miroir horizontal)", group: "Boutons", min: 0, max: 1, type: "toggle" },

  { key: "saturation", label: "Saturation", group: "Visuel", min: 0.0, max: 0.0, step: 0.01 },
  { key: "contrast",   label: "Contraste",  group: "Visuel", min: 0.0, max: 0.0, step: 0.01 },
  { key: "brightness", label: "Luminosité", group: "Visuel", min: 0.0, max: 0.0, step: 0.01 },
  { key: "gamma",      label: "Gamma",      group: "Visuel", min: 0.0, max: 0.0, step: 0.01 },
  { key: "hue_rad",    label: "Teinte (Hue)", unit: "rad", group: "Visuel", min: 0.0, max: 0.0, step: 0.005 },
  { key: "vignette",   label: "Vignette (angle)", unit: "rad", group: "Visuel", min: 0.0, max: 0.0, step: 0.005 },
  { key: "noise",      label: "Grain (Noise)", group: "Visuel", min: 0, max: 0, step: 1 },
  { key: "lens_k",     label: "Correction optique (k)", group: "Visuel", min: 0.0, max: 0.0, step: 0.001 },
  { key: "unsharp",    label: "Netteté douce", group: "Visuel", min: 0, max: 0, step: 0.1 },

  { key: "speed",        label: "Vitesse", unit: "x", group: "Mouvement", min: 0.0, max: 0.0, step: 0.001 },
  { key: "zoom",         label: "Zoom",    unit: "x", group: "Mouvement", min: 0.0, max: 0.0, step: 0.001 },
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
type Template = { name: string; ranges: RangeState };

const TKEY = "duupflow_video_templates_v5";

/** ==== Bornes "dures" (FFmpeg safe) pour validation UI ==== */
const LIMITS: Record<
  string,
  { lo: number; hi: number; label?: string }
> = {
  brightness: { lo: -1, hi: 1, label: "−1.0 à +1.0 (neutre 0)" },
  saturation: { lo: 0, hi: 3, label: "0.0 à 3.0 (neutre 1.0)" },
  contrast:   { lo: 0, hi: 3, label: "0.0 à 3.0 (neutre 1.0)" },
  gamma:      { lo: 0.1, hi: 3, label: "0.1 à 3.0 (neutre 1.0)" },
  hue_rad:    { lo: -Math.PI, hi: Math.PI, label: "≈ −3.142 à +3.142 (neutre 0)" },
  vignette:   { lo: 0, hi: Math.PI, label: "0.0 à 3.142" },
  noise:      { lo: 0, hi: 64, label: "0 à 64" },
  lens_k:     { lo: -1, hi: 1, label: "−1.0 à +1.0 (neutre 0)" },
  unsharp:    { lo: 0, hi: 5, label: "0.0 à 5.0" },

  speed:        { lo: 0.5, hi: 2, label: "0.5 à 2.0 (neutre 1.0)" },
  zoom:         { lo: 0.5, hi: 3, label: "0.5 à 3.0 (neutre 1.0)" },
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
  Visuel: (
    <div>
      <b>Valeurs recommandées</b><br />
      Saturation/Contraste/Gamma&nbsp;: <b>0.9 → 1.1</b> (neutre 1) •
      Luminosité&nbsp;: <b>−0.05 → +0.05</b> (neutre 0) •
      Hue (rad)&nbsp;: <b>−0.1 → +0.1</b> •
      Vignette (rad)&nbsp;: <b>0 → 0.15</b> •
      Grain&nbsp;: <b>0 → 16</b> •
      k&nbsp;: <b>−0.3 → +0.3</b> •
      Netteté&nbsp;: <b>0 → 0.6</b>.
    </div>
  ),
  Mouvement: (
    <div>
      Vitesse (x) <b>0.9 → 1.1</b> • Zoom <b>0.95 → 1.2</b> • Pixel shift <b>0 → 8</b> •
      Rotation <b>−5 → +5</b> • FPS <b>24 → 60</b>.
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
  Boutons: (
    <div>
      <b>Flip</b> : vertical. <b>Reverse</b> : miroir horizontal. Cumulables.
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

  // Stealth mode
  const [stealthMode, setStealthMode] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TKEY);
      if (raw) setTemplates(JSON.parse(raw));
    } catch {}
  }, []);

  const saveTemplates = (next: Template[]) => {
    setTemplates(next);
    try {
      localStorage.setItem(TKEY, JSON.stringify(next));
    } catch {}
  };

  const onSaveTpl = () => {
    const name = tplName.trim();
    if (!name) return;
    const snapshot: RangeState = {
      ...ranges,
      dim_w: { enabled: dimsEnabled, min: dimW, max: dimW },
      dim_h: { enabled: dimsEnabled, min: dimH, max: dimH },
    };
    const tpl: Template = { name, ranges: snapshot };
    const next = [...templates.filter((t) => t.name !== name), tpl];
    saveTemplates(next);
    setTplName("");
  };

  const onLoadTpl = (t: Template) => {
    setRanges(t.ranges);
    setDimsEnabled(Boolean(t.ranges.dim_w?.enabled || t.ranges.dim_h?.enabled));
    setDimW(Number(t.ranges.dim_w?.min ?? 0));
    setDimH(Number(t.ranges.dim_h?.min ?? 0));
  };

  const onDeleteTpl = (name: string) => saveTemplates(templates.filter((t) => t.name !== name));

  const onResetAll = () => {
    setRanges(Object.fromEntries(CONTROLS.map((c) => [c.key, { enabled: false, min: c.min, max: c.max }])));
    setDimsEnabled(false);
    setDimW(0);
    setDimH(0);
  };

  const groups = useMemo(() => {
    const wanted: Group[] = ["Visuel", "Mouvement", "Techniques", "Audio", "Boutons"];
    return wanted.filter((g) => CONTROLS.some((c) => c.group === g));
  }, []);

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g, true]))
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProcessing(true);
    setSubmitError(null);
    setProgress(0);
    setProgressMsg("Préparation…");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const rawForm = new FormData(e.currentTarget);
      const uploadedFiles = rawForm.getAll("files") as File[];

      // Always use Supabase Storage — see simple client for rationale.
      const DIRECT_LIMIT = 0;
      const canDirect = uploadedFiles.length > 0 && uploadedFiles.every(f => f.size <= DIRECT_LIMIT);

      let apiForm: FormData;
      if (uploadedFiles.length > 0 && uploadedFiles[0].size > 0 && !canDirect) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        const userId = user?.id ?? "anon";

        setProgressMsg(`Upload 0/${uploadedFiles.length}…`);
        setProgress(0);
        let doneUploads = 0;

        const storagePaths = await Promise.all(
          uploadedFiles.map(async (file) => {
            const signRes = await fetch("/api/storage/sign-upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileName: file.name, userId }),
              signal: ctrl.signal,
            });
            if (!signRes.ok) {
              const j = await signRes.json().catch(() => ({}));
              throw new Error(j?.error || `Erreur sign-upload HTTP ${signRes.status}`);
            }
            const { token, path: storagePath } = await signRes.json();

            const uploadRes = await supabase.storage
              .from("video-uploads")
              .uploadToSignedUrl(storagePath, token, file);
            if (uploadRes.error) throw new Error(`Upload storage: ${uploadRes.error.message}`);

            doneUploads++;
            setProgress(Math.round((doneUploads / uploadedFiles.length) * 30));
            setProgressMsg(`Upload ${doneUploads}/${uploadedFiles.length}…`);
            return storagePath;
          })
        );

        setProgress(30);
        setProgressMsg("Envoi au serveur…");

        apiForm = new FormData();
        for (const key of ["channel", "mode", "ranges", "count"]) {
          const v = rawForm.get(key);
          if (v !== null) apiForm.append(key, v);
        }
        for (const sp of storagePaths) apiForm.append("storagePaths", sp);
        for (const f of uploadedFiles) apiForm.append("fileNames", f.name);
      } else {
        apiForm = rawForm;
      }

      const res = await fetch("/api/duplicate-video", {
        method: "POST",
        body: apiForm,
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}`;
        try { const j = JSON.parse(text); msg = j?.error || msg; } catch { if (text) msg += `: ${text.slice(0, 120)}`; }
        setSubmitError(msg);
        setProcessing(false);
        return;
      }

      const INACTIVITY_MS = 5 * 60 * 1000;
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
              if (evt.percent !== undefined) setProgress(30 + Math.round(evt.percent * 0.7));
              if (evt.msg) setProgressMsg(evt.msg);
              if (evt.error) {
                setSubmitError(evt.msg || "Erreur FFmpeg");
                setProcessing(false);
                return;
              }
              if (evt.done) {
                receivedDone = true;
                router.refresh(); // re-fetch server component → file list updates instantly
                return;
              }
            } catch {}
          }
        }
      } finally {
        if (inactivityTimer) clearTimeout(inactivityTimer);
      }

      if (!receivedDone) {
        setSubmitError("Le serveur n'a pas répondu à temps. Réessayez avec une vidéo plus courte.");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (ctrl.signal.reason === "timeout") {
          setSubmitError("Délai dépassé — la vidéo est trop longue ou le serveur est surchargé.");
        }
      } else {
        setSubmitError("Erreur réseau");
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
      <input type="hidden" name="stealthMode" value={stealthMode ? "true" : "false"} />

      {/* Dropzone */}
      <Dropzone name="files" accept="video/*" multiple maxFiles={25} />

      {/* Copies + aide */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Copies">
          <input
            type="number"
            name="count"
            min={1}
            defaultValue={1}
            className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90"
          />
        </Card>

        <Card
        title={
            <span className="inline-flex items-center gap-2">
              Aide rapide
              <InfoTooltip>
                Active un filtre puis renseigne <b>Min</b> et <b>Max</b>. Une valeur au hasard
                dans l'intervalle est tirée pour chaque copie. <b>Dimensions</b> s'applique
                en pourcentage (W×H) et reste constant pour toutes les copies.
              </InfoTooltip>
            </span>
          }
        >
          <p className="text-sm text-white/70">
            Pour un rendu naturel, reste dans les bornes conseillées des infobulles des packs.
          </p>
        </Card>
      </div>

      {/* Stealth Mode */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            Mode Stealth (Anti-détection)
            <InfoTooltip>
              <b>Mode Stealth activé</b> : applique des transformations beaucoup plus agressives
              pour réduire la similarité à 40-50% (au lieu de 87%). Modifie la structure interne
              de la vidéo sans changer l'apparence visuelle : noise élevé (5-15), denoise variable,
              rotation subtile (-0.5 à +0.5°), flip aléatoire, scale variation (98-102%),
              variations de bitrate (800-3000 kbps), GOP (30-250), FPS (23.5-30.5),
              format pixel aléatoire, CRF (20-26), ajustements bass/treble.
              <br/><br/>
              <b>Idéal pour contourner les détecteurs de plateforme.</b>
              <br/><br/>
              ⚠️ En mode Stealth, TOUS les filtres sont appliqués automatiquement,
              indépendamment des paramètres que vous configurez ci-dessous.
            </InfoTooltip>
          </span>
        }
      >
        <label className="inline-flex cursor-pointer select-none items-center gap-3 text-sm">
          <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-white/15 transition">
            <input
              type="checkbox"
              checked={stealthMode}
              onChange={(e) => setStealthMode(e.target.checked)}
              className="sr-only"
            />
            <span
              className={[
                "absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition",
                stealthMode
                  ? "translate-x-4 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,.9)]"
                  : "bg-white/70",
              ].join(" ")}
            />
          </span>
          <span className="text-white/85">
            {stealthMode
              ? "Stealth activé — Similarité cible: 40-50%"
              : "Stealth désactivé — Similarité: ~87%"}
          </span>
        </label>
        {stealthMode && (
          <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-400/10 p-3 text-xs text-amber-300/90">
            <p className="font-semibold">⚠️ Mode Stealth actif</p>
            <p className="mt-1">
              Toutes les transformations agressives seront appliquées automatiquement
              pour maximiser la différence détectable tout en préservant le visuel.
              Les filtres configurés manuellement ci-dessous seront ignorés.
            </p>
          </div>
        )}
      </Card>

      {/* Groupes */}
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