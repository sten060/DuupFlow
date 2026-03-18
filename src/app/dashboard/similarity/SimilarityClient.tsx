"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compareSimilarityByPaths } from "./actions";

function scoreColor(v: number): string {
  if (v >= 80) return "text-red-300";
  if (v >= 55) return "text-yellow-300";
  return "text-emerald-300";
}

export default function SimilarityClient({
  initialScore,
  initialErr,
}: {
  initialScore?: number;
  initialErr?: string;
}) {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState<string | null>(initialErr ?? null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileA || !fileB || processing) return;

    setProcessing(true);
    setError(null);
    setProgress(0);
    setProgressMsg("Préparation…");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      const userId = user?.id ?? "anon";

      // Upload both files to Supabase in parallel — avoids sending large videos through Next.js
      let doneUploads = 0;
      const uploadFile = async (file: File): Promise<string> => {
        const signRes = await fetch("/api/storage/sign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, userId }),
          signal: ctrl.signal,
        });
        if (!signRes.ok) {
          const j = await signRes.json().catch(() => ({}));
          throw new Error(`[SIM-004] Upload échoué : ${j?.error ?? signRes.status}`);
        }
        const { token, path: storagePath } = await signRes.json();

        const { error: uploadError } = await supabase.storage
          .from("video-uploads")
          .uploadToSignedUrl(storagePath, token, file);
        if (uploadError) throw new Error(`[SIM-004] Upload stockage : ${uploadError.message}`);

        doneUploads++;
        setProgress(Math.round((doneUploads / 2) * 60));
        setProgressMsg(`Envoi ${doneUploads}/2 fichier(s)…`);
        return storagePath;
      };

      const [pathA, pathB] = await Promise.all([uploadFile(fileA), uploadFile(fileB)]);

      setProgress(65);
      setProgressMsg("Analyse en cours…");

      // Server action: downloads from Supabase + runs comparison + redirects
      await compareSimilarityByPaths(pathA, fileA.name, fileA.type, pathB, fileB.name, fileB.type);

    } catch (err: any) {
      if (err?.name === "AbortError") return; // user cancelled
      // If Next.js redirect throws, let it propagate (it navigates the user)
      if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
      setError(err?.message || "[SIM-003] Erreur comparaison");
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {/* Fichier A */}
      <div className="rounded-xl border border-white/15 bg-white/5 p-4">
        <label className="block text-sm font-medium mb-2 text-white/85">Fichier A</label>
        <input
          type="file"
          accept="image/*,video/*"
          required
          disabled={processing}
          onChange={(e) => setFileA(e.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90 disabled:opacity-50"
        />
        {fileA && (
          <p className="mt-1 text-xs text-white/45 truncate">{fileA.name} — {(fileA.size / 1024 / 1024).toFixed(2)} Mo</p>
        )}
      </div>

      {/* Fichier B */}
      <div className="rounded-xl border border-white/15 bg-white/5 p-4">
        <label className="block text-sm font-medium mb-2 text-white/85">Fichier B</label>
        <input
          type="file"
          accept="image/*,video/*"
          required
          disabled={processing}
          onChange={(e) => setFileB(e.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90 disabled:opacity-50"
        />
        {fileB && (
          <p className="mt-1 text-xs text-white/45 truncate">{fileB.name} — {(fileB.size / 1024 / 1024).toFixed(2)} Mo</p>
        )}
      </div>

      {/* Actions + résultat */}
      <div className="sm:col-span-2 space-y-3">
        {/* Score (rafraîchi depuis URL params après redirect) */}
        {typeof initialScore === "number" && !processing && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm">
            <span className="font-semibold text-emerald-300">Similarité : </span>
            <span className={`font-bold text-2xl ${scoreColor(initialScore)}`}>{initialScore}%</span>
          </div>
        )}

        {/* Erreur */}
        {error && !processing && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Progress */}
        {processing && (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.6)] transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs text-white/55">{progressMsg || "Analyse…"}</p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={processing || !fileA || !fileB}
            className={[
              "rounded-lg px-4 py-2 font-medium text-white transition",
              processing || !fileA || !fileB
                ? "cursor-not-allowed bg-emerald-700/60"
                : "bg-emerald-600 hover:bg-emerald-500",
            ].join(" ")}
          >
            {processing ? "Analyse…" : "Comparer"}
          </button>
        </div>
      </div>
    </form>
  );
}
