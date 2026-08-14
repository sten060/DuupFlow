// Pipeline ffmpeg LOCAL du Studio : probe des vidéos brutes, détection de
// format (Talking/Action) et génération des variantes de reels.
// Réutilise le binaire @ffmpeg-installer déjà présent dans le projet
// (même approche spawn que src/app/dashboard/videos/processVideos.ts).

import { execSync, spawn } from "child_process";
import fsSync from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { buildAssForClip, buildRevealAss, type CaptionStyle } from "./captions";
import type { TranscriptWord } from "./transcribe";
import type { ReelFormat } from "./types";

// ── Résolution du binaire ffmpeg (au RUNTIME, jamais via import) ─────────────
// Importer @ffmpeg-installer ici casserait le bundling webpack des routes
// App Router (require dynamique du package par plateforme → webpackEmptyContext).
// On résout donc le chemin sur disque à l'exécution.
//
// ⚠️ ON CHOISIT PAR CAPACITÉ, PAS PAR ORDRE FIXE. La prod tournait sur le
// binaire @ffmpeg-installer, figé en 4.1 (2018) : `xfade` n'existe pas → TOUTES
// les transitions étaient silencieusement remplacées par des coupes sèches, et
// ce moteur ancien produisait des montages faux (durées ×9) que les tests
// locaux — sur un ffmpeg récent — ne reproduisaient jamais. On prend donc le
// PREMIER binaire qui sait faire ce dont le moteur a besoin, et on retombe sur
// l'ancien si aucun moderne n'est disponible (jamais pire qu'avant).
const REQUIRED_FILTERS = ["xfade"]; // marqueur d'un ffmpeg ≥ 4.3
let _ffmpegBin: string | null = null;

function hasFilters(bin: string): boolean {
  try {
    const out = execSync(`"${bin}" -hide_banner -filters 2>/dev/null`, { encoding: "utf8", shell: "/bin/sh", maxBuffer: 8 << 20 });
    return REQUIRED_FILTERS.every((f) => out.includes(` ${f} `));
  } catch { return false; }
}

function candidateBins(): string[] {
  const list: string[] = [];
  const fromEnv = process.env.FFMPEG_BIN || process.env.FFMPEG_PATH;
  if (fromEnv) list.push(fromEnv);
  // ffmpeg-static : build RÉCENT (ffmpeg 6+), installé sur la plateforme cible.
  // ⚠ On vise le fichier SUR DISQUE, jamais `require("ffmpeg-static")` : webpack
  // bundlerait le module et le chemin résolu pointerait vers le chunk (c'est
  // exactement le piège documenté plus haut pour @ffmpeg-installer).
  list.push(path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"));
  // ffmpeg du système (nixpacks/brew) — souvent récent.
  try {
    const found = execSync("command -v ffmpeg", { encoding: "utf8", shell: "/bin/sh" }).trim();
    if (found) list.push(found);
  } catch { /* pas dans le PATH */ }
  // Repli historique : @ffmpeg-installer (4.1 sur Linux, 4.4 sur macOS).
  list.push(path.join(process.cwd(), "node_modules", "@ffmpeg-installer", `${process.platform}-${process.arch}`, "ffmpeg"));
  return list.filter((x, i) => x && list.indexOf(x) === i);
}

function getFfmpegBin(): string {
  if (_ffmpegBin) return _ffmpegBin;
  const cands = candidateBins().filter((b) => b === "ffmpeg" || fsSync.existsSync(b));
  // 1er passage : un binaire COMPLET (xfade → transitions réelles).
  for (const b of cands) {
    if (hasFilters(b)) {
      console.log(`[ffmpeg] moteur : ${b} (complet)`);
      return (_ffmpegBin = b);
    }
  }
  // 2e passage : n'importe lequel qui existe, en le signalant BRUYAMMENT.
  if (cands.length) {
    console.warn(`[ffmpeg] ⚠ moteur ANCIEN : ${cands[0]} — filtres manquants (${REQUIRED_FILTERS.join(", ")}) : les transitions seront remplacées par des coupes.`);
    return (_ffmpegBin = cands[0]);
  }
  throw new Error("ffmpeg introuvable (ni FFMPEG_BIN, ni ffmpeg-static, ni PATH, ni @ffmpeg-installer)");
}

/** Chemin du binaire ffmpeg réellement utilisé (sélection par capacité). */
export function ffmpegBinPath(): string { return getFfmpegBin(); }

// ── Utilitaires ──────────────────────────────────────────────────────────────

// Lance ffmpeg et retourne { code, stderr }. ffmpeg écrit ses infos de probe
// sur stderr — on le parse plutôt que d'embarquer ffprobe (non fourni par
// @ffmpeg-installer). Exporté pour les passes d'analyse (analysis.ts).
export function runFFmpeg(
  args: string[],
  timeoutMs = 10 * 60 * 1000,
  // Taille max de stderr conservée. Les passes d'ANALYSE (ebur128 ≈ 10
  // lignes/s) doivent la monter — tronquer amputerait la timeline d'énergie
  // et fausserait la découpe intelligente.
  maxStderrBytes = 64_000
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(getFfmpegBin(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`ffmpeg timeout après ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    p.stderr.on("data", (d) => {
      stderr += String(d);
      // Garde-fou mémoire : on ne conserve que la fin du log.
      if (stderr.length > maxStderrBytes) stderr = stderr.slice(-Math.floor(maxStderrBytes / 2));
    });
    p.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg introuvable : ${err.message}`));
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stderr });
    });
  });
}

// PRNG seedé (mulberry32) → variantes reproductibles pour un même job,
// et différentes entre elles (seed = index de variante).
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Retour à la ligne "mot entier" pour drawtext (4.4 ne wrappe pas seul).
// Max 3 lignes, on tronque au-delà pour ne pas envahir l'écran.
function wrapText(text: string, maxChars: number): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3).join("\n");
}

// #RRGGBB → "0xRRGGBB" (format couleur de drawtext). Défaut blanc.
function hexToDrawtext(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? `0x${m[1].toUpperCase()}` : "white";
}

// Retire les emojis/symboles (non rendus par la police système) + espaces
// résiduels. Garde apostrophes, accents, « … ».
function stripEmoji(text: string): string {
  return text
    .replace(
      /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Probe ────────────────────────────────────────────────────────────────────

export interface VideoProbe {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
  bitrateKbps: number;
}

// `ffmpeg -i <file>` sort code ≠ 0 ("At least one output file must be
// specified") mais écrit toutes les infos sur stderr — comportement attendu.
export async function probeVideo(inputPath: string): Promise<VideoProbe> {
  const { stderr } = await runFFmpeg(["-hide_banner", "-i", inputPath], 30_000);

  const dur = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!dur) throw new Error("Fichier illisible par ffmpeg (pas une vidéo ?)");
  const durationSec =
    Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);

  const video = stderr.match(/Stream #.*Video:.*?\s(\d{2,5})x(\d{2,5})/);
  if (!video) throw new Error("Aucune piste vidéo détectée");

  const bitrate = stderr.match(/bitrate:\s*(\d+)\s*kb\/s/);

  return {
    durationSec,
    width: Number(video[1]),
    height: Number(video[2]),
    hasAudio: /Stream #.*Audio:/.test(stderr),
    bitrateKbps: bitrate ? Number(bitrate[1]) : 0,
  };
}

// ── Détection de format (heuristique v1, réelle mais simple) ────────────────
// Pas de piste audio → Action. Sinon on mesure le volume moyen des 2
// premières minutes (volumedetect) : quasi silencieux → Action (musique
// ajoutée au montage), sinon Talking (quelqu'un parle face cam).
// Limite connue : une musique forte est classée Talking — la vraie
// distinction voix/musique viendra avec la transcription.
// TODO: brancher une vraie détection IA (voix vs musique, mouvement).
export async function detectFormat(
  inputPath: string,
  probe: VideoProbe
): Promise<ReelFormat> {
  if (!probe.hasAudio) return "Action";
  try {
    const { stderr } = await runFFmpeg(
      ["-hide_banner", "-t", "120", "-i", inputPath, "-map", "0:a:0", "-af", "volumedetect", "-f", "null", "-"],
      120_000
    );
    const mean = stderr.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
    if (mean && Number(mean[1]) < -45) return "Action"; // quasi silence
    return "Talking";
  } catch {
    return "Talking"; // en cas de doute, le cas le plus courant
  }
}

// ── Police pour l'incrustation du hook (drawtext) ────────────────────────────
const FONT_CANDIDATES = [
  "/System/Library/Fonts/Helvetica.ttc",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/Library/Fonts/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];
// Exporté : references.ts s'en sert pour étiqueter la règle de mesure.
export const FONT_FILE = FONT_CANDIDATES.find((f) => fsSync.existsSync(f)) ?? null;

// ── Génération d'une variante ────────────────────────────────────────────────

export interface VariantParams {
  inputPath: string;
  outputPath: string;
  hook: string;
  hasAudio: boolean;
  srcBitrateKbps: number;
  seed: number; // varie par variante → transformations différentes
  // Extrait à découper dans la brute (découpe intelligente, segments.ts).
  // Absent → la vidéo entière est utilisée.
  segment?: { startSec: number; durationSec: number };
  // Mots horodatés (whisper) → sous-titres animés brûlés (captions.ts).
  // Absent/vide → pas de captions (vidéos sans parole), hook en bas comme avant.
  captionWords?: TranscriptWord[];
  // Révélations séquentielles (mode poster OFM) : lignes qui apparaissent après
  // le hook, une par une. Style des captions repris d'une référence.
  captionReveals?: string[];
  sourceDurationSec?: number; // durée de la vidéo source (timing des révélations)
  captionStyle?: CaptionStyle;
  // true = produire la vidéo de BASE sans aucun texte incrusté (la couche
  // captions sera rendue par Remotion par-dessus). N'affecte pas les
  // sous-titres mot-à-mot (voie vidéos parlées, toujours ffmpeg).
  omitText?: boolean;
}

/**
 * Encode UNE variante de reel :
 *  - recadrage centré 9:16 puis zoom léger seedé (sous-crop décalé)
 *  - sortie 1080×1920
 *  - micro-variations colorimétriques (eq) + vitesse ±3% (setpts/atempo)
 *  - hook incrusté en bas via drawtext (si une police système est trouvée)
 *  - CRF 23 + maxrate cappé au bitrate source → jamais plus lourd que la source
 */
export async function generateVariant(params: VariantParams): Promise<void> {
  const rng = mulberry32(params.seed);

  // Paramètres de variation (plages volontairement subtiles)
  const zoom = 1 + rng() * 0.06; // 1.00–1.06
  const offX = rng(); // position du sous-crop (0–1)
  const offY = rng();
  const brightness = (rng() - 0.5) * 0.04; // ±0.02
  const contrast = 1 + (rng() - 0.5) * 0.06; // ±0.03
  const saturation = 1 + (rng() - 0.5) * 0.1; // ±0.05
  const rate = 1 + (rng() - 0.5) * 0.06; // vitesse 0.97–1.03

  const vf: string[] = [
    // Recadrage centré au ratio 9:16
    "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)'",
    // Zoom seedé : sous-région (1/zoom) prise à une position aléatoire stable
    `crop=w=iw/${zoom.toFixed(4)}:h=ih/${zoom.toFixed(4)}` +
      `:x=(iw-iw/${zoom.toFixed(4)})*${offX.toFixed(4)}` +
      `:y=(ih-ih/${zoom.toFixed(4)})*${offY.toFixed(4)}`,
    "scale=1080:1920:flags=bicubic",
    "setsar=1",
    `eq=brightness=${brightness.toFixed(4)}:contrast=${contrast.toFixed(4)}:saturation=${saturation.toFixed(4)}`,
    `setpts=PTS/${rate.toFixed(4)}`,
  ];

  // Sous-titres animés brûlés (captions.ts) — vidéos parlées uniquement.
  // Écrits dans un .ass temporaire, calés au mot près en tenant compte de la
  // découpe (clipStart) et de la vitesse (rate).
  let assFile: string | null = null;
  const hasCaptions = !!params.captionWords && params.captionWords.length > 0;
  if (hasCaptions) {
    const clipStart = params.segment?.startSec ?? 0;
    const clipDur = params.segment?.durationSec ?? Number.POSITIVE_INFINITY;
    const ass = buildAssForClip(
      params.captionWords!,
      clipStart,
      clipDur,
      rate,
      params.captionStyle ?? {}
    );
    if (ass) {
      assFile = path.join(
        os.tmpdir(),
        `duup_sub_${process.pid}_${params.seed}_${Date.now()}.ass`
      );
      await fs.writeFile(assFile, ass, "utf8");
    }
  }

  // Mode POSTER (pas de captions mot-à-mot) : hook + révélations séquentielles
  // via ASS (elles apparaissent une par une et s'empilent, façon reel OFM).
  // omitText = base "propre" pour Remotion → aucun texte ffmpeg.
  const posterMode = !assFile && !params.omitText;
  let posterAssFile: string | null = null;
  if (posterMode) {
    const outDur =
      (params.segment?.durationSec ?? params.sourceDurationSec ?? 8) / rate;
    const ass = buildRevealAss(
      params.hook,
      params.captionReveals ?? [],
      outDur,
      params.captionStyle ?? {}
    );
    if (ass) {
      posterAssFile = path.join(
        os.tmpdir(),
        `duup_poster_${process.pid}_${params.seed}_${Date.now()}.ass`
      );
      await fs.writeFile(posterAssFile, ass, "utf8");
    }
  }

  // Mode captions mot-à-mot : le hook devient un TITRE drawtext en haut.
  // (omitText : aucun texte du tout — Remotion s'en charge.)
  let hookFile: string | null = null;
  if (!posterMode && !params.omitText && FONT_FILE) {
    hookFile = path.join(
      os.tmpdir(),
      `duup_hook_${process.pid}_${params.seed}_${Date.now()}.txt`
    );
    const style = params.captionStyle ?? {};
    const color = style.accentColor ? hexToDrawtext(style.accentColor) : "white";
    let hookText = stripEmoji(params.hook);
    if (style.uppercase) hookText = hookText.toUpperCase();
    await fs.writeFile(hookFile, wrapText(hookText, 24), "utf8");
    vf.push(
      `drawtext=fontfile='${FONT_FILE}':textfile='${hookFile}'` +
        `:fontcolor=${color}:fontsize=46:borderw=2:bordercolor=black@0.6` +
        ":box=1:boxcolor=black@0.35:boxborderw=18:line_spacing=8" +
        ":x=(w-text_w)/2:y=h*0.06"
    );
  }

  // Sous-titres brûlés : mot-à-mot (parlé) OU poster/révélations (visuel).
  const subFile = assFile ?? posterAssFile;
  if (subFile) {
    // Chemin sûr (os.tmpdir + nom généré) — on échappe tout de même : et \.
    const esc = subFile.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
    vf.push(`subtitles='${esc}'`);
  }
  vf.push("format=yuv420p");

  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
  // Découpe de l'extrait : -ss/-t AVANT -i (seek d'entrée — précis à l'image
  // près puisqu'on ré-encode, et bien plus rapide qu'un seek de sortie).
  if (params.segment) {
    args.push(
      "-ss", params.segment.startSec.toFixed(2),
      "-t", params.segment.durationSec.toFixed(2)
    );
  }
  args.push("-i", params.inputPath, "-map", "0:v:0");
  if (params.hasAudio) {
    args.push("-map", "0:a:0", "-af", `atempo=${(1 * rate).toFixed(4)}`);
  }
  args.push("-vf", vf.join(","));
  args.push(
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart"
  );
  // Jamais plus lourd que la source (cf. incident OOM/gros fichiers du
  // duplicateur) : cap VBV au bitrate mesuré de la source.
  if (params.srcBitrateKbps > 0) {
    const cap = Math.min(
      12_000,
      Math.max(1_000, Math.round(params.srcBitrateKbps))
    );
    args.push("-maxrate", `${cap}k`, "-bufsize", `${cap * 2}k`);
  }
  args.push(params.outputPath);

  try {
    const { code, stderr } = await runFFmpeg(args);
    if (code !== 0) {
      throw new Error(`ffmpeg a échoué (${code}) : ${stderr.slice(-400)}`);
    }
  } finally {
    if (hookFile) await fs.unlink(hookFile).catch(() => {});
    if (assFile) await fs.unlink(assFile).catch(() => {});
    if (posterAssFile) await fs.unlink(posterAssFile).catch(() => {});
  }
}
