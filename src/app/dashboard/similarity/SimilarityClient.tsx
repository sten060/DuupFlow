"use client";

import { useRef, useState, DragEvent } from "react";
import { probeFile } from "./probeActions";

type ProbeResult = Record<string, any> | null;

export default function SimilarityClient() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [probe1, setProbe1] = useState<ProbeResult>(null);
  const [probe2, setProbe2] = useState<ProbeResult>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function makeDrop(setter: (f: File | null) => void, probeSetter: (p: ProbeResult) => void) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const droppedFile = e.dataTransfer.files?.[0] ?? null;
      setter(droppedFile);
      probeSetter(null);
    };
  }

  async function handleCompare() {
    if (!file1 || !file2) return;
    setLoading(true);
    setError(null);
    setProbe1(null);
    setProbe2(null);

    try {
      // Upload files sequentially (not in parallel) to avoid ECONNRESET
      // on large files. Send full files — MOV moov atom can be at the end.
      const fd1 = new FormData();
      fd1.append("file", file1);
      fd1.append("realSize", String(file1.size));
      const r1 = await probeFile(fd1);

      const fd2 = new FormData();
      fd2.append("file", file2);
      fd2.append("realSize", String(file2.size));
      const r2 = await probeFile(fd2);

      if ("error" in r1) { setError(`Fichier 1 : ${r1.error}`); return; }
      if ("error" in r2) { setError(`Fichier 2 : ${r2.error}`); return; }

      setProbe1(r1);
      setProbe2(r2);
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  // Get all unique keys from both tag objects
  const tags1 = probe1?.format?.tags ?? {};
  const tags2 = probe2?.format?.tags ?? {};
  const allTagKeys = [...new Set([...Object.keys(tags1), ...Object.keys(tags2)])];

  // Format-level fields to compare
  const formatFields = ["format_name", "duration", "size", "bit_rate", "format_long_name", "nb_streams", "start_time", "probe_score"];

  // Stream helpers
  const streams1 = probe1?.streams as Record<string, any>[] | undefined;
  const streams2 = probe2?.streams as Record<string, any>[] | undefined;
  const videoStream1 = streams1?.find((s) => s.codec_type === "video");
  const videoStream2 = streams2?.find((s) => s.codec_type === "video");
  const audioStream1 = streams1?.find((s) => s.codec_type === "audio");
  const audioStream2 = streams2?.find((s) => s.codec_type === "audio");

  const videoFields = ["codec_name", "width", "height", "pix_fmt", "bit_rate", "avg_frame_rate", "duration"];
  const audioFields = ["codec_name", "sample_rate", "channels", "bit_rate"];

  // Similarity score computation
  function computeSimilarity() {
    if (!probe1 || !probe2) return null;

    let total = 0;
    let matches = 0;

    // Format fields
    for (const key of formatFields) {
      const v1 = String(probe1.format?.[key] ?? "");
      const v2 = String(probe2.format?.[key] ?? "");
      if (v1 || v2) {
        total++;
        if (v1 === v2) matches++;
      }
    }

    // Tags
    for (const key of allTagKeys) {
      const v1 = tags1[key] ?? "";
      const v2 = tags2[key] ?? "";
      total++;
      if (v1 === v2) matches++;
    }

    // Video stream fields
    if (videoStream1 || videoStream2) {
      for (const key of videoFields) {
        const v1 = String(videoStream1?.[key] ?? "");
        const v2 = String(videoStream2?.[key] ?? "");
        if (v1 || v2) {
          total++;
          if (v1 === v2) matches++;
        }
      }
    }

    // Audio stream fields
    if (audioStream1 || audioStream2) {
      for (const key of audioFields) {
        const v1 = String(audioStream1?.[key] ?? "");
        const v2 = String(audioStream2?.[key] ?? "");
        if (v1 || v2) {
          total++;
          if (v1 === v2) matches++;
        }
      }
    }

    if (total === 0) return null;
    const score = Math.round((matches / total) * 100);
    return { score, matches, total };
  }

  const similarity = probe1 && probe2 ? computeSimilarity() : null;

  function similarityColor(score: number) {
    if (score >= 75) return "text-red-400";
    if (score >= 45) return "text-yellow-400";
    return "text-emerald-400";
  }

  function similarityLabel(score: number) {
    if (score >= 75) return "Très similaires";
    if (score >= 45) return "Similarité modérée";
    return "Fichiers distincts";
  }

  function similarityBg(score: number) {
    if (score >= 75) return "border-red-500/20 bg-red-500/[0.06]";
    if (score >= 45) return "border-yellow-500/20 bg-yellow-500/[0.06]";
    return "border-emerald-500/20 bg-emerald-500/[0.06]";
  }

  return (
    <div className="space-y-6">
      {/* File inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Fichier 1</label>
          <div
            onClick={() => ref1.current?.click()}
            onDragOver={handleDragOver}
            onDrop={makeDrop(setFile1, setProbe1)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 cursor-pointer hover:border-emerald-400/30 transition text-sm text-white/60"
          >
            {file1 ? file1.name : "Cliquer ou glisser-déposer…"}
            <input ref={ref1} type="file" className="hidden" accept="video/*,image/*"
              onChange={(e) => { setFile1(e.target.files?.[0] ?? null); setProbe1(null); }} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Fichier 2</label>
          <div
            onClick={() => ref2.current?.click()}
            onDragOver={handleDragOver}
            onDrop={makeDrop(setFile2, setProbe2)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 cursor-pointer hover:border-emerald-400/30 transition text-sm text-white/60"
          >
            {file2 ? file2.name : "Cliquer ou glisser-déposer…"}
            <input ref={ref2} type="file" className="hidden" accept="video/*,image/*"
              onChange={(e) => { setFile2(e.target.files?.[0] ?? null); setProbe2(null); }} />
          </div>
        </div>
      </div>

      <button
        onClick={handleCompare}
        disabled={loading || !file1 || !file2}
        className={[
          "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
          loading || !file1 || !file2
            ? "bg-white/10 text-white/50 cursor-not-allowed"
            : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-[0_4px_20px_rgba(16,185,129,.35)]",
        ].join(" ")}
      >
        {loading ? "Analyse en cours…" : "Comparer les métadonnées"}
      </button>

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* Results side by side */}
      {probe1 && probe2 && (
        <div className="space-y-4">
          {/* Similarity score */}
          {similarity && (
            <div className={`rounded-xl border px-4 py-3 ${similarityBg(similarity.score)}`}>
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${similarityColor(similarity.score)}`}>
                  {similarity.score}%
                </span>
                <div>
                  <span className={`text-sm font-semibold ${similarityColor(similarity.score)}`}>
                    {similarityLabel(similarity.score)}
                  </span>
                  <p className="text-xs text-white/50">
                    {similarity.matches} champs identiques sur {similarity.total}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Format info */}
          <div>
            <h3 className="text-sm font-semibold text-white/80 mb-2">Format</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left py-2 pr-4 text-white/50 font-medium">Champ</th>
                    <th className="text-left py-2 pr-4 text-white/50 font-medium">Fichier 1</th>
                    <th className="text-left py-2 text-white/50 font-medium">Fichier 2</th>
                  </tr>
                </thead>
                <tbody>
                  {formatFields.map((key) => {
                    const v1 = String(probe1.format?.[key] ?? "—");
                    const v2 = String(probe2.format?.[key] ?? "—");
                    const diff = v1 !== v2;
                    return (
                      <tr key={key} className="border-b border-white/[0.04]">
                        <td className="py-1.5 pr-4 font-mono text-white/60">{key}</td>
                        <td className={`py-1.5 pr-4 font-mono ${diff ? "text-emerald-300" : "text-white/80"}`}>{v1}</td>
                        <td className={`py-1.5 font-mono ${diff ? "text-emerald-300" : "text-white/80"}`}>{v2}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Tags comparison */}
          <div>
            <h3 className="text-sm font-semibold text-white/80 mb-2">Métadonnées (tags)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left py-2 pr-4 text-white/50 font-medium">Tag</th>
                    <th className="text-left py-2 pr-4 text-white/50 font-medium">Fichier 1</th>
                    <th className="text-left py-2 text-white/50 font-medium">Fichier 2</th>
                  </tr>
                </thead>
                <tbody>
                  {allTagKeys.sort().map((key) => {
                    const v1 = tags1[key] ?? "—";
                    const v2 = tags2[key] ?? "—";
                    const diff = v1 !== v2;
                    return (
                      <tr key={key} className="border-b border-white/[0.04]">
                        <td className="py-1.5 pr-4 font-mono text-white/60 whitespace-nowrap">{key}</td>
                        <td className={`py-1.5 pr-4 font-mono break-all ${diff ? "text-emerald-300" : "text-white/80"}`}>{v1}</td>
                        <td className={`py-1.5 font-mono break-all ${diff ? "text-emerald-300" : "text-white/80"}`}>{v2}</td>
                      </tr>
                    );
                  })}
                  {allTagKeys.length === 0 && (
                    <tr><td colSpan={3} className="py-3 text-white/40 text-center">Aucun tag trouvé</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Video stream comparison */}
          {(videoStream1 || videoStream2) && (
            <>
              <div className="h-px bg-white/[0.06]" />
              <div>
                <h3 className="text-sm font-semibold text-white/80 mb-2">Flux vidéo</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left py-2 pr-4 text-white/50 font-medium">Champ</th>
                        <th className="text-left py-2 pr-4 text-white/50 font-medium">Fichier 1</th>
                        <th className="text-left py-2 text-white/50 font-medium">Fichier 2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videoFields.map((key) => {
                        const v1 = String(videoStream1?.[key] ?? "—");
                        const v2 = String(videoStream2?.[key] ?? "—");
                        const diff = v1 !== v2;
                        return (
                          <tr key={key} className="border-b border-white/[0.04]">
                            <td className="py-1.5 pr-4 font-mono text-white/60">{key}</td>
                            <td className={`py-1.5 pr-4 font-mono ${diff ? "text-emerald-300" : "text-white/80"}`}>{v1}</td>
                            <td className={`py-1.5 font-mono ${diff ? "text-emerald-300" : "text-white/80"}`}>{v2}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Audio stream comparison */}
          {(audioStream1 || audioStream2) && (
            <>
              <div className="h-px bg-white/[0.06]" />
              <div>
                <h3 className="text-sm font-semibold text-white/80 mb-2">Flux audio</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left py-2 pr-4 text-white/50 font-medium">Champ</th>
                        <th className="text-left py-2 pr-4 text-white/50 font-medium">Fichier 1</th>
                        <th className="text-left py-2 text-white/50 font-medium">Fichier 2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audioFields.map((key) => {
                        const v1 = String(audioStream1?.[key] ?? "—");
                        const v2 = String(audioStream2?.[key] ?? "—");
                        const diff = v1 !== v2;
                        return (
                          <tr key={key} className="border-b border-white/[0.04]">
                            <td className="py-1.5 pr-4 font-mono text-white/60">{key}</td>
                            <td className={`py-1.5 pr-4 font-mono ${diff ? "text-emerald-300" : "text-white/80"}`}>{v1}</td>
                            <td className={`py-1.5 font-mono ${diff ? "text-emerald-300" : "text-white/80"}`}>{v2}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
