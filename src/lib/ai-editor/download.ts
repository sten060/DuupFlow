// src/lib/ai-editor/download.ts
//
// Télécharge une vidéo de RÉFÉRENCE depuis une URL (TikTok / Instagram /
// YouTube…) via yt-dlp, pour l'analyser ensuite. Repli sur les cookies du
// navigateur pour Instagram (contenu qui exige d'être connecté).
//
// Sécurité : garde anti-SSRF (http/https uniquement, pas d'IP privée/localhost)
// car l'URL vient de l'utilisateur → le serveur ne doit pas être détourné vers
// des cibles internes.
//
// Prérequis : `brew install yt-dlp`. Dégradation douce : binaire absent /
// download échoué → { error } clair (jamais de crash).

import { execFile } from "child_process";
import fsSync from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileP = promisify(execFile);

const YTDLP_CANDIDATES = ["/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp"];
const COOKIE_BROWSER = process.env.STUDIO_YTDLP_BROWSER || "chrome";

let _ytdlp: string | null | undefined;
function getYtDlp(): string | null {
  if (_ytdlp !== undefined) return _ytdlp;
  const fromEnv = process.env.YTDLP_BIN;
  if (fromEnv && fsSync.existsSync(fromEnv)) return (_ytdlp = fromEnv);
  for (const p of YTDLP_CANDIDATES) if (fsSync.existsSync(p)) return (_ytdlp = p);
  return (_ytdlp = null);
}

/** Garde anti-SSRF : http(s) public uniquement (pas localhost / IP privée). */
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return false;
  if (h === "0.0.0.0" || h === "::1" || h === "[::1]") return false;
  // IPv4 privées / loopback / link-local
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (/^169\.254\./.test(h)) return false;
  return true;
}

function friendly(e: unknown): string {
  const msg = (e as { stderr?: string; message?: string })?.stderr || (e as Error)?.message || "";
  if (/login required|private|not available|Sign in|cookies/i.test(msg))
    return "Reel privé ou connexion requise — dépose plutôt le fichier.";
  if (/Unsupported URL|Unable to extract/i.test(msg)) return "Lien non reconnu — vérifie l'URL, ou dépose le fichier.";
  return "Téléchargement impossible (reel privé, supprimé, ou URL invalide ?).";
}

export type DownloadResult = { path: string; dir: string } | { error: string };

/** Télécharge la vidéo dans un dossier temporaire. À nettoyer par l'appelant. */
export async function downloadReference(url: string): Promise<DownloadResult> {
  if (!isSafePublicUrl(url)) return { error: "URL invalide (http/https public uniquement)." };

  const ytdlp = getYtDlp();
  if (!ytdlp) return { error: "yt-dlp non installé côté serveur — dépose le fichier à la place." };

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_refdl_"));
  const out = path.join(dir, "ref.mp4");

  const run = async (useCookies: boolean) => {
    const args = ["--no-warnings", "--no-playlist", "-f", "mp4/best", "-o", out, url];
    if (useCookies) args.push("--cookies-from-browser", COOKIE_BROWSER);
    await execFileP(ytdlp, args, { timeout: 180_000, maxBuffer: 20 * 1024 * 1024 });
  };

  try {
    try {
      await run(false); // TikTok / YouTube publics
    } catch {
      await run(true); // repli cookies (Instagram / connecté)
    }
    if (!fsSync.existsSync(out) || (await fs.stat(out)).size === 0) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      return { error: "Téléchargement impossible (reel privé, supprimé ou URL invalide ?)." };
    }
    return { path: out, dir };
  } catch (e) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    return { error: friendly(e) };
  }
}
