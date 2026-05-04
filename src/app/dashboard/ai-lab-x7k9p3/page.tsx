"use client";

import { useRef, useState } from "react";

type Mode = "variation" | "prompt";

export default function AiLabPage() {
  const [mode, setMode] = useState<Mode>("variation");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [variants, setVariants] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  function setPicked(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setResults([]);
    setErr("");
  }

  async function handleLaunch() {
    setErr("");
    setResults([]);
    if (!file) return setErr("Ajoute une image avant de lancer.");
    if (mode === "prompt" && !prompt.trim()) {
      return setErr("Tu dois écrire un prompt en mode personnalisé.");
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
      if (!res.ok || !j.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setResults(j.urls || []);
    } catch (e: any) {
      setErr(e?.message || "Erreur réseau.");
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
      setErr(e?.message || "Téléchargement impossible.");
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
      setErr(e?.message || "Erreur lors du téléchargement du ZIP");
    }
  }

  return (
    <div className="p-8 w-full">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-white/30 tracking-[0.14em] uppercase mb-2">
          Lab interne
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            Variation IA
          </span>
        </h1>
        <p className="text-sm text-white/40 mt-1.5">
          Génère 1 à 3 variations d'une image. Identité, décor, lumière conservés — seule l'action change.
        </p>
      </div>

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
          Variation pure
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
          Avec prompt
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
              {file ? "Image de référence" : "Glisse une image ou clique pour parcourir"}
            </p>

            {!preview ? (
              <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-white/10 bg-white/[0.02]">
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-white/30 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4h16v16H4zM12 8v8M8 12h8" />
                </svg>
                <p className="text-xs text-white/40">PNG, JPG, WebP</p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={preview}
                  alt="Référence"
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
                  aria-label="Retirer l'image"
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
                Prompt personnalisé
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="Ex: change l'arrière-plan en plage au coucher du soleil…"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-fuchsia-400/40 resize-none"
              />
              <p className="mt-2 text-[11px] text-white/35">
                Décris ce que tu veux modifier sur l'image. Le modèle (Qwen Image Edit) applique tes instructions.
              </p>
            </div>
          )}
        </div>

        {/* Right — controls + results */}
        <div className="space-y-4">
          {/* Controls */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <label className="block text-sm font-medium text-white/80 mb-3">
              Nombre de variations
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
                {busy ? "Génération en cours…" : "Lancer"}
              </button>
              {results.length > 0 && (
                <button
                  type="button"
                  onClick={downloadZip}
                  className="rounded-xl px-4 py-3 text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.10] text-white/85 transition"
                  title="Télécharger toutes les variations en ZIP"
                >
                  ZIP
                </button>
              )}
            </div>

            {err && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">
                {err}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-sm font-medium text-white/80 mb-3">
              Résultats {results.length > 0 && <span className="text-white/40">({results.length})</span>}
            </p>

            {results.length === 0 ? (
              <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-white/10 bg-white/[0.02]">
                <p className="text-xs text-white/40">
                  {busy ? "Le modèle travaille — patience…" : "Aucune variation pour le moment"}
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
                      aria-label={`Supprimer la variation ${i + 1}`}
                      title="Supprimer cette variation"
                    >
                      ×
                    </button>
                    <img src={url} alt={`variation ${i + 1}`} className="w-full h-auto" />
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-white/55">Variation {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => downloadOne(url, i + 1)}
                        className="rounded-md px-2.5 py-1 text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white/85 transition"
                      >
                        Télécharger
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
