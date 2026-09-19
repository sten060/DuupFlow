"use client";

// « IA automatique » — duplication conversationnelle (BETA).
// Deux états d'écran, calqués sur deux références précises :
//  1. ACCUEIL → design Higgsfield : titre centré avec icône inline + UN gros
//     bloc de composition arrondi (textarea + barre d'outils interne : « + »
//     à gauche, bouton rond d'envoi à droite). Les vidéos déposées deviennent
//     des pastilles DANS le bloc, chacune avec son nombre de copies.
//  2. CONVERSATION → design Claude : la discussion se range à droite sur toute
//     la hauteur ; réponses de l'IA en texte plein (sans bulle), messages du
//     user en bulle discrète, composer arrondi en bas + mention « l'IA peut se
//     tromper ». À gauche : les fichiers et les duplications rendues.

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

type Mat = {
  id: string;
  name: string;
  kind: "video" | "image" | "audio";
  status?: "analyzing" | "ready" | "failed";
  analysis: { durationSec?: number; width: number; height: number } | null;
};
type Variant = { id: string; label?: string; durationSec?: number; createdAt: number };
type Msg = { role: "user" | "assistant"; content: string };

const MAX_FILES = 5;
const MAX_COPIES = 6;

/** Icône flèche haut (bouton d'envoi, façon Higgsfield / Claude). */
function ArrowUp() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

// ── VERROU BETA ──────────────────────────────────────────────────────────────
// La feature est en chantier (décision Sten 19/09/2026) : FERMÉE aux users tant
// que NEXT_PUBLIC_AI_AUTO_BETA≠"1". Le flag dans .env.local permet de continuer
// à développer en local ; la prod, sans le flag, montre « Bientôt disponible »
// (même en tapant l'URL directement). Rouvrir = poser le flag sur Railway.
const AI_AUTO_OPEN = process.env.NEXT_PUBLIC_AI_AUTO_BETA === "1";

export default function AiAutoPage() {
  return AI_AUTO_OPEN ? <AiAutoClient /> : <AiAutoComingSoon />;
}

function AiAutoComingSoon() {
  const { t } = useTranslation();
  return (
    <main className="grid h-full place-items-center p-8">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-fuchsia-400" style={{ background: "rgba(217,70,239,0.10)", border: "1px solid rgba(217,70,239,0.22)" }}>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6 10l.9 2.5L21.5 15l-2.6.9L18 18.5l-.9-2.6L14.5 15l2.6-.5L18 12zM6 13l.8 2.2L9 16l-2.2.8L6 19l-.8-2.2L3 16l2.2-.8L6 13z" /></svg>
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--app-text)]">{t("dashboard.videos.aiTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">{t("dashboard.videos.aiSoonDesc")}</p>
        <a href="/dashboard/videos" className="mt-6 inline-block rounded-lg border border-[var(--app-border-strong)] px-4 py-2.5 text-sm font-medium text-[var(--app-text)] hover:bg-[var(--app-surface-2)]">
          {t("dashboard.videos.aiSoonBack")}
        </a>
      </div>
    </main>
  );
}

function AiAutoClient() {
  const { t } = useTranslation();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Mat[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [launched, setLaunched] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const started = messages.length > 0;
  const pending = Math.max(0, launched - variants.length);

  // ── Session : un projet vierge par visite ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/ai-auto/session", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!cancelled && data?.projectId) setProjectId(data.projectId);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Polling : statuts d'analyse + duplications rendues ────────────────────
  const refresh = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/ai-editor/project?id=${projectId}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    const p = data?.project;
    if (!p) return;
    setMaterials(p.materials ?? []);
    setVariants(p.variants ?? []);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const iv = setInterval(refresh, 4000);
    return () => clearInterval(iv);
  }, [projectId, refresh]);

  // ── Upload (bouton, clic sur la zone, drag & drop) ────────────────────────
  const uploadFiles = useCallback(async (list: FileList | File[]) => {
    if (!projectId) return;
    setError(null);
    const files = Array.from(list).filter((f) => f.type.startsWith("video") || /\.(mp4|mov|m4v|webm)$/i.test(f.name));
    const room = MAX_FILES - materials.length - uploading;
    for (const file of files.slice(0, Math.max(0, room))) {
      setUploading((n) => n + 1);
      const form = new FormData();
      form.set("projectId", projectId);
      form.set("file", file);
      fetch("/api/ai-editor/material", { method: "POST", body: form })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) setError(data?.error || t("dashboard.videos.aiError"));
          else if (data?.material?.id) setCopies((c) => ({ ...c, [data.material.id]: 3 }));
          await refresh();
        })
        .catch(() => setError(t("dashboard.videos.aiError")))
        .finally(() => setUploading((n) => n - 1));
    }
  }, [projectId, materials.length, uploading, refresh, t]);

  const removeMaterial = useCallback(async (materialId: string) => {
    if (!projectId) return;
    setMaterials((ms) => ms.filter((m) => m.id !== materialId));
    await fetch("/api/ai-editor/material", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, materialId }),
    }).catch(() => {});
    await refresh();
  }, [projectId, refresh]);

  // ── Envoi d'un message ────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !projectId) return;
    if (materials.length === 0) { setError(t("dashboard.videos.aiNeedFiles")); return; }
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/ai-auto/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          messages: next,
          files: materials.map((m) => ({ materialId: m.id, copies: copies[m.id] ?? 3 })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessages((ms) => [...ms, { role: "assistant", content: `⚠️ ${data?.error || t("dashboard.videos.aiError")}` }]);
      } else {
        setMessages((ms) => [...ms, { role: "assistant", content: String(data?.reply ?? "…") }]);
        if (Number(data?.launched) > 0) { setLaunched((n) => n + Number(data.launched)); void refresh(); }
      }
    } catch {
      setMessages((ms) => [...ms, { role: "assistant", content: `⚠️ ${t("dashboard.videos.aiError")}` }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, projectId, materials, copies, messages, refresh, t]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const onComposerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); void uploadFiles(e.dataTransfer.files); },
  };

  const hiddenInput = (
    <input ref={fileInputRef} type="file" accept="video/*,.mp4,.mov,.m4v,.webm" multiple className="hidden"
      onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }} />
  );

  // ── Statut d'un fichier (pastille colorée) ────────────────────────────────
  const statusDot = (m: Mat) => {
    const s = m.status ?? (m.analysis ? "ready" : "analyzing");
    const map = {
      ready: ["bg-emerald-400", "text-emerald-400", t("dashboard.videos.aiReady")],
      failed: ["bg-rose-400", "text-rose-400", t("dashboard.videos.aiFailed")],
      analyzing: ["bg-amber-300 animate-pulse", "text-amber-300", t("dashboard.videos.aiAnalyzing")],
    }[s === "ready" || s === "failed" ? s : "analyzing"];
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${map[1]}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${map[0]}`} />{map[2]}
      </span>
    );
  };

  // ── Pastille d'un fichier + réglage du nombre de copies ───────────────────
  const fileChip = (m: Mat, tone: "onSurface" | "onPanel") => (
    <div key={m.id}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2
        ${tone === "onSurface"
          ? "border-[var(--app-border)] bg-[var(--app-surface-2)]"
          : "border-[var(--app-border)] bg-[var(--app-surface)]"}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--app-text)]">{m.name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--app-text-faint)]">
          {statusDot(m)}
          {m.analysis?.durationSec ? <span>{Math.round(m.analysis.durationSec)}s</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-1">
        <button type="button" aria-label="-" className="px-1 text-fuchsia-300 hover:text-fuchsia-100"
          onClick={() => setCopies((c) => ({ ...c, [m.id]: Math.max(1, (c[m.id] ?? 3) - 1) }))}>−</button>
        <span className="min-w-[3.4rem] text-center text-xs font-semibold text-fuchsia-200">{copies[m.id] ?? 3} {t("dashboard.videos.aiCopies")}</span>
        <button type="button" aria-label="+" className="px-1 text-fuchsia-300 hover:text-fuchsia-100"
          onClick={() => setCopies((c) => ({ ...c, [m.id]: Math.min(MAX_COPIES, (c[m.id] ?? 3) + 1) }))}>＋</button>
      </div>
      <button type="button" aria-label="Retirer" className="shrink-0 text-[var(--app-text-faint)] hover:text-rose-400" onClick={() => void removeMaterial(m.id)}>✕</button>
    </div>
  );

  const canSend = !!input.trim() && !sending;

  // ═══ ÉTAT 1 : ACCUEIL — bloc de composition façon Higgsfield ═══════════════
  if (!started) {
    return (
      <main className="flex h-full flex-col overflow-y-auto">
        {hiddenInput}
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-10">
          <div className="mb-6 flex items-center justify-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl text-fuchsia-300"
                  style={{ background: "rgba(217,70,239,0.12)", border: "1px solid rgba(217,70,239,0.28)" }}>✨</span>
            <h1 className="text-center text-[34px] font-extrabold leading-none tracking-tight text-[var(--app-text)] sm:text-[42px]">
              {t("dashboard.videos.aiHeroTitle")}
            </h1>
          </div>
          <p className="mb-8 max-w-xl text-center text-[15px] leading-relaxed text-[var(--app-text-muted)]">
            {t("dashboard.videos.aiHeroSubtitle")}
          </p>

          {/* LE BLOC — un seul conteneur arrondi, barre d'outils interne */}
          <div
            {...dropHandlers}
            className={`w-full rounded-[24px] border bg-[var(--app-surface)] p-3.5 shadow-2xl transition-colors
              ${dragOver ? "border-fuchsia-400/70 ring-2 ring-fuchsia-400/25" : "border-[var(--app-border)]"}`}
          >
            <textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={t("dashboard.videos.aiPlaceholder")}
              className="w-full resize-none bg-transparent px-2 pt-1.5 pb-1 text-[16px] leading-relaxed text-[var(--app-text)] placeholder-[var(--app-text-faint)] outline-none"
            />

            {(materials.length > 0 || uploading > 0) && (
              <div className="mb-1 mt-1 space-y-2 px-1">
                {materials.map((m) => fileChip(m, "onSurface"))}
                {uploading > 0 && <p className="px-1 text-xs text-[var(--app-text-faint)]">⏳ {uploading}…</p>}
              </div>
            )}

            {/* Barre d'outils : + à gauche, envoi rond à droite */}
            <div className="mt-1 flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <button type="button" onClick={() => fileInputRef.current?.click()} aria-label={t("dashboard.videos.aiAddVideos")}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border)] text-[var(--app-text-muted)] transition-colors hover:border-fuchsia-400/60 hover:text-fuchsia-300">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
                <span className="text-xs text-[var(--app-text-faint)]">{t("dashboard.videos.aiUploadHint")}</span>
              </div>
              <button type="button" onClick={() => void send()} disabled={!canSend} aria-label={t("dashboard.videos.aiSend")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-500 text-white transition-opacity hover:bg-fuchsia-400 disabled:opacity-30">
                <ArrowUp />
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300/80">✨ {t("dashboard.videos.aiTitle")} · BETA</p>
          {error && <p className="mt-3 text-sm font-medium text-rose-400">{error}</p>}
        </div>
      </main>
    );
  }

  // ═══ ÉTAT 2 : CONVERSATION façon Claude, panneau à droite ══════════════════
  return (
    <main className="flex h-full min-h-0">
      {hiddenInput}

      {/* Gauche : fichiers + duplications rendues */}
      <section className="min-w-0 flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--app-text)]">{t("dashboard.videos.aiFilesTitle")}</h2>
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--app-text-muted)] hover:border-fuchsia-400/50 hover:text-fuchsia-300">
            ＋ {t("dashboard.videos.aiAddVideos")}
          </button>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">{materials.map((m) => fileChip(m, "onPanel"))}</div>

        <h2 className="mt-8 text-lg font-bold text-[var(--app-text)]">{t("dashboard.videos.aiResultsTitle")}</h2>
        {variants.length === 0 && pending === 0 ? (
          <p className="mt-3 max-w-md text-sm text-[var(--app-text-muted)]">{t("dashboard.videos.aiResultsEmpty")}</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {variants.map((v) => (
              <div key={v.id} className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
                <video controls preload="metadata" className="aspect-[9/16] max-h-72 w-full bg-black object-contain"
                  src={`/api/ai-editor/variant?projectId=${projectId}&id=${v.id}`} />
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="truncate text-xs font-medium text-[var(--app-text-muted)]">{v.label ?? v.id}</p>
                  <a href={`/api/ai-editor/variant?projectId=${projectId}&id=${v.id}&dl=1`}
                    className="shrink-0 rounded-lg bg-fuchsia-500/15 px-2.5 py-1 text-[11px] font-bold text-fuchsia-300 hover:bg-fuchsia-500/25">
                    ⬇ {t("dashboard.videos.aiDownload")}
                  </a>
                </div>
              </div>
            ))}
            {Array.from({ length: pending }).map((_, i) => (
              <div key={`p${i}`} className="flex aspect-[9/16] max-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-fuchsia-500/40 bg-fuchsia-500/[0.05]">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent" />
                <p className="mt-3 px-4 text-center text-xs font-semibold text-fuchsia-200">{t("dashboard.videos.aiRendering")}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Droite : la discussion façon Claude */}
      <aside className="flex h-full w-full max-w-[460px] shrink-0 flex-col border-l border-[var(--app-border)] bg-[var(--app-bg)]">
        <header className="flex items-center gap-2 border-b border-[var(--app-border)] px-5 py-3.5">
          <span className="text-lg" aria-hidden>✨</span>
          <h2 className="text-sm font-bold text-[var(--app-text)]">{t("dashboard.videos.aiTitle")}</h2>
          <span className="rounded-full border border-fuchsia-500/45 bg-fuchsia-500/[0.14] px-2 py-0.5 text-[10px] font-semibold text-fuchsia-200">BETA</span>
        </header>

        {/* Fil de discussion : IA en texte plein, user en bulle discrète */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl bg-[var(--app-surface-2)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--app-text)]">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="whitespace-pre-wrap text-[15px] leading-[1.7] text-[var(--app-text)]">
                {m.content}
              </div>
            )
          )}
          {sending && (
            <div className="flex items-center gap-1.5 text-[15px] text-[var(--app-text-faint)]">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--app-text-faint)] [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--app-text-faint)] [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--app-text-faint)]" />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Composer bas façon Claude : bloc arrondi, + à gauche, envoi rond */}
        <div className="px-4 pb-3 pt-1">
          {error && <p className="mb-2 px-1 text-xs font-medium text-rose-400">{error}</p>}
          <div className="rounded-[22px] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 pb-2 pt-2.5">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={t("dashboard.videos.aiPanelPlaceholder")}
              className="w-full resize-none bg-transparent px-1 text-[15px] leading-relaxed text-[var(--app-text)] placeholder-[var(--app-text-faint)] outline-none"
            />
            {/* pr-14 : dégage le coin bas-droite où vit le chatbot de support flottant. */}
            <div className="mt-1 flex items-center justify-between pr-14">
              <button type="button" onClick={() => fileInputRef.current?.click()} aria-label={t("dashboard.videos.aiAddVideos")}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-border)] text-[var(--app-text-muted)] transition-colors hover:border-fuchsia-400/60 hover:text-fuchsia-300">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              <button type="button" onClick={() => void send()} disabled={!canSend} aria-label={t("dashboard.videos.aiSend")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-fuchsia-500 text-white transition-opacity hover:bg-fuchsia-400 disabled:opacity-30">
                <ArrowUp />
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-[var(--app-text-faint)]">{t("dashboard.videos.aiDisclaimer")}</p>
        </div>
      </aside>
    </main>
  );
}
