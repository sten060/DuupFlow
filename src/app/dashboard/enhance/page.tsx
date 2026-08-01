"use client";
import { useState } from "react";
import { enhanceAction } from "./actions";

export default function EnhancePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [restore, setRestore] = useState(0.7);
  const [smooth, setSmooth] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = (e: any) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const onSubmit = async (e: any) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("image", file);
    fd.set("restore", String(restore));
    fd.set("smooth", String(smooth));
    const res = await enhanceAction(fd);
    setLoading(false);

    if (res.ok) setOutput(res.url ?? null);
    else setError(res.error);
  };

  return (
    <main className="p-6 space-y-6">
      <h1 className="h1">Amélioration IA de l’image</h1>
      <p className="muted">Rend ta photo plus propre, plus nette et plus lisse sans rien changer d’autre.</p>

      <form onSubmit={onSubmit} className="space-y-6">
        <input type="file" accept="image/*" onChange={onFile} />
        {preview && <img src={preview} alt="preview" className="rounded-xl w-64" />}

        <div className="glass p-4 space-y-4">
          <div>
            <label className="block text-sm text-[var(--app-text-muted)] mb-1">Qualité (fidélité visage)</label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.01"
              value={restore}
              onChange={(e) => setRestore(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--app-text-muted)] mb-1">Lissage peau</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={smooth}
              onChange={(e) => setSmooth(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary px-5 py-2" disabled={loading}>
          {loading ? "Amélioration en cours..." : "Améliorer l’image"}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>

      {output && (
        <div className="glass p-4">
          <h2 className="text-[var(--app-text)] mb-2">Résultat</h2>
          <img src={output} alt="enhanced" className="rounded-xl w-full max-w-md" />
        </div>
      )}
    </main>
  );
}