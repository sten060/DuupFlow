// src/app/dashboard/videos/watermark.ts
//
// Backend du "Watermark visible" (module vidéo avancé). Le formulaire envoie un
// JSON `watermarkConfig` + un fichier optionnel `watermarkLogo`. Ici on :
//   1. rasterise la forme choisie (ou toutes les formes si aléatoire) en PNG via
//      sharp, ou on normalise le logo uploadé en PNG ;
//   2. expose `resolveWatermarkOverlay()` qui, PAR COPIE, choisit la forme +
//      position (aléatoires si demandé) et renvoie les paramètres d'overlay FFmpeg.
//
// L'incrustation elle-même est empilée avec les autres couches par
// buildOverlayFilterComplex() (cf. overlays.ts), appelé depuis runFFmpegSafe().

import fs from "node:fs/promises";
import path from "node:path";
import type { VideoOverlay } from "@/app/dashboard/videos/overlays";

/* ── Formes SVG (miroir de ShapeGlyph côté client) ────────────────────────── */
function shapeSvg(shape: string, color: string, size = 512): string {
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">`;
  const body = (() => {
    switch (shape) {
      case "circle":  return `<circle cx="12" cy="12" r="9" fill="${color}"/>`;
      case "square":  return `<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" fill="${color}"/>`;
      case "diamond": return `<path d="M12 2 L22 12 L12 22 L2 12 Z" fill="${color}"/>`;
      case "triangle":return `<path d="M12 3 L21.5 20 L2.5 20 Z" fill="${color}"/>`;
      case "star":    return `<path d="M12 2.4l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9 6.4 19.9l1.3-6.3L2.9 9l6.4-.7z" fill="${color}"/>`;
      case "heart":   return `<path d="M12 21s-7.5-4.6-9.7-9.1C.9 8.6 2.6 5.5 5.6 5.5c1.9 0 3.3 1.1 4.4 2.6C11.1 6.6 12.5 5.5 14.4 5.5c3 0 4.7 3.1 3.3 6.4C19.5 16.4 12 21 12 21z" fill="${color}"/>`;
      case "hexagon": return `<path d="M12 2 L20.6 7 V17 L12 22 L3.4 17 V7 Z" fill="${color}"/>`;
      case "snowflake":
      default:
        return `<g fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round">
          <line x1="12" y1="2" x2="12" y2="22"/><line x1="3.3" y1="7" x2="20.7" y2="17"/><line x1="20.7" y1="7" x2="3.3" y2="17"/>
          <path d="M12 5 l-2.1 2M12 5 l2.1 2M12 19 l-2.1 -2M12 19 l2.1 -2M4.5 8 l.6 2.8M4.5 8 l2.8 .6M19.5 16 l-.6 -2.8M19.5 16 l-2.8 -.6M19.5 8 l-2.8 .6M19.5 8 l-.6 2.8M4.5 16 l2.8 -.6M4.5 16 l.6 -2.8"/>
        </g>`;
    }
  })();
  return `${open}${body}</svg>`;
}

const SHAPE_KEYS = ["snowflake", "circle", "square", "diamond", "triangle", "star", "heart", "hexagon"];

/* ── Positions fixes — expressions overlay (vars FFmpeg W/H/w/h) ───────────── */
const MX = "(W*0.04)"; // marge horizontale ≈ 4% largeur
const MY = "(H*0.04)"; // marge verticale
const POSITIONS: Record<string, [string, string]> = {
  tl: [MX, MY],
  tc: ["(W-w)/2", MY],
  tr: [`W-w-${MX}`, MY],
  ml: [MX, "(H-h)/2"],
  mc: ["(W-w)/2", "(H-h)/2"],
  mr: [`W-w-${MX}`, "(H-h)/2"],
  bl: [MX, `H-h-${MY}`],
  bc: ["(W-w)/2", `H-h-${MY}`],
  br: [`W-w-${MX}`, `H-h-${MY}`],
};
const POS_KEYS = Object.keys(POSITIONS);

export type PreparedWatermark = {
  source: "shape" | "logo";
  shapeKey: string;
  randomShape: boolean;
  shapePaths: Record<string, string>; // clé forme → PNG rasterisé
  logoPath: string | null;
  opacity: number;      // 5–100
  size: number;         // taille en % de la largeur vidéo (4–40)
  position: string;     // clé grille 3×3
  randomPosition: boolean;
  motion: boolean;
  speed: number;        // 1–100
  simpleRandom: boolean; // mode simple : tout aléatoire par copie (formes blanches teintées)
  tempFiles: string[];  // à nettoyer en fin de job
};

/** Le watermark n'est qu'une incrustation parmi d'autres — cf. overlays.ts. */
export type WatermarkOverlay = VideoOverlay;

/**
 * Parse `watermarkConfig` + `watermarkLogo` et prépare les assets (une fois par job).
 * Retourne null si le watermark est désactivé ou la config invalide.
 */
export async function prepareWatermark(
  formData: FormData,
  dir: string,
): Promise<PreparedWatermark | null> {
  const raw = formData.get("watermarkConfig");
  if (typeof raw !== "string") return null;
  let cfg: any;
  try { cfg = JSON.parse(raw); } catch { return null; }
  if (!cfg?.enabled) return null;

  const sharp = (await import("sharp")).default;
  const tempFiles: string[] = [];
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const source: "shape" | "logo" = cfg.source === "logo" && cfg.hasLogo ? "logo" : "shape";
  const color = typeof cfg.color === "string" ? cfg.color : "#ffffff";
  const randomShape = !!cfg.randomShape;

  let logoPath: string | null = null;
  const shapePaths: Record<string, string> = {};

  if (source === "logo") {
    const logo = formData.get("watermarkLogo");
    if (logo && typeof logo === "object" && "arrayBuffer" in logo) {
      try {
        const buf = Buffer.from(await (logo as Blob).arrayBuffer());
        // Normalise en PNG (garde la transparence), borné à 512px de large.
        const png = await sharp(buf).resize({ width: 512, withoutEnlargement: true }).png().toBuffer();
        logoPath = path.join(dir, `__wm_logo_${stamp}.png`);
        await fs.writeFile(logoPath, png);
        tempFiles.push(logoPath);
      } catch (e) {
        console.warn("[watermark] logo illisible, fallback forme:", (e as Error)?.message);
      }
    }
  }

  // Si pas de logo exploitable → on retombe sur les formes.
  const needShapes = source === "shape" || !logoPath;
  if (needShapes) {
    const keys = randomShape ? SHAPE_KEYS : [typeof cfg.shape === "string" ? cfg.shape : "snowflake"];
    for (const key of keys) {
      try {
        const png = await sharp(Buffer.from(shapeSvg(key, color))).png().toBuffer();
        const p = path.join(dir, `__wm_${key}_${stamp}.png`);
        await fs.writeFile(p, png);
        shapePaths[key] = p;
        tempFiles.push(p);
      } catch (e) {
        console.warn(`[watermark] rasterisation forme "${key}" échouée:`, (e as Error)?.message);
      }
    }
  }

  // Rien de rasterisé → inutile de continuer.
  if (!logoPath && Object.keys(shapePaths).length === 0) return null;

  return {
    source: logoPath ? "logo" : "shape",
    shapeKey: typeof cfg.shape === "string" ? cfg.shape : "snowflake",
    randomShape,
    shapePaths,
    logoPath,
    opacity: clampNum(cfg.opacity, 1, 100, 60),
    size: clampNum(cfg.size, 1, 100, 12),
    position: typeof cfg.position === "string" && POSITIONS[cfg.position] ? cfg.position : "br",
    randomPosition: cfg.position === "random" || !!cfg.randomPosition,
    motion: !!cfg.motion,
    speed: clampNum(cfg.speed, 1, 100, 50),
    simpleRandom: false,
    tempFiles,
  };
}

/**
 * Watermark ALÉATOIRE du mode simple (toggle `simpleWatermark`). Rasterise les 8
 * formes en BLANC (teintées ensuite par copie via colorchannelmixer). Chaque copie
 * aura : forme + couleur + taille (40–80%) + vitesse (30–80) aléatoires, opacité 1%,
 * en mouvement. Retourne null si le toggle n'est pas activé.
 */
export async function prepareSimpleWatermark(
  formData: FormData,
  dir: string,
): Promise<PreparedWatermark | null> {
  if (formData.get("simpleWatermark") !== "1") return null;

  const sharp = (await import("sharp")).default;
  const tempFiles: string[] = [];
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const shapePaths: Record<string, string> = {};

  for (const key of SHAPE_KEYS) {
    try {
      const png = await sharp(Buffer.from(shapeSvg(key, "#ffffff"))).png().toBuffer();
      const p = path.join(dir, `__wms_${key}_${stamp}.png`);
      await fs.writeFile(p, png);
      shapePaths[key] = p;
      tempFiles.push(p);
    } catch (e) {
      console.warn(`[watermark] simple: forme "${key}" échouée:`, (e as Error)?.message);
    }
  }
  if (Object.keys(shapePaths).length === 0) return null;

  return {
    source: "shape",
    shapeKey: "snowflake",
    randomShape: true,
    shapePaths,
    logoPath: null,
    opacity: 2,          // fixe : 2%
    size: 60,            // indicatif (recalculé aléatoire par copie)
    position: "br",
    randomPosition: false,
    motion: true,
    speed: 55,           // indicatif (recalculé aléatoire par copie)
    simpleRandom: true,
    tempFiles,
  };
}

/** Par copie : choisit forme + position (aléatoires si demandé) → params overlay. */
export function resolveWatermarkOverlay(prep: PreparedWatermark, width: number): WatermarkOverlay {
  // ── Mode simple : TOUT aléatoire par copie ──────────────────────────────────
  // Forme + couleur (teinte) + taille (40–80%) + vitesse (30–80) aléatoires,
  // opacité 1%, mouvement rebond. Formes rasterisées en blanc → teintées ici.
  if (prep.simpleRandom) {
    const keys = Object.keys(prep.shapePaths);
    const moviePath = prep.shapePaths[keys[Math.floor(Math.random() * keys.length)]];
    const frac = 0.4 + Math.random() * 0.4;                    // 40–80 %
    const scaleW = width > 0 ? Math.max(12, Math.round(width * frac)) : Math.round(120 * (frac / 0.12));
    const speed = 30 + Math.random() * 50;                     // 30–80
    const sx = (60 + speed * 3).toFixed(1);
    const sy = ((60 + speed * 3) * 0.8).toFixed(1);
    return {
      moviePath,
      scaleW,
      opacity: 0.02,                                           // 2 %
      x: `abs(mod(${sx}*t,2*(W-w))-(W-w))`,
      y: `abs(mod(${sy}*t,2*(H-h))-(H-h))`,
      tint: { r: Math.random(), g: Math.random(), b: Math.random() }, // couleur aléatoire
    };
  }

  // Asset : logo, ou forme (aléatoire ou fixe).
  let moviePath = prep.logoPath ?? "";
  if (!moviePath) {
    const keys = Object.keys(prep.shapePaths);
    const key = prep.randomShape ? keys[Math.floor(Math.random() * keys.length)] : prep.shapeKey;
    moviePath = prep.shapePaths[key] ?? prep.shapePaths[keys[0]];
  }

  const frac = Math.min(1, Math.max(0.01, prep.size / 100));
  const scaleW = width > 0 ? Math.max(12, Math.round(width * frac)) : Math.round(120 * (frac / 0.12));
  const opacity = Math.min(1, Math.max(0.01, prep.opacity / 100));

  let x: string, y: string;
  if (prep.motion) {
    // Rebond type "DVD logo" — vitesse en px/s dérivée du curseur (1–100).
    const sx = (60 + prep.speed * 3).toFixed(1);
    const sy = ((60 + prep.speed * 3) * 0.8).toFixed(1);
    x = `abs(mod(${sx}*t,2*(W-w))-(W-w))`;
    y = `abs(mod(${sy}*t,2*(H-h))-(H-h))`;
  } else {
    const key = prep.randomPosition ? POS_KEYS[Math.floor(Math.random() * POS_KEYS.length)] : prep.position;
    [x, y] = POSITIONS[key] ?? POSITIONS.br;
  }

  return { moviePath, scaleW, opacity, x, y };
}

function clampNum(v: unknown, lo: number, hi: number, def: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, n));
}
