"use client";

// Éditeur de montage — le "mini-CapCut". Le plan (ReelPlan) est la source de
// vérité : on l'édite en state, l'aperçu (Remotion Player) se met à jour EN
// DIRECT, et "Exporter" re-rend le MP4 côté serveur à partir du plan édité.
//
// Frise : chaque caption est un bloc positionné sur l'axe du temps.
//  - montage POSTER (hook + révélations) : on déplace le bloc pour changer le
//    moment d'apparition (revealAtSec).
//  - montage COORDONNÉ (plans) : on étire le bord droit pour changer la durée
//    d'un plan.
// Clic sur un bloc → panneau : texte, taille, position verticale.

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ReelPlan, RecipeLayout } from "@/lib/studio/types";

const ReelPlayer = dynamic(() => import("./ReelPlayer"), { ssr: false });

// Layout par défaut si la ref n'en portait pas (pour rendre l'édition possible).
const DEFAULT_LAYOUT: RecipeLayout = {
  revealCount: 0,
  revealAtFrac: [],
  hookYFrac: 0.32,
  stackYFrac: 0.46,
  fontFrac: 0.033,
  maxCharsPerLine: 24,
  mode: "stack",
  refDurationSec: 0, // inutilisé côté éditeur (on passe revealAtSec en direct)
  hookFontFrac: 0.05,
  fontFamily: "sans",
  fontWeight: "heavy",
  outline: "thick",
  shadow: true,
};

type Block = {
  id: string;
  label: string;
  text: string;
  startSec: number;
  endSec: number;
  kind: "hook" | "reveal" | "shot";
  index: number; // index dans reveals[] ou shots[]
};

export default function ReelEditor({
  initialPlan,
  reelUrl,
  fileName,
  onBack,
}: {
  initialPlan: ReelPlan;
  reelUrl: string;
  fileName: string;
  onBack: () => void;
}) {
  // On garantit un layout éditable dès le départ.
  const [plan, setPlan] = useState<ReelPlan>(() => ({
    ...initialPlan,
    layout: initialPlan.layout ?? DEFAULT_LAYOUT,
  }));
  const [selectedId, setSelectedId] = useState<string | null>("b-hook");
  const [exporting, setExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dur = Math.max(0.1, plan.durationSec);
  const layout = plan.layout ?? DEFAULT_LAYOUT;

  // ── Blocs dérivés du plan ────────────────────────────────────────────────
  const blocks = useMemo<Block[]>(() => {
    if (plan.shots && plan.shots.length > 0) {
      let cursor = 0;
      return plan.shots.map((s, i) => {
        const startSec = cursor;
        cursor += s.durationSec;
        return {
          id: `b-shot-${i}`,
          label: `Plan ${i + 1}`,
          text: s.caption,
          startSec,
          endSec: cursor,
          kind: "shot" as const,
          index: i,
        };
      });
    }
    const list: Block[] = [
      {
        id: "b-hook",
        label: "Hook",
        text: plan.hook,
        startSec: 0,
        endSec: dur,
        kind: "hook",
        index: -1,
      },
    ];
    plan.reveals.forEach((r, i) => {
      list.push({
        id: `b-reveal-${i}`,
        label: `Révélation ${i + 1}`,
        text: r,
        startSec: plan.revealAtSec[i] ?? (0.3 + 0.5 * i),
        endSec: dur,
        kind: "reveal",
        index: i,
      });
    });
    return list;
  }, [plan, dur]);

  const selected = blocks.find((b) => b.id === selectedId) ?? blocks[0];

  // ── Mutations du plan ────────────────────────────────────────────────────
  const patchLayout = useCallback((p: Partial<RecipeLayout>) => {
    setExportedUrl(null);
    setPlan((prev) => ({
      ...prev,
      layout: { ...(prev.layout ?? DEFAULT_LAYOUT), ...p },
    }));
  }, []);

  const setBlockText = useCallback((b: Block, text: string) => {
    setExportedUrl(null);
    setPlan((prev) => {
      if (b.kind === "shot" && prev.shots) {
        const shots = prev.shots.map((s, i) =>
          i === b.index ? { ...s, caption: text } : s
        );
        return { ...prev, shots };
      }
      if (b.kind === "hook") return { ...prev, hook: text };
      const reveals = prev.reveals.map((r, i) => (i === b.index ? text : r));
      return { ...prev, reveals };
    });
  }, []);

  // Déplace un bloc "révélation" (change revealAtSec) ou étire un "plan".
  const setRevealStart = useCallback((index: number, startSec: number) => {
    setExportedUrl(null);
    setPlan((prev) => {
      const revealAtSec = prev.revealAtSec.slice();
      revealAtSec[index] = startSec;
      return { ...prev, revealAtSec };
    });
  }, []);

  const setShotDuration = useCallback((index: number, durationSec: number) => {
    setExportedUrl(null);
    setPlan((prev) => {
      if (!prev.shots) return prev;
      const shots = prev.shots.map((s, i) =>
        i === index ? { ...s, durationSec } : s
      );
      const total = shots.reduce((a, s) => a + s.durationSec, 0);
      return { ...prev, shots, durationSec: total };
    });
  }, []);

  // ── Drag sur la frise (listeners window : robuste même hors de la piste) ───
  const trackRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (
    e: React.PointerEvent,
    block: Block,
    mode: "move" | "resize"
  ) => {
    if (block.kind === "hook") return; // le hook démarre toujours à 0
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(block.id);
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const dur0 = dur; // axe figé pendant le geste (évite le rebond au resize)
    const move = (ev: PointerEvent) => {
      const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const t = frac * dur0;
      if (mode === "move" && block.kind === "reveal") {
        setRevealStart(block.index, Math.min(dur0 - 0.2, Math.max(0.1, t)));
      } else if (mode === "resize" && block.kind === "shot") {
        setShotDuration(block.index, Math.max(0.3, t - block.startSec));
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const doExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(plan),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Rendu échoué");
      setExportedUrl(data.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setExporting(false);
    }
  };

  const download = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const isShots = !!plan.shots && plan.shots.length > 0;
  const selSize =
    selected?.kind === "reveal" ? layout.fontFrac : layout.hookFontFrac ?? 0.05;
  const selY =
    selected?.kind === "reveal" ? layout.stackYFrac : layout.hookYFrac;

  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row">
      {/* Aperçu live 9:16 */}
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black sm:w-[38%] sm:shrink-0">
        <ReelPlayer plan={plan} />
      </div>

      {/* Panneau d'édition */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-[#9a9ac6] transition-colors hover:text-[#eef0fb]"
          >
            ← Retour
          </button>
          <span className="text-sm font-medium text-[#eef0fb]">
            Éditer le montage
          </span>
        </div>

        {/* FRISE */}
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-[11px] text-[#7a7aa6]">
            <span>0:00</span>
            <span>{fmt(dur)}</span>
          </div>
          <div
            ref={trackRef}
            className="relative h-[76px] w-full overflow-hidden rounded-lg border border-[#232350] bg-[#0a0a1e]"
          >
            {blocks.map((b, row) => {
              const left = (b.startSec / dur) * 100;
              const width = Math.max(6, ((b.endSec - b.startSec) / dur) * 100);
              const active = b.id === selected?.id;
              const top = 6 + (row % 3) * 22;
              return (
                <div
                  key={b.id}
                  onPointerDown={(e) => onPointerDown(e, b, "move")}
                  onClick={() => setSelectedId(b.id)}
                  className="absolute flex h-[20px] cursor-grab items-center overflow-hidden rounded px-2 text-[11px] font-medium active:cursor-grabbing"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    top,
                    background: active ? "#6d5efc" : "#2a2a5c",
                    color: active ? "#fff" : "#c8c8ef",
                    outline: active ? "1px solid #b3aaff" : "none",
                  }}
                  title={b.text}
                >
                  <span className="truncate">{b.label}</span>
                  {b.kind === "shot" && (
                    <span
                      onPointerDown={(e) => onPointerDown(e, b, "resize")}
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/25"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-[#7a7aa6]">
            {isShots
              ? "Glisse le bord droit d'un plan pour changer sa durée."
              : "Glisse une révélation pour changer quand elle apparaît."}
          </p>
        </div>

        {/* PANNEAU DU BLOC SÉLECTIONNÉ */}
        {selected && (
          <div className="rounded-xl border border-[#232350] bg-[#12122e] p-4">
            <div className="mb-3 text-xs uppercase tracking-wide text-[#9a9ac6]">
              {selected.label}
            </div>

            <label className="mb-1 block text-[11px] text-[#9a9ac6]">Texte</label>
            <textarea
              value={selected.text}
              onChange={(e) => setBlockText(selected, e.target.value)}
              rows={2}
              className="mb-3 w-full resize-none rounded-lg border border-[#2e2e60] bg-[#0a0a1e] px-3 py-2 text-sm text-[#eef0fb] outline-none focus:border-[#6d5efc]"
            />

            <Slider
              label="Taille"
              min={0.02}
              max={0.09}
              step={0.002}
              value={selSize}
              onChange={(vv) =>
                selected.kind === "reveal"
                  ? patchLayout({ fontFrac: vv })
                  : patchLayout({ hookFontFrac: vv })
              }
              display={`${Math.round((selSize * 1920) / 0.72)}px`}
            />
            <Slider
              label="Position ↕"
              min={0.05}
              max={0.85}
              step={0.01}
              value={selY}
              onChange={(vv) =>
                selected.kind === "reveal"
                  ? patchLayout({ stackYFrac: vv })
                  : patchLayout({ hookYFrac: vv })
              }
              display={selY < 0.4 ? "haut" : selY < 0.6 ? "milieu" : "bas"}
            />
            {selected.kind === "reveal" && (
              <Slider
                label="Apparaît à"
                min={0.1}
                max={Math.max(0.2, dur - 0.2)}
                step={0.1}
                value={selected.startSec}
                onChange={(vv) => setRevealStart(selected.index, vv)}
                display={`${selected.startSec.toFixed(1)}s`}
              />
            )}
          </div>
        )}

        {/* ACTIONS */}
        <div className="mt-4 space-y-2">
          {error && <p className="text-sm text-[#ff8b8b]">{error}</p>}
          <button
            type="button"
            onClick={doExport}
            disabled={exporting}
            className="w-full rounded-xl py-3 text-[15px] font-medium text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg,#6d5efc,#4ec5ff)",
              boxShadow: "0 8px 32px rgba(109,94,252,.35)",
            }}
          >
            {exporting ? "Rendu en cours…" : "✦ Exporter le reel monté"}
          </button>
          {exportedUrl && (
            <button
              type="button"
              onClick={() => download(exportedUrl)}
              className="w-full rounded-xl border border-[#2e2e60] py-3 text-[15px] text-[#eef0fb] transition-colors hover:border-[#6d5efc]"
            >
              ⬇ Télécharger le reel monté
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  display,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <div className="mb-2 grid grid-cols-[70px_1fr_52px] items-center gap-2 text-[13px] text-[#9a9ac6]">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[#6d5efc]"
      />
      <span className="text-right text-[#eef0fb]">{display}</span>
    </div>
  );
}
