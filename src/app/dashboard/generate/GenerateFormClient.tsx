// src/app/dashboard/generate/GenerateFormClient.tsx
"use client";

import React from "react";

export default function GenerateFormClient() {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  const [prompt, setPrompt] = React.useState("");
  const [variants, setVariants] = React.useState(4);
  const [seed, setSeed] = React.useState<string>("");
  const [strength, setStrength] = React.useState<number>(0.55);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<string[]>([]);

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setError(null);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  function onReset() {
    setPrompt("");
    setVariants(4);
    setSeed("");
    setStrength(0.55);
    setResults([]);
    setError(null);
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function downloadOne(url: string, i: number) {
    const r = await fetch(url);
    const b = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `duupflow-${i + 1}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  async function downloadAll() {
    for (let i = 0; i < results.length; i++) await downloadOne(results[i], i);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Ajoute une image de référence.");
    if (!prompt.trim()) return setError("Écris un prompt court et précis.");

    setLoading(true);
    setError(null);
    setResults([]);

    const fd = new FormData();
    fd.set("image", file);
    fd.set("prompt", prompt.trim());
    fd.set("variants", String(variants));
    if (seed.trim()) fd.set("seed", seed.trim());
    fd.set("strength", String(strength));

    try {
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Erreur de génération.");
      } else if (!Array.isArray(data.urls) || data.urls.length === 0) {
        setError("Aucune image retournée.");
      } else {
        setResults(data.urls);
      }
    } catch (err: any) {
      setError(err?.message || "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-8">
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
          <section className="space-y-3">
            <label className="label">Image de référence</label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="file-input"
            />
            {preview && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <img src={preview} alt="preview" className="w-full h-auto rounded-lg object-contain" />
              </div>
            )}
          </section>

          {/* Prompt */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label">Prompt (variante souhaitée)</label>
              <span className="text-xs text-white/50">Reste simple et direct.</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              placeholder={`Ex : "même cadrage, studio propre, éclairage doux"\nEx : "teintes froides, fond minimal, +netteté"\nEx : "look lifestyle moderne, salon lumineux"`}
              className="textarea min-h-[176px]"
            />
          </section>
        </div>

        {/* Options */}
        <section className="grid md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="label">Variantes</label>
            <input
              type="number"
              min={1}
              max={8}
              value={variants}
              onChange={(e) => setVariants(Number(e.target.value))}
              className="input"
            />
          </div>

          <div className="space-y-2">
            <label className="label">Seed (optionnel)</label>
            <input
              type="text"
              placeholder="ex: 12345"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="input"
            />
            <p className="text-xs text-white/50">Fixe la seed pour répéter un résultat.</p>
          </div>

          <div className="space-y-2">
            <label className="label">Fidélité (0=très fidèle, 1=libre)</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-white/50">{strength.toFixed(2)}</p>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "Génération…" : "Générer"}
          </button>
          <button type="button" onClick={onReset} disabled={loading} className="btn btn-ghost">
            Réinitialiser
          </button>
          {results.length > 0 && (
            <>
              <button type="button" onClick={downloadAll} className="btn border border-white/15 bg-white/5 hover:bg-white/10">
                Télécharger tout
              </button>
              <button type="button" onClick={() => setResults([])} className="btn border border-white/15 bg-white/5 hover:bg-white/10">
                Vider les résultats
              </button>
            </>
          )}
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}
      </form>

      {/* Résultats */}
      {results.length > 0 && (
        <section className="space-y-4">
          <h2 className="h2">Résultats</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((url, i) => (
              <article key={`${url}-${i}`} className="card p-3 space-y-3 overflow-hidden">
                <img src={url} alt={`variant-${i + 1}`} className="w-full h-auto rounded-lg object-cover" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Variante {i + 1}</span>
                  <button type="button" onClick={() => downloadOne(url, i)} className="btn btn-ghost px-3 py-1">
                    Télécharger
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}