"use client";

// ── ÉDITEUR MANUEL (v1 « chemin du milieu ») ─────────────────────────────────
// Retouche d'une VARIANTE générée par l'IA : lecteur d'aperçu navigateur +
// timeline + panneaux (textes / plans / musique) → export par le moteur serveur.
//
// Le contrat d'aperçu, assumé et affiché au user :
//   · FIDÈLE : coupes, ordre, vitesses, textes (rasterisés par le MOTEUR via
//     /api/ai-editor/edit/caption → pixel-perfect), musique, volumes, recadrage.
//   · APPROXIMÉ : transitions (affichées en coupe + étiquette), animations de
//     captions (affichées statiques), effets (zoomPunch/secousses/flous → badge),
//     grade (approché en filtres CSS). L'EXPORT, lui, est toujours exact : c'est
//     le même moteur ffmpeg que les variantes IA.
//
// Ce composant ne modifie JAMAIS la variante d'origine : l'export crée une
// NOUVELLE variante (derivedFrom) via /api/ai-editor/edit — gratuite (décision
// produit, voir la route). Le brouillon vit en localStorage par variante.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import type { EditPlan, EditSegment, EditCaption } from "@/lib/ai-editor/plan-types";
import { CAPTION_FONTS, FONT_CATALOG, type CaptionFont } from "@/lib/ai-editor/font-catalog";

const BRAND = "linear-gradient(135deg,#6366F1,#38BDF8)";
const CANVAS: Record<string, [number, number]> = { "9:16": [1080, 1920], "1:1": [1080, 1080], "16:9": [1920, 1080] };

/* ── Types minimaux côté client ── */
type Mat = {
  id: string; name: string; kind: "video" | "image" | "audio";
  analysis?: { durationSec?: number; thumb?: string | null } | null;
};
type ProjectLite = {
  id: string;
  materials: Mat[];
  variants: { id: string; label?: string; plan?: EditPlan }[];
};

/* ── Modèle temporel d'un plan ────────────────────────────────────────────────
   L'aperçu doit savoir, pour un instant t de la TIMELINE, quel plan est actif
   et quelle image SOURCE afficher. Vitesse : t avance `speed` fois plus vite
   dans la source. Freeze : plateau (la source ne bouge plus, la timeline si).
   Rampe : approchée par la vitesse MOYENNE (l'export, lui, fait la vraie rampe). */
type SegTiming = { dur: number; speed: number; toSrc: (local: number) => { src: number; frozen: boolean } };

function clampN(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function segTiming(seg: EditSegment, mat: Mat | undefined): SegTiming {
  const isImage = mat?.kind === "image";
  const srcStart = Math.max(0, seg.startSec ?? 0);
  const matDur = mat?.analysis?.durationSec;
  const srcEnd = Math.max(srcStart + 0.1, seg.endSec ?? (isImage ? srcStart + 3 : matDur ?? srcStart + 3));
  if (isImage) {
    const dur = srcEnd - srcStart;
    return { dur, speed: 1, toSrc: () => ({ src: 0, frozen: false }) };
  }
  const speed = clampN(seg.speedRamp ? ((seg.speedRamp.from ?? 1) + (seg.speedRamp.to ?? 1)) / 2 : (seg.speed ?? 1), 0.25, 4);
  const base = (srcEnd - srcStart) / speed;
  const hasFreeze = seg.freezeAt != null && (seg.freezeDuration ?? 0) > 0 && seg.freezeAt >= srcStart && seg.freezeAt <= srcEnd;
  const fDur = hasFreeze ? (seg.freezeDuration ?? 0) : 0;
  const fLocal = hasFreeze ? (seg.freezeAt! - srcStart) / speed : Infinity; // début du plateau (temps timeline)
  return {
    dur: base + fDur,
    speed,
    toSrc: (local) => {
      if (local < fLocal) return { src: srcStart + local * speed, frozen: false };
      if (local < fLocal + fDur) return { src: seg.freezeAt!, frozen: true };
      return { src: srcStart + (local - fDur) * speed, frozen: false };
    },
  };
}

/* Approximation CSS du grade (l'export applique le vrai). */
function gradeFilter(plan: EditPlan, seg?: EditSegment): string {
  const g = { ...(plan.grade ?? {}), ...(seg?.grade ?? {}) };
  const parts: string[] = [];
  if (g.saturation != null && g.saturation !== 1) parts.push(`saturate(${clampN(g.saturation, 0, 3)})`);
  if (g.contrast != null && g.contrast !== 1) parts.push(`contrast(${clampN(g.contrast, 0, 3)})`);
  if (g.brightness != null && g.brightness !== 0) parts.push(`brightness(${clampN(1 + g.brightness, 0, 2)})`);
  return parts.join(" ");
}

/* ── PISTES de textes : deux textes qui se chevauchent dans le temps ne sont
   JAMAIS sur la même ligne — la timeline s'empile (façon CapCut). `lane` (choisi
   au drag vertical) est respecté quand c'est possible, sinon on pousse vers le
   bas ; les pistes vides sont compactées. ── */
function capLanes(captions: EditCaption[]): { lanes: number[]; count: number } {
  const order = captions.map((_, i) => i).sort((a, b) => (captions[a].startSec - captions[b].startSec) || (a - b));
  const busy: Array<Array<[number, number]>> = []; // par piste : fenêtres occupées
  const overlaps = (L: number, s: number, e: number) => (busy[L] ?? []).some(([s2, e2]) => s < e2 - 0.01 && e > s2 + 0.01);
  const lanes = new Array<number>(captions.length).fill(0);
  for (const i of order) {
    const c = captions[i];
    let L = Math.max(0, Math.floor(c.lane ?? 0));
    while (overlaps(L, c.startSec, c.endSec)) L++;
    lanes[i] = L;
    (busy[L] ??= []).push([c.startSec, c.endSec]);
  }
  // Compacte les pistes vides (ex. tout le monde en piste 1 → redevient piste 0).
  const used = [...new Set(lanes)].sort((a, b) => a - b);
  const remap = new Map(used.map((l, n) => [l, n]));
  return { lanes: lanes.map((l) => remap.get(l)!), count: Math.max(1, used.length) };
}

/* ── SCISSION à la tête de lecture ────────────────────────────────────────────
   Un texte se coupe en deux fenêtres ; les mots horodatés (karaoké) suivent
   chacun leur moitié. Un plan se coupe au timecode SOURCE correspondant, et
   chaque effet à timecode relatif part du bon côté (rebasé pour la 2e moitié). */
function splitCaption(c: EditCaption, t: number): [EditCaption, EditCaption] | null {
  if (c.counter || t < c.startSec + 0.15 || t > c.endSec - 0.15) return null;
  const a = structuredClone(c), b = structuredClone(c);
  a.endSec = Math.round(t * 20) / 20;
  b.startSec = a.endSec;
  if (Array.isArray(c.words)) { // timings absolus → chaque mot suit sa moitié
    a.words = c.words.filter((w) => w.start < t);
    b.words = c.words.filter((w) => w.end > t);
  }
  a.exitAnimation = undefined; // la coupe est invisible : pas de sortie au milieu…
  b.animation = c.animation === "wordByWord" || c.animation === "karaoke" ? c.animation : "none"; // …ni d'entrée rejouée
  return [a, b];
}
function splitSegment(seg: EditSegment, srcSplit: number, mat: Mat | undefined): [EditSegment, EditSegment] | null {
  const s0 = seg.startSec ?? 0;
  const s1 = seg.endSec ?? mat?.analysis?.durationSec ?? s0 + 3;
  if (srcSplit < s0 + 0.15 || srcSplit > s1 - 0.15) return null;
  const off = srcSplit - s0; // s SOURCE depuis le début du plan
  const a = structuredClone(seg), b = structuredClone(seg);
  a.endSec = Math.round(srcSplit * 20) / 20;
  b.startSec = a.endSec;
  b.transition = undefined; b.transitionDuration = undefined; // la coupe interne reste un cut
  a.fadeOut = undefined; b.fadeIn = undefined;                // les fondus restent aux extrémités d'origine
  if (seg.zoomPunch) { const zp = seg.zoomPunch; if (zp.at < off) b.zoomPunch = undefined; else { a.zoomPunch = undefined; b.zoomPunch = { ...zp, at: zp.at - off }; } }
  if (seg.shakeAt) {
    a.shakeAt = seg.shakeAt.filter((k) => (k.t ?? 0) < off);
    b.shakeAt = seg.shakeAt.filter((k) => (k.t ?? 0) >= off).map((k) => ({ ...k, t: (k.t ?? 0) - off }));
    if (!a.shakeAt.length) a.shakeAt = undefined;
    if (!b.shakeAt.length) b.shakeAt = undefined;
  }
  if (seg.blurRegions) { // fenêtres relatives au plan → clippées de chaque côté
    const clip = (rs: NonNullable<EditSegment["blurRegions"]>, from: number, to: number, rebase: number) =>
      rs.map((r) => {
        const rs0 = r.startSec ?? 0, rs1 = r.endSec ?? Number.POSITIVE_INFINITY;
        if (rs1 <= from || rs0 >= to) return null;
        const ns = Math.max(rs0, from) - rebase;
        const n = { ...r, startSec: ns === 0 ? undefined : ns, endSec: rs1 === Number.POSITIVE_INFINITY ? undefined : Math.min(rs1, to) - rebase };
        return n;
      }).filter((x): x is NonNullable<typeof x> => !!x);
    a.blurRegions = clip(seg.blurRegions, 0, off, 0);
    b.blurRegions = clip(seg.blurRegions, off, Number.POSITIVE_INFINITY, off);
    if (!a.blurRegions.length) a.blurRegions = undefined;
    if (!b.blurRegions.length) b.blurRegions = undefined;
  }
  if (seg.freezeAt != null) { // timecode DANS LE FICHIER → il part avec sa moitié
    if (seg.freezeAt < srcSplit) { b.freezeAt = undefined; b.freezeDuration = undefined; }
    else { a.freezeAt = undefined; a.freezeDuration = undefined; }
  }
  if (seg.speedRamp) { // la rampe se poursuit : a va de from au point de coupe, b reprend là
    const frac = clampN(off / Math.max(0.1, s1 - s0), 0, 1);
    const mid = (seg.speedRamp.from ?? 1) + ((seg.speedRamp.to ?? 1) - (seg.speedRamp.from ?? 1)) * frac;
    a.speedRamp = { from: seg.speedRamp.from, to: mid };
    b.speedRamp = { from: mid, to: seg.speedRamp.to };
  }
  return [a, b];
}

/* Une caption a-t-elle des effets que l'aperçu n'anime pas ? (info user) */
function segEffectCount(seg: EditSegment): number {
  return (seg.blurRegions?.length ?? 0) + (seg.shakeAt?.length ?? 0) + (seg.zoomPunch ? 1 : 0)
    + (seg.speedRamp ? 1 : 0) + (seg.reverse ? 1 : 0) + (seg.freezeAt != null ? 1 : 0);
}

function fmt(t: number): string {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
}

/* Texte affiché d'une caption (compteur → valeur finale, spans → concaténation). */
function captionDisplayText(c: EditCaption): string {
  if (c.counter) return `${c.counter.prefix ?? ""}${c.counter.to}${c.counter.suffix ?? ""}`;
  if (Array.isArray(c.spans) && c.spans.length) return c.spans.map((s) => s.text).join(" ");
  return c.text ?? "";
}

/* Caption → version envoyée au rasteriseur d'aperçu (statique). */
function captionForPreview(c: EditCaption): EditCaption {
  const out: EditCaption = { ...c };
  if (c.counter) { out.text = captionDisplayText(c); out.counter = undefined; out.spans = undefined; }
  return out;
}

/* Position EFFECTIVE d'une caption (centre, % du cadre) — la même règle que le
   moteur : x explicite sinon centré ; y explicite sinon dérivé du preset. */
function capX(c: EditCaption): number { return c.x ?? 50; }
function capY(c: EditCaption): number { return c.y ?? (c.position === "top" ? 14 : c.position === "center" ? 50 : 82); }
/* Taille effective (px @1080) — mêmes défauts que le panneau. */
function capSize(c: EditCaption): number { return c.fontSize ?? (c.size === "s" ? 52 : c.size === "l" ? 92 : 70); }

/* ── « Styles » du panneau texte ──────────────────────────────────────────────
   Le moteur n'a que 3 styles de BASE (contour/fond/sticker) mais sait faire le
   néon (glow) et l'ombre sans contour : le panneau les expose comme des styles
   à part entière — c'est comme ça que le user les pense (cf. CapCut). */
function captionStyleKey(c: EditCaption): string {
  if (c.style === "sticker") return "sticker";
  if (c.style === "box" || (typeof c.background === "string" && c.background.toLowerCase() !== "none")) return "box";
  if (c.glow) return "neon";
  const noStroke = String(c.strokeColor ?? "").toLowerCase() === "none" || (c.strokeWidth != null && c.strokeWidth <= 0);
  if (noStroke && c.shadowColor) return "shadow";
  return "outline";
}
function applyCaptionStyle(cc: EditCaption, key: string): void {
  // On repart d'une base propre puis on pose UNIQUEMENT ce que le style demande.
  cc.glow = undefined; cc.shadowColor = undefined; cc.shadowBlur = undefined; cc.shadowOffset = undefined;
  cc.strokeColor = undefined; cc.strokeWidth = undefined;
  if (key === "sticker") { cc.style = "sticker"; }
  else if (key === "box") { cc.style = "box"; if (typeof cc.background !== "string" || cc.background.toLowerCase() === "none") cc.background = "#111111"; }
  else {
    cc.style = "outline"; cc.background = undefined;
    if (key === "neon") { cc.glow = { color: /^#[0-9a-f]{6}$/i.test(cc.color ?? "") ? cc.color! : "#22d3ee", intensity: 0.9 }; cc.strokeColor = "none"; }
    else if (key === "shadow") { cc.strokeColor = "none"; cc.shadowColor = "#000000"; cc.shadowBlur = 14; cc.shadowOffset = 5; }
  }
}

/* ── Cache de PNGs de captions (rasterisés par le moteur) ─────────────────────
   « Stale-while-revalidate » : pendant qu'on tape ou qu'on GLISSE une caption,
   on continue d'afficher le dernier PNG servi (avec sa position d'origine `ex/ey`
   pour que la scène puisse le décaler en CSS), et le PNG frais le remplace dès
   qu'il arrive. Sans ça, chaque frappe faisait clignoter le texte. */
type CapPng = { url: string | null; ex: number; ey: number; es: number };
function useCaptionPngs(captions: EditCaption[], aspect: string): CapPng[] {
  const cache = useRef(new Map<string, string>()); // clé JSON → objectURL ("" = en cours)
  const lastGood = useRef(new Map<number, { url: string; ex: number; ey: number; es: number }>()); // par index de caption
  const [, bump] = useState(0);
  const keys = captions.map((c) => JSON.stringify({ ...captionForPreview(c), startSec: 0, endSec: 0, aspect }));

  useEffect(() => {
    let dead = false;
    // Débounce : pendant la frappe/le drag on ne rasterise pas à chaque geste.
    const timer = window.setTimeout(() => {
      keys.forEach((key, i) => {
        if (cache.current.has(key)) return;
        cache.current.set(key, ""); // marqueur « en cours » (évite les doublons)
        void fetch("/api/ai-editor/edit/caption", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption: captionForPreview(captions[i]), aspect }),
        }).then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));
          const url = URL.createObjectURL(await r.blob());
          if (!dead) { cache.current.set(key, url); bump((n) => n + 1); }
        }).catch(() => { cache.current.delete(key); });
      });
    }, 350);
    return () => { dead = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(keys)]);

  useEffect(() => {
    const map = cache.current;
    return () => { for (const url of map.values()) if (url) URL.revokeObjectURL(url); };
  }, []);

  return captions.map((c, i) => {
    const url = cache.current.get(keys[i]);
    const ex = capX(c), ey = capY(c), es = capSize(c);
    if (url) { lastGood.current.set(i, { url, ex, ey, es }); return { url, ex, ey, es }; }
    return lastGood.current.get(i) ?? { url: null, ex, ey, es }; // PNG périmé en attendant le frais
  });
}

/* ════════════════════════════ COMPOSANT ════════════════════════════ */
export default function ManualEditor({ projectId, variantId, onClose, onExported }: {
  projectId: string;
  variantId: string;
  onClose: () => void;
  onExported: (newVariantId: string) => void;
}) {
  const { t } = useTranslation();
  const [project, setProject] = useState<ProjectLite | null>(null);
  const [basePlan, setBasePlan] = useState<EditPlan | null>(null); // le plan de la variante (référence du reset)
  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftKey = `duup_ai_edit_${variantId}`;

  /* ── Chargement : projet + plan de la variante + brouillon éventuel ── */
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch(`/api/ai-editor/project?id=${encodeURIComponent(projectId)}`);
        const { project: p } = await res.json();
        if (dead) return;
        const v = p?.variants?.find((x: { id: string }) => x.id === variantId);
        if (!p || !v?.plan) { setLoadErr(t("dashboard.aiEditor.editor.noPlan")); return; }
        setProject(p);
        setBasePlan(v.plan);
        let restored: EditPlan | null = null;
        try {
          const raw = localStorage.getItem(draftKey);
          if (raw) { restored = JSON.parse(raw); if (JSON.stringify(restored) === JSON.stringify(v.plan)) restored = null; }
        } catch { /* brouillon illisible → on repart du plan */ }
        setPlan(restored ?? structuredClone(v.plan));
        setDraftRestored(!!restored);
      } catch {
        if (!dead) setLoadErr(t("dashboard.aiEditor.editor.loadErr"));
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, variantId]);

  /* ── Historique (annuler / refaire) + brouillon ── */
  const history = useRef<{ stack: EditPlan[]; idx: number; lastKey: string; lastAt: number }>({ stack: [], idx: -1, lastKey: "", lastAt: 0 });
  useEffect(() => { // amorce l'historique au chargement
    if (plan && history.current.idx < 0) { history.current = { stack: [structuredClone(plan)], idx: 0, lastKey: "", lastAt: 0 }; }
  }, [plan]);
  useEffect(() => { // brouillon persistant (le user peut fermer et revenir)
    if (!plan || !basePlan) return;
    const id = window.setTimeout(() => {
      try {
        if (JSON.stringify(plan) === JSON.stringify(basePlan)) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify(plan));
      } catch { /* stockage plein/indispo — le brouillon est un confort */ }
    }, 700);
    return () => window.clearTimeout(id);
  }, [plan, basePlan, draftKey]);

  /** Toute modification passe ici : clone → mutation → historique (les frappes
   *  successives d'un même champ fusionnent en UNE entrée via coalesceKey). */
  const mutate = useCallback((fn: (draft: EditPlan) => void, coalesceKey = "") => {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      const h = history.current;
      const now = Date.now();
      const coalesce = coalesceKey && coalesceKey === h.lastKey && now - h.lastAt < 1500;
      h.stack = h.stack.slice(0, h.idx + 1);
      if (coalesce) h.stack[h.idx] = structuredClone(next);
      else { h.stack.push(structuredClone(next)); h.idx++; }
      h.lastKey = coalesceKey; h.lastAt = now;
      return next;
    });
  }, []);
  const undo = useCallback(() => {
    const h = history.current;
    if (h.idx <= 0) return;
    h.idx--; h.lastKey = "";
    setPlan(structuredClone(h.stack[h.idx]));
  }, []);
  const redo = useCallback(() => {
    const h = history.current;
    if (h.idx >= h.stack.length - 1) return;
    h.idx++; h.lastKey = "";
    setPlan(structuredClone(h.stack[h.idx]));
  }, []);

  /* ── Sélection + export + zoom timeline ── */
  const [sel, setSel] = useState<{ kind: "segment" | "caption" | "audio"; idx: number } | null>(null);
  const [tlZoom, setTlZoom] = useState(1); // 1 = tout le montage visible, jusqu'à ×8
  const [exportTick, setExportTick] = useState(0); // horloge 1 s de la modale d'export (chrono)
  const [exportState, setExportState] = useState<{ jobId: string; queued: boolean; startedAt: number } | { done: string } | { error: string } | null>(null);
  const [exportLabel, setExportLabel] = useState("");

  const mats = useMemo(() => new Map((project?.materials ?? []).map((m) => [m.id, m])), [project]);
  const aspect = plan?.aspect ?? "9:16";
  const [W, H] = CANVAS[aspect] ?? CANVAS["9:16"];

  /* Modèle temporel : bornes cumulées des plans sur la timeline. */
  const timings = useMemo(() => (plan?.segments ?? []).map((s) => segTiming(s, mats.get(s.materialId))), [plan, mats]);
  const starts = useMemo(() => { let a = 0; return timings.map((tg) => { const s = a; a += tg.dur; return s; }); }, [timings]);
  const total = useMemo(() => timings.reduce((a, tg) => a + tg.dur, 0), [timings]);

  const segAt = useCallback((tt: number): number => {
    for (let i = starts.length - 1; i >= 0; i--) if (tt >= starts[i]) return i;
    return 0;
  }, [starts]);

  /* Pistes de textes (empilement sans chevauchement, façon CapCut). */
  const capLaneInfo = useMemo(() => capLanes(plan?.captions ?? []), [plan]);
  const LANE_H = 30; // hauteur d'une piste texte (28 px de chip + 2 d'inter-piste)

  /* ── LECTEUR ──────────────────────────────────────────────────────────────
     Horloge maîtresse (rAF) → elle pilote tout : le plan actif, la frame des
     <video> (une par matière, empilées : bascule instantanée), la musique, les
     captions. Les <video> SUIVENT l'horloge, jamais l'inverse. */
  const [tNow, setTNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const clock = useRef({ t: 0, playing: false, last: 0, raf: 0 });
  const videoEls = useRef(new Map<string, HTMLVideoElement>());
  const musicEl = useRef<HTMLAudioElement | null>(null);
  const activeIdxRef = useRef(-1);

  const mediaUrl = useCallback((materialId: string) =>
    `/api/ai-editor/edit/media?projectId=${encodeURIComponent(projectId)}&materialId=${encodeURIComponent(materialId)}`, [projectId]);

  const videoMatIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of plan?.segments ?? []) { const m = mats.get(s.materialId); if (m?.kind === "video") ids.add(s.materialId); }
    return [...ids];
  }, [plan, mats]);

  /** Applique l'état (plan actif, frame, volumes) pour l'instant t. */
  const apply = useCallback((tt: number, isPlaying: boolean) => {
    if (!plan || !plan.segments.length) return;
    const idx = segAt(tt);
    const seg = plan.segments[idx];
    const tg = timings[idx];
    const local = tt - starts[idx];
    const { src, frozen } = tg.toSrc(local);
    const switched = idx !== activeIdxRef.current;
    activeIdxRef.current = idx;

    const musicReplace = plan.audio?.mode === "replace";
    for (const [matId, v] of videoEls.current) {
      const isActive = matId === seg.materialId && mats.get(seg.materialId)?.kind === "video";
      if (!isActive) { if (!v.paused) v.pause(); continue; }
      v.playbackRate = tg.speed;
      const vol = clampN(seg.volume ?? 1, 0, 1); // le moteur monte à 2 ; le navigateur plafonne à 1
      v.muted = !!seg.mute || vol === 0 || musicReplace;
      v.volume = vol;
      // Resynchronisation : à la bascule de plan, à un seek, ou si ça dérive.
      if (switched || !isPlaying || Math.abs(v.currentTime - src) > 0.2) {
        try { v.currentTime = src; } catch { /* pas encore prêt */ }
      }
      if (isPlaying && !frozen) { if (v.paused) void v.play().catch(() => {}); }
      else if (!v.paused) v.pause();
    }
    const music = musicEl.current;
    if (music && plan.audio) {
      const target = (plan.audio.startSec ?? 0) + tt;
      const musicOn = isPlaying && tt < (plan.audio.endSec ?? Infinity); // endSec = la musique s'arrête là
      music.volume = clampN(plan.audio.volume ?? 1, 0, 1);
      if (!musicOn || Math.abs(music.currentTime - target) > 0.25) { try { music.currentTime = target; } catch { /* idem */ } }
      if (musicOn) { if (music.paused) void music.play().catch(() => {}); }
      else if (!music.paused) music.pause();
    }
  }, [plan, timings, starts, segAt, mats]);

  useEffect(() => { // boucle d'horloge
    const step = (now: number) => {
      const c = clock.current;
      if (c.playing) {
        c.t += (now - c.last) / 1000;
        if (c.t >= total) { c.t = total; c.playing = false; setPlaying(false); }
        apply(c.t, c.playing);
        setTNow(c.t);
      }
      c.last = now;
      c.raf = requestAnimationFrame(step);
    };
    clock.current.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(clock.current.raf);
  }, [apply, total]);

  const seek = useCallback((tt: number) => {
    const c = clock.current;
    c.t = clampN(tt, 0, Math.max(0, total));
    apply(c.t, c.playing);
    setTNow(c.t);
  }, [apply, total]);

  const playPause = useCallback(() => {
    const c = clock.current;
    if (!c.playing && c.t >= total - 0.05) c.t = 0; // relire depuis le début
    c.playing = !c.playing;
    setPlaying(c.playing);
    apply(c.t, c.playing);
  }, [apply, total]);

  // (le clavier — espace/⌘Z/suppr — est branché plus bas, après les actions.)

  // Le plan change (montage retouché) → l'instant courant peut dépasser la fin.
  useEffect(() => { if (clock.current.t > total) seek(total); else apply(clock.current.t, clock.current.playing); }, [total, apply, seek]);

  /* Captions rasterisées par le moteur (pixel-perfect). */
  const captionPngs = useCaptionPngs(plan?.captions ?? [], aspect);

  /* ── DRAG d'un texte SUR LA VIDÉO : on attrape la poignée et on pose x/y en %
     du cadre. Le PNG suit en CSS (voir le rendu), le moteur re-rasterise en
     débounce. React réutilise le même nœud DOM pendant le drag → la capture de
     pointeur et les listeners survivent aux re-rendus. */
  const startStageDrag = useCallback((e: React.PointerEvent<HTMLDivElement>, i: number) => {
    e.stopPropagation();
    e.preventDefault();
    setSel({ kind: "caption", idx: i });
    const stage = stageRef.current;
    const c = plan?.captions?.[i];
    if (!stage || !c) return;
    const rect = stage.getBoundingClientRect();
    const o = { x: e.clientX, y: e.clientY, cx: capX(c), cy: capY(c) };
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      ev.stopPropagation(); // sinon l'événement remonte et déclenche d'autres zones
      const nx = clampN(o.cx + ((ev.clientX - o.x) / rect.width) * 100, 2, 98);
      const ny = clampN(o.cy + ((ev.clientY - o.y) / rect.height) * 100, 4, 96);
      mutate((d) => {
        const cc = d.captions?.[i];
        if (cc) { cc.x = Math.round(nx * 10) / 10; cc.y = Math.round(ny * 10) / 10; }
      }, `capxy${i}`);
    };
    const onUp = () => { el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerup", onUp); };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }, [plan, mutate]);

  /* ── DRAG d'un bloc texte SUR LA TIMELINE : le corps déplace le bloc dans le
     temps, les bords (9 px) rognent début/fin. Un simple clic (< 4 px de
     mouvement) reste une sélection + seek, comme avant. */
  const startCapTimelineDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>, i: number) => {
    e.stopPropagation();
    const c = plan?.captions?.[i];
    const el = e.currentTarget;
    const row = el.parentElement;
    if (!c || !row) return;
    const rowW = row.getBoundingClientRect().width;
    const r = el.getBoundingClientRect();
    const mode = e.clientX - r.left < 9 ? "start" : r.right - e.clientX < 9 ? "end" : "move";
    // Piste de départ + nb de pistes AU DÉBUT du drag (glisser verticalement =
    // changer de piste ; une piste de plus que l'existant est autorisée).
    const lanesNow = capLanes(plan?.captions ?? []);
    const o = { x: e.clientX, y: e.clientY, start: c.startSec, end: c.endSec, lane: lanesNow.lanes[i] ?? 0, laneMax: lanesNow.count };
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      ev.stopPropagation(); // sinon le fond de la timeline scrubbe pendant le drag du bloc
      if (Math.abs(ev.clientX - o.x) > 4 || Math.abs(ev.clientY - o.y) > 8) moved = true;
      if (!moved || rowW === 0) return;
      const dt = ((ev.clientX - o.x) / rowW) * total;
      const nLane = clampN(o.lane + Math.round((ev.clientY - o.y) / 30), 0, o.laneMax);
      mutate((d) => {
        const cc = d.captions?.[i];
        if (!cc) return;
        const round = (v: number) => Math.round(v * 20) / 20; // pas de 0,05 s
        if (mode === "move") {
          const dur = o.end - o.start;
          cc.startSec = round(clampN(o.start + dt, 0, Math.max(0, total - dur)));
          cc.endSec = round(cc.startSec + dur);
          cc.lane = nLane; // capLanes repousse automatiquement en cas de chevauchement
        } else if (mode === "start") {
          cc.startSec = round(clampN(o.start + dt, 0, o.end - 0.2));
        } else {
          cc.endSec = round(clampN(o.end + dt, o.start + 0.2, total));
        }
      }, `captl${i}`);
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      // Clic sans mouvement = sélection + seek au début du texte (comportement d'avant).
      if (!moved) { setSel({ kind: "caption", idx: i }); seek((plan?.captions?.[i]?.startSec ?? 0) + 0.01); }
      else setSel({ kind: "caption", idx: i });
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }, [plan, mutate, total, seek]);

  /* ── ROGNAGE d'un PLAN sur la timeline : les bords (9 px) tirent l'entrée/la
     sortie DANS LA SOURCE (converti par la vitesse : 1 s de timeline = speed s
     de rush). Le corps reste un clic = sélection + seek — déplacer un plan se
     fait par « Avancer/Reculer » (réordonner ≠ glisser, sur une timeline sans trous). */
  const startSegTimelineDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>, i: number) => {
    e.stopPropagation();
    const seg = plan?.segments?.[i];
    const el = e.currentTarget;
    const row = el.parentElement;
    if (!seg || !row) return;
    const mat = mats.get(seg.materialId);
    const isImage = mat?.kind === "image";
    const rowW = row.getBoundingClientRect().width;
    const r = el.getBoundingClientRect();
    const mode = e.clientX - r.left < 9 ? "start" : r.right - e.clientX < 9 ? "end" : "select";
    const speed = timings[i]?.speed ?? 1;
    const o = { x: e.clientX, start: seg.startSec ?? 0, end: seg.endSec ?? (isImage ? (seg.startSec ?? 0) + 3 : mat?.analysis?.durationSec ?? 3) };
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      ev.stopPropagation();
      if (Math.abs(ev.clientX - o.x) > 4) moved = true;
      if (!moved || mode === "select" || rowW === 0) return;
      const ds = ((ev.clientX - o.x) / rowW) * total * (isImage ? 1 : speed); // s SOURCE
      mutate((d) => {
        const s = d.segments[i];
        if (!s) return;
        const round = (v: number) => Math.round(v * 20) / 20;
        if (mode === "start") s.startSec = round(clampN(o.start + ds, 0, o.end - 0.2));
        else {
          const maxEnd = !isImage && mat?.analysis?.durationSec != null ? mat.analysis.durationSec : Number.POSITIVE_INFINITY;
          s.endSec = round(clampN(o.end + ds, o.start + 0.2, maxEnd));
        }
      }, `segtl${i}`);
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      setSel({ kind: "segment", idx: i });
      if (mode === "select" || !moved) seek(starts[i] + 0.01);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }, [plan, mats, timings, total, starts, mutate, seek]);

  /* ── ROGNAGE de la MUSIQUE : le bord droit du bloc fixe audio.endSec (silence
     ensuite). Tiré jusqu'au bout = la limite disparaît (musique entière). */
  const startMusicDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const el = e.currentTarget;
    const row = el.parentElement;
    if (!plan?.audio || !row) return;
    const rowW = row.getBoundingClientRect().width;
    const r = el.getBoundingClientRect();
    const mode = r.right - e.clientX < 9 ? "end" : "select";
    const o = { x: e.clientX, end: plan.audio.endSec ?? total };
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      ev.stopPropagation();
      if (Math.abs(ev.clientX - o.x) > 4) moved = true;
      if (!moved || mode === "select" || rowW === 0) return;
      const nEnd = clampN(o.end + ((ev.clientX - o.x) / rowW) * total, 1, total);
      mutate((d) => {
        if (!d.audio) return;
        d.audio.endSec = nEnd >= total - 0.05 ? undefined : Math.round(nEnd * 20) / 20;
      }, "audiotl");
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      setSel({ kind: "audio", idx: 0 });
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }, [plan, total, mutate]);

  /* ── REDIMENSIONNER un texte SUR LA VIDÉO : la pastille en bas-droite de la
     poignée (caption sélectionnée) se tire vers l'extérieur pour agrandir. Le
     PNG périmé est mis à l'échelle en CSS en attendant le rendu frais. */
  const startStageResize = useCallback((e: React.PointerEvent<HTMLSpanElement>, i: number) => {
    e.stopPropagation();
    e.preventDefault();
    const c = plan?.captions?.[i];
    const stage = stageRef.current;
    if (!c || !stage) return;
    const rect = stage.getBoundingClientRect();
    const o = { x: e.clientX, y: e.clientY, size: capSize(c) };
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      ev.stopPropagation();
      const k = 1 + (ev.clientX - o.x + (ev.clientY - o.y)) / (rect.width * 1.1);
      mutate((d) => {
        const cc = d.captions?.[i];
        if (cc) cc.fontSize = Math.round(clampN(o.size * k, 20, 200));
      }, `capsz${i}`);
    };
    const onUp = () => { el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerup", onUp); };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }, [plan, mutate]);

  /* ── SCINDER / ROGNER à la tête de lecture (barre d'outils de la timeline).
     keep: "both" = scinder · "left"/"right" = la partie qu'on GARDE. */
  const cutSelection = useCallback((keep: "both" | "left" | "right") => {
    if (!plan || !sel) return;
    if (sel.kind === "caption") {
      const c = plan.captions?.[sel.idx];
      const parts = c && splitCaption(c, tNow);
      if (!parts) return;
      mutate((d) => { d.captions?.splice(sel.idx, 1, ...(keep === "both" ? parts : [keep === "left" ? parts[0] : parts[1]])); });
    } else if (sel.kind === "segment") {
      if (sel.idx !== segAt(tNow)) return; // la tête doit être DANS le plan sélectionné
      const seg = plan.segments[sel.idx];
      const src = timings[sel.idx].toSrc(tNow - starts[sel.idx]).src;
      const parts = seg && splitSegment(seg, src, mats.get(seg.materialId));
      if (!parts) return;
      mutate((d) => { d.segments.splice(sel.idx, 1, ...(keep === "both" ? parts : [keep === "left" ? parts[0] : parts[1]])); });
    } else if (sel.kind === "audio") {
      // Une seule piste musique : « scinder » n'a pas de sens ; « garder la
      // gauche » = borner la musique à la tête de lecture.
      if (keep !== "left" || tNow < 0.5) return;
      mutate((d) => { if (d.audio) d.audio.endSec = tNow >= total - 0.1 ? undefined : Math.round(tNow * 20) / 20; });
    }
  }, [plan, sel, tNow, starts, timings, mats, segAt, mutate, total]);

  /** La tête de lecture permet-elle de couper la sélection ? (état des boutons) */
  const cuttable = useMemo(() => {
    if (!plan || !sel) return { split: false, left: false, right: false };
    if (sel.kind === "caption") {
      const c = plan.captions?.[sel.idx];
      const ok = !!c && !c.counter && tNow > c.startSec + 0.15 && tNow < c.endSec - 0.15;
      return { split: ok, left: ok, right: ok };
    }
    if (sel.kind === "segment") {
      const ok = sel.idx === segAt(tNow) && (() => { const l = tNow - starts[sel.idx]; return l > 0.15 && l < timings[sel.idx].dur - 0.15; })();
      return { split: ok, left: ok, right: ok };
    }
    return { split: false, left: tNow > 0.5, right: false }; // musique : borner seulement
  }, [plan, sel, tNow, starts, timings, segAt]);

  /** Supprime l'élément sélectionné (bouton corbeille + touche Suppr). */
  const deleteSelection = useCallback(() => {
    if (!plan || !sel) return;
    if (sel.kind === "caption") { mutate((d) => { d.captions?.splice(sel.idx, 1); }); setSel(null); }
    else if (sel.kind === "segment" && plan.segments.length > 1) { mutate((d) => { d.segments.splice(sel.idx, 1); }); setSel(null); }
    else if (sel.kind === "audio") { mutate((d) => { d.audio = undefined; }); setSel(null); }
  }, [plan, sel, mutate]);

  /** Ajoute un texte à la tête de lecture (bouton « + Texte » du header). */
  const addCaption = useCallback(() => {
    if (!plan) return;
    const start = Math.round(Math.min(tNow, Math.max(0, total - 1)) * 10) / 10;
    mutate((d) => {
      if (!d.captions) d.captions = [];
      d.captions.push({ text: t("dashboard.aiEditor.editor.newText"), startSec: start, endSec: Math.min(total, start + 2.5), position: "bottom", size: "m" });
    });
    setSel({ kind: "caption", idx: plan.captions?.length ?? 0 });
  }, [plan, tNow, total, mutate, t]);

  useEffect(() => { // espace = lecture/pause · ⌘Z = annuler · ⌫/suppr = supprimer la sélection (sauf en train d'écrire)
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement | null)?.isContentEditable;
      if (typing) return;
      if (e.code === "Space") { e.preventDefault(); playPause(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); deleteSelection(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playPause, undo, redo, deleteSelection]);

  /* Échelle d'affichage du cadre (px rendus @1080 → px écran, pour les overlays). */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(0.3);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageScale(el.clientWidth / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, plan]);

  /* ── Export ── */
  const doExport = useCallback(async () => {
    if (!plan) return;
    setExportState(null);
    try {
      const res = await fetch("/api/ai-editor/edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, variantId, plan, label: exportLabel || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Export impossible.");
      setExportState({ jobId: json.jobId, queued: true, startedAt: Date.now() });
    } catch (e) {
      setExportState({ error: (e as Error).message });
    }
  }, [plan, projectId, variantId, exportLabel]);

  useEffect(() => { // suivi du ticket de rendu
    if (!exportState || !("jobId" in exportState)) return;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-editor/edit?jobId=${encodeURIComponent(exportState.jobId)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Ticket perdu.");
        if (json.status === "done" && json.variantId) {
          window.clearInterval(id);
          try { localStorage.removeItem(draftKey); } catch { /* sans effet */ }
          setExportState({ done: json.variantId });
          onExported(json.variantId);
        } else if (json.status === "failed") {
          window.clearInterval(id);
          setExportState({ error: json.error || "Rendu échoué." });
        } else if (json.queued !== exportState.queued) {
          setExportState({ jobId: exportState.jobId, queued: json.queued, startedAt: exportState.startedAt });
        }
      } catch (e) {
        window.clearInterval(id);
        setExportState({ error: (e as Error).message });
      }
    }, 2500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportState && "jobId" in exportState ? exportState.jobId + String(exportState.queued) : ""]);

  useEffect(() => { // tick 1 s pendant l'export (chrono de la modale)
    if (!exportState || !("jobId" in exportState)) return;
    const id = window.setInterval(() => setExportTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [exportState]);

  const reset = useCallback(() => {
    if (!basePlan) return;
    if (!window.confirm(t("dashboard.aiEditor.editor.resetConfirm"))) return;
    setPlan(structuredClone(basePlan));
    try { localStorage.removeItem(draftKey); } catch { /* sans effet */ }
    setDraftRestored(false);
    history.current = { stack: [structuredClone(basePlan)], idx: 0, lastKey: "", lastAt: 0 };
    setSel(null);
  }, [basePlan, draftKey, t]);

  /* ══════════ RENDU ══════════ */
  if (loadErr) {
    return (
      <Overlay onClose={onClose}>
        <div className="grid h-full place-items-center p-10 text-center">
          <div>
            <div className="text-[15px] font-bold text-[var(--app-text)]">{loadErr}</div>
            <button onClick={onClose} className="mt-4 rounded-lg border border-[var(--app-border-strong)] px-4 py-2 text-sm text-[var(--app-text)]">{t("dashboard.aiEditor.drawer.close")}</button>
          </div>
        </div>
      </Overlay>
    );
  }
  if (!plan || !project) {
    return (
      <Overlay onClose={onClose}>
        <div className="grid h-full place-items-center text-[13px] text-[var(--app-text-muted)]">{t("dashboard.aiEditor.editor.loading")}</div>
      </Overlay>
    );
  }

  const activeIdx = segAt(tNow);
  const activeSeg = plan.segments[activeIdx];
  const activeMat = activeSeg ? mats.get(activeSeg.materialId) : undefined;
  const filter = gradeFilter(plan, activeSeg);
  const objectFit = (activeSeg?.fit ?? "cover") === "contain" || activeSeg?.fit === "blurFill" ? "contain" : "cover";
  const transform = activeSeg ? [
    activeSeg.flipH ? "scaleX(-1)" : "", activeSeg.flipV ? "scaleY(-1)" : "",
    (activeSeg.scale ?? 1) !== 1 ? `scale(${clampN(activeSeg.scale ?? 1, 1, 3)})` : "",
    activeSeg.offsetX || activeSeg.offsetY ? `translate(${-(activeSeg.offsetX ?? 0)}%, ${-(activeSeg.offsetY ?? 0)}%)` : "",
    activeSeg.rotate ? `rotate(${activeSeg.rotate}deg)` : "",
  ].filter(Boolean).join(" ") : "";

  return (
    <Overlay onClose={onClose}>
      {/* ── Barre haute ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--app-border)] px-4 py-3">
        {/* Pas de titre : l'espace respire, l'aperçu parle de lui-même. La note
            « transitions/effets en étiquettes » vit dans le ⓘ au survol. */}
        <span title={t("dashboard.aiEditor.editor.approxNote")} className="cursor-help text-[13px] text-[var(--app-text-faint)]">ⓘ</span>
        <button onClick={addCaption} className="duup-btn rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[var(--app-text)]">+ {t("dashboard.aiEditor.editor.addText")}</button>
        <button onClick={() => setSel({ kind: "audio", idx: 0 })} className={`duup-btn rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ${sel?.kind === "audio" ? "text-indigo-400" : "text-[var(--app-text)]"}`}>
          🎵 {t("dashboard.aiEditor.editor.music")}
        </button>
        <div className="flex-1" />
        {draftRestored && (
          <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-400">{t("dashboard.aiEditor.editor.draftRestored")}</span>
        )}
        <button onClick={reset} className="duup-btn rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--app-text-muted)] hover:text-[var(--app-text)]">{t("dashboard.aiEditor.editor.reset")}</button>
        <input
          value={exportLabel}
          onChange={(e) => setExportLabel(e.target.value)}
          placeholder={t("dashboard.aiEditor.editor.labelPlaceholder")}
          className="hidden w-44 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2.5 py-1.5 text-[12px] text-[var(--app-text)] placeholder:text-[var(--app-text-faint)] md:block"
        />
        <button
          onClick={doExport}
          disabled={!!exportState && "jobId" in exportState}
          className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          style={{ background: BRAND }}
        >
          {exportState && "jobId" in exportState ? t("dashboard.aiEditor.editor.exporting") : t("dashboard.aiEditor.editor.exportBtn")}
        </button>
        <button onClick={onClose} className="ml-1 text-xl leading-none text-[var(--app-text-muted)] hover:text-[var(--app-text)]">✕</button>
      </div>

      {/* ── Corps : lecteur | panneau ── */}
      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "1fr 320px" }}>
        {/* Scène */}
        <div className="flex min-h-0 flex-col items-center justify-center gap-3 overflow-hidden bg-[var(--app-bg-2)] p-4">
          <div
            ref={stageRef}
            className="relative max-h-full overflow-hidden rounded-xl"
            style={{ aspectRatio: `${W} / ${H}`, background: plan.background ?? "#000", maxWidth: "100%", height: "min(100%, 62vh)", filter: filter || undefined }}
          >
            {/* blurFill : fond flouté derrière un plan « contain » */}
            {activeSeg?.fit === "blurFill" && activeMat?.analysis?.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeMat.analysis.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "blur(28px)", transform: "scale(1.15)" }} />
            )}
            {/* Une <video> par matière vidéo — empilées, seule l'active est visible. */}
            {videoMatIds.map((matId) => (
              <video
                key={matId}
                ref={(el) => { if (el) videoEls.current.set(matId, el); else videoEls.current.delete(matId); }}
                src={mediaUrl(matId)}
                preload="auto"
                playsInline
                className="absolute inset-0 h-full w-full"
                style={{
                  objectFit,
                  visibility: activeSeg?.materialId === matId && activeMat?.kind === "video" ? "visible" : "hidden",
                  transform: activeSeg?.materialId === matId ? transform || undefined : undefined,
                  zIndex: 1,
                }}
              />
            ))}
            {/* Plan image */}
            {activeMat?.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(activeMat.id)} alt="" className="absolute inset-0 h-full w-full" style={{ objectFit, transform: transform || undefined, zIndex: 1 }} />
            )}
            {/* Incrustations du plan actif (statiques : cartes couleur + vignettes) */}
            {(activeSeg?.overlays ?? []).map((o, i) => {
              const local = tNow - starts[activeIdx];
              if ((o.startSec != null && local < o.startSec) || (o.endSec != null && local > o.endSec)) return null;
              const om = o.materialId ? mats.get(o.materialId) : undefined;
              const wPct = o.width ?? 40;
              const hPct = o.height ?? (o.shape === "circle" || o.shape === "square" ? wPct * (W / H) : wPct);
              return (
                <div
                  key={i}
                  className="absolute overflow-hidden"
                  style={{
                    left: `${o.x ?? 0}%`, top: `${o.y ?? 0}%`, width: `${wPct}%`, height: `${hPct}%`,
                    background: !om ? (o.color ?? "#ffffff") : undefined,
                    borderRadius: o.shape === "circle" ? "50%" : `${Math.round((o.borderRadius ?? 0) * stageScale)}px`,
                    opacity: o.opacity ?? 1,
                    zIndex: 2 + (o.zIndex ?? 0),
                  }}
                >
                  {om?.analysis?.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={om.analysis.thumb} alt="" className="h-full w-full object-cover" />
                  ) : om ? (
                    <div className="grid h-full w-full place-items-center bg-black/40 text-[11px] text-white/80">{om.kind === "audio" ? "🎵" : "🎬"}</div>
                  ) : null}
                </div>
              );
            })}
            {/* Captions — le PNG couvre tout le cadre. Si la position a bougé
                depuis le dernier rendu (drag en cours), on le décale en CSS en
                attendant le PNG frais : le texte suit la souris sans clignoter.
                Le translate est en % de l'élément = % du cadre (img plein cadre). */}
            {(plan.captions ?? []).map((c, i) => {
              if (tNow < c.startSec || tNow > c.endSec) return null;
              const p = captionPngs[i];
              if (!p.url) return null;
              const dx = capX(c) - p.ex, dy = capY(c) - p.ey;
              const k = capSize(c) / p.es; // redimensionnement en cours → échelle CSS en attendant le PNG frais
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={p.url}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  style={{
                    zIndex: 30,
                    transform: dx || dy || k !== 1 ? `translate(${dx}%, ${dy}%)${k !== 1 ? ` scale(${k})` : ""}` : undefined,
                    transformOrigin: `${p.ex}% ${p.ey}%`,
                  }}
                />
              );
            })}
            {/* Poignées de drag : une zone invisible centrée sur chaque texte
                visible — on l'attrape à la souris et on le pose où on veut. */}
            {(plan.captions ?? []).map((c, i) => {
              if (tNow < c.startSec || tNow > c.endSec) return null;
              const selected = sel?.kind === "caption" && sel.idx === i;
              return (
                <div
                  key={`h${i}`}
                  onPointerDown={(e) => startStageDrag(e, i)}
                  title={captionDisplayText(c)}
                  className="absolute z-40 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-xl"
                  style={{
                    left: `${capX(c)}%`, top: `${capY(c)}%`, width: "80%", height: "13%",
                    outline: selected ? "1.5px dashed rgba(99,102,241,.9)" : undefined,
                  }}
                >
                  {/* Pastille bas-droite : tirer vers l'extérieur = agrandir le texte. */}
                  {selected && (
                    <span
                      onPointerDown={(e) => startStageResize(e, i)}
                      title={t("dashboard.aiEditor.editor.resizeTitle")}
                      className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-indigo-500 shadow"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Transport */}
          <div className="flex w-full max-w-[560px] items-center gap-3">
            <button onClick={playPause} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition hover:brightness-110" style={{ background: BRAND }} title={playing ? t("dashboard.aiEditor.editor.pause") : t("dashboard.aiEditor.editor.play")}>
              {playing ? "❚❚" : "▶"}
            </button>
            <span className="w-[52px] shrink-0 text-right font-mono text-[12px] tabular-nums text-[var(--app-text-muted)]">{fmt(tNow)}</span>
            <input
              type="range" min={0} max={Math.max(0.1, total)} step={0.05} value={Math.min(tNow, total)}
              onChange={(e) => seek(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full accent-indigo-500"
              style={{ background: "var(--app-border-strong)" }}
            />
            <span className="w-[52px] shrink-0 font-mono text-[12px] tabular-nums text-[var(--app-text-faint)]">{fmt(total)}</span>
          </div>
        </div>

        {/* Panneau contextuel */}
        <aside className="min-h-0 overflow-y-auto border-l border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          {sel?.kind === "caption" && plan.captions?.[sel.idx] ? (
            <CaptionPanel
              c={plan.captions[sel.idx]} idx={sel.idx} total={total} mutate={mutate}
              onDelete={() => { mutate((d) => { d.captions?.splice(sel.idx, 1); }); setSel(null); }}
            />
          ) : sel?.kind === "segment" && plan.segments[sel.idx] ? (
            <SegmentPanel
              seg={plan.segments[sel.idx]} idx={sel.idx} count={plan.segments.length}
              mat={mats.get(plan.segments[sel.idx].materialId)} mutate={mutate}
              onMove={(dir) => {
                const j = sel.idx + dir;
                if (j < 0 || j >= plan.segments.length) return;
                mutate((d) => { const [x] = d.segments.splice(sel.idx, 1); d.segments.splice(j, 0, x); });
                setSel({ kind: "segment", idx: j });
              }}
              onDelete={() => {
                if (plan.segments.length <= 1) return;
                mutate((d) => { d.segments.splice(sel.idx, 1); });
                setSel(null);
              }}
            />
          ) : sel?.kind === "audio" ? (
            <AudioPanel plan={plan} materials={project.materials} total={total} mutate={mutate} onRemoved={() => setSel(null)} />
          ) : (
            <div className="text-[12.5px] leading-relaxed text-[var(--app-text-muted)]">
              <div className="mb-2 text-[13px] font-bold text-[var(--app-text)]">{t("dashboard.aiEditor.editor.hintTitle")}</div>
              {t("dashboard.aiEditor.editor.hintBody")}
              <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-2)] px-3 py-2.5 text-[11.5px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.editor.freeNote")}</div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Timeline ── */}
      <div className="shrink-0 select-none border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 pb-4 pt-3">
        {/* Barre d'outils façon CapCut : annuler/refaire · scinder/rogner à la
            tête de lecture · supprimer — puis le zoom à droite. */}
        <div className="mb-2 flex items-center gap-1">
          <IconBtn onClick={undo} title={t("dashboard.aiEditor.editor.undo")}>↩︎</IconBtn>
          <IconBtn onClick={redo} title={t("dashboard.aiEditor.editor.redo")}>↪︎</IconBtn>
          <span className="mx-1.5 h-4 w-px bg-[var(--app-border-strong)]" />
          <IconBtn onClick={() => cutSelection("both")} disabled={!cuttable.split} title={t("dashboard.aiEditor.editor.splitLbl")}><SplitIcon /></IconBtn>
          <IconBtn onClick={() => cutSelection("right")} disabled={!cuttable.right} title={t("dashboard.aiEditor.editor.trimLeftLbl")}><SplitIcon side="left" /></IconBtn>
          <IconBtn onClick={() => cutSelection("left")} disabled={!cuttable.left} title={t("dashboard.aiEditor.editor.trimRightLbl")}><SplitIcon side="right" /></IconBtn>
          <IconBtn onClick={deleteSelection} disabled={!sel} title={t("dashboard.aiEditor.editor.deleteSelLbl")}>🗑</IconBtn>
          {/* Zoom de la timeline (aussi au trackpad : pincer, ou ⌘+molette). */}
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setTlZoom((z) => clampN(z / 1.25, 1, 8))} className="grid h-5 w-5 place-items-center rounded text-[13px] leading-none text-[var(--app-text-faint)] hover:text-[var(--app-text)]" title={t("dashboard.aiEditor.editor.zoomOut")}>−</button>
            <input
              type="range" min={1} max={8} step={0.1} value={tlZoom}
              onChange={(e) => setTlZoom(Number(e.target.value))}
              className="h-1 w-28 cursor-pointer appearance-none rounded-full accent-indigo-500"
              style={{ background: "var(--app-border-strong)" }}
              title={t("dashboard.aiEditor.editor.zoomLbl")}
            />
            <button onClick={() => setTlZoom((z) => clampN(z * 1.25, 1, 8))} className="grid h-5 w-5 place-items-center rounded text-[13px] leading-none text-[var(--app-text-faint)] hover:text-[var(--app-text)]" title={t("dashboard.aiEditor.editor.zoomIn")}>+</button>
          </div>
        </div>

        <TimelineArea total={total} tNow={tNow} zoom={tlZoom} onZoom={setTlZoom} onSeek={seek}>
          {/* Règle temporelle */}
          <TimeRuler total={total} />
          {/* Rangée plans */}
          <div className="relative mt-1 h-14">
            {plan.segments.map((s, i) => {
              const m = mats.get(s.materialId);
              const fx = segEffectCount(s);
              return (
                <button
                  key={i}
                  onPointerDown={(e) => startSegTimelineDrag(e, i)}
                  className={`absolute inset-y-0 overflow-hidden rounded-md border text-left transition ${sel?.kind === "segment" && sel.idx === i ? "border-indigo-500 ring-1 ring-indigo-500" : "border-[var(--app-border-strong)] hover:border-indigo-400/60"}`}
                  style={{ left: `${(starts[i] / Math.max(0.1, total)) * 100}%`, width: `calc(${(timings[i].dur / Math.max(0.1, total)) * 100}% - 2px)`, background: "var(--app-bg-2)" }}
                  title={m?.name}
                >
                  {m?.analysis?.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.analysis.thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                  )}
                  <span className="absolute bottom-0.5 left-1 rounded bg-black/55 px-1 font-mono text-[9.5px] text-white">{timings[i].dur.toFixed(1)}s</span>
                  {s.transition && s.transition !== "cut" && (
                    <span className="absolute left-0.5 top-0.5 rounded bg-indigo-500/85 px-1 text-[9px] font-bold text-white" title={t("dashboard.aiEditor.editor.transitionChip")}>{s.transition}</span>
                  )}
                  {fx > 0 && (
                    <span className="absolute right-0.5 top-0.5 rounded bg-black/55 px-1 text-[9px] text-white" title={t("dashboard.aiEditor.editor.effectsChip")}>✨{fx}</span>
                  )}
                  {/* Bords = rognage entrée/sortie du plan (détectés dans startSegTimelineDrag).
                      Sélectionné → poignées visibles ; sinon zones invisibles. */}
                  {sel?.kind === "segment" && sel.idx === i ? <TrimHandles /> : (
                    <>
                      <span aria-hidden className="absolute inset-y-0 left-0 w-2 cursor-col-resize" />
                      <span aria-hidden className="absolute inset-y-0 right-0 w-2 cursor-col-resize" />
                    </>
                  )}
                </button>
              );
            })}
          </div>
          {/* Rangée captions — chips colorés façon CapCut, sur PLUSIEURS pistes
              quand ils se chevauchent (la timeline grandit). Glisser un chip
              verticalement le change de piste. */}
          <div className="relative mt-1.5" style={{ height: capLaneInfo.count * LANE_H - 2 }}>
            {(plan.captions ?? []).map((c, i) => (
              <button
                key={i}
                onPointerDown={(e) => startCapTimelineDrag(e, i)}
                className={`absolute cursor-grab truncate rounded-md border px-2 text-left text-[10px] font-semibold transition active:cursor-grabbing ${sel?.kind === "caption" && sel.idx === i ? "border-indigo-500 bg-indigo-500/30 text-[var(--app-text)]" : "border-indigo-400/35 bg-indigo-500/12 text-[var(--app-text-muted)] hover:border-indigo-400/70"}`}
                style={{ top: capLaneInfo.lanes[i] * LANE_H, height: LANE_H - 2, left: `${(clampN(c.startSec, 0, total) / Math.max(0.1, total)) * 100}%`, width: `calc(${((clampN(c.endSec, 0, total) - clampN(c.startSec, 0, total)) / Math.max(0.1, total)) * 100}% - 2px)` }}
              >
                💬 {captionDisplayText(c)}
                {sel?.kind === "caption" && sel.idx === i ? <TrimHandles /> : (
                  <>
                    <span aria-hidden className="absolute inset-y-0 left-0 w-2 cursor-col-resize" />
                    <span aria-hidden className="absolute inset-y-0 right-0 w-2 cursor-col-resize" />
                  </>
                )}
              </button>
            ))}
          </div>
          {/* Rangée musique — la largeur du bloc = jusqu'où elle joue ; son bord
              droit se tire pour la raccourcir (silence ensuite, exact à l'export). */}
          {plan.audio && (
            <div className="relative mt-1.5 h-6">
              <button
                onPointerDown={startMusicDrag}
                className={`absolute inset-y-0 cursor-grab overflow-hidden truncate rounded-md border text-left text-[9.5px] font-semibold active:cursor-grabbing ${sel?.kind === "audio" ? "border-teal-500 bg-teal-500/30" : "border-teal-500/35 bg-teal-500/12 hover:border-teal-500/70"}`}
                style={{ left: 0, width: `${(clampN(plan.audio.endSec ?? total, 1, Math.max(1, total)) / Math.max(0.1, total)) * 100}%` }}
              >
                <span className="px-2 text-[var(--app-text-muted)]">🎵 {mats.get(plan.audio.materialId)?.name ?? t("dashboard.aiEditor.editor.music")} · {plan.audio.mode === "replace" ? t("dashboard.aiEditor.editor.modeReplace") : t("dashboard.aiEditor.editor.modeMix")}{plan.audio.endSec != null ? ` · ⇥ ${plan.audio.endSec.toFixed(1)}s` : ""}</span>
                {sel?.kind === "audio" ? (
                  <span aria-hidden className="absolute inset-y-0 right-0 z-10 flex w-[7px] cursor-col-resize items-center justify-center rounded-r-md bg-teal-500">
                    <span className="h-2/5 w-[1.5px] rounded bg-white/90" />
                  </span>
                ) : (
                  <span aria-hidden className="absolute inset-y-0 right-0 w-2 cursor-col-resize" />
                )}
              </button>
            </div>
          )}
        </TimelineArea>
      </div>

      {/* Musique (élément audio hors écran) */}
      {plan.audio && <audio ref={musicEl} src={mediaUrl(plan.audio.materialId)} preload="auto" />}

      {/* ── Modale d'export ── */}
      {exportState && (
        <div className="absolute inset-0 z-[60] grid place-items-center bg-black/55 backdrop-blur-sm" onClick={() => { if (!("jobId" in exportState)) setExportState(null); }}>
          <div className="w-[440px] max-w-[92%] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-7 text-center" onClick={(e) => e.stopPropagation()}>
            {"jobId" in exportState ? (
              <>
                <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-indigo-500 border-t-transparent" />
                <div className="text-[15px] font-bold text-[var(--app-text)]">{exportState.queued ? t("dashboard.aiEditor.editor.queued") : t("dashboard.aiEditor.editor.rendering")}</div>
                {/* Chrono : le user voit que ça avance (le moteur coupe de
                    lui-même à 8 min avec un message clair). exportTick = tick 1 s. */}
                <div className="mt-1.5 font-mono text-[13px] tabular-nums text-[var(--app-text-muted)]" data-tick={exportTick}>
                  {(() => { const s = Math.max(0, Math.floor((Date.now() - exportState.startedAt) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; })()}
                </div>
                <p className="mt-2 text-[12.5px] text-[var(--app-text-muted)]">{t("dashboard.aiEditor.editor.renderNote")}</p>
                <button
                  onClick={() => {
                    void fetch(`/api/ai-editor/edit?jobId=${encodeURIComponent(exportState.jobId)}`, { method: "DELETE" }).catch(() => {});
                    setExportState(null);
                  }}
                  className="mt-5 rounded-lg border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                >
                  {t("dashboard.aiEditor.editor.cancelRender")}
                </button>
              </>
            ) : "done" in exportState ? (
              <>
                <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-emerald-400/15 text-xl">✅</div>
                <div className="text-[15px] font-bold text-[var(--app-text)]">{t("dashboard.aiEditor.editor.done")}</div>
                <p className="mt-2 text-[12.5px] text-[var(--app-text-muted)]">{t("dashboard.aiEditor.editor.doneNote")}</p>
                <div className="mt-5 flex justify-center gap-2.5">
                  <button onClick={() => setExportState(null)} className="rounded-lg border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[var(--app-text)]">{t("dashboard.aiEditor.editor.keepEditing")}</button>
                  <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: BRAND }}>{t("dashboard.aiEditor.editor.seeVariant")}</button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-red-400/15 text-xl">⚠️</div>
                <div className="text-[15px] font-bold text-[var(--app-text)]">{t("dashboard.aiEditor.editor.exportError")}</div>
                <p className="mt-2 break-words text-[12.5px] text-[var(--app-text-muted)]">{exportState.error}</p>
                <div className="mt-5 flex justify-center gap-2.5">
                  <button onClick={() => setExportState(null)} className="rounded-lg border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[var(--app-text)]">{t("dashboard.aiEditor.drawer.close")}</button>
                  <button onClick={doExport} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: BRAND }}>{t("dashboard.aiEditor.editor.retry")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Overlay>
  );
}

/* ── Habillage plein écran ── */
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[var(--app-bg)]">
      {children}
    </div>
  );
}

/* ── Règle temporelle (graduations + tampons horodatés, façon CapCut) ── */
function TimeRuler({ total }: { total: number }) {
  const label = total > 30 ? 5 : total > 12 ? 2 : 1; // pas des étiquettes
  const ticks: number[] = [];
  for (let s = 0; s <= Math.floor(Math.max(1, total)); s++) ticks.push(s);
  return (
    <div className="relative h-6">
      {ticks.map((s) => (
        <div key={s} className="absolute bottom-0" style={{ left: `${(s / Math.max(0.1, total)) * 100}%` }}>
          <div className={`w-px ${s % label === 0 ? "h-2 bg-[var(--app-border-strong)]" : "h-1 bg-[var(--app-border)]"}`} />
          {s % label === 0 && (
            <span className="absolute bottom-2.5 -translate-x-1/2 font-mono text-[9px] tabular-nums text-[var(--app-text-faint)]">
              {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Poignées de rognage VISIBLES sur l'élément sélectionné (les côtés qu'on
   tire — la zone active de 9 px existe sur tous les blocs, sélectionnés ou non). ── */
function TrimHandles() {
  return (
    <>
      <span aria-hidden className="absolute inset-y-0 left-0 z-10 flex w-[7px] cursor-col-resize items-center justify-center rounded-l-md bg-indigo-500">
        <span className="h-2/5 w-[1.5px] rounded bg-white/90" />
      </span>
      <span aria-hidden className="absolute inset-y-0 right-0 z-10 flex w-[7px] cursor-col-resize items-center justify-center rounded-r-md bg-indigo-500">
        <span className="h-2/5 w-[1.5px] rounded bg-white/90" />
      </span>
    </>
  );
}

/* ── Zone timeline cliquable + zoomable ──────────────────────────────────────
   Le contenu (rangées en %) vit dans un panneau interne large de `zoom × 100 %`
   dans un conteneur à défilement horizontal. Pincement trackpad / ⌘+molette =
   zoom ANCRÉ sous le curseur ; molette simple = défilement. ── */
function TimelineArea({ total, tNow, zoom, onZoom, onSeek, children }: {
  total: number; tNow: number; zoom: number;
  onZoom: (z: number) => void; onSeek: (t: number) => void;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  // Le listener molette est natif ({passive:false} pour preventDefault) → il lit
  // zoom/onZoom via des refs pour ne pas être ré-attaché à chaque re-render.
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const onZoomRef = useRef(onZoom); onZoomRef.current = onZoom;
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { // pinch trackpad (ctrlKey) ou ⌘+molette
        e.preventDefault();
        const inner = innerRef.current;
        if (!inner) return;
        const rect = inner.getBoundingClientRect();
        const frac = clampN((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1); // instant sous le curseur
        const nz = clampN(zoomRef.current * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 1, 8);
        onZoomRef.current(nz);
        requestAnimationFrame(() => { // garder cet instant sous le curseur
          const or = el.getBoundingClientRect();
          el.scrollLeft = frac * el.clientWidth * nz - (e.clientX - or.left);
        });
      } else {
        // La timeline n'a pas de défilement vertical : la molette défile en X.
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); }
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toT = (clientX: number) => {
    const r = innerRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return clampN(((clientX - r.left) / r.width) * total, 0, total);
  };
  return (
    <div ref={outerRef} className="overflow-x-auto overflow-y-hidden pb-1">
      <div
        ref={innerRef}
        className="relative cursor-crosshair"
        style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
        onPointerDown={(e) => {
          // Un clic sur un BLOC (plan/texte/musique) sélectionne — il stoppe la
          // propagation. Ici on ne traite que le fond : seek à la position cliquée.
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onSeek(toT(e.clientX));
        }}
        onPointerMove={(e) => { if (e.buttons & 1) onSeek(toT(e.clientX)); }}
      >
        {children}
        {/* Tête de lecture */}
        <div className="pointer-events-none absolute inset-y-0 z-20 w-[2px] bg-red-500" style={{ left: `${(clampN(tNow, 0, total) / Math.max(0.1, total)) * 100}%` }}>
          <div className="absolute -left-[5px] -top-1 h-3 w-3 rounded-full bg-red-500" />
        </div>
      </div>
    </div>
  );
}

/* ── Petits contrôles partagés (volontairement discrets : l'aperçu est la star,
   les réglages sont un inspecteur, pas un formulaire). ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[9.5px] font-semibold uppercase tracking-wide text-[var(--app-text-faint)]">{label}</span>
      {children}
    </label>
  );
}
function NumField({ label, value, step = 0.1, min, max, onChange }: { label: string; value: number; step?: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <input
        type="number" value={Math.round(value * 100) / 100} step={step} min={min} max={max}
        onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v); }}
        className="h-8 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2 text-[12.5px] tabular-nums text-[var(--app-text)]"
      />
    </Field>
  );
}
const inputCls = "h-8 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2 text-[12.5px] text-[var(--app-text)] placeholder:text-[var(--app-text-faint)]";

/* Petit bouton-bascule (B/U/I, casse, alignement). */
function ToggleBtn({ active, onClick, label, bold, italic, underline }: { active: boolean; onClick: () => void; label: React.ReactNode; bold?: boolean; italic?: boolean; underline?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 flex-1 rounded-md border text-[12.5px] transition ${active ? "border-indigo-500 bg-indigo-500/15 text-indigo-400" : "border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]"}`}
      style={{ fontWeight: bold ? 800 : 600, fontStyle: italic ? "italic" : undefined, textDecoration: underline ? "underline" : undefined }}
    >
      {label}
    </button>
  );
}

/* Bouton d'icône de la barre d'outils timeline. */
function IconBtn({ onClick, disabled, title, children }: { onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="grid h-7 w-8 place-items-center rounded-md text-[13px] text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)] disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* Icône « scinder » : deux crochets dos à dos autour de la coupe. `side` = la
   partie SUPPRIMÉE (estompée) pour les variantes rogner-gauche/rogner-droite. */
function SplitIcon({ side }: { side?: "left" | "right" }) {
  return (
    <svg viewBox="0 0 18 12" className="h-3.5 w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M6.5 1 H2.5 V11 H6.5" opacity={side === "left" ? 0.3 : 1} />
      <path d="M11.5 1 H15.5 V11 H11.5" opacity={side === "right" ? 0.3 : 1} />
      <path d="M9 0.5 V11.5" strokeDasharray={side ? undefined : "2.5 2"} />
    </svg>
  );
}

/* Icônes d'alignement des lignes (façon CapCut : barres alignées gauche/centre/droite). */
function AlignIcon({ v }: { v: "left" | "center" | "right" }) {
  const rows: Array<[number, number]> = v === "left" ? [[0, 16], [0, 10], [0, 13]] : v === "right" ? [[0, 16], [6, 10], [3, 13]] : [[0, 16], [3, 10], [1.5, 13]];
  return (
    <svg viewBox="0 0 16 12" className="mx-auto h-3 w-4" fill="currentColor" aria-hidden>
      {rows.map(([x, w], i) => <rect key={i} x={x} y={i * 5} width={w} height={2} rx={1} />)}
    </svg>
  );
}

/* ── Panneau CAPTION ── */
function CaptionPanel({ c, idx, total, mutate, onDelete }: {
  c: EditCaption; idx: number; total: number;
  mutate: (fn: (d: EditPlan) => void, key?: string) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const set = (fn: (cc: EditCaption) => void, key?: string) => mutate((d) => { const cc = d.captions?.[idx]; if (cc) fn(cc); }, key);
  const hasSpans = Array.isArray(c.spans) && c.spans.length > 0;
  const hasWords = Array.isArray(c.words) && c.words.length > 0;

  return (
    <div className="space-y-2.5">
      <div className="text-[13px] font-bold text-[var(--app-text)]">💬 {t("dashboard.aiEditor.editor.panelCaption")}</div>

      {c.counter ? (
        <p className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2.5 py-2 text-[11.5px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.editor.counterNote")}</p>
      ) : hasSpans ? (
        <Field label={t("dashboard.aiEditor.editor.text")}>
          <div className="space-y-1.5">
            {c.spans!.map((sp, si) => (
              <input
                key={si}
                value={sp.text}
                onChange={(e) => set((cc) => { if (cc.spans?.[si]) cc.spans[si].text = e.target.value; }, `span${idx}-${si}`)}
                className={inputCls}
                style={sp.color ? { color: sp.color } : undefined}
              />
            ))}
          </div>
          <p className="mt-1 text-[10.5px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.editor.spanNote")}</p>
        </Field>
      ) : (
        <Field label={t("dashboard.aiEditor.editor.text")}>
          <textarea
            value={c.text}
            rows={2}
            onChange={(e) => set((cc) => {
              cc.text = e.target.value;
              // Les timings mot-à-mot ne correspondent plus au nouveau texte :
              // on repasse en fondu simple plutôt que d'exporter un karaoké faux.
              if (Array.isArray(cc.words) && cc.words.length) { cc.words = undefined; if (cc.animation === "wordByWord" || cc.animation === "karaoke") cc.animation = "fade"; }
            }, `cap${idx}-text`)}
            className={`${inputCls} resize-none`}
          />
          {hasWords && <p className="mt-1 text-[10.5px] text-amber-400/90">{t("dashboard.aiEditor.editor.wordAnimNote")}</p>}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Field label={t("dashboard.aiEditor.editor.color")}>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(c.color ?? "") ? c.color : "#ffffff"}
            onChange={(e) => set((cc) => { cc.color = e.target.value; if (cc.fill) cc.fill = { type: "solid", color: e.target.value }; }, `cap${idx}-color`)}
            className="h-9 w-full cursor-pointer rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-2)]"
          />
        </Field>
        <NumField
          label={t("dashboard.aiEditor.editor.fontSizeLbl")}
          value={c.fontSize ?? (c.size === "s" ? 52 : c.size === "l" ? 92 : 70)}
          step={2} min={20} max={200}
          onChange={(v) => set((cc) => { cc.fontSize = clampN(v, 20, 200); }, `cap${idx}-fsz`)}
        />
      </div>

      <Field label={t("dashboard.aiEditor.editor.font")}>
        <select
          value={(c.font as string) ?? "sans"}
          onChange={(e) => set((cc) => { cc.font = e.target.value as CaptionFont; })}
          className={inputCls}
        >
          {CAPTION_FONTS.map((k) => <option key={k} value={k}>{FONT_CATALOG[k].family}</option>)}
        </select>
      </Field>

      {/* Motif (gras/souligné/italique) + Casse — façon CapCut. */}
      <div className="grid grid-cols-2 gap-2.5">
        <Field label={t("dashboard.aiEditor.editor.motifLbl")}>
          <div className="flex gap-1.5">
            <ToggleBtn active={(c.fontWeight ?? 800) >= 700} onClick={() => set((cc) => { cc.fontWeight = (cc.fontWeight ?? 800) >= 700 ? 400 : 900; })} label="B" bold />
            <ToggleBtn active={!!c.underline} onClick={() => set((cc) => { cc.underline = !cc.underline || undefined; })} label="U" underline />
            <ToggleBtn active={!!c.italic} onClick={() => set((cc) => { cc.italic = !cc.italic || undefined; })} label="I" italic />
          </div>
        </Field>
        <Field label={t("dashboard.aiEditor.editor.caseLbl")}>
          <div className="flex gap-1.5">
            {([["uppercase", "TT"], ["lowercase", "tt"], ["capitalize", "Tt"]] as const).map(([v, lbl]) => (
              <ToggleBtn key={v} active={c.textTransform === v} onClick={() => set((cc) => { cc.textTransform = cc.textTransform === v ? undefined : v; })} label={lbl} />
            ))}
          </div>
        </Field>
      </div>

      {/* Caractère (interlettrage) + Ligne (interligne). */}
      <div className="grid grid-cols-2 gap-2.5">
        <NumField
          label={t("dashboard.aiEditor.editor.letterSpacingLbl")}
          value={c.letterSpacing ?? 0} step={1} min={-20} max={40}
          onChange={(v) => set((cc) => { cc.letterSpacing = clampN(v, -20, 40) || undefined; }, `cap${idx}-ls`)}
        />
        <NumField
          label={t("dashboard.aiEditor.editor.lineHeightLbl")}
          value={c.lineHeight ?? 1.24} step={0.05} min={0.9} max={2.2}
          onChange={(v) => set((cc) => { cc.lineHeight = clampN(v, 0.9, 2.2); }, `cap${idx}-lh`)}
        />
      </div>

      <Field label={t("dashboard.aiEditor.editor.alignLbl")}>
        {/* Structure les LIGNES d'un texte multi-lignes dans son bloc — ne
            déplace pas le bloc à l'écran (ça, c'est le drag sur la vidéo). */}
        <div className="flex gap-1.5">
          {(["left", "center", "right"] as const).map((v) => (
            <ToggleBtn key={v} active={(c.align ?? "center") === v} onClick={() => set((cc) => { cc.align = v === "center" ? undefined : v; })} label={<AlignIcon v={v} />} />
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label={t("dashboard.aiEditor.editor.styleLbl")}>
          <select
            value={captionStyleKey(c)}
            onChange={(e) => set((cc) => applyCaptionStyle(cc, e.target.value))}
            className={inputCls}
          >
            <option value="outline">{t("dashboard.aiEditor.editor.styleOutline")}</option>
            <option value="box">{t("dashboard.aiEditor.editor.styleBox")}</option>
            <option value="sticker">{t("dashboard.aiEditor.editor.styleSticker")}</option>
            <option value="neon">{t("dashboard.aiEditor.editor.styleNeon")}</option>
            <option value="shadow">{t("dashboard.aiEditor.editor.styleShadow")}</option>
          </select>
        </Field>
        {(captionStyleKey(c) === "box" || captionStyleKey(c) === "sticker") && (
          <Field label={t("dashboard.aiEditor.editor.background")}>
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(c.background ?? "") ? c.background : c.style === "sticker" ? "#ffffff" : "#000000"}
              onChange={(e) => set((cc) => { cc.background = e.target.value; }, `cap${idx}-bg`)}
              className="h-8 w-full cursor-pointer rounded-md border border-[var(--app-border)] bg-[var(--app-bg-2)]"
            />
          </Field>
        )}
        {captionStyleKey(c) === "neon" && (
          <Field label={t("dashboard.aiEditor.editor.neonColor")}>
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(c.glow?.color ?? "") ? c.glow!.color : "#22d3ee"}
              onChange={(e) => set((cc) => { cc.glow = { color: e.target.value, intensity: cc.glow?.intensity ?? 0.9 }; }, `cap${idx}-glow`)}
              className="h-8 w-full cursor-pointer rounded-md border border-[var(--app-border)] bg-[var(--app-bg-2)]"
            />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <NumField label={t("dashboard.aiEditor.editor.from")} value={c.startSec} min={0} max={total} onChange={(v) => set((cc) => { cc.startSec = clampN(v, 0, Math.min(cc.endSec - 0.1, total)); }, `cap${idx}-start`)} />
        <NumField label={t("dashboard.aiEditor.editor.to")} value={c.endSec} min={0} max={total} onChange={(v) => set((cc) => { cc.endSec = clampN(v, cc.startSec + 0.1, total); }, `cap${idx}-end`)} />
      </div>

      <button onClick={onDelete} className="w-full rounded-lg border border-red-500/40 px-3 py-2 text-[12.5px] font-semibold text-red-400 transition hover:bg-red-500/10">
        🗑 {t("dashboard.aiEditor.editor.deleteCaption")}
      </button>
    </div>
  );
}

/* ── Panneau PLAN (segment) ── */
function SegmentPanel({ seg, idx, count, mat, mutate, onMove, onDelete }: {
  seg: EditSegment; idx: number; count: number; mat?: Mat;
  mutate: (fn: (d: EditPlan) => void, key?: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const set = (fn: (s: EditSegment) => void, key?: string) => mutate((d) => { const s = d.segments[idx]; if (s) fn(s); }, key);
  const matDur = mat?.analysis?.durationSec;
  const isVideo = mat?.kind === "video";
  const fx = segEffectCount(seg);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-black/30">
          {mat?.analysis?.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mat.analysis.thumb} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-[var(--app-text)]">🎬 {t("dashboard.aiEditor.editor.panelSegment", { n: idx + 1 })}</div>
          <div className="truncate text-[11px] text-[var(--app-text-faint)]">{mat?.name}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <NumField
          label={t("dashboard.aiEditor.editor.trimStart")}
          value={seg.startSec ?? 0} min={0} max={matDur}
          onChange={(v) => set((s) => { s.startSec = clampN(v, 0, (s.endSec ?? matDur ?? v + 0.1) - 0.1); }, `seg${idx}-start`)}
        />
        <NumField
          label={t("dashboard.aiEditor.editor.trimEnd")}
          value={seg.endSec ?? matDur ?? 3} min={0} max={matDur}
          onChange={(v) => set((s) => { s.endSec = Math.max((s.startSec ?? 0) + 0.1, matDur != null ? Math.min(v, matDur) : v); }, `seg${idx}-end`)}
        />
      </div>
      {matDur != null && <p className="text-[10.5px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.editor.matDur", { d: matDur.toFixed(1) })}</p>}

      {isVideo && (
        <Field label={t("dashboard.aiEditor.editor.speed")}>
          <select
            value={String(seg.speed ?? 1)}
            onChange={(e) => set((s) => { s.speed = Number(e.target.value); s.speedRamp = undefined; })}
            className={inputCls}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => <option key={v} value={v}>{v}×</option>)}
            {seg.speed != null && ![0.5, 0.75, 1, 1.25, 1.5, 2].includes(seg.speed) && <option value={seg.speed}>{seg.speed}×</option>}
          </select>
        </Field>
      )}

      {isVideo && (
        <Field label={t("dashboard.aiEditor.editor.volume")}>
          <div className="flex items-center gap-2.5">
            <input
              type="range" min={0} max={2} step={0.05}
              value={seg.mute ? 0 : seg.volume ?? 1}
              onChange={(e) => set((s) => { const v = Number(e.target.value); s.volume = v; s.mute = v === 0; }, `seg${idx}-vol`)}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full accent-indigo-500"
              style={{ background: "var(--app-border-strong)" }}
            />
            <button
              onClick={() => set((s) => { s.mute = !s.mute; })}
              className={`shrink-0 rounded-lg border px-2 py-1 text-[12px] ${seg.mute ? "border-red-500/50 text-red-400" : "border-[var(--app-border)] text-[var(--app-text-muted)]"}`}
              title={t("dashboard.aiEditor.editor.muteLbl")}
            >
              {seg.mute ? "🔇" : "🔊"}
            </button>
          </div>
        </Field>
      )}

      {(seg.transition && seg.transition !== "cut") || fx > 0 ? (
        <p className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--app-text-faint)]">
          {seg.transition && seg.transition !== "cut" ? `${t("dashboard.aiEditor.editor.transitionChip")} : ${seg.transition}. ` : ""}
          {fx > 0 ? t("dashboard.aiEditor.editor.effectsNote", { n: fx }) : ""}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button onClick={() => onMove(-1)} disabled={idx === 0} className="duup-btn flex-1 rounded-lg px-2 py-2 text-[12.5px] font-semibold text-[var(--app-text)] disabled:opacity-40">← {t("dashboard.aiEditor.editor.moveLeft")}</button>
        <button onClick={() => onMove(1)} disabled={idx === count - 1} className="duup-btn flex-1 rounded-lg px-2 py-2 text-[12.5px] font-semibold text-[var(--app-text)] disabled:opacity-40">{t("dashboard.aiEditor.editor.moveRight")} →</button>
      </div>
      <button onClick={onDelete} disabled={count <= 1} className="w-full rounded-lg border border-red-500/40 px-3 py-2 text-[12.5px] font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-40">
        🗑 {t("dashboard.aiEditor.editor.deleteSegment")}
      </button>
    </div>
  );
}

/* ── Panneau MUSIQUE ── */
function AudioPanel({ plan, materials, total, mutate, onRemoved }: {
  plan: EditPlan; materials: Mat[]; total: number;
  mutate: (fn: (d: EditPlan) => void, key?: string) => void;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const candidates = materials.filter((m) => m.kind === "audio" || m.kind === "video");
  const a = plan.audio;

  return (
    <div className="space-y-2.5">
      <div className="text-[13px] font-bold text-[var(--app-text)]">🎵 {t("dashboard.aiEditor.editor.panelAudio")}</div>

      {!a ? (
        <>
          <p className="text-[12px] text-[var(--app-text-muted)]">{t("dashboard.aiEditor.editor.noMusic")}</p>
          <Field label={t("dashboard.aiEditor.editor.addMusic")}>
            <select
              value=""
              onChange={(e) => { if (e.target.value) mutate((d) => { d.audio = { materialId: e.target.value, mode: "mix", volume: 0.8, duck: true }; }); }}
              className={inputCls}
            >
              <option value="">—</option>
              {candidates.map((m) => <option key={m.id} value={m.id}>{m.kind === "audio" ? "🎵" : "🎬"} {m.name}</option>)}
            </select>
          </Field>
        </>
      ) : (
        <>
          <Field label={t("dashboard.aiEditor.editor.music")}>
            <select
              value={a.materialId}
              onChange={(e) => mutate((d) => { if (d.audio) d.audio.materialId = e.target.value; })}
              className={inputCls}
            >
              {candidates.map((m) => <option key={m.id} value={m.id}>{m.kind === "audio" ? "🎵" : "🎬"} {m.name}</option>)}
            </select>
          </Field>
          <Field label={t("dashboard.aiEditor.editor.volume")}>
            <input
              type="range" min={0} max={2} step={0.05} value={a.volume ?? 1}
              onChange={(e) => mutate((d) => { if (d.audio) d.audio.volume = Number(e.target.value); }, "audio-vol")}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-indigo-500"
              style={{ background: "var(--app-border-strong)" }}
            />
          </Field>
          <NumField
            label={t("dashboard.aiEditor.editor.musicEnd")}
            value={a.endSec ?? total} min={1} max={total}
            onChange={(v) => mutate((d) => { if (d.audio) d.audio.endSec = v >= total - 0.05 ? undefined : clampN(v, 1, total); }, "audio-end")}
          />
          <Field label={t("dashboard.aiEditor.editor.modeLbl")}>
            <div className="flex gap-1.5">
              {(["mix", "replace"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => mutate((d) => { if (d.audio) d.audio.mode = m; })}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11.5px] font-semibold transition ${(a.mode ?? "mix") === m ? "border-indigo-500 text-indigo-400" : "border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]"}`}
                >
                  {m === "mix" ? t("dashboard.aiEditor.editor.modeMix") : t("dashboard.aiEditor.editor.modeReplace")}
                </button>
              ))}
            </div>
          </Field>
          <button
            onClick={() => { mutate((d) => { d.audio = undefined; }); onRemoved(); }}
            className="w-full rounded-lg border border-red-500/40 px-3 py-2 text-[12.5px] font-semibold text-red-400 transition hover:bg-red-500/10"
          >
            🗑 {t("dashboard.aiEditor.editor.removeMusic")}
          </button>
        </>
      )}
    </div>
  );
}
