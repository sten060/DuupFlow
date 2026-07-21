// Lecture d'un reel de RÉFÉRENCE (Insta/TikTok). Deux entrées :
//   A) par URL  → yt-dlp télécharge (avec repli sur les cookies du navigateur
//                 pour Instagram, qui exige d'être connecté)
//   B) par FICHIER → l'user glisse le reel déjà téléchargé (increvable)
//
// Analyse commune (la moins chère possible) :
//   1. grille ~6 images clés basse-résolution (1 seule image pour le LLM)
//   2. gratuit : transcription whisper (hook parlé) + légende du post (URL)
//   3. ~1 centime : grille → Haiku vision → recette virale
//   4. cache disque par URL (les fichiers ne sont pas cachés)
//
// Dégradation douce : yt-dlp absent / download échoué / LLM indispo → erreur
// claire, jamais de crash. Prérequis local : `brew install yt-dlp`.

import { execFile } from "child_process";
import crypto from "crypto";
import fsSync from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { analyzeAudio, sceneScores } from "./analysis";
import { extractRecipeFromReference, refineTransitionCounts } from "./llm";
import { STUDIO_ROOT } from "./local-store";
import { FONT_FILE, runFFmpeg } from "./pipeline";
import { transcribeVideo } from "./transcribe";
import type { RecipeRhythm, ViralRecipe } from "./types";

const execFileP = promisify(execFile);

const REFS_DIR = path.join(STUDIO_ROOT, "refs");
// Navigateur d'où lire les cookies pour l'auth Instagram (l'user y est connecté).
const COOKIE_BROWSER = process.env.STUDIO_YTDLP_BROWSER || "chrome";

// ── Résolution du binaire yt-dlp (runtime) ──────────────────────────────────
const YTDLP_CANDIDATES = ["/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp"];
let _ytdlp: string | null | undefined;
function getYtDlp(): string | null {
  if (_ytdlp !== undefined) return _ytdlp;
  const fromEnv = process.env.YTDLP_BIN;
  if (fromEnv && fsSync.existsSync(fromEnv)) return (_ytdlp = fromEnv);
  for (const p of YTDLP_CANDIDATES) if (fsSync.existsSync(p)) return (_ytdlp = p);
  return (_ytdlp = null);
}

function urlHash(url: string): string {
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
}

// ── A) Analyse par URL ───────────────────────────────────────────────────────
export async function analyzeReference(
  url: string
): Promise<{ recipe: ViralRecipe } | { error: string }> {
  await fs.mkdir(REFS_DIR, { recursive: true });

  // Cache : recette déjà extraite pour cette URL → réutilisée, 0 coût.
  // Suffixe _v5 = mesures "hauteur de capitales" + règle 5% (v4 = ère montage). Caches d'ancien format (recette
  // descriptive sans mesures) ne peuvent JAMAIS resurgir.
  const cacheFile = path.join(REFS_DIR, `${urlHash(url)}_v5.json`);
  try {
    const cached = JSON.parse(await fs.readFile(cacheFile, "utf8")) as ViralRecipe;
    if (cached?.hookStyle && cached.layout && cached.rhythm && cached.montageLevel) return { recipe: cached };
  } catch {
    /* pas de cache — on analyse */
  }

  const ytdlp = getYtDlp();
  if (!ytdlp) {
    return {
      error: "yt-dlp non installé (brew install yt-dlp). Astuce : glisse plutôt le fichier du reel.",
    };
  }

  const base = path.join(os.tmpdir(), `duup_ref_${urlHash(url)}_${process.pid}`);
  const videoPath = `${base}.mp4`;

  try {
    // Téléchargement : 1er essai sans cookies (TikTok/YouTube publics),
    // repli avec les cookies du navigateur (Instagram / contenu connecté).
    const dl = async (useCookies: boolean) => {
      const args = ["--no-warnings", "-f", "mp4/best", "-o", videoPath, url];
      if (useCookies) args.push("--cookies-from-browser", COOKIE_BROWSER);
      await execFileP(ytdlp, args, { timeout: 180_000, maxBuffer: 20 * 1024 * 1024 });
    };

    let usedCookies = false;
    try {
      await dl(false);
    } catch (e1) {
      try {
        await dl(true);
        usedCookies = true;
      } catch (e2) {
        return { error: friendlyDownloadError(e2) };
      }
    }
    if (!fsSync.existsSync(videoPath)) {
      return { error: "Téléchargement impossible (reel privé, supprimé ou URL invalide ?)" };
    }

    // Légende du post (best-effort, mêmes cookies si utilisés).
    let postCaption = "";
    try {
      const metaArgs = ["--no-warnings", "--dump-single-json", url];
      if (usedCookies) metaArgs.push("--cookies-from-browser", COOKIE_BROWSER);
      const { stdout } = await execFileP(ytdlp, metaArgs, {
        timeout: 60_000,
        maxBuffer: 20 * 1024 * 1024,
      });
      const meta = JSON.parse(stdout) as { description?: string; title?: string };
      postCaption = (meta.description || meta.title || "").slice(0, 1500);
    } catch {
      /* pas de métadonnées → on continue */
    }

    const recipe = await buildRecipeFromVideo(videoPath, postCaption);
    if (!recipe) return { error: "Analyse IA indisponible (clé API ?) ou reel illisible" };

    await fs.writeFile(cacheFile, JSON.stringify(recipe), "utf8");
    return { recipe };
  } catch (e) {
    return { error: `Lecture de la référence échouée : ${errMsg(e).slice(0, 160)}` };
  } finally {
    await fs.unlink(videoPath).catch(() => {});
  }
}

// ── B) Analyse par FICHIER (le reel déjà téléchargé, glissé par l'user) ─────
// Cache par HASH DE CONTENU (sha1 des octets) : re-déposer le même fichier ne
// coûte plus une ré-analyse (et deux dépôts = même recette, déterminisme).
export async function analyzeReferenceFile(
  videoPath: string
): Promise<{ recipe: ViralRecipe } | { error: string }> {
  try {
    await fs.mkdir(REFS_DIR, { recursive: true });
    const contentHash = crypto
      .createHash("sha1")
      .update(await fs.readFile(videoPath))
      .digest("hex")
      .slice(0, 16);
    const cacheFile = path.join(REFS_DIR, `${contentHash}_v5.json`);
    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, "utf8")) as ViralRecipe;
      if (cached?.hookStyle && cached.layout && cached.rhythm && cached.montageLevel) return { recipe: cached };
    } catch {
      /* pas de cache — on analyse */
    }

    const recipe = await buildRecipeFromVideo(videoPath, "");
    if (!recipe) return { error: "Analyse IA indisponible (clé API ?) ou vidéo illisible" };

    await fs.writeFile(cacheFile, JSON.stringify(recipe), "utf8");
    return { recipe };
  } catch (e) {
    return { error: `Analyse du fichier échouée : ${errMsg(e).slice(0, 160)}` };
  }
}

// ── Analyse commune : grille (timing) + DEUX frames réglées (50% et 85% —
// détection accumulation/remplacement + mesures) + transcription → recette.
// Les frames réglées portent une RÈGLE graduée (traits fins tous les 5% de la
// hauteur, étiquetés tous les 10%) : la vision MESURE la HAUTEUR DES CAPITALES
// et les positions au lieu d'estimer.
async function buildRecipeFromVideo(
  videoPath: string,
  postCaption: string
): Promise<ViralRecipe | null> {
  const durationSec = await probeDuration(videoPath);
  const [grids, design50, design85] = await Promise.all([
    buildKeyframeGrid(videoPath, durationSec),
    buildDesignFrame(videoPath, durationSec, 0.5),
    buildDesignFrame(videoPath, durationSec, 0.85),
  ]);
  if (!grids) throw new Error("extraction des images impossible");

  let transcript = "";
  try {
    const t = await transcribeVideo(videoPath);
    if (t) transcript = t.phrases.map((p) => p.text).join(" ").slice(0, 3000);
  } catch {
    /* pas de parole → la vision suffit */
  }

  const recipe = await extractRecipeFromReference({
    gridImagesBase64: grids,
    designImage50Base64: design50 ?? undefined,
    designImage85Base64: design85 ?? undefined,
    transcript: transcript || undefined,
    postCaption: postCaption || undefined,
    refDurationSec: durationSec,
  });

  // Compréhension du montage (Phase 1) — greffée sur l'appel vision ci-dessus.
  if (recipe) {
    console.log(
      `[studio] montage ref : niveau=${recipe.montageLevel} · ${recipe.moves?.length ?? 0} mouvement(s)` +
        (recipe.footageNeeded ? ` · rush idéal : ${recipe.footageNeeded.slice(0, 90)}` : "")
    );
  }

  // Passe de raffinement : le comptage grille est fiable à ±1 frame près.
  // On re-vérifie chaque transition sur les 2 frames frontières en grand.
  if (recipe?.layout && recipe.layout.revealAtFrac.length > 0) {
    try {
      await refineRevealTimings(videoPath, durationSec, recipe.layout);
    } catch (e) {
      console.warn(
        "[studio] raffinement timing ignoré :",
        e instanceof Error ? e.message : e
      );
    }
  }

  // Rythme de montage — PUR CODE (aucune vision) : cuts + beat-sync.
  if (recipe) {
    try {
      recipe.rhythm = await extractRhythm(videoPath, durationSec);
      console.log(
        `[studio] rythme ref : ${recipe.rhythm.cutTimestampsSec.length} cut(s), ` +
          `plan moyen ${recipe.rhythm.avgShotSec.toFixed(1)}s, courbe ${recipe.rhythm.shotCurve}, ` +
          `1er cut ${recipe.rhythm.firstCutSec.toFixed(1)}s, beatSync=${recipe.rhythm.beatSync}`
      );
    } catch (e) {
      console.warn(
        "[studio] extraction du rythme ignorée :",
        e instanceof Error ? e.message : e
      );
    }
  }
  return recipe;
}

// ── Rythme de montage de la ref (scene detection adaptative + beat-sync) ────
// Les jump cuts (même cadrage) scorent bas (0.08-0.2) : seuil adaptatif +
// écart minimal entre cuts, bornes de début/fin exclues (fondus d'intro).
async function extractRhythm(
  videoPath: string,
  durationSec: number
): Promise<RecipeRhythm> {
  const scores = await sceneScores(videoPath, 0.05);

  // Cuts candidats : score ≥ 0.08, hors 0.5s de début et 0.3s de fin,
  // écart ≥ 0.8s (on garde le plus fort score dans chaque fenêtre).
  const candidates = scores
    .filter((s) => s.score >= 0.08 && s.t >= 0.5 && s.t <= durationSec - 0.3)
    .sort((a, b) => b.score - a.score);
  const cuts: number[] = [];
  for (const c of candidates) {
    if (cuts.every((t) => Math.abs(t - c.t) >= 0.8)) cuts.push(c.t);
  }
  cuts.sort((a, b) => a - b);

  // Durées de plans → moyenne + courbe (1ʳᵉ moitié vs 2ᵉ moitié des plans).
  const bounds = [0, ...cuts, durationSec];
  const shots = bounds.slice(1).map((b, i) => b - bounds[i]);
  const avgShotSec = durationSec / (cuts.length + 1);
  let shotCurve: RecipeRhythm["shotCurve"] = "steady";
  if (shots.length >= 4) {
    const half = Math.floor(shots.length / 2);
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const ratio = avg(shots.slice(half)) / Math.max(0.1, avg(shots.slice(0, half)));
    if (ratio < 0.75) shotCurve = "accelerating";
    else if (ratio > 1.33) shotCurve = "decelerating";
  }

  // Beat-sync : cuts proches (±0.35s) d'un pic local d'énergie audio ?
  let beatSync = false;
  if (cuts.length >= 3) {
    try {
      const { loudness } = await analyzeAudio(videoPath);
      const peaks: number[] = [];
      for (let i = 2; i < loudness.length - 2; i++) {
        const p = loudness[i];
        if (
          p.m > loudness[i - 1].m && p.m > loudness[i + 1].m &&
          p.m > loudness[i - 2].m && p.m > loudness[i + 2].m
        ) {
          peaks.push(p.t);
        }
      }
      if (peaks.length > 0) {
        const near = cuts.filter((c) =>
          peaks.some((p) => Math.abs(p - c) <= 0.35)
        ).length;
        beatSync = near / cuts.length >= 0.6;
      }
    } catch {
      /* pas d'audio → beatSync false */
    }
  }

  return {
    cutTimestampsSec: cuts.map((t) => Math.round(t * 100) / 100),
    avgShotSec: Math.round(avgShotSec * 100) / 100,
    shotCurve,
    firstCutSec: Math.round((cuts[0] ?? durationSec) * 100) / 100,
    beatSync,
  };
}

// Ajuste revealAtFrac de ±1 frame (1/16 de la durée) en re-comptant les
// captions sur les frames frontières agrandies. Modifie layout EN PLACE.
async function refineRevealTimings(
  videoPath: string,
  durationSec: number,
  layout: NonNullable<ViralRecipe["layout"]>
): Promise<void> {
  const N = 16;
  const step = durationSec / N;

  // Reconstruit l'index de frame de chaque transition depuis le point médian
  // (mid = (i-1+i)/2/N → i = mid*N + 0.5).
  const frameIdx = layout.revealAtFrac.map((mid) =>
    Math.max(1, Math.min(N - 1, Math.round(mid * N + 0.5)))
  );

  // Une image par transition : frame i-1 | frame i, côte à côte, en grand.
  const pairs: string[] = [];
  const tmpFiles: string[] = [];
  try {
    for (let k = 0; k < frameIdx.length; k++) {
      const i = frameIdx[k];
      const out = `${videoPath}.pair${k}.png`;
      tmpFiles.push(out);
      const tL = ((i - 1) * step).toFixed(3);
      const tR = (i * step).toFixed(3);
      // 2 extractions dans un même ffmpeg (2 inputs -ss) puis hstack.
      const { code } = await runFFmpeg(
        [
          "-y", "-hide_banner", "-loglevel", "error",
          "-ss", tL, "-i", videoPath,
          "-ss", tR, "-i", videoPath,
          "-filter_complex", "[0:v]scale=360:-2[l];[1:v]scale=360:-2[r];[l][r]hstack=2",
          "-frames:v", "1", out,
        ],
        60_000
      );
      if (code !== 0 || !fsSync.existsSync(out)) return;
      pairs.push((await fs.readFile(out)).toString("base64"));
    }

    const counts = await refineTransitionCounts(pairs);
    if (!counts || counts.length !== frameIdx.length) return;

    for (let k = 0; k < frameIdx.length; k++) {
      // Cumul attendu APRÈS cette transition : hook (1) + reveals 0..k → k+2.
      const expectedAfter = k + 2;
      const { left, right } = counts[k];
      let i = frameIdx[k];
      if (left >= expectedAfter) i = Math.max(1, i - 1); // déjà là avant → plus tôt
      else if (right < expectedAfter) i = Math.min(N - 1, i + 1); // pas encore là → plus tard
      const newMid = (i - 0.5) / N;
      if (newMid !== layout.revealAtFrac[k]) {
        console.log(
          `[studio] raffinement: reveal[${k}] frame ${frameIdx[k]} → ${i} (frac ${layout.revealAtFrac[k].toFixed(3)} → ${newMid.toFixed(3)}) [G=${left} D=${right}]`
        );
        layout.revealAtFrac[k] = newMid;
      }
    }
    layout.revealAtFrac.sort((a, b) => a - b);
  } finally {
    for (const f of tmpFiles) await fs.unlink(f).catch(() => {});
  }
}

async function probeDuration(videoPath: string): Promise<number> {
  const { stderr } = await runFFmpeg(["-hide_banner", "-i", videoPath], 30_000);
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 30;
}

// Frame unique à une fraction donnée de la durée, en 720px, avec une règle
// incrustée : lignes rouges tous les 10% de la hauteur + étiquettes "10"…"90".
// La vision lit les positions CONTRE la règle. Deux appels (50% et 85%)
// permettent de détecter si les captions s'accumulent ou se remplacent.
async function buildDesignFrame(
  videoPath: string,
  durationSec: number,
  atFrac: number
): Promise<string | null> {
  const outPath = `${videoPath}.design${Math.round(atFrac * 100)}.png`;
  try {
    const t = Math.max(0, durationSec * atFrac);
    const filters: string[] = ["scale=720:-2"];
    // Règle horizontale : trait FIN tous les 5% (interpolation serrée pour les
    // petites hauteurs de texte), étiquette seulement tous les 10%.
    for (let k = 1; k <= 19; k++) {
      const frac = (k * 0.05).toFixed(2);
      const labeled = k % 2 === 0; // multiples de 0.10
      filters.push(
        `drawbox=y=ih*${frac}:w=iw:h=${labeled ? 2 : 1}:color=red@${labeled ? "0.85" : "0.5"}:t=fill`
      );
      if (labeled && FONT_FILE) {
        // NB : dans drawtext la hauteur de l'image est `H` (pas `ih` comme drawbox).
        filters.push(
          `drawtext=fontfile='${FONT_FILE}':text='${k * 5}':fontcolor=red:fontsize=26` +
            `:borderw=2:bordercolor=white:x=8:y=H*${frac}-30`
        );
      }
    }
    const { code } = await runFFmpeg(
      ["-y", "-hide_banner", "-loglevel", "error", "-ss", t.toFixed(2),
       "-i", videoPath, "-frames:v", "1", "-vf", filters.join(","), outPath],
      60_000
    );
    if (code !== 0 || !fsSync.existsSync(outPath)) return null;
    return (await fs.readFile(outPath)).toString("base64");
  } catch {
    return null;
  } finally {
    await fs.unlink(outPath).catch(() => {});
  }
}

// Extrait 16 images réparties sur toute la durée, en QUATRE grilles 2×2 de
// 4 frames (tuiles 480px — le comptage de captions exige des tuiles LISIBLES ;
// une grille unique de 16 donnait ±2 frames d'erreur, 2×8 donnait ±1).
// Pas de ~6.7% → précision ~±3% avec le point médian.
async function buildKeyframeGrid(
  videoPath: string,
  durationSec: number
): Promise<string[] | null> {
  const outs = [0, 1, 2, 3].map((i) => `${videoPath}.grid${i}.png`);
  try {
    const dur = Math.max(1, durationSec);
    const fps = Math.max(0.1, 16 / dur);

    const mk = async (out: string, fromIdx: number) => {
      const { code } = await runFFmpeg(
        [
          "-y", "-hide_banner", "-loglevel", "error", "-i", videoPath,
          "-vf",
          `fps=${fps.toFixed(4)},select='between(n\\,${fromIdx}\\,${fromIdx + 3})',scale=480:-1,tile=2x2`,
          "-frames:v", "1", out,
        ],
        60_000
      );
      return code === 0 && fsSync.existsSync(out);
    };
    const results: string[] = [];
    for (let i = 0; i < 4; i++) {
      if (!(await mk(outs[i], i * 4))) return null;
      results.push((await fs.readFile(outs[i])).toString("base64"));
    }
    return results;
  } catch {
    return null;
  } finally {
    for (const o of outs) await fs.unlink(o).catch(() => {});
  }
}

// ── Helpers d'erreur ─────────────────────────────────────────────────────────
function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "stderr" in e) {
    const s = String((e as { stderr?: unknown }).stderr ?? "").trim();
    if (s) return s;
  }
  return e instanceof Error ? e.message : String(e);
}

// Message actionnable selon la cause réelle renvoyée par yt-dlp.
function friendlyDownloadError(e: unknown): string {
  const s = errMsg(e).toLowerCase();
  if (/login|logged-in|cookies|empty media|private|rate.?limit|429/.test(s)) {
    return "Instagram exige d'être connecté. Connecte-toi à Instagram dans Chrome (ou glisse directement le fichier du reel).";
  }
  if (/unsupported url|not a valid url|unable to extract/.test(s)) {
    return "URL non reconnue — colle le lien direct du reel, ou glisse le fichier.";
  }
  return `Téléchargement échoué : ${errMsg(e).slice(0, 140)}`;
}
