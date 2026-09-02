// src/app/dashboard/videos/assets.ts
//
// Backend des « Assets » (effets visuels du module vidéo avancé). Le formulaire
// envoie un JSON `assetsConfig` ; chaque asset a son propre interrupteur et son
// propre curseur d'opacité, comme le watermark.
//
// Deux effets, deux techniques différentes — c'est volontaire :
//
//   · FLOCONS : une texture PNG de flocons, rasterisée UNE fois par job, qu'on
//     fait défiler verticalement pendant toute la vidéo. La texture fait deux
//     fois la hauteur de l'image et ses deux moitiés sont IDENTIQUES : la
//     boucle est donc invisible quand le défilement repart de zéro.
//
//   · FLASHS : aucun fichier. Une impulsion de luminosité pilotée par le temps
//     (`eq` évalué à chaque image) suffit, et ça ne coûte quasiment rien —
//     là où un calque blanc plein cadre aurait ajouté une couche à composer.
//
// Comme le watermark, tout asset activé impose un ré-encodage vidéo complet :
// on ne peut pas incruster quoi que ce soit sur un flux recopié tel quel.

import fs from "node:fs/promises";
import path from "node:path";
import type { VideoOverlay } from "@/app/dashboard/videos/overlays";

/* ── Flocons : la texture ──────────────────────────────────────────────────
 * Rasterisée à la MOITIÉ de la résolution vidéo puis agrandie à l'incrustation :
 * quatre fois moins de pixels à générer, et le léger flou de l'agrandissement
 * arrondit les flocons au lieu de les abîmer.
 * Les deux moitiés sont identiques (translation de `half`), sinon le retour de
 * boucle du défilement se verrait comme un saut. */
function snowSvg(w: number, half: number, count: number): string {
  const flakes: string[] = [];
  for (let i = 0; i < count; i++) {
    const cx = +(Math.random() * w).toFixed(1);
    const cy = +(Math.random() * half).toFixed(1);
    // Tailles mélangées : les gros flocons lisent comme un premier plan.
    const r = +(1 + Math.pow(Math.random(), 2.2) * 3.4).toFixed(2);
    const o = +(0.35 + Math.random() * 0.65).toFixed(2);
    flakes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" fill-opacity="${o}"/>`);
    flakes.push(`<circle cx="${cx}" cy="${(cy + half).toFixed(1)}" r="${r}" fill="#fff" fill-opacity="${o}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${half * 2}" viewBox="0 0 ${w} ${half * 2}">${flakes.join("")}</svg>`;
}

/* Marge horizontale de la texture, en px de la vidéo finale : le calque oscille
 * doucement de gauche à droite, il doit rester plus large que l'image. */
const SWAY_MARGIN = 20;

export type PreparedAssets = {
  /** Textures de flocons prêtes (plusieurs implantations → variété par copie). */
  snowTextures: string[];
  /** Opacité des flocons, 1–100. 0 = asset désactivé. */
  snowOpacity: number;
  /** Intensité des flashs, 1–100. 0 = asset désactivé. */
  flashOpacity: number;
  /** Dimensions de la texture, telle qu'elle a été rasterisée. */
  texW: number;
  texHalf: number;
  /** À nettoyer en fin de job. */
  tempFiles: string[];
};

/**
 * Parse `assetsConfig` et prépare les textures (une fois par job).
 * `width`/`height` = dimensions de la PREMIÈRE vidéo valide : la texture est
 * ensuite redimensionnée par FFmpeg pour chaque copie, donc une source d'un
 * autre format ne casse rien.
 * Retourne null si aucun asset n'est activé ou si la config est invalide.
 */
export async function prepareAssets(
  formData: FormData,
  dir: string,
  width: number,
  height: number,
): Promise<PreparedAssets | null> {
  const raw = formData.get("assetsConfig");
  if (typeof raw !== "string") return null;
  let cfg: any;
  try { cfg = JSON.parse(raw); } catch { return null; }

  const snowOn = !!cfg?.snow?.enabled;
  const flashOn = !!cfg?.flash?.enabled;
  if (!snowOn && !flashOn) return null;

  const snowOpacity = snowOn ? clampNum(cfg.snow.opacity, 1, 100, 45) : 0;
  const flashOpacity = flashOn ? clampNum(cfg.flash.opacity, 1, 100, 35) : 0;

  const tempFiles: string[] = [];
  const snowTextures: string[] = [];
  // Repli sur une base 1080×1920 quand la sonde n'a rien donné : la texture est
  // de toute façon redimensionnée à l'incrustation.
  const w = width > 0 ? width : 1080;
  const h = height > 0 ? height : 1920;
  const texW = Math.max(64, Math.round(w / 2) + SWAY_MARGIN);
  const texHalf = Math.max(64, Math.round(h / 2));

  if (snowOn) {
    const sharp = (await import("sharp")).default;
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Densité calée sur la surface : une vidéo verticale et une vidéo carrée
    // doivent avoir la même impression de chute, pas le même nombre de flocons.
    const count = Math.min(220, Math.max(30, Math.round((texW * texHalf) / 6000)));
    // Trois implantations : chaque copie en tire une au sort, ce qui suffit à ce
    // que deux copies n'aient pas la même neige — sans rasteriser à chaque copie.
    for (let i = 0; i < 3; i++) {
      try {
        const png = await sharp(Buffer.from(snowSvg(texW, texHalf, count))).png({ compressionLevel: 6 }).toBuffer();
        const p = path.join(dir, `__asset_snow${i}_${stamp}.png`);
        await fs.writeFile(p, png);
        snowTextures.push(p);
        tempFiles.push(p);
      } catch (e) {
        console.warn(`[assets] texture flocons #${i} échouée:`, (e as Error)?.message);
      }
    }
  }

  // Flocons demandés mais aucune texture produite → l'asset tombe, les flashs
  // (qui ne dépendent d'aucun fichier) restent.
  if (snowTextures.length === 0 && flashOpacity === 0) return null;

  return {
    snowTextures,
    snowOpacity: snowTextures.length ? snowOpacity : 0,
    flashOpacity,
    texW,
    texHalf,
    tempFiles,
  };
}

/**
 * Par copie : l'incrustation des flocons (texture + défilement), ou null si
 * l'asset est éteint. Vitesse, oscillation, phase et implantation sont tirées
 * au sort à chaque copie — deux copies n'ont donc jamais la même chute.
 */
export function resolveSnowOverlay(prep: PreparedAssets, width: number, height: number): VideoOverlay | null {
  if (prep.snowOpacity <= 0 || prep.snowTextures.length === 0) return null;

  const moviePath = prep.snowTextures[Math.floor(Math.random() * prep.snowTextures.length)];
  const w = width > 0 ? width : 1080;
  const h = height > 0 ? height : 1920;

  // Vitesse de chute exprimée en hauteurs d'image par seconde : un flocon
  // traverse l'écran en 4,5 à 8 s quelle que soit la définition.
  const fall = (0.125 + Math.random() * 0.095).toFixed(4);
  const sway = (0.35 + Math.random() * 0.4).toFixed(2);   // oscillation, rad/s
  const phase = (Math.random() * 6.28).toFixed(2);
  const amp = (7 + Math.random() * 8).toFixed(1);          // amplitude, px

  return {
    moviePath,
    // La texture couvre deux hauteurs d'image, plus la marge d'oscillation.
    scaleW: w + SWAY_MARGIN * 2,
    scaleH: h * 2,
    opacity: Math.min(1, Math.max(0.01, prep.snowOpacity / 100)),
    x: `-${SWAY_MARGIN}+${amp}*sin(${sway}*t+${phase})`,
    // y va de -H à 0 puis repart : les deux moitiés étant identiques, le saut
    // ne se voit pas. `H` = hauteur de l'image, `h` = hauteur du calque (2H).
    y: `mod(${fall}*H*t,H)-H`,
  };
}

/**
 * Par copie : le filtre vidéo des flashs, ou null si l'asset est éteint.
 * Une impulsion qui retombe (rampe linéaire) sur la luminosité ET le contraste,
 * répétée toute la vidéo — période, durée et phase tirées au sort à chaque copie.
 */
export function resolveFlashFilter(prep: PreparedAssets): string | null {
  if (prep.flashOpacity <= 0) return null;

  const amp = Math.min(0.6, 0.08 + (prep.flashOpacity / 100) * 0.55);
  const period = (1.8 + Math.random() * 1.6).toFixed(2);   // un flash toutes les 1,8–3,4 s
  const decay = (0.1 + Math.random() * 0.12).toFixed(3);   // il retombe en 0,10–0,22 s
  const phase = (Math.random() * Number(period)).toFixed(2);
  // Rampe : 1 au moment du flash, 0 une fois `decay` écoulé, jamais négative.
  const pulse = `max(0,1-mod(t+${phase},${period})/${decay})`;

  return `eq=brightness='${amp.toFixed(3)}*${pulse}':contrast='1+${(amp * 0.4).toFixed(3)}*${pulse}':eval=frame`;
}

function clampNum(v: unknown, lo: number, hi: number, def: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, n));
}
