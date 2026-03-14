// src/app/dashboard/videos/simple/VideoFormSimpleClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Dropzone from "../../Dropzone";
import InfoTooltip from "@/app/dashboard/components/InfoTooltip";

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
        "relative rounded-2xl border border-white/10",
        "bg-[linear-gradient(180deg,rgba(16,24,40,.35),rgba(16,24,40,.25))]",
        "backdrop-blur-md",
        "shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_0_24px_rgba(90,140,255,.14)]",
        dense ? "p-3" : "p-4",
      ].join(" ")}
    >
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between">
          {title ? <h3 className="text-sm font-semibold leading-none text-white/90">{title}</h3> : <span />}
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
    <div className="flex items-center justify-between gap-4">
      <button
        type="submit"
        disabled={pending}
        className={[
          "group relative inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium",
          "transition will-change-transform",
          pending ? "bg-slate-600 text-white/80 cursor-not-allowed" : "bg-gradient-to-r from-indigo-500 to-sky-500 text-white hover:scale-[1.01]",
          "shadow-[0_8px_30px_rgba(80,140,255,.25)]",
        ].join(" ")}
      >
        {pending ? "Duplication en cours…" : "Dupliquer les vidéos"}
        <span className="absolute inset-0 rounded-lg ring-1 ring-white/10" />
      </button>
      {pending && (
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-gradient-to-r from-indigo-400 to-sky-400" />
        </div>
      )}
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
      Variations légères (tirées aléatoirement) :<br />
      Luminosité −0.15 → +0.05 • Contraste 0.9 → 1.1 • Saturation 0.85 → 1.05 • Hue ±0.15 rad •
      Vignette légère • Unsharp doux • Grain fin.<br />
      Idéal pour rester naturel tout en diversifiant.
    </div>
  ),
  motion: (
    <div>
      Zoom 1.00 → 1.25 + micro panoramique/crop • Vitesse 0.9 → 1.1 (audio synchronisé) •
      légère rotation aléatoire • pixel shift subtil.
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
        "group rounded-xl border px-4 py-3 text-left transition",
        "border-white/10 bg-white/[.04] backdrop-blur-md",
        "hover:shadow-[0_0_24px_rgba(99,179,237,.18)] hover:border-sky-300/40",
        selected ? "ring-1 ring-sky-300/50 shadow-[0_0_24px_rgba(56,189,248,.28)]" : "",
      ].join(" ")}
    >
      <div className="font-semibold text-white/90 inline-flex items-center gap-2">
        {label}
        <InfoTooltip>{PACK_HELP[name]}</InfoTooltip>
      </div>
      <div className="text-xs text-white/60">{hint}</div>
    </button>
  );
}

/* ---------- Composant principal (SIMPLE) ---------- */
export default function VideoFormSimpleClient() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
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

  const [rotEnabled, setRotEnabled] = useState(false);
  const [rotMin, setRotMin] = useState(-5);
  const [rotMax, setRotMax] = useState(5);

  const [dimEnabled, setDimEnabled] = useState(false);
  const [dimW, setDimW] = useState(1.0);
  const [dimH, setDimH] = useState(1.0);

  const [borderEnabled, setBorderEnabled] = useState(false);
  const [borderMin, setBorderMin] = useState(0);
  const [borderMax, setBorderMax] = useState(20);
  const [borderHoriz, setBorderHoriz] = useState(false);
  const [borderLat, setBorderLat] = useState(false);

  const singlesJSON = JSON.stringify({
    flip,
    reverse,
    rotation: { enabled: rotEnabled, min_deg: rotMin, max_deg: rotMax },
    dims: { enabled: dimEnabled, w_factor: dimW, h_factor: dimH },
    border: { enabled: borderEnabled, min_pct: borderMin, max_pct: borderMax, horizontal: borderHoriz, lateral: borderLat },
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProcessing(true);
    try {
      const res = await fetch("/api/duplicate-video", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      if (res.ok) {
        router.push("/dashboard/videos/simple?ok=1");
      } else {
        const j = await res.json().catch(() => ({}));
        console.error("Duplication error:", j?.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="channel" value="simple" />
      <input type="hidden" name="mode" value="simple" />
      <input type="hidden" name="singles" value={singlesJSON} />
      <GlowCard>
        <Dropzone name="files" accept="video/*" multiple maxFiles={25} />
      </GlowCard>

      <GlowCard title="Nombre de copies" dense>
        <input type="number" name="count" min={1} defaultValue={1} className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-sm text-white/90" />
      </GlowCard>

      <GlowCard title="Packs (cumulables)">
        <input type="hidden" name="packs" value={packsSelected.join(",")} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <p className="mt-2 text-xs text-white/55">
          Ces packs sont <b>légers</b>. Les filtres seuls ci-dessous s’ajoutent par-dessus.
        </p>
      </GlowCard>

      <GlowCard title="Filtres seuls (cumulables)">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle checked={flip} onChange={setFlip} label="Flip (vertical)" />
          <Toggle checked={reverse} onChange={setReverse} label="Reverse (miroir horizontal)" />
        </div>

        {/* … le reste de tes contrôles (rotation, dimensions, bordures) inchangés … */}
      </GlowCard>

      <SubmitWithProgress pending={processing} />
    </form>
  );
}