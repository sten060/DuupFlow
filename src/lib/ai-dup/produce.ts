// src/lib/ai-dup/produce.ts
//
// ── FABRICATION D'UNE COPIE ──────────────────────────────────────────────────
//   Variations : plan → moteur de l'Éditeur IA (recadrage, vitesse, couleur,
//                textes) → fichier intermédiaire → SPOOFER.
//   Invisible  : original → SPOOFER directement.
// Le spoofer est le duplicateur de la page Duplication (processVideos), avec
// les packs de SPOOFER_PACKS : métadonnées iPhone neuves, réencodage haute
// qualité plafonné au débit de la source, pixel magique. Il tire ses réglages
// au hasard à chaque passage → deux copies n'ont jamais la même identité.
//
// La copie finale atterrit dans le dossier du créateur (même endroit que les
// duplications classiques) : elle apparaît aussi dans sa bibliothèque.

import fs from "fs/promises";
import path from "path";
import { renderVariant } from "@/lib/ai-editor/render";
import { projectPaths, removeVariant } from "@/lib/ai-editor/store";
import { creatorOutDir } from "@/lib/creator-out-dir";
import { probeInfo } from "@/lib/ffmpeg-probe";
import { SPOOFER_PACKS, SPOOFER_IPHONE_META } from "./config";
import { copyToEditPlan } from "./to-edit-plan";
import type { AiDupAnalysis, CopyPlan } from "./types";

/** Part du débit TOTAL de l'originale (image + son) laissée à l'image de la
 *  copie : le spoofer réencode le son à un débit tiré au hasard (jusqu'à
 *  256 kbps) et applique déjà sa propre marge de 10 % à l'image. */
const ORIGINAL_BITRATE_SHARE = 0.8;

export type ProducedCopy = { fileName: string; sizeBytes: number; deviceLabel?: string };

/** Lit l'appareil annoncé dans les métadonnées du fichier final (pour le résumé). */
async function readDeviceLabel(file: string): Promise<string | undefined> {
  try {
    const { getFFmpegBin } = await import("@/app/dashboard/videos/processVideos");
    const { stderr } = await probeInfo(file, await getFFmpegBin(), "ai-dup");
    const m = stderr.match(/com\.apple\.quicktime\.model\s*:\s*(.+)/i) ?? stderr.match(/^\s*model\s*:\s*(.+)$/im);
    return m?.[1]?.trim() || undefined;
  } catch { return undefined; }
}

/** Passe un fichier dans le spoofer et renvoie le chemin de la copie finale.
 *  `maxBitrateKbps` : plafond de débit imposé (0 = celui du fichier reçu). */
export async function spoofFile(
  srcPath: string, srcName: string, storeKey: string, maxShortEdge: number, signal?: AbortSignal, maxBitrateKbps = 0,
): Promise<string> {
  const fd = new FormData();
  fd.append("channel", "simple");
  fd.append("mode", "simple");
  fd.append("count", "1");
  fd.append("maxShortEdge", String(Number.isFinite(maxShortEdge) ? maxShortEdge : 0));
  if (maxBitrateKbps > 0) fd.append("maxBitrateKbps", String(Math.round(maxBitrateKbps)));
  if (SPOOFER_IPHONE_META) fd.append("iphoneMeta", "1");
  fd.append("packs", SPOOFER_PACKS.join(","));
  fd.append("singles", "{}");
  const outDir = creatorOutDir(storeKey);
  await fs.mkdir(outDir, { recursive: true });
  const { processVideos } = await import("@/app/dashboard/videos/processVideos");
  const out = await processVideos(fd, undefined, outDir, [{ name: srcName, tmpPath: srcPath }], undefined, signal);
  const file = out.outputPaths[0];
  if (!file) throw new Error(out.rejectedFiles.join(" ; ") || "Le spoofer n'a produit aucune copie.");
  return file;
}

export async function produceCopy(input: {
  storeKey: string;
  projectId: string;
  materialId: string;
  materialName: string;
  /** Chemin absolu de l'original (store.materialAbsPath). */
  materialPath: string;
  analysis: AiDupAnalysis;
  copy: CopyPlan;
  /** Plafond de résolution du plan du user (plans.ts), Infinity = aucun. */
  maxShortEdge: number;
  onStage?: (stage: "rendering" | "spoofing") => void;
  signal?: AbortSignal;
}): Promise<ProducedCopy> {
  const { storeKey, projectId, copy } = input;
  let src = input.materialPath;
  let variantId: string | null = null;

  if (copy.visual || copy.texts.length) {
    input.onStage?.("rendering");
    const plan = copyToEditPlan(copy, input.materialId, input.materialName, input.analysis);
    const r = await renderVariant(storeKey, projectId, plan, { signal: input.signal });
    if ("error" in r) throw new Error(`rendu : ${r.error}`);
    variantId = r.variant.id;
    src = path.join(projectPaths(storeKey, projectId).variantsDir, r.variant.storedName);
  }

  try {
    input.onStage?.("spoofing");
    const ext = path.extname(input.materialName) || ".mp4";
    // Rendu intermédiaire (Variations) : il sort en 1080p, peu compressé. La
    // copie finale doit retrouver la résolution et le débit de l'ORIGINALE —
    // jamais plus lourde qu'elle (règle du duplicateur).
    let maxShortEdge = input.maxShortEdge, maxKbps = 0;
    if (variantId) {
      const a = input.analysis;
      const srcShort = Math.min(a.width, a.height);
      if (srcShort > 0) maxShortEdge = Math.min(Number.isFinite(maxShortEdge) && maxShortEdge > 0 ? maxShortEdge : Infinity, srcShort);
      const size = (await fs.stat(input.materialPath).catch(() => null))?.size ?? 0;
      if (size > 0 && a.durationSec > 0) maxKbps = ((size * 8) / a.durationSec / 1000) * ORIGINAL_BITRATE_SHARE;
    }
    const out = await spoofFile(src, `copie-${copy.index + 1}${variantId ? ".mp4" : ext}`, storeKey, maxShortEdge, input.signal, maxKbps);
    const [stat, deviceLabel] = await Promise.all([fs.stat(out), readDeviceLabel(out)]);
    return { fileName: path.basename(out), sizeBytes: stat.size, deviceLabel };
  } finally {
    // Le rendu intermédiaire n'est qu'une étape : on ne le laisse pas traîner
    // dans les variantes du projet.
    if (variantId) await removeVariant(storeKey, projectId, variantId).catch(() => {});
  }
}
