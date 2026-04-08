"use client";

import { useMemo, useState, useRef } from "react";
import { useTranslation } from "@/lib/i18n/context";

type Line = { id: string; text: string };

function GlowyTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-semibold mb-3 text-fuchsia-300 drop-shadow-[0_0_6px_rgba(217,70,239,0.7)]">
      {children}
    </div>
  );
}

function Section({
  title,
  lines,
  onChange,
  onAdd,
  onRemove,
  placeholder,
  noLinesText,
  addLabel,
}: {
  title: string;
  lines: Line[];
  onChange: (id: string, v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  placeholder: string;
  noLinesText: string;
  addLabel: string;
}) {
  return (
    <div className="rounded-xl bg-[#0f1220] border border-white/10 p-4">
      <GlowyTitle>{title}</GlowyTitle>
      <div className="space-y-2">
        {lines.length === 0 && (
          <div className="text-sm text-white/50">
            {noLinesText}
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className="flex gap-2">
            <input
              value={l.text}
              onChange={(e) => onChange(l.id, e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30"
            />
            <button
              onClick={() => onRemove(l.id)}
              className="px-3 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/15"
            >✕</button>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <button
          onClick={onAdd}
          className="px-3 py-2 text-sm rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500"
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [replaces, setReplaces] = useState<Line[]>([]);
  const [adds, setAdds] = useState<Line[]>([]);
  const [removes, setRemoves] = useState<Line[]>([]);

  const [variants, setVariants] = useState("1");
  const [quality, setQuality] = useState("90");
  const [seed, setSeed] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function addLine(setter: React.Dispatch<React.SetStateAction<Line[]>>) {
  setter((s) => [...s, { id: crypto.randomUUID(), text: "" }]);
}

function changeLine(
  setter: React.Dispatch<React.SetStateAction<Line[]>>,
  id: string,
  v: string
) {
  setter((s) => s.map((l) => (l.id === id ? { ...l, text: v } : l)));
}

function removeLine(
  setter: React.Dispatch<React.SetStateAction<Line[]>>,
  id: string
) {
  setter((s) => s.filter((l) => l.id !== id));
}

  const prompt = useMemo(() => {
    const parts: string[] = [];
    replaces.forEach((l) => l.text.trim() && parts.push(`Remplace ${l.text.trim()}.`));
    adds.forEach((l) => l.text.trim() && parts.push(`Ajoute ${l.text.trim()}.`));
    removes.forEach((l) => l.text.trim() && parts.push(`Supprime ${l.text.trim()}.`));
    return parts.join(" ");
  }, [replaces, adds, removes]);

  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [err, setErr] = useState<string>("");

  async function onGenerate() {
    setErr("");
    setResults([]);
    if (!file) return setErr(t("dashboard.generate.errorNoImage"));
    if (!prompt) return setErr(t("dashboard.generate.errorNoPrompt"));

    const fd = new FormData();
    fd.append("image", file);
    fd.append("prompt", prompt);
    fd.append("variants", variants || "1");
    fd.append("output_quality", quality || "90");
    if (seed.trim()) fd.append("seed", seed.trim());

   setBusy(true);
try {
  const res = await fetch("/api/generate", { method: "POST", body: fd });
  const j = await res.json();
  if (!res.ok || !j.ok) throw new Error(j?.error || "Erreur");

  // Les URLs sont maintenant déjà locales (sauvegardées sur le serveur)
  setResults(j.urls || []);
} catch (e: any) {
  setErr(e?.message || "Erreur réseau.");
} finally {
  setBusy(false);
}
  }

  // --- ZIP (toutes les variantes) ---
  async function downloadZip() {
    if (!results.length) return;

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      let idx = 1;
      for (const url of results) {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          console.error(`Échec du téléchargement de l'image ${idx}:`, res.statusText);
          continue;
        }

        const blob = await res.blob();
        const ext =
          blob.type?.includes("png") ? "png" :
          blob.type?.includes("webp") ? "webp" :
          blob.type?.includes("jpeg") || blob.type?.includes("jpg") ? "jpg" : "png";
        zip.file(`duupflow_generation_${idx}.${ext}`, blob);
        idx++;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "duupflow_generations.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (e: any) {
      console.error("Erreur lors de la création du ZIP:", e);
      setErr(e?.message || "Erreur lors du téléchargement du ZIP");
    }
  }

  // --- Téléchargement individuel ---
  async function downloadOne(url: string, idx: number) {
    try {
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        throw new Error(`Échec du téléchargement: ${res.statusText}`);
      }

      const blob = await res.blob();

      // Vérifier que le blob contient bien des données
      if (blob.size === 0) {
        throw new Error("L'image téléchargée est vide");
      }

      const ext =
        blob.type?.includes("png") ? "png" :
        blob.type?.includes("webp") ? "webp" :
        blob.type?.includes("jpeg") || blob.type?.includes("jpg") ? "jpg" : "png";

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `duupflow_generation_${idx}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    } catch (e: any) {
      console.error("Téléchargement individuel échoué:", e);
      setErr(e?.message || "Échec du téléchargement de l'image");
    }
  }

  // --- Helpers dropzone & steppers ---
  function setPicked(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  const vNum = Math.max(1, Math.min(4, Number(variants || 1)));
  const qNum = Math.max(60, Math.min(100, Number(quality || 90)));
  function incVariants() { setVariants(String(Math.min(4, vNum + 1))); }
  function decVariants() { setVariants(String(Math.max(1, vNum - 1))); }
  function incQuality() { setQuality(String(Math.min(100, qNum + 1))); }
  function decQuality() { setQuality(String(Math.max(60, qNum - 1))); }

  return (
    <div className="relative min-h-screen bg-[#0b0e1a] text-white overflow-hidden">

      {/* ── Coming Soon Overlay ── */}
      <div
        className="absolute inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(6,9,24,0.82)", backdropFilter: "blur(12px)" }}
      >
        <div
          className="text-center max-w-sm mx-4 rounded-2xl px-8 py-10"
          style={{
            background: "rgba(10,14,40,0.96)",
            border: "1px solid rgba(99,102,241,0.30)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.10)",
          }}
        >
          <div
            className="mx-auto mb-6 h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.30)" }}
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-3 tracking-tight">
            {t("dashboard.generate.comingSoonTitle")}
          </h2>
          <p className="text-sm text-white/50 leading-relaxed mb-5">
            {t("dashboard.generate.comingSoonDesc")}
          </p>
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
            style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", color: "#818CF8" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            {t("dashboard.generate.comingSoonBadge")}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-6">
        <h1 className="text-3xl font-semibold mb-6">{t("dashboard.generate.title")}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonne gauche */}
          <div className="space-y-6">
            {/* Dropzone friendly */}
            <div
              className={[
                "relative rounded-xl border border-white/10 p-4 bg-[#0f1220]",
                "transition-all",
                isDragOver
                  ? "shadow-[0_0_32px_rgba(99,102,241,0.35)] border-indigo-400/40"
                  : "hover:shadow-[0_0_24px_rgba(217,70,239,0.25)]",
              ].join(" ")}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setPicked(f);
              }}
              onClick={() => inputRef.current?.click()}
            >
              <div className="text-sm mb-2 opacity-80">{t("dashboard.generate.referenceImage")}</div>

              {!preview ? (
                <div className="flex flex-col items-center justify-center h-40 rounded-lg border border-dashed border-white/15 bg-white/5">
                  <div className="text-white/80">{t("dashboard.generate.dropImage")}</div>
                  <div className="text-xs text-white/50">
                    {t("dashboard.generate.dropImageSub")}
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Prévisualisation"
                    className="rounded-lg border border-white/10 max-h-64 object-contain w-full"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPicked(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    title={t("dashboard.generate.removeImage")}
                    className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/70 border border-white/20"
                  >
                    ✕
                  </button>
                  {file && (
                    <div className="mt-2 text-xs opacity-70">
                      {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  )}
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setPicked(f);
                }}
              />
            </div>

            {/* Sections */}
            <Section
              title={t("dashboard.generate.replace")}
              lines={replaces}
              onChange={(id, v) => changeLine(setReplaces, id, v)}
              onAdd={() => addLine(setReplaces)}
              onRemove={(id) => removeLine(setReplaces, id)}
              placeholder={t("dashboard.generate.replacePlaceholder")}
              noLinesText={t("dashboard.generate.noLines")}
              addLabel={t("dashboard.generate.addButton")}
            />
            <Section
              title={t("dashboard.generate.add")}
              lines={adds}
              onChange={(id, v) => changeLine(setAdds, id, v)}
              onAdd={() => addLine(setAdds)}
              onRemove={(id) => removeLine(setAdds, id)}
              placeholder={t("dashboard.generate.addPlaceholder")}
              noLinesText={t("dashboard.generate.noLines")}
              addLabel={t("dashboard.generate.addButton")}
            />
            <Section
              title={t("dashboard.generate.remove")}
              lines={removes}
              onChange={(id, v) => changeLine(setRemoves, id, v)}
              onAdd={() => addLine(setRemoves)}
              onRemove={(id) => removeLine(setRemoves, id)}
              placeholder={t("dashboard.generate.removePlaceholder")}
              noLinesText={t("dashboard.generate.noLines")}
              addLabel={t("dashboard.generate.addButton")}
            />
          </div>

          {/* Colonne droite */}
          <div className="space-y-6">
            {/* Options */}
            <div className="rounded-xl bg-[#0f1220] border border-white/10 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs opacity-70">{t("dashboard.generate.variants")}</label>
                  <div className="mt-1 flex items-stretch gap-2">
                    <input
                      value={variants}
                      onChange={(e) => setVariants(e.target.value)}
                      placeholder="1"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30"
                    />
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={incVariants}
                        className="px-2 h-6 rounded-md bg-white/10 hover:bg-white/15 leading-none"
                        title="Augmenter"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={decVariants}
                        className="px-2 h-6 mt-1 rounded-md bg-white/10 hover:bg-white/15 leading-none"
                        title="Diminuer"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs opacity-70">{t("dashboard.generate.quality")}</label>
                  <div className="mt-1 flex items-stretch gap-2">
                    <input
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                      placeholder="90"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30"
                    />
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={incQuality}
                        className="px-2 h-6 rounded-md bg-white/10 hover:bg-white/15 leading-none"
                        title="Augmenter"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={decQuality}
                        className="px-2 h-6 mt-1 rounded-md bg-white/10 hover:bg-white/15 leading-none"
                        title="Diminuer"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs opacity-70">{t("dashboard.generate.seed")}</label>
                  <input
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="ex: 12345"
                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={onGenerate}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 disabled:opacity-60"
                >
                  {busy ? t("dashboard.generate.generating") : t("dashboard.generate.generate")}
                </button>

                <button
                  onClick={() => {
                    setResults([]);
                    setErr("");
                    setReplaces([]); setAdds([]); setRemoves([]);
                    setSeed(""); setVariants("1"); setQuality("90");
                    setFile(null); setPreview(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15"
                >
                  {t("dashboard.generate.clear")}
                </button>

                <button
                  onClick={downloadZip}
                  disabled={!results.length}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50"
                  title={!results.length ? "Génère d’abord des images" : "Télécharger toutes les variantes"}
                >
                  {t("dashboard.generate.downloadAll")}
                </button>
              </div>

              {err && <div className="mt-3 text-sm text-amber-300">⚠️ {err}</div>}
            </div>

            {/* Résultats */}
            <div className="rounded-xl bg-[#0f1220] border border-white/10 p-4">
              <div className="text-sm mb-3 opacity-80">{t("dashboard.generate.results")}</div>
              {results.length === 0 ? (
                <div className="text-sm text-white/50">{t("dashboard.generate.noResults")}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.map((u, i) => (
                    <div
                      key={u + i}
                      className="overflow-hidden rounded-lg border border-white/10 hover:border-white/20 bg-white/5"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`variant-${i + 1}`} className="w-full h-auto" />
                      <div className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className="opacity-80">{t("dashboard.generate.variant")} {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => downloadOne(u, i + 1)}
                          className="px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                          title={t("dashboard.generate.downloadImage")}
                        >
                          {t("dashboard.generate.downloadImage")}
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
    </div>
  );
}