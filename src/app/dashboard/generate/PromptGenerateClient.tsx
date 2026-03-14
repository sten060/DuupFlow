"use client";

import * as React from "react";

// ---------- Types ----------
type ActionType = "remplace" | "ajoute" | "supprime";
type ActionItem = { id: string; kind: ActionType; text: string };

// ---------- Utilitaires UI ----------
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="h2 mb-3">{children}</h3>;
}
function NeonBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${colorClass}`}
    >
      {label}
    </span>
  );
}

// Couleurs pour les catégories
const KIND_STYLE: Record<ActionType, { label: string; border: string; pill: string }> = {
  remplace: {
    label: "REMPLACE",
    border: "hover:border-fuchsia-400/30",
    pill: "border-white/15 bg-white/5 text-fuchsia-300",
  },
  ajoute: {
    label: "AJOUTE",
    border: "hover:border-indigo-400/30",
    pill: "border-white/15 bg-white/5 text-indigo-300",
  },
  supprime: {
    label: "SUPPRIME",
    border: "hover:border-emerald-400/30",
    pill: "border-white/15 bg-white/5 text-emerald-300",
  },
};

// ---------- Construction de prompt ----------

function buildPrompt(actions: ActionItem[]): string {
  if (actions.length === 0) return "";

  const parts: string[] = [];

  const remplace = actions.filter(a => a.kind === "remplace" && a.text.trim());
  const ajoute   = actions.filter(a => a.kind === "ajoute"   && a.text.trim());
  const supprime = actions.filter(a => a.kind === "supprime" && a.text.trim());

  if (remplace.length) {
    const lines = remplace.map(a => `Remplace ${a.text.trim()}.`);
    // Important: cadrage et fidélité
    lines.push("Garde la même pose, le même angle et la même composition.");
    parts.push(lines.join(" "));
  }
  if (ajoute.length) {
    const lines = ajoute.map(a => `Ajoute ${a.text.trim()}.`);
    parts.push(lines.join(" "));
  }
  if (supprime.length) {
    const lines = supprime.map(a => `Supprime ${a.text.trim()}.`);
    parts.push(lines.join(" "));
  }

  return parts.join(" ");
}

// ---------- Composant ----------
export default function PromptGenerateClient() {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  // listes par catégorie
  const [remplace, setRemplace] = React.useState<ActionItem[]>([
    { id: crypto.randomUUID(), kind: "remplace", text: "" },
  ]);
  const [ajoute, setAjoute] = React.useState<ActionItem[]>([]);
  const [supprime, setSupprime] = React.useState<ActionItem[]>([]);

  // options
  const [variants, setVariants] = React.useState(2);
  const [outputQuality, setOutputQuality] = React.useState(92);
  const [seed, setSeed] = React.useState<string>("");

  // états
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // --- helpers upload
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setError(null);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }
  function resetAll() {
    setRemplace([{ id: crypto.randomUUID(), kind: "remplace", text: "" }]);
    setAjoute([]);
    setSupprime([]);
    setVariants(2);
    setOutputQuality(92);
    setSeed("");
    setResults([]);
    setError(null);
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // --- CRUD items
  function addItem(kind: ActionType) {
    const item: ActionItem = { id: crypto.randomUUID(), kind, text: "" };
    if (kind === "remplace") setRemplace(prev => [...prev, item]);
    if (kind === "ajoute") setAjoute(prev => [...prev, item]);
    if (kind === "supprime") setSupprime(prev => [...prev, item]);
  }
  function removeItem(kind: ActionType, id: string) {
    if (kind === "remplace") setRemplace(prev => prev.filter(x => x.id !== id));
    if (kind === "ajoute") setAjoute(prev => prev.filter(x => x.id !== id));
    if (kind === "supprime") setSupprime(prev => prev.filter(x => x.id !== id));
  }
  function updateItem(kind: ActionType, id: string, text: string) {
    const map = (arr: ActionItem[]) => arr.map(x => (x.id === id ? { ...x, text } : x));
    if (kind === "remplace") setRemplace(prev => map(prev));
    if (kind === "ajoute") setAjoute(prev => map(prev));
    if (kind === "supprime") setSupprime(prev => map(prev));
  }

  // --- génération
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Ajoute une image de référence.");
    const prompt = buildPrompt([...remplace, ...ajoute, ...supprime]);
    if (!prompt.trim()) return setError("Complète au moins une ligne.");

    setLoading(true);
    setError(null);
    setResults([]);

    const fd = new FormData();
    fd.set("image", file);
    fd.set("prompt", prompt);
    fd.set("variants", String(variants));
    fd.set("output_quality", String(outputQuality));
    if (seed.trim()) fd.set("seed", seed.trim());

    try {
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Erreur de génération.");
      } else {
        setResults(Array.isArray(data.urls) ? data.urls : []);
      }
    } catch (err: any) {
      setError(err?.message || "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadOne(url: string, i: number) {
    const r = await fetch(url);
    const b = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `duupflow-variant-${i + 1}.webp`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---------- UI ----------
  function ActionList({
    kind,
    items,
    onAdd,
    onRemove,
    onChange,
  }: {
    kind: ActionType;
    items: ActionItem[];
    onAdd: () => void;
    onRemove: (id: string) => void;
    onChange: (id: string, v: string) => void;
  }) {
    const style = KIND_STYLE[kind];
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <NeonBadge label={style.label} colorClass={style.pill} />
          <button
            type="button"
            onClick={onAdd}
            className="btn border border-white/15 bg-white/5 hover:bg-white/10"
            title="Ajouter une ligne"
          >
            + Ajouter
          </button>
        </div>

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div
              key={it.id}
              className={`rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition ${style.border}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 min-w-[78px]">
                  {style.label}
                </span>
                <input
                  value={it.text}
                  onChange={(e) => onChange(it.id, e.target.value)}
                  placeholder={
                    kind === "remplace"
                      ? "ex: le décor actuel par une salle de sport moderne"
                      : kind === "ajoute"
                      ? "ex: un oreiller bleu à sa droite"
                      : "ex: le sac posé au sol"
                  }
                  className="flex-1 bg-transparent outline-none placeholder-white/40"
                />
                <button
                  type="button"
                  onClick={() => onRemove(it.id)}
                  className="text-white/50 hover:text-white text-sm"
                  title="Supprimer la ligne"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-white/50">
              Aucune ligne pour l’instant — clique sur “Ajouter”.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* 1) Upload + aperçu */}
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <SectionTitle>Image de référence</SectionTitle>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            className="file-input"
          />
          {preview && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <img
                src={preview}
                alt="preview"
                className="w-full h-auto rounded-lg object-contain"
              />
            </div>
          )}
        </div>

        {/* 2) Options simples */}
        <div className="space-y-4">
          <SectionTitle>Options</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span className="label">Variantes</span>
              <input
                type="number"
                min={1}
                max={4}
                value={variants}
                onChange={(e) => setVariants(Number(e.target.value))}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label">Qualité (60–100)</span>
              <input
                type="number"
                min={60}
                max={100}
                value={outputQuality}
                onChange={(e) => setOutputQuality(Number(e.target.value))}
                className="input"
              />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="label">Seed (optionnel)</span>
            <input
              type="text"
              placeholder="ex: 12345"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="input"
            />
          </label>

          {/* Aperçu du prompt auto (lecture seule) */}
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-white/50 mb-1">Prompt généré (aperçu) :</p>
            <p className="text-sm text-white/80">
              {buildPrompt([...remplace, ...ajoute, ...supprime]) || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* 3) Blocs d’actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <ActionList
          kind="remplace"
          items={remplace}
          onAdd={() => addItem("remplace")}
          onRemove={(id) => removeItem("remplace", id)}
          onChange={(id, v) => updateItem("remplace", id, v)}
        />
        <ActionList
          kind="ajoute"
          items={ajoute}
          onAdd={() => addItem("ajoute")}
          onRemove={(id) => removeItem("ajoute", id)}
          onChange={(id, v) => updateItem("ajoute", id, v)}
        />
        <ActionList
          kind="supprime"
          items={supprime}
          onAdd={() => addItem("supprime")}
          onRemove={(id) => removeItem("supprime", id)}
          onChange={(id, v) => updateItem("supprime", id, v)}
        />
      </div>

      {/* 4) Actions */}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Génération…" : "Générer"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={resetAll} disabled={loading}>
          Vider
        </button>
      </div>

      {/* 5) Résultats */}
      {results.length > 0 && (
        <section className="space-y-3">
          <h3 className="h2">Résultats</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((url, i) => (
              <article key={i} className="card p-3 space-y-3 overflow-hidden">
                <img src={url} alt={`variant-${i + 1}`} className="w-full h-auto rounded-lg object-cover" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Variante {i + 1}</span>
                  <button type="button" className="btn btn-ghost px-3 py-1" onClick={() => downloadOne(url, i)}>
                    Télécharger
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </form>
  );
}