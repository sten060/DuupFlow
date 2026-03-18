"use client";

import { useState } from "react";
import { compareFiles } from "./actions";

const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"];
const VIDEO_FRAME_COUNT = 5; // frames extracted at 10%, 25%, 50%, 75%, 90%

function extOf(name: string) {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
}
function isVideoFile(file: File) {
  return file.type.startsWith("video/") || VIDEO_EXTS.includes(extOf(file.name));
}
function scoreColor(v: number): string {
  if (v >= 80) return "text-red-300";
  if (v >= 55) return "text-yellow-300";
  return "text-emerald-300";
}

// Draw a video frame at `t` seconds onto a canvas and return base64 JPEG
function seekAndCapture(video: HTMLVideoElement, t: number, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d")!.drawImage(video, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.88).split(",")[1]);
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", reject, { once: true });
    video.currentTime = t;
  });
}

// Extract N evenly-spaced frames from a video file (sequential seeks on one element)
async function extractVideoFrames(file: File, n: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.src = url;

    video.addEventListener("loadedmetadata", async () => {
      try {
        const dur = video.duration || 10;
        // timestamps spread at 10%…90% to avoid blank start/end
        const pts = Array.from({ length: n }, (_, i) =>
          dur * (0.1 + (0.8 * i) / Math.max(n - 1, 1))
        );
        const frames: string[] = [];
        for (const t of pts) {
          frames.push(await seekAndCapture(video, t));
        }
        URL.revokeObjectURL(url);
        resolve(frames);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    }, { once: true });

    video.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Lecture vidéo impossible"));
    }, { once: true });
  });
}

// Extract a single 128×128 thumbnail from an image file
async function extractImageFrame(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      canvas.getContext("2d")!.drawImage(img, 0, 0, 128, 128);
      URL.revokeObjectURL(url);
      resolve([canvas.toDataURL("image/jpeg", 0.88).split(",")[1]]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Chargement image impossible")); };
    img.src = url;
  });
}

async function getFrames(file: File): Promise<string[]> {
  return isVideoFile(file) ? extractVideoFrames(file, VIDEO_FRAME_COUNT) : extractImageFrame(file);
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
      // Extract frames client-side in parallel (files are already in browser memory)
      const [framesA, framesB] = await Promise.all([getFrames(fileA), getFrames(fileB)]);
      const result = await compareFiles(framesA, framesB);

      if ("error" in result) setError(result.error);
      else setScore(result.score);
    } catch (err: any) {
      setError(err?.message || "Erreur comparaison");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
        {fileA && <p className="mt-1 text-xs text-white/45 truncate">{fileA.name} — {(fileA.size / 1024 / 1024).toFixed(2)} Mo</p>}
      </div>

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
        {fileB && <p className="mt-1 text-xs text-white/45 truncate">{fileB.name} — {(fileB.size / 1024 / 1024).toFixed(2)} Mo</p>}
      </div>

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
