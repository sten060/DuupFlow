"use client";

import { useState } from "react";
import { compareFiles } from "./actions";

const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"];
// Larger thumbnails → more detail → better precision for subtle filters
const THUMB_SIZE = 192;
const VIDEO_FRAME_COUNT = 5; // frames extracted at 10%, 25%, 50%, 75%, 90%

function extOf(name: string) {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
}
function isVideoFile(file: File) {
  return file.type.startsWith("video/") || VIDEO_EXTS.includes(extOf(file.name));
}
function scoreColor(v: number): string {
  if (v >= 75) return "text-red-300";
  if (v >= 45) return "text-yellow-300";
  return "text-emerald-300";
}
function scoreBgBorder(v: number): string {
  if (v >= 75) return "border-red-500/30 bg-red-500/10";
  if (v >= 45) return "border-yellow-500/30 bg-yellow-500/10";
  return "border-emerald-500/30 bg-emerald-500/15";
}
function scoreLabel(v: number): string {
  if (v >= 75) return "Très similaires — risque de détection";
  if (v >= 45) return "Similarité modérée";
  return "Très différents — bien protégé ✓";
}

// Draw a video frame at `t` seconds onto a canvas and return base64 JPEG
function seekAndCapture(video: HTMLVideoElement, t: number, size = THUMB_SIZE): Promise<string> {
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

// Extract a single THUMB_SIZE×THUMB_SIZE thumbnail from an image file
async function extractImageFrame(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = THUMB_SIZE;
      canvas.height = THUMB_SIZE;
      canvas.getContext("2d")!.drawImage(img, 0, 0, THUMB_SIZE, THUMB_SIZE);
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

// Read first 128KB of a file as base64 (enough for EXIF/ICC headers)
async function fileHeader(file: File): Promise<string> {
  const slice = await file.slice(0, 131072).arrayBuffer();
  const bytes = new Uint8Array(slice);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type Breakdown = {
  ssim: number;
  mse: number;
  spatial: number;
  chroma: number;
  color: number;
  luma: number;
  colorMom: number;
  phash: number;
  dhash: number;
  edgeOr: number;
  gradient: number;
  proj: number;
  texture: number;
  ahash: number;
  metadata: number;
  filename: number;
  mirrored: boolean;
};

type Result = {
  score: number;
  breakdown: Breakdown;
};

function MetricBar({
  label,
  value,
  hint,
  weight,
}: {
  label: string;
  value: number;
  hint: string;
  weight: string;
}) {
  const color = value >= 75 ? "bg-red-400" : value >= 45 ? "bg-yellow-400" : "bg-emerald-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/70 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-white/35 text-[10px]">{weight}</span>
          <span className={`font-bold ${value >= 75 ? "text-red-300" : value >= 45 ? "text-yellow-300" : "text-emerald-300"}`}>
            {value}%
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-[10px] text-white/30">{hint}</p>
    </div>
  );
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
  const [result, setResult] = useState<Result | undefined>(
    initialScore !== undefined ? { score: initialScore, breakdown: { ssim: 0, mse: 0, spatial: 0, chroma: 0, color: 0, luma: 0, colorMom: 0, phash: 0, dhash: 0, edgeOr: 0, gradient: 0, proj: 0, texture: 0, ahash: 0, metadata: 0, mirrored: false } } : undefined
  );
  const [error, setError] = useState<string | null>(initialErr ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileA || !fileB || processing) return;

    setProcessing(true);
    setError(null);
    setResult(undefined);

    try {
      const [framesA, framesB, rawA, rawB] = await Promise.all([
        getFrames(fileA), getFrames(fileB),
        fileHeader(fileA), fileHeader(fileB),
      ]);
      // fileA.size / fileB.size = taille réelle — essentiel pour les vidéos car
      // rawA/rawB ne contiennent que 128KB, ce qui biaise le ratio de taille à 1.0.
      // fileA.name / fileB.name = pour la pénalité de nom de fichier différent.
      const data = await compareFiles(framesA, framesB, rawA, rawB, fileA.size, fileB.size, fileA.name, fileB.name);

      if ("error" in data) setError(data.error);
      else setResult(data);
    } catch (err: any) {
      setError(err?.message || "Erreur comparaison");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-white/15 bg-white/5 p-4">
          <label className="block text-sm font-medium mb-2 text-white/85">Fichier A (original)</label>
          <input
            type="file"
            accept="image/*,video/*"
            required
            disabled={processing}
            onChange={(e) => { setFileA(e.target.files?.[0] ?? null); setResult(undefined); }}
            className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90 disabled:opacity-50"
          />
          {fileA && <p className="mt-1 text-xs text-white/45 truncate">{fileA.name} — {(fileA.size / 1024 / 1024).toFixed(2)} Mo</p>}
        </div>

        <div className="rounded-xl border border-white/15 bg-white/5 p-4">
          <label className="block text-sm font-medium mb-2 text-white/85">Fichier B (copie dupliquée)</label>
          <input
            type="file"
            accept="image/*,video/*"
            required
            disabled={processing}
            onChange={(e) => { setFileB(e.target.files?.[0] ?? null); setResult(undefined); }}
            className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90 disabled:opacity-50"
          />
          {fileB && <p className="mt-1 text-xs text-white/45 truncate">{fileB.name} — {(fileB.size / 1024 / 1024).toFixed(2)} Mo</p>}
        </div>

        <div className="sm:col-span-2 space-y-4">
          {/* Main score */}
          {result && (
            <div className={`rounded-xl border px-5 py-4 ${scoreBgBorder(result.score)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white/80">Score de similarité</span>
                <span className={`font-extrabold text-3xl ${scoreColor(result.score)}`}>{result.score}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 mb-2">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${
                    result.score >= 75 ? "bg-red-400" : result.score >= 45 ? "bg-yellow-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${result.score}%` }}
                />
              </div>
              <p className="text-xs text-white/55">{scoreLabel(result.score)}</p>
              {result.breakdown.mirrored && (
                <p className="mt-2 text-xs font-medium text-sky-300">
                  🔁 Miroir horizontal détecté — filtre Reverse appliqué sur le fichier B
                </p>
              )}
            </div>
          )}

          {/* Breakdown */}
          {result && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Détail des métriques</p>
              <MetricBar label="SSIM" value={result.breakdown.ssim} weight="×13%" hint="Structural Similarity Index — standard industrie YouTube/Netflix — mesure luminance × contraste × structure" />
              <MetricBar label="Pixels (MSE)" value={result.breakdown.mse} weight="×11%" hint="Erreur quadratique pixel par pixel (96×96) — détecte tout changement de valeur, CRF, décalage spatial" />
              <MetricBar label="Chroma Cb/Cr" value={result.breakdown.chroma} weight="×10%" hint="Canaux Cb et Cr (BT.601) — très sensible au bruit chroma, teinte, saturation, colorchannelmixer" />
              <MetricBar label="Gradients (magnitude)" value={result.breakdown.gradient} weight="×10%" hint="Distribution des magnitudes de gradient — grain, bruit, unsharp, tout changement de netteté" />
              <MetricBar label="Profils projection" value={result.breakdown.proj} weight="×9%" hint="Sommes lignes + colonnes — très sensible au décalage spatial, zoom offset, vignette" />
              <MetricBar label="Grille spatiale" value={result.breakdown.spatial} weight="×9%" hint="Moyenne luminance par cellule 8×8 — détecte zoom, recadrage, vignette, décalage de position" />
              <MetricBar label="Couleurs RGB" value={result.breakdown.color} weight="×8%" hint="Histogramme RGB 32 bins/canal — sensible à la saturation, luminosité, filtres visuels" />
              <MetricBar label="Moments couleurs" value={result.breakdown.colorMom} weight="×8%" hint="Moyenne/écart-type/asymétrie par canal RGB — statistiques d'ordre supérieur : teinte, saturation, EQ" />
              <MetricBar label="Luminance (histogramme)" value={result.breakdown.luma} weight="×7%" hint="Histogramme luminance 64 bins (128×128) — sensible à luminosité ±3%, contraste, gamma" />
              <MetricBar label="Métadonnées" value={Math.round((result.breakdown.metadata * 0.72 + result.breakdown.filename * 0.28))} weight="×18%" hint="Format, taille fichier, richesse EXIF, profil ICC, densité DPI, chroma, progressif, nom de fichier — signature technique du fichier" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {processing && (
            <div className="space-y-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.6)] animate-pulse w-full" />
              </div>
              <p className="text-xs text-white/40 text-center">Analyse en cours — 9 algorithmes + métadonnées…</p>
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
    </div>
  );
}
