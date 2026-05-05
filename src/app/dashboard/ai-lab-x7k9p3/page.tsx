"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { formatTokens, formatEur, imageCostCents, imagesAffordable } from "@/lib/tokens";

type Mode = "variation" | "prompt";

// ── Persistent results across reloads ──────────────────────────────────────
// Variations live in localStorage with a per-entry timestamp. On every load
// we drop entries older than 24 h — which also matches the Supabase signed
// URL TTL set server-side, so we never display dead links.
const STORAGE_KEY = "duupflow_ai_variations_v1";
const TTL_MS = 24 * 60 * 60 * 1000;

type StoredVariation = { url: string; createdAt: number };

function loadFreshVariations(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items: StoredVariation[] = JSON.parse(raw);
    const now = Date.now();
    const fresh = items.filter((it) => now - it.createdAt < TTL_MS);
    if (fresh.length !== items.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    }
    return fresh.map((it) => it.url);
  } catch {
    return [];
  }
}

function syncVariationsToStorage(urls: string[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: StoredVariation[] = raw ? JSON.parse(raw) : [];
    const byUrl = new Map(existing.map((it) => [it.url, it.createdAt]));
    const now = Date.now();
    // Preserve original createdAt for known URLs; stamp new ones now.
    const next: StoredVariation[] = urls.map((url) => ({
      url,
      createdAt: byUrl.get(url) ?? now,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export default function AiLabPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("variation");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [variants, setVariants] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Fetch balance + plan on mount (and after each generation).
  async function refreshBalance() {
    try {
      const r = await fetch("/api/tokens-lab-q8m4w7", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setBalanceCents(j.balanceCents ?? 0);
      setPlan(j.plan ?? null);
    } catch {}
  }
  useEffect(() => { refreshBalance(); }, []);

  // Load fresh (<24 h) variations from localStorage on mount.
  // Initial state is [] to avoid SSR/hydration mismatch.
  useEffect(() => {
    const stored = loadFreshVariations();
    if (stored.length > 0) setResults(stored);
  }, []);

  // Persist results to localStorage on every change (additions, deletions).
  useEffect(() => {
    syncVariationsToStorage(results);
  }, [results]);

  function setPicked(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    // Don't wipe results — they're persisted across reloads and the user
    // should be able to swap input image without losing previous variations.
    setErr("");
  }

  async function handleLaunch() {
    setErr("");
    // Keep previous results — new ones are appended (newest first) and they
    // all auto-expire after 24 h. User can prune individually via the × button.
    if (!file) return setErr(t("dashboard.aiLab.errAddImage"));
    if (mode === "prompt" && !prompt.trim()) {
      return setErr(t("dashboard.aiLab.errPromptRequired"));
    }

    const fd = new FormData();
    fd.append("image", file);
    fd.append("mode", mode);
    fd.append("variants", String(variants));
    if (mode === "prompt") fd.append("prompt", prompt.trim());

    setBusy(true);
    try {
      const res = await fetch("/api/ai-lab-x7k9p3", { method: "POST", body: fd });
      const j = await res.json();
      // Refresh balance from response payload (or refetch on missing field).
      if (typeof j?.balanceCents === "number") setBalanceCents(j.balanceCents);
      else void refreshBalance();
      if (!res.ok || !j.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      const incoming: string[] = j.urls || [];
      setResults((prev) => [...incoming, ...prev]);
    } catch (e: any) {
      setErr(e?.message || t("dashboard.aiLab.errNetwork"));
    } finally {
      setBusy(false);
    }
  }

  async function downloadOne(url: string, idx: number) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const ext = blob.type.includes("webp") ? "webp" : blob.type.includes("jpeg") ? "jpg" : "png";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `duupflow_ai_${idx}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    } catch (e: any) {
      setErr(e?.message || t("dashboard.aiLab.errDownload"));
    }
  }

  async function downloadZip() {
    if (!results.length) return;
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let i = 1;
      for (const url of results) {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const blob = await res.blob();
        const ext = blob.type.includes("webp") ? "webp" : blob.type.includes("jpeg") ? "jpg" : "png";
        zip.file(`duupflow_ai_${i}.${ext}`, blob);
        i++;
      }
      const content = await zip.generateAsync({ type: "blob" });
      const dlUrl = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = "duupflow_ai_variations.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dlUrl);
    } catch (e: any) {
      setErr(e?.message || t("dashboard.aiLab.errZipDownload"));
    }
  }

  return (
    <div className="p-8 w-full">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-white/30 tracking-[0.14em] uppercase mb-2">
            {t("dashboard.aiLab.labBadge")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
              {t("dashboard.aiLab.title")}
            </span>
          </h1>
          <p className="text-sm text-white/40 mt-1.5">
            {t("dashboard.aiLab.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Balance pill */}
          {balanceCents !== null && (
            <div
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-200/85"
              title={`Solde : ${formatEur(balanceCents)} · ${imagesAffordable(balanceCents, plan)} image(s) possible(s)`}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-400/40 text-[10px] font-bold text-emerald-300">
                €
              </span>
              {formatTokens(balanceCents)} tokens
            </div>
          )}

          {/* Info button — opens an explanatory modal */}
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/[0.06] px-3 py-1.5 text-xs font-medium text-fuchsia-200/85 hover:bg-fuchsia-500/[0.12] hover:border-fuchsia-400/40 transition"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-fuchsia-400/40 text-[10px] font-bold text-fuchsia-300">
              i
            </span>
            {t("dashboard.aiLab.infoButton")}
          </button>
        </div>
      </div>

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}

      {/* Mode toggle */}
      <div className="mb-6 inline-flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
        <button
          type="button"
          onClick={() => setMode("variation")}
          className={[
            "rounded-lg px-4 py-2 text-sm font-medium transition",
            mode === "variation"
              ? "bg-gradient-to-r from-fuchsia-500/30 to-indigo-500/30 text-white border border-fuchsia-400/30"
              : "text-white/55 hover:text-white/85",
          ].join(" ")}
        >
          {t("dashboard.aiLab.modeVariation")}
        </button>
        <button
          type="button"
          onClick={() => setMode("prompt")}
          className={[
            "rounded-lg px-4 py-2 text-sm font-medium transition",
            mode === "prompt"
              ? "bg-gradient-to-r from-fuchsia-500/30 to-indigo-500/30 text-white border border-fuchsia-400/30"
              : "text-white/55 hover:text-white/85",
          ].join(" ")}
        >
          {t("dashboard.aiLab.modePrompt")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — input */}
        <div className="space-y-4">
          {/* Dropzone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f && f.type.startsWith("image/")) setPicked(f);
            }}
            className={[
              "rounded-2xl border bg-white/[0.02] p-4 cursor-pointer transition",
              isDragOver
                ? "border-fuchsia-400/40 shadow-[0_0_32px_rgba(217,70,239,0.20)]"
                : "border-white/[0.08] hover:border-fuchsia-500/30",
            ].join(" ")}
          >
            <p className="text-sm text-white/70 mb-3">
              {file ? t("dashboard.aiLab.referenceImage") : t("dashboard.aiLab.dropOrPick")}
            </p>

            {!preview ? (
              <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-white/10 bg-white/[0.02]">
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-white/30 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4h16v16H4zM12 8v8M8 12h8" />
                </svg>
                <p className="text-xs text-white/40">{t("dashboard.aiLab.supportedFormats")}</p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={preview}
                  alt={t("dashboard.aiLab.referenceImage")}
                  className="rounded-lg border border-white/10 max-h-80 object-contain w-full bg-black/20"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPicked(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-white"
                  aria-label={t("dashboard.aiLab.removeImage")}
                >
                  ×
                </button>
                {file && (
                  <p className="mt-2 text-xs text-white/45">
                    {file.name} — {(file.size / 1024 / 1024).toFixed(2)} Mo
                  </p>
                )}
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPicked(e.target.files?.[0] || null)}
            />
          </div>

          {/* Prompt textarea (only in prompt mode) */}
          {mode === "prompt" && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <label className="block text-sm font-medium text-white/80 mb-2">
                {t("dashboard.aiLab.promptLabel")}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder={t("dashboard.aiLab.promptPlaceholder")}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-fuchsia-400/40 resize-none"
              />
              <p className="mt-2 text-[11px] text-white/35">
                {t("dashboard.aiLab.promptHint")}
              </p>
            </div>
          )}
        </div>

        {/* Right — controls + results */}
        <div className="space-y-4">
          {/* Controls */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <label className="block text-sm font-medium text-white/80 mb-3">
              {t("dashboard.aiLab.variantsLabel")}
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setVariants(n)}
                  className={[
                    "flex-1 rounded-lg py-2.5 text-sm font-semibold transition",
                    variants === n
                      ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white shadow-[0_4px_20px_rgba(192,38,211,.30)]"
                      : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]",
                  ].join(" ")}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={handleLaunch}
                disabled={busy || !file}
                className={[
                  "flex-1 rounded-xl px-5 py-3 text-sm font-bold transition",
                  busy || !file
                    ? "bg-white/[0.06] text-white/35 cursor-not-allowed"
                    : "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white hover:shadow-[0_4px_24px_rgba(192,38,211,.40)]",
                ].join(" ")}
              >
                {busy ? t("dashboard.aiLab.generating") : t("dashboard.aiLab.launchButton")}
              </button>
              {results.length > 0 && (
                <button
                  type="button"
                  onClick={downloadZip}
                  className="rounded-xl px-4 py-3 text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.10] text-white/85 transition"
                  title={t("dashboard.aiLab.downloadAllZip")}
                >
                  ZIP
                </button>
              )}
            </div>

            {/* Cost estimate */}
            {balanceCents !== null && (
              <p className="mt-3 text-[11px] text-white/40">
                Coût estimé&nbsp;:&nbsp;
                <span className="text-white/70 font-medium">
                  {formatTokens(imageCostCents(plan) * variants)} tokens
                </span>
                &nbsp;·&nbsp;Solde après&nbsp;:&nbsp;
                <span className={
                  balanceCents - imageCostCents(plan) * variants < 0
                    ? "text-red-300 font-medium"
                    : "text-white/70"
                }>
                  {formatTokens(Math.max(0, balanceCents - imageCostCents(plan) * variants))} tokens
                </span>
              </p>
            )}

            {err && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">
                {err}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-sm font-medium text-white/80 mb-3">
              {t("dashboard.aiLab.resultsTitle")} {results.length > 0 && <span className="text-white/40">({results.length})</span>}
            </p>

            {results.length === 0 ? (
              <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-white/10 bg-white/[0.02]">
                <p className="text-xs text-white/40">
                  {busy ? t("dashboard.aiLab.modelWorking") : t("dashboard.aiLab.noResultsYet")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map((url, i) => (
                  <div
                    key={url + i}
                    className="relative overflow-hidden rounded-lg border border-white/10 hover:border-fuchsia-400/30 bg-white/5 transition"
                  >
                    <button
                      type="button"
                      onClick={() => setResults((r) => r.filter((u) => u !== url))}
                      className="absolute top-2 right-2 z-10 h-7 w-7 flex items-center justify-center rounded-full bg-black/65 hover:bg-black/85 border border-white/15 text-white"
                      aria-label={t("dashboard.aiLab.deleteVariantAria", { n: String(i + 1) })}
                      title={t("dashboard.aiLab.deleteVariant")}
                    >
                      ×
                    </button>
                    <img src={url} alt={t("dashboard.aiLab.variantLabel", { n: String(i + 1) })} className="w-full h-auto" />
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-white/55">
                        {t("dashboard.aiLab.variantLabel", { n: String(i + 1) })}
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadOne(url, i + 1)}
                        className="rounded-md px-2.5 py-1 text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white/85 transition"
                      >
                        {t("dashboard.aiLab.downloadOne")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Info modal ─────────────────────────────────────────────────────────────
function InfoModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
      style={{ background: "rgba(6,9,24,0.78)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-fuchsia-400/20 bg-[#0b0e1a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(217,70,239,0.10)]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/70"
          aria-label={t("dashboard.aiLab.modalClose")}
        >
          ×
        </button>

        <div className="mb-5">
          <p className="text-xs font-medium text-fuchsia-300/70 tracking-[0.12em] uppercase mb-1.5">
            {t("dashboard.aiLab.modalEyebrow")}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
              {t("dashboard.aiLab.title")}
            </span>
          </h2>
        </div>

        <div className="space-y-5 text-sm leading-relaxed">
          <section>
            <h3 className="text-white/95 font-semibold mb-1.5">
              {t("dashboard.aiLab.modalSection1Title")}
            </h3>
            <p className="text-white/60">{t("dashboard.aiLab.modalSection1Body")}</p>
          </section>

          <section>
            <h3 className="text-white/95 font-semibold mb-1.5">
              {t("dashboard.aiLab.modalSection2Title")}
            </h3>
            <ol className="space-y-1 text-white/60 list-decimal list-inside">
              <li>{t("dashboard.aiLab.modalSection2Step1")}</li>
              <li>{t("dashboard.aiLab.modalSection2Step2")}</li>
              <li>{t("dashboard.aiLab.modalSection2Step3")}</li>
              <li>{t("dashboard.aiLab.modalSection2Step4")}</li>
            </ol>
          </section>

          <section>
            <h3 className="text-white/95 font-semibold mb-1.5">
              {t("dashboard.aiLab.modalSection3Title")}
            </h3>
            <ul className="space-y-1 text-white/60 list-disc list-inside">
              <li>{t("dashboard.aiLab.modalSection3Pure")}</li>
              <li>{t("dashboard.aiLab.modalSection3Prompt")}</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white/95 font-semibold mb-1.5">
              {t("dashboard.aiLab.modalSection4Title")}
            </h3>
            <ul className="space-y-1 text-white/60 list-disc list-inside">
              <li>{t("dashboard.aiLab.modalSection4Tip1")}</li>
              <li>{t("dashboard.aiLab.modalSection4Tip2")}</li>
              <li>{t("dashboard.aiLab.modalSection4Tip3")}</li>
              <li>{t("dashboard.aiLab.modalSection4Tip4")}</li>
            </ul>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white hover:shadow-[0_4px_20px_rgba(192,38,211,.35)] transition"
          >
            {t("dashboard.aiLab.modalCta")}
          </button>
        </div>
      </div>
    </div>
  );
}
