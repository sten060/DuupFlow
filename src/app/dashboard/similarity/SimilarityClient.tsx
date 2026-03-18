"use client";

import { useState } from "react";
import { compareFiles } from "./actions";

const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"];

function extOf(name: string) {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
}

function scoreColor(v: number): string {
  if (v >= 80) return "text-red-300";
  if (v >= 55) return "text-yellow-300";
  return "text-emerald-300";
}

// Extract a 64×64 thumbnail from a file entirely in the browser — no upload needed
async function getThumbnail(file: File): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  const isVideo = file.type.startsWith("video/") || VIDEO_EXTS.includes(extOf(file.name));

  if (isVideo) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "metadata";
      const url = URL.createObjectURL(file);
      video.src = url;

      video.addEventListener("seeked", () => {
        ctx.drawImage(video, 0, 0, 64, 64);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      }, { once: true });

      video.addEventListener("loadedmetadata", () => {
        video.currentTime = Math.min(1, (video.duration || 10) * 0.1);
      });

      video.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        reject(new Error("Lecture vidéo impossible dans le navigateur"));
      });
    });
  } else {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 64, 64);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Chargement image impossible"));
      };
      img.src = url;
    });
  }
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
  const [score, setScore] = useState<number | undefined>(initialScore);
  const [error, setError] = useState<string | null>(initialErr ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileA || !fileB || processing) return;

    setProcessing(true);
    setError(null);
    setScore(undefined);

    try {
      // Extract thumbnails client-side (video already in browser memory — instant)
      const [thumbA, thumbB] = await Promise.all([getThumbnail(fileA), getThumbnail(fileB)]);

      // Send ~4KB of thumbnail data to server — no large upload
      const result = await compareFiles(thumbA, thumbB);

      if ("error" in result) {
        setError(result.error);
      } else {
        setScore(result.score);
      }
    } catch (err: any) {
      setError(err?.message || "Erreur comparaison");
    } finally {
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
          onChange={(e) => { setFileA(e.target.files?.[0] ?? null); setScore(undefined); }}
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
          onChange={(e) => { setFileB(e.target.files?.[0] ?? null); setScore(undefined); }}
          className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90 disabled:opacity-50"
        />
        {fileB && (
          <p className="mt-1 text-xs text-white/45 truncate">{fileB.name} — {(fileB.size / 1024 / 1024).toFixed(2)} Mo</p>
        )}
      </div>

      {/* Résultat + actions */}
      <div className="sm:col-span-2 space-y-3">
        {typeof score === "number" && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-4 py-3">
            <span className="text-sm font-semibold text-emerald-300">Similarité : </span>
            <span className={`font-bold text-2xl ${scoreColor(score)}`}>{score}%</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {processing && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.6)] animate-pulse w-full" />
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
