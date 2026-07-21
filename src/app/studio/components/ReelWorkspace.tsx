"use client";

// Workspace d'édition — plein écran, 3 colonnes (inspiré des éditeurs type
// Nemo/CapCut, aux couleurs DuupFlow) :
//   GAUCHE  : chatbot IA pour re-modifier la vidéo en langage naturel
//   CENTRE  : lecteur vidéo (live) + frise d'édition en bas
//   DROITE  : contrôles fins (texte / taille / position / timing) + variantes
// Le plan (ReelPlan) est la source de vérité, partagée par les 3 colonnes ;
// l'aperçu se met à jour en direct, et "Exporter" re-rend le MP4.

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ReelPlan, RecipeLayout, StudioReel } from "@/lib/studio/types";

const ReelPlayer = dynamic(() => import("./ReelPlayer"), { ssr: false });

const DEFAULT_LAYOUT: RecipeLayout = {
  revealCount: 0,
  revealAtFrac: [],
  hookYFrac: 0.32,
  stackYFrac: 0.46,
  fontFrac: 0.033,
  maxCharsPerLine: 24,
  mode: "stack",
  refDurationSec: 0,
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
  index: number;
};

type ChatMsg = { role: "user" | "ai"; text: string };

export default function ReelWorkspace({
  reel,
  reels,
  onSelectVariant,
  onNewProject,
}: {
  reel: StudioReel;
  reels: StudioReel[];
  onSelectVariant: (r: StudioReel) => void;
  onNewProject: () => void;
}) {
  const [plan, setPlan] = useState<ReelPlan>(() => ({
    ...(reel.plan as ReelPlan),
    layout: (reel.plan as ReelPlan).layout ?? DEFAULT_LAYOUT,
  }));
  const [selectedId, setSelectedId] = useState<string | null>("b-hook");
  const [exporting, setExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chat IA
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "ai", text: "Dis-moi comment retoucher ta vidéo (texte, taille, position, timing…) et je l'applique." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  const dur = Math.max(0.1, plan.durationSec);
  const layout = plan.layout ?? DEFAULT_LAYOUT;

  const blocks = useMemo<Block[]>(() => {
    if (plan.shots && plan.shots.length > 0) {
      let cursor = 0;
      return plan.shots.map((s, i) => {
        const startSec = cursor;
        cursor += s.durationSec;
        return { id: `b-shot-${i}`, label: `Plan ${i + 1}`, text: s.caption, startSec, endSec: cursor, kind: "shot" as const, index: i };
      });
    }
    const list: Block[] = [
      { id: "b-hook", label: "Hook", text: plan.hook, startSec: 0, endSec: dur, kind: "hook", index: -1 },
    ];
    plan.reveals.forEach((r, i) => {
      list.push({ id: `b-reveal-${i}`, label: `Révélation ${i + 1}`, text: r, startSec: plan.revealAtSec[i] ?? 0.3 + 0.5 * i, endSec: dur, kind: "reveal", index: i });
    });
    return list;
  }, [plan, dur]);

  const selected = blocks.find((b) => b.id === selectedId) ?? blocks[0];

  const patchLayout = useCallback((p: Partial<RecipeLayout>) => {
    setExportedUrl(null);
    setPlan((prev) => ({ ...prev, layout: { ...(prev.layout ?? DEFAULT_LAYOUT), ...p } }));
  }, []);

  const setBlockText = useCallback((b: Block, text: string) => {
    setExportedUrl(null);
    setPlan((prev) => {
      if (b.kind === "shot" && prev.shots) {
        return { ...prev, shots: prev.shots.map((s, i) => (i === b.index ? { ...s, caption: text } : s)) };
      }
      if (b.kind === "hook") return { ...prev, hook: text };
      return { ...prev, reveals: prev.reveals.map((r, i) => (i === b.index ? text : r)) };
    });
  }, []);

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
      const shots = prev.shots.map((s, i) => (i === index ? { ...s, durationSec } : s));
      return { ...prev, shots, durationSec: shots.reduce((a, s) => a + s.durationSec, 0) };
    });
  }, []);

  // Drag sur la frise (listeners window).
  const trackRef = useRef<HTMLDivElement>(null);
  const onPointerDown = (e: React.PointerEvent, block: Block, mode: "move" | "resize") => {
    if (block.kind === "hook") return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(block.id);
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const dur0 = dur;
    const move = (ev: PointerEvent) => {
      const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const t = frac * dur0;
      if (mode === "move" && block.kind === "reveal") setRevealStart(block.index, Math.min(dur0 - 0.2, Math.max(0.1, t)));
      else if (mode === "resize" && block.kind === "shot") setShotDuration(block.index, Math.max(0.3, t - block.startSec));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

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
    a.download = reel.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || sending) return;
    setChatInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setSending(true);
    try {
      const res = await fetch("/api/studio/chat-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, message: msg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erreur");
      if (data.plan) {
        setExportedUrl(null);
        setPlan((prev) => ({ ...prev, ...data.plan, layout: data.plan.layout ?? prev.layout }));
      }
      setMessages((m) => [...m, { role: "ai", text: data.reply || "C'est appliqué." }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: `Désolé, je n'ai pas pu : ${e instanceof Error ? e.message : "erreur"}` }]);
    } finally {
      setSending(false);
    }
  };

  const selSize = selected?.kind === "reveal" ? layout.fontFrac : layout.hookFontFrac ?? 0.05;
  const selY = selected?.kind === "reveal" ? layout.stackYFrac : layout.hookYFrac;
  const isShots = !!plan.shots && plan.shots.length > 0;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* ── GAUCHE : chatbot IA ── */}
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-[#232350] bg-[#0c0c22]/70">
        <div className="flex items-center gap-2 border-b border-[#232350] px-4 py-3.5 text-[15px] font-medium text-[#eef0fb]">
          <span aria-hidden style={{ background: "linear-gradient(135deg,#6d5efc,#4ec5ff)" }} className="flex h-5 w-5 items-center justify-center rounded text-xs text-white">✦</span>
          Retoucher avec l'IA
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "user" ? "bg-[#6d5efc] text-white" : "border border-[#232350] bg-[#12122e] text-[#d7d7f0]"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && <div className="text-[12px] text-[#7a7aa6]">L'IA réfléchit…</div>}
        </div>
        <div className="border-t border-[#232350] p-3">
          <div className="flex items-end gap-2 rounded-xl border border-[#2e2e60] bg-[#0a0a1e] p-2 focus-within:border-[#6d5efc]">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat();
                }
              }}
              rows={1}
              placeholder="Ex : agrandis le texte, mets-le plus haut…"
              className="max-h-24 flex-1 resize-none bg-transparent text-[13px] text-[#eef0fb] outline-none placeholder:text-[#5c5c88]"
            />
            <button
              type="button"
              onClick={() => void sendChat()}
              disabled={sending || !chatInput.trim()}
              aria-label="Envoyer"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#6d5efc,#4ec5ff)" }}
            >
              ↑
            </button>
          </div>
        </div>
      </aside>

      {/* ── CENTRE : vidéo + frise ── */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[#232350] px-5 py-3">
          <span className="text-[15px] font-medium text-[#eef0fb]">Vidéo</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNewProject}
              className="rounded-lg border border-[#2e2e60] px-3 py-1.5 text-[13px] text-[#9a9ac6] transition-colors hover:border-[#6d5efc] hover:text-[#eef0fb]"
            >
              ← Nouveau
            </button>
            {exportedUrl ? (
              <button
                type="button"
                onClick={() => download(exportedUrl)}
                className="rounded-lg px-4 py-1.5 text-[13px] font-medium text-white"
                style={{ background: "linear-gradient(135deg,#6d5efc,#4ec5ff)" }}
              >
                ⬇ Télécharger
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void doExport()}
                disabled={exporting}
                className="rounded-lg px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#6d5efc,#4ec5ff)" }}
              >
                {exporting ? "Rendu…" : "✦ Exporter la vidéo"}
              </button>
            )}
          </div>
        </div>

        {/* Aperçu live */}
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-[#050510] p-4">
          <div className="relative h-full max-h-[60vh] overflow-hidden rounded-xl" style={{ aspectRatio: "9 / 16" }}>
            <ReelPlayer plan={plan} />
          </div>
        </div>

        {/* Frise */}
        <div className="border-t border-[#232350] p-4">
          <div className="mb-1 flex justify-between text-[11px] text-[#7a7aa6]">
            <span>0:00</span>
            <span>{fmt(dur)}</span>
          </div>
          <div ref={trackRef} className="relative h-[70px] w-full overflow-hidden rounded-lg border border-[#232350] bg-[#0a0a1e]">
            {blocks.map((b, row) => {
              const left = (b.startSec / dur) * 100;
              const width = Math.max(6, ((b.endSec - b.startSec) / dur) * 100);
              const active = b.id === selected?.id;
              return (
                <div
                  key={b.id}
                  onPointerDown={(e) => onPointerDown(e, b, "move")}
                  onClick={() => setSelectedId(b.id)}
                  className="absolute flex h-[20px] cursor-grab items-center overflow-hidden rounded px-2 text-[11px] font-medium active:cursor-grabbing"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    top: 6 + (row % 3) * 21,
                    background: active ? "#6d5efc" : "#2a2a5c",
                    color: active ? "#fff" : "#c8c8ef",
                    outline: active ? "1px solid #b3aaff" : "none",
                  }}
                  title={b.text}
                >
                  <span className="truncate">{b.label}</span>
                  {b.kind === "shot" && (
                    <span onPointerDown={(e) => onPointerDown(e, b, "resize")} className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/25" />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-[#7a7aa6]">
            {isShots ? "Glisse le bord droit d'un plan pour sa durée." : "Glisse une révélation pour changer quand elle apparaît."}
          </p>
        </div>
      </main>

      {/* ── DROITE : contrôles + variantes ── */}
      <aside className="flex w-[300px] shrink-0 flex-col border-l border-[#232350] bg-[#0c0c22]/70">
        <div className="border-b border-[#232350] px-4 py-3.5 text-[15px] font-medium text-[#eef0fb]">Contrôles</div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {reels.length > 1 && (
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-[#9a9ac6]">Variantes</div>
              <div className="flex flex-wrap gap-2">
                {reels.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelectVariant(r)}
                    className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
                      r.id === reel.id ? "border-[#6d5efc] bg-[#6d5efc]/10 text-[#eef0fb]" : "border-[#2e2e60] text-[#9a9ac6] hover:border-[#6d5efc]"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected && (
            <div>
              <div className="mb-3 text-xs uppercase tracking-wide text-[#9a9ac6]">{selected.label}</div>
              <label className="mb-1 block text-[11px] text-[#9a9ac6]">Texte</label>
              <textarea
                value={selected.text}
                onChange={(e) => setBlockText(selected, e.target.value)}
                rows={2}
                className="mb-3 w-full resize-none rounded-lg border border-[#2e2e60] bg-[#0a0a1e] px-3 py-2 text-sm text-[#eef0fb] outline-none focus:border-[#6d5efc]"
              />
              <Slider label="Taille" min={0.02} max={0.09} step={0.002} value={selSize}
                onChange={(v) => (selected.kind === "reveal" ? patchLayout({ fontFrac: v }) : patchLayout({ hookFontFrac: v }))}
                display={`${Math.round((selSize * 1920) / 0.72)}px`} />
              <Slider label="Position ↕" min={0.05} max={0.85} step={0.01} value={selY}
                onChange={(v) => (selected.kind === "reveal" ? patchLayout({ stackYFrac: v }) : patchLayout({ hookYFrac: v }))}
                display={selY < 0.4 ? "haut" : selY < 0.6 ? "milieu" : "bas"} />
              {selected.kind === "reveal" && (
                <Slider label="Apparaît à" min={0.1} max={Math.max(0.2, dur - 0.2)} step={0.1} value={selected.startSec}
                  onChange={(v) => setRevealStart(selected.index, v)} display={`${selected.startSec.toFixed(1)}s`} />
              )}
            </div>
          )}

          {error && <p className="text-sm text-[#ff8b8b]">{error}</p>}
        </div>
      </aside>
    </div>
  );
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Slider({
  label, min, max, step, value, onChange, display,
}: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; display: string;
}) {
  return (
    <div className="mb-2 grid grid-cols-[70px_1fr_52px] items-center gap-2 text-[13px] text-[#9a9ac6]">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[#6d5efc]" />
      <span className="text-right text-[#eef0fb]">{display}</span>
    </div>
  );
}
