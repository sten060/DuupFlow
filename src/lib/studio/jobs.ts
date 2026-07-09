// Registre de jobs de génération EN MÉMOIRE (local uniquement).
// Le client poll GET /api/studio/generate/[jobId] et voit les reels arriver
// au fur et à mesure que ffmpeg les termine.
// TODO: brancher — persister les jobs (DB) + queue de workers pour la prod.

import path from "path";
import fs from "fs/promises";
import { ACTION_HOOKS, TALKING_HOOKS } from "@/lib/mock-data";
import { analyzeVideo } from "./analysis";
import { OUTPUTS_DIR, UPLOADS_DIR, ensureStudioDirs } from "./local-store";
import {
  formatDuration,
  generateVariant,
  probeVideo,
  type VideoProbe,
} from "./pipeline";
import { computeRevealTimes } from "./captions";
import { planClipsWithLLM } from "./llm";
import { renderCaptionsWithRemotion } from "./remotion-render";
import { buildEditPlan, pickSegments } from "./segments";
import {
  pickHookFromTranscript,
  transcribeVideo,
  type Transcript,
} from "./transcribe";
import type {
  StudioJobSnapshot,
  StudioReel,
  UploadedVideo,
  ViralRecipe,
} from "./types";

interface StudioJob extends StudioJobSnapshot {
  startedAt: number;
}

// globalThis → le registre survit au HMR du serveur de dev Next
// (sinon chaque recompilation de route repartirait d'une Map vide).
const jobs: Map<string, StudioJob> = ((globalThis as any).__duupStudioJobs ??=
  new Map());

export function getJobSnapshot(jobId: string): StudioJobSnapshot | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const { startedAt: _ignored, ...snapshot } = job;
  return snapshot;
}

interface PlannedVariant {
  video: UploadedVideo;
  hook: string;
  variantNumber: number; // 1-based, global au job
  variantIndexInVideo: number; // 0-based, pour attribuer son extrait
}

// Lance la génération (non awaité par la route) : encode SÉQUENTIEL —
// 1 seul ffmpeg à la fois, volontaire pour ne pas saturer la machine
// (cf. incident OOM ffmpeg du duplicateur).
export function startGenerationJob(
  videos: UploadedVideo[],
  variantsPerVideo: number,
  recipes: ViralRecipe[] = [],
  origin: string | null = null
): StudioJobSnapshot {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Plan : hooks piochés cycliquement par format, comme la maquette.
  // TODO: brancher la génération de hooks par IA (références analysées).
  const plan: PlannedVariant[] = [];
  let talkingIdx = 0;
  let actionIdx = 0;
  for (const video of videos) {
    for (let i = 0; i < variantsPerVideo; i++) {
      const hooks = video.format === "Talking" ? TALKING_HOOKS : ACTION_HOOKS;
      const idx = video.format === "Talking" ? talkingIdx++ : actionIdx++;
      plan.push({
        video,
        hook: hooks[idx % hooks.length],
        variantNumber: plan.length + 1,
        variantIndexInVideo: i,
      });
    }
  }

  const job: StudioJob = {
    jobId,
    total: plan.length,
    done: false,
    failed: 0,
    reels: [],
    startedAt: Date.now(),
  };
  jobs.set(jobId, job);

  void runJob(job, plan, recipes, origin);

  // Purge des vieux jobs terminés (> 1 h) pour ne pas fuir en mémoire.
  for (const [id, j] of jobs) {
    if (j.done && Date.now() - j.startedAt > 60 * 60 * 1000) jobs.delete(id);
  }

  const { startedAt: _ignored, ...snapshot } = job;
  return snapshot;
}

async function runJob(
  job: StudioJob,
  plan: PlannedVariant[],
  recipes: ViralRecipe[],
  origin: string | null
): Promise<void> {
  try {
    await ensureStudioDirs();

    // ── Référence PRINCIPALE (Phase 3) : UNE seule ref pilote le rendu
    // (layout, rythme, couleurs) ET la copy — plus de recipes[0] silencieux
    // désaligné du prompt. Priorité : première ref avec mesures de layout.
    // Les autres refs restent une inspiration secondaire pour la copy
    // (réordonnées : principale en premier).
    const primary =
      recipes.find((r) => r.layout) ?? (recipes.length > 0 ? recipes[0] : null);
    const orderedRecipes = primary
      ? [primary, ...recipes.filter((r) => r !== primary)]
      : [];
    if (recipes.length > 1) {
      console.log(
        `[studio] multi-refs : "${primary?.hookStyle.slice(0, 40)}…" pilote le rendu (${recipes.length} refs)`
      );
    }

    // Probe + analyse (énergie audio, silences, cuts) + transcription
    // whisper (vidéos parlées) + planification LLM (extraits/hooks/captions),
    // UNE fois par vidéo. Chaque variante pioche ensuite son extrait.
    const perVideo = new Map<
      string,
      { probe: VideoProbe; clips: PreparedClip[]; transcript: Transcript | null }
    >();

    for (const item of plan) {
      const inputPath = path.join(UPLOADS_DIR, item.video.id);
      const outputName = `out_${job.jobId.slice(4)}_${item.variantNumber}.mp4`;
      const outputPath = path.join(OUTPUTS_DIR, outputName);

      try {
        let prepared = perVideo.get(item.video.id);
        if (!prepared) {
          const probe = await probeVideo(inputPath);
          const analysis = await analyzeVideo(inputPath, probe.hasAudio);
          const variantsForThisVideo = plan.filter(
            (p) => p.video.id === item.video.id
          ).length;

          // Transcription : SEULEMENT les vidéos détectées parlées (Talking).
          // Les vidéos musique/muettes n'en ont pas besoin — voie cuts de scène.
          let transcript: Transcript | null = null;
          if (item.video.format === "Talking" && probe.hasAudio) {
            const t0 = Date.now();
            transcript = await transcribeVideo(inputPath);
            console.log(
              `[studio] ${item.video.name} → transcription : ${
                transcript
                  ? `${transcript.phrases.length} phrases / ${transcript.words.length} mots`
                  : "indisponible"
              } (${Math.round((Date.now() - t0) / 1000)}s)`
            );
          }

          // Hooks du pool pour cette vidéo (fallback quand le LLM n'écrit pas).
          const poolHooks = plan
            .filter((p) => p.video.id === item.video.id)
            .map((p) => p.hook);

          const clips = await buildClips({
            transcript,
            probe,
            analysis,
            format: item.video.format,
            count: variantsForThisVideo,
            seed: hashString(job.jobId + item.video.id),
            poolHooks,
            // Réordonnées : la ref PRINCIPALE en premier → la copy et le
            // rendu s'alignent sur la MÊME ref.
            recipes: orderedRecipes,
          });

          prepared = { probe, clips, transcript };
          perVideo.set(item.video.id, prepared);
          console.log(
            `[studio] ${item.video.name} → extraits :`,
            clips
              .map((c) => (c.isFull ? "entière" : `${c.startSec}s+${c.durationSec}s`))
              .join(", ")
          );
        }

        const clip = prepared.clips[item.variantIndexInVideo];

        const baseParams = {
          inputPath,
          outputPath,
          hook: clip.hook,
          hasAudio: prepared.probe.hasAudio,
          srcBitrateKbps: prepared.probe.bitrateKbps,
          seed: item.variantNumber * 7919, // premier → seeds bien répartis
          segment: clip.isFull
            ? undefined
            : { startSec: clip.startSec, durationSec: clip.durationSec },
          // Sous-titres animés brûlés (vidéos parlées) — calés au mot près.
          captionWords: prepared.transcript?.words,
          // Révélations séquentielles (mode poster OFM) + durée source pour le timing.
          captionReveals: clip.reveals,
          sourceDurationSec: prepared.probe.durationSec,
          // Style + MESURES du montage repris de la 1ʳᵉ référence s'il y en a
          // (couleur, MAJ, nb de reveals, timings, positions, taille).
          captionStyle: primary
            ? {
                accentColor: primary.accentColor,
                uppercase: primary.uppercase,
                layout: primary.layout,
              }
            : undefined,
        };

        // ── Voie REMOTION (mode poster : vidéo sans captions mot-à-mot) ──────
        // ffmpeg produit une base SANS texte, Remotion rend les captions
        // par-dessus (emojis natifs, typo propre). Échec → fallback ffmpeg.
        const wantRemotion =
          process.env.STUDIO_RENDERER !== "ffmpeg" &&
          !!origin &&
          !prepared.transcript?.words?.length;

        let rendered = false;
        if (wantRemotion) {
          const baseName = outputName.replace(/\.mp4$/, "_base.mp4");
          const basePath = path.join(OUTPUTS_DIR, baseName);
          try {
            await generateVariant({ ...baseParams, outputPath: basePath, omitText: true });
            const baseProbe = await probeVideo(basePath);
            const layout = primary?.layout ?? null;

            // ── Montage au rythme de la ref (Phase 2) : jump cuts qui
            // reproduisent le pattern de plans de la ref. La durée de sortie
            // devient la somme des segments.
            const rhythm = primary?.rhythm ?? null;
            let segments = null;
            let outDur = baseProbe.durationSec;
            if (rhythm && rhythm.cutTimestampsSec.length > 0) {
              segments = buildEditPlan(
                rhythm,
                layout?.refDurationSec ?? baseProbe.durationSec,
                baseProbe.durationSec
              );
              if (segments) {
                outDur = segments.reduce((a, s) => a + s.durationSec, 0);
                console.log(
                  `[studio] montage rythme ref : ${segments.length} plans (` +
                    segments.map((s) => `${s.durationSec}s`).join(", ") +
                    `) — sortie ${outDur.toFixed(1)}s`
                );
              }
            }

            // Timings en secondes ABSOLUES via la règle unique (proportionnel
            // si durées proches, rythme de la ref conservé si user ≫ ref) —
            // calculés sur la durée de SORTIE (après montage).
            const revealAtSec = layout
              ? computeRevealTimes(layout, outDur)
              : clip.reveals.map(
                  (_, i) =>
                    (0.15 + (0.65 * i) / Math.max(1, clip.reveals.length - 1)) *
                    outDur
                );
            rendered = await renderCaptionsWithRemotion({
              videoUrl: `${origin}/api/studio/media/${baseName}`,
              durationSec: outDur,
              hook: clip.hook,
              reveals: clip.reveals,
              segments,
              revealAtSec,
              captionMode: layout?.mode ?? "stack",
              layout,
              accentColor: primary?.accentColor ?? null,
              uppercase: primary?.uppercase ?? false,
              outputPath,
            });
          } finally {
            await fs.unlink(basePath).catch(() => {});
          }
        }

        // Voie ffmpeg (vidéos parlées, Remotion désactivé, ou échec Remotion).
        if (!rendered) {
          await generateVariant(baseParams);
        }

        // Durée / poids RÉELS de la sortie.
        const [outProbe, stat] = await Promise.all([
          probeVideo(outputPath),
          fs.stat(outputPath),
        ]);

        const reel: StudioReel = {
          id: outputName,
          variantLabel: `Variante ${item.variantNumber}`,
          hook: clip.hook,
          format: item.video.format,
          duration: formatDuration(outProbe.durationSec),
          source: item.video.name,
          fileName: `variante_${item.variantNumber}.mp4`,
          sizeMo: Math.max(1, Math.round(stat.size / 1_000_000)),
          url: `/api/studio/media/${outputName}`,
          segment: clip.isFull
            ? "vidéo entière"
            : `${formatDuration(clip.startSec)} → ${formatDuration(clip.startSec + clip.durationSec)}`,
          caption: clip.caption,
        };
        job.reels.push(reel);
      } catch (e) {
        job.failed += 1;
        console.error(
          `[studio] variante ${item.variantNumber} échouée :`,
          e instanceof Error ? e.message : e
        );
      }
    }
  } catch (e) {
    job.error = e instanceof Error ? e.message : String(e);
    console.error("[studio] job en échec :", job.error);
  } finally {
    job.done = true;
  }
}

// Extrait résolu pour une variante — même forme quelle que soit la source
// de décision (LLM par le sens, découpe pur-code, ou vidéo entière).
interface PreparedClip {
  isFull: boolean; // true = vidéo entière (pas de découpe)
  startSec: number;
  durationSec: number;
  hook: string;
  reveals: string[]; // lignes révélées ensuite (format liste OFM)
  caption?: string; // seulement quand le LLM l'a écrite
}

// Décide des `count` extraits d'une vidéo. Priorité : le LLM (vidéos parlées
// avec transcription + clé API) choisit extraits/hooks/captions par le SENS.
// Sinon on retombe sur la découpe pur-code (énergie/cuts) + hooks du pool.
async function buildClips(opts: {
  transcript: Transcript | null;
  probe: VideoProbe;
  analysis: Awaited<ReturnType<typeof analyzeVideo>>;
  format: "Talking" | "Action";
  count: number;
  seed: number;
  poolHooks: string[];
  recipes: ViralRecipe[];
}): Promise<PreparedClip[]> {
  const { transcript, probe, analysis, format, count, seed, poolHooks, recipes } =
    opts;
  const phrases = transcript?.phrases ?? null;

  // ── Voie LLM — s'applique à TOUTES les vidéos (parlées ou visuelles) ───────
  // Avec transcription : découpe + hooks/captions ancrés sur ce qui est dit.
  // Sans transcription (cas OFM) : le LLM écrit N accroches incrustées "poster"
  // dans le style de la référence, sur la vidéo entière.
  {
    const llm = await planClipsWithLLM({
      transcript: phrases ?? undefined,
      durationSec: probe.durationSec,
      count,
      format,
      recipes: recipes.length > 0 ? recipes : undefined,
    });
    if (llm && llm.length > 0) {
      // On ne découpe QUE si on a une transcription ET une vidéo assez longue.
      const canCut = !!phrases && phrases.length > 0 && probe.durationSec > 34;
      console.log(
        `[studio] LLM a écrit ${llm.length} accroche(s) — ${canCut ? "avec découpe" : "vidéo entière (poster)"}`
      );
      return Array.from({ length: count }, (_, i) => {
        const c = llm[i % llm.length];
        return {
          isFull: !canCut,
          startSec: canCut ? c.startSec : 0,
          durationSec: canCut ? Math.max(1, c.endSec - c.startSec) : probe.durationSec,
          hook: c.hook,
          reveals: c.reveals ?? [],
          caption: c.caption || undefined,
        };
      });
    }
  }

  // ── Fallback pur-code (LLM indispo : découpe énergie/cuts + hooks pool) ────
  const segments = pickSegments({
    durationSec: probe.durationSec,
    analysis,
    hasAudio: probe.hasAudio,
    count,
    seed,
    transcript: phrases,
  });

  return segments.map((s, i) => {
    const hook =
      (phrases &&
        pickHookFromTranscript(
          phrases,
          s.reason === "full" ? 0 : s.startSec,
          s.reason === "full" ? probe.durationSec : s.durationSec
        )) ||
      poolHooks[i % poolHooks.length];
    return {
      isFull: s.reason === "full",
      startSec: s.startSec,
      durationSec: s.durationSec,
      hook,
      reveals: [],
    };
  });
}

// Petit hash stable (djb2) → seed de découpe propre à (job, vidéo).
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
