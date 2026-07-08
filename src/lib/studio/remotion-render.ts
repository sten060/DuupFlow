// Rendu Remotion LOCAL de la couche captions (remotion/CaptionedReel.tsx).
// ffmpeg produit la vidéo de BASE (recadrée/découpée/vitesse), Remotion rend
// par-dessus le hook + les révélations (emojis natifs, typo propre) → mp4 final.
//
// Dégradation douce : toute erreur (bundle, chrome headless, render) remonte
// null → l'appelant garde la voie ffmpeg/libass. Jamais bloquant.
//
// Le bundle webpack est construit UNE fois par process (puis réutilisé) ;
// le premier rendu télécharge aussi Chrome Headless Shell (~1 min, une fois).

import path from "path";
import type { RecipeLayout } from "./types";

export interface RemotionCaptionJob {
  videoUrl: string; // URL http de la vidéo de base (route /api/studio/media)
  durationSec: number; // durée de la base (après vitesse)
  hook: string;
  reveals: string[];
  revealAtSec: number[]; // secondes absolues (règle unique computeRevealTimes)
  captionMode: "stack" | "replace";
  layout: RecipeLayout | null;
  accentColor: string | null;
  uppercase: boolean;
  outputPath: string; // mp4 final
}

let _bundlePromise: Promise<string> | null = null;

async function getBundle(): Promise<string> {
  if (!_bundlePromise) {
    _bundlePromise = (async () => {
      const { bundle } = await import("@remotion/bundler");
      // NB : le dossier s'appelle remotion-comps (PAS "remotion") — avec
      // baseUrl=".", un dossier ./remotion masquerait le package npm remotion.
      const entry = path.join(process.cwd(), "remotion-comps", "index.ts");
      console.log("[studio] remotion : bundle en cours (1ʳᵉ fois)…");
      const serveUrl = await bundle({ entryPoint: entry, onProgress: () => {} });
      console.log("[studio] remotion : bundle prêt");
      return serveUrl;
    })().catch((e) => {
      _bundlePromise = null; // retente au prochain appel
      throw e;
    });
  }
  return _bundlePromise;
}

/**
 * Rend la vidéo finale (base + captions) via Remotion.
 * Retourne true si OK, false si échec (l'appelant retombe sur ffmpeg).
 */
export async function renderCaptionsWithRemotion(
  job: RemotionCaptionJob
): Promise<boolean> {
  try {
    const [{ renderMedia, selectComposition }, serveUrl] = await Promise.all([
      import("@remotion/renderer"),
      getBundle(),
    ]);

    const inputProps = {
      videoUrl: job.videoUrl,
      durationSec: job.durationSec,
      hook: job.hook,
      reveals: job.reveals,
      revealAtSec: job.revealAtSec,
      captionMode: job.captionMode,
      layout: job.layout,
      accentColor: job.accentColor,
      uppercase: job.uppercase,
    };

    const composition = await selectComposition({
      serveUrl,
      id: "CaptionedReel",
      inputProps,
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: job.outputPath,
      inputProps,
      // Qualité alignée sur la voie ffmpeg (crf 23), logs discrets.
      crf: 23,
      logLevel: "error",
      timeoutInMilliseconds: 8 * 60 * 1000,
    });

    return true;
  } catch (e) {
    console.error(
      "[studio] rendu Remotion échoué — fallback captions ffmpeg :",
      e instanceof Error ? e.message.slice(0, 300) : e
    );
    return false;
  }
}
