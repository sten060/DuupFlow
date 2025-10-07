"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateAction } from "./actions";

type Status = "idle" | "submitting" | "error";

export default function GenerateFormClient() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [n, setN] = useState(4);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]); // <— NEW
  const formRef = useRef<HTMLFormElement>(null);
  const dropRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    if (!file) return void setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const stop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const enter = (e: DragEvent) => { stop(e); el.classList.add("ring-2","ring-fuchsia-400/60"); };
    const leave = (e: DragEvent) => { stop(e); el.classList.remove("ring-2","ring-fuchsia-400/60"); };
    const over  = (e: DragEvent) => stop(e);
    const drop  = (e: DragEvent) => {
      stop(e);
      el.classList.remove("ring-2","ring-fuchsia-400/60");
      const f = e.dataTransfer?.files?.[0];
      if (f && f.type.startsWith("image/")) setFile(f);
    };
    el.addEventListener("dragenter", enter);
    el.addEventListener("dragleave", leave);
    el.addEventListener("dragover", over);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragenter", enter);
      el.removeEventListener("dragleave", leave);
      el.removeEventListener("dragover", over);
      el.removeEventListener("drop", drop);
    };
  }, []);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type.startsWith("image/")) setFile(f);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    setResults([]);

    try {
      const fd = new FormData(formRef.current!);
      if (file) fd.set("image", file);
      fd.set("n", String(n));
      const res = await generateAction(fd);

      if (!res.ok) {
        setStatus("error");
        setError(res.error);
        return;
      }

      setResults(res.urls);
      setStatus("idle");
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Une erreur est survenue.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="h1">Générer des variantes</h1>
        <span className="muted text-xs">Décor, tenue & accessoires — identité préservée</span>
      </header>

      <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Colonne gauche : upload */}
        <div className="lg:col-span-5">
          <div className="glass border-gradient relative overflow-hidden">
            <label ref={dropRef} className="group block cursor-pointer p-4">
              <input type="file" accept="image/*" className="hidden" onChange={onPick} />
              <div className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-white/5 ring-inset transition">
                {preview ? (
                  <img src={preview} alt="aperçu" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/60">
                    <div className="rounded-full bg-white/5 px-3 py-1 text-xs">Glisser-déposer</div>
                    <div className="text-sm">ou <span className="text-white/90 underline">sélectionner une image</span></div>
                    <div className="text-xs">JPG/PNG, 10 Mo max</div>
                  </div>
                )}
              </div>
            </label>

            <div className="flex items-center justify-between p-4">
              <div className="text-sm text-white/70">Nombre d’images</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setN((v) => Math.max(1, v - 1))} className="btn bg-white/10">−</button>
                <input
                  name="n"
                  value={n}
                  onChange={(e) => setN(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                  min={1}
                  max={8}
                  type="number"
                  className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center"
                />
                <button type="button" onClick={() => setN((v) => Math.min(8, v + 1))} className="btn bg-white/10">+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne droite : prompt */}
        <div className="lg:col-span-7">
          <div className="glass space-y-5 p-5">
            <Field label="Décor / Lieu / Ambiance" name="decor" placeholder="Ex. loft minimaliste, lumière douce, plantes, tons chauds" />
            <Field label="Tenue / Style vestimentaire" name="tenue" placeholder="Ex. robe noire satin, talons, silhouette élégante" />
            <Field label="Accessoires / Props" name="accessoires" placeholder="Ex. sac à main, lunettes de soleil, boucles d’oreilles or" />
            <Field label="Style global / Éclairage" name="style" placeholder="Ex. photographie éditoriale, 50mm, bokeh léger, peau naturelle" />

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-white/60">Astuce : sois descriptif mais concis. L’identité du modèle est automatiquement conservée.</p>
              <button type="submit" disabled={status === "submitting"} className="btn btn-primary px-5 py-2">
                {status === "submitting" ? "Génération…" : "Générer"}
              </button>
            </div>

            {status === "error" && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Résultats */}
      {results.length > 0 && (
        <div className="glass p-4">
          <div className="mb-2 text-sm text-white/70">Résultats du lot</div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {results.map((u, i) => (
              <a key={u + i} href={u} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <img src={u} alt={`result-${i}`} className="h-56 w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Aide rapide */}
      <div className="glass p-4">
        <ul className="grid gap-2 text-sm text-white/70 md:grid-cols-3">
          <li>• Identité préservée (visage, peau, morphologie)</li>
          <li>• Tu modifies décor, tenue, accessoires & style</li>
          <li>• 1 à 8 rendus par lot</li>
        </ul>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wide text-white/60">{label}</span>
      <textarea
        name={name}
        rows={2}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/35 focus:border-fuchsia-400/40"
      />
    </label>
  );
}