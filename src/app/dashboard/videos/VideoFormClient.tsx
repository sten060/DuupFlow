"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Dropzone from "../Dropzone";
import ToggleChip from "../ToggleChip";
import { duplicateVideos } from "../actions";

/* ---------- UI helpers ---------- */
function SubmitWithProgress() {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg px-4 py-2 text-white transition ${
          pending ? "bg-gray-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500"
        }`}
      >
        {pending ? "Duplication en cours…" : "Dupliquer les vidéos"}
      </button>

      {pending && (
        <div className="w-full bg-white/10 rounded-full h-2.5 mt-3 overflow-hidden">
          <div className="h-2.5 w-3/4 rounded-full animate-pulse bg-indigo-500" />
        </div>
      )}
    </>
  );
}

/* ---------- Définition des packs (Simple) ---------- */
const PACKS: Record<
  "metadata" | "audio" | "motion" | "visual" | "technical",
  { label: string; hint: string; filters: string[] }
> = {
  metadata: {
    label: "Métadonnées",
    hint: "invisible (titres/commentaires, encodage neutre)",
    filters: [],
  },
  audio: {
    label: "Audio",
    hint: "volume ±1 dB, shift fréquentiel léger, débit audio",
    filters: ["volume", "waveformshift", "audiobitrate"],
  },
  motion: {
    label: "Mouvement",
    hint: "vitesse ±1.5%, zoom léger, rotation minime, pixel shift",
    filters: ["speed", "zoom", "rotation", "pixelshift"],
  },
  visual: {
    label: "Visuels",
    hint: "eq (B/C/S), hue, unsharp doux, noise doux, vignette/lens",
    filters: ["eq", "hue", "unsharp", "noise", "vignette", "lens"],
  },
  technical: {
    label: "Technique",
    hint: "bitrate vidéo, GOP, profil/level H.264, framerate",
    filters: ["bitrate", "gop", "profile", "fps"],
  },
};

/* ---------- Contrôles Avancé (min/max) ---------- */
const ADVANCED_CONTROLS: {
  key: string;
  label: string;
  unit?: string;
  minDefault: number;
  maxDefault: number;
  step?: number;
  group: "Visuel" | "Temps/Mouvement" | "Technique (vidéo)" | "Audio";
}[] = [
  // Visuel
  { key: "eq_brightness", label: "EQ: Brightness", unit: "", minDefault: -0.03, maxDefault: 0.03, step: 0.001, group: "Visuel" },
  { key: "eq_contrast", label: "EQ: Contrast", unit: "", minDefault: 0.97, maxDefault: 1.03, step: 0.001, group: "Visuel" },
  { key: "eq_saturation", label: "EQ: Saturation", unit: "", minDefault: 0.97, maxDefault: 1.03, step: 0.001, group: "Visuel" },
  { key: "hue_rad", label: "Teinte (Hue) [rad]", unit: "rad", minDefault: -0.03, maxDefault: 0.03, step: 0.001, group: "Visuel" },
  { key: "unsharp_amt", label: "Unsharp doux", unit: "", minDefault: 0.0, maxDefault: 1.0, step: 0.1, group: "Visuel" },
  { key: "rotation_deg", label: "Rotation [°]", unit: "°", minDefault: -2, maxDefault: 2, step: 0.1, group: "Visuel" },
  { key: "dimension_scale", label: "Dimension ±%", unit: "%", minDefault: -4, maxDefault: 4, step: 0.1, group: "Visuel" },
  { key: "pixelsize_factor", label: "Pixelation (facteur)", unit: "x", minDefault: 2, maxDefault: 6, step: 1, group: "Visuel" },
  { key: "pixelshift_px", label: "Pixel shift [px]", unit: "px", minDefault: 1, maxDefault: 2, step: 1, group: "Visuel" },
  { key: "zoom_factor", label: "Zoom", unit: "x", minDefault: 1.02, maxDefault: 1.08, step: 0.001, group: "Visuel" },
  { key: "vignette_angle", label: "Vignette (angle)", unit: "rad", minDefault: Math.PI/12, maxDefault: Math.PI/6, step: 0.001, group: "Visuel" },
  { key: "lens_k", label: "Lens correction (k)", unit: "", minDefault: -0.03, maxDefault: 0.03, step: 0.001, group: "Visuel" },
  { key: "noise_level", label: "Noise (léger)", unit: "", minDefault: 1, maxDefault: 5, step: 1, group: "Visuel" },
  { key: "border_pad", label: "Bordure (pad) [px]", unit: "px", minDefault: 2, maxDefault: 6, step: 1, group: "Visuel" },

  // Temps / Mouvement
  { key: "speed_factor", label: "Vitesse", unit: "x", minDefault: 0.985, maxDefault: 1.015, step: 0.001, group: "Temps/Mouvement" },
  { key: "fps_value", label: "Framerate", unit: "fps", minDefault: 24.1, maxDefault: 25.9, step: 0.001, group: "Temps/Mouvement" },

  // Technique (vidéo)
  { key: "bitrate_k", label: "Bitrate vidéo", unit: "kb/s", minDefault: 100, maxDefault: 2000, step: 50, group: "Technique (vidéo)" },
  { key: "gop_n", label: "GOP", unit: "frames", minDefault: 50, maxDefault: 100, step: 1, group: "Technique (vidéo)" },

  // Audio
  { key: "volume_db", label: "Volume [dB]", unit: "dB", minDefault: -1, maxDefault: 1, step: 0.1, group: "Audio" },
  { key: "afreq_hz", label: "Waveform shift [Hz]", unit: "Hz", minDefault: -120, maxDefault: 120, step: 1, group: "Audio" },
  { key: "abitrate_k", label: "Audio bitrate", unit: "kb/s", minDefault: 96, maxDefault: 256, step: 32, group: "Audio" },
];

/* ---------- Templates (localStorage) ---------- */
type Template = { name: string; ranges: Record<string, { min: number; max: number; enabled: boolean }> };
const TEMPL_KEY = "zeno_video_templates_v1";

/* ---------- Composants ---------- */
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
      className={`rounded-xl border px-4 py-3 text-left transition ${
        selected ? "border-indigo-400 bg-indigo-500/10" : "border-white/15 hover:bg-white/5"
      }`}
    >
      <div className="font-semibold">{label}</div>
      <div className="text-xs text-white/60">{hint}</div>
    </button>
  );
}

/* ---------- Onglet SIMPLE (avec Filtres seuls) ---------- */
function SimpleTab({ channel }: { channel: "simple" | "advanced" }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({
    metadata: true,
    audio: false,
    motion: false,
    visual: false,
    technical: false,
  });
  const packsSelected = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  // --- Filtres seuls (cumulables) ---
  const [flip, setFlip] = useState(false);              // vertical
  const [reverse, setReverse] = useState(false);        // miroir horizontal
  const [rot, setRot] = useState(0);                    // degrés
  const [dimW, setDimW] = useState(0);                  // %
  const [dimH, setDimH] = useState(0);                  // %
  const [border, setBorder] = useState(0);              // px

  // sérialisation pour le serveur
  const singlesJSON = JSON.stringify({
    flip, reverse,
    rotation_deg: rot,
    dim_w_pct: dimW,
    dim_h_pct: dimH,
    border_px: border,
  });

  return (
    <form action={duplicateVideos} method="post" className="space-y-6">
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="mode" value="simple" />
      <input type="hidden" name="singles" value={singlesJSON} />

      <Dropzone name="files" accept="video/*" multiple maxFiles={25} />

      <div>
        <label className="block text-sm font-medium mb-2 text-white/80">Nombre de copies</label>
        <input
          type="number"
          name="count"
          min={1}
          defaultValue={1}
          className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90"
        />
      </div>

      {/* Packs */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-white/90 mb-2">Packs (cumulables)</legend>
        <input type="hidden" name="packs" value={packsSelected.join(",")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.keys(PACKS) as (keyof typeof PACKS)[]).map((k) => (
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
        <div className="text-xs text-white/50">
          Note : ces packs restent <b>très légers</b>. Les filtres ci-dessous s’appliquent en plus.
        </div>
      </fieldset>

      {/* Filtres seuls (cumulables) */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <h3 className="font-semibold">Filtres seuls (cumulables)</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flip} onChange={(e)=>setFlip(e.target.checked)} />
            <span>Flip (vertical)</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reverse} onChange={(e)=>setReverse(e.target.checked)} />
            <span>Reverse (miroir horizontal)</span>
          </label>
        </div>

        <div className="space-y-4">
          {/* Rotation */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <label className="font-medium">Rotation (°)</label>
              <span className="text-white/70">Valeur : {rot.toFixed(1)}°</span>
            </div>
            <input type="range" min={-10} max={10} step={0.1} value={rot} onChange={(e)=>setRot(Number(e.target.value))}
              className="w-full" />
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <label className="font-medium">Dimension – Largeur (%)</label>
                <span className="text-white/70">Valeur : {dimW.toFixed(1)}%</span>
              </div>
              <input type="range" min={-20} max={20} step={0.1} value={dimW} onChange={(e)=>setDimW(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <label className="font-medium">Dimension – Hauteur (%)</label>
                <span className="text-white/70">Valeur : {dimH.toFixed(1)}%</span>
              </div>
              <input type="range" min={-20} max={20} step={0.1} value={dimH} onChange={(e)=>setDimH(Number(e.target.value))} className="w-full" />
            </div>
          </div>

          {/* Bordure */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <label className="font-medium">Bordure (pad) [px]</label>
              <span className="text-white/70">Valeur : {border.toFixed(0)}px</span>
            </div>
            <input type="range" min={0} max={40} step={1} value={border} onChange={(e)=>setBorder(Number(e.target.value))}
              className="w-full" />
          </div>
        </div>
      </section>

      <SubmitWithProgress />
    </form>
  );
}

/* ---------- Onglet AVANCÉ (inchangé ici) ---------- */
function AdvancedTab({ channel }: { channel: "simple" | "advanced" }) {
  const [ranges, setRanges] = useState<Record<string, { min: number; max: number; enabled: boolean }>>(
    () =>
      Object.fromEntries(
        ADVANCED_CONTROLS.map((c) => [
          c.key,
          { min: c.minDefault, max: c.maxDefault, enabled: false },
        ])
      )
  );

  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplName, setTplName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TEMPL_KEY);
      if (raw) setTemplates(JSON.parse(raw));
    } catch {}
  }, []);

  const saveTemplates = (next: Template[]) => {
    setTemplates(next);
    try {
      localStorage.setItem(TEMPL_KEY, JSON.stringify(next));
    } catch {}
  };

  const onSaveTpl = () => {
    const cleanName = tplName.trim();
    if (!cleanName) return;
    const tpl: Template = { name: cleanName, ranges };
    const next = [...templates.filter((t) => t.name !== cleanName), tpl];
    saveTemplates(next);
    setTplName("");
  };

  const onLoadTpl = (t: Template) => setRanges(t.ranges);
  const onDeleteTpl = (name: string) => saveTemplates(templates.filter((t) => t.name !== name));
  const onReset = () => setRanges(Object.fromEntries(ADVANCED_CONTROLS.map((c) => [c.key, { min: c.minDefault, max: c.maxDefault, enabled: false }])));

  const rangesJSON = JSON.stringify(ranges);
  const groups = Array.from(new Set(ADVANCED_CONTROLS.map((c) => c.group))) as (typeof ADVANCED_CONTROLS[number]["group"])[];

  return (
    <form action={duplicateVideos} method="post" className="space-y-6">
      <input type="hidden" name="channel" value={channel} />
      <Dropzone name="files" accept="video/*" multiple maxFiles={25} />

      <div>
        <label className="block text-sm font-medium mb-2 text-white/80">Nombre de copies</label>
        <input type="number" name="count" min={1} defaultValue={1}
          className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90" />
      </div>

      <input type="hidden" name="mode" value="advanced" />
      <input type="hidden" name="advancedRanges" value={rangesJSON} />

      {groups.map((g) => (
        <fieldset key={g} className="space-y-3">
          <legend className="text-sm font-semibold text-white/90">{g}</legend>
          {/* ... tes cartes de contrôles comme avant ... */}
        </fieldset>
      ))}

      {/* Templates */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="font-semibold">Templates</h3>
        <div className="flex gap-2">
          <input value={tplName} onChange={(e)=>setTplName(e.target.value)} placeholder="Nom de la template…" className="flex-1 rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm" />
          <button type="button" onClick={onSaveTpl} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-2">Enregistrer</button>
          <button type="button" onClick={onReset} className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10">Reset</button>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-white/50">Aucune template sauvegardée.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <span key={t.name} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm bg-white/5">
                <button type="button" onClick={()=>onLoadTpl(t)} className="underline">{t.name}</button>
                <button type="button" onClick={()=>onDeleteTpl(t.name)} className="rounded-full bg-white/10 hover:bg-white/20 px-2" title="Supprimer">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      <SubmitWithProgress />
    </form>
  );
}

/* ---------- Tabs wrapper ---------- */
export default function VideoFormClient({
  showTabs = true,
  forceTab = "simple",
  channel = "simple",
}: {
  showTabs?: boolean;
  forceTab?: "simple" | "advanced";
  channel?: "simple" | "advanced";
}) {
  const [tab, setTab] = useState<"simple" | "advanced">(forceTab);

  return (
    <div className="space-y-6">
      {showTabs && (
        <div className="inline-flex rounded-xl border border-white/15 bg-white/5 p-1">
          <button
            className={`px-4 py-2 rounded-lg text-sm ${
              tab === "simple" ? "bg-indigo-600 text-white" : "text-white/80 hover:bg-white/10"
            }`}
            onClick={() => setTab("simple")}
            type="button"
          >
            Simple
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm ${
              tab === "advanced" ? "bg-indigo-600 text-white" : "text-white/80 hover:bg-white/10"
            }`}
            onClick={() => setTab("advanced")}
            type="button"
          >
            Avancé
          </button>
        </div>
      )}

      {tab === "simple" ? <SimpleTab channel={channel} /> : <AdvancedTab channel={channel} />}
    </div>
  );
}