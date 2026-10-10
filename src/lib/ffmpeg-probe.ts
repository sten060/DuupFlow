// Sonde ffmpeg (`ffmpeg -i fichier` → en-têtes sur stderr) ROBUSTE À LA CHARGE.
//
// Incident du 10/10/2026 : chaque module avait sa sonde avec un délai fixe de
// 8–10 s. Serveur chargé → la sonde expirait, la durée tombait à 0 et un fichier
// PARFAITEMENT valide était traité comme « corrompu » (duplication), compressé
// sans plafond de débit ni détection HDR (compresseur), ou refusé (comparateur).
//
// Règles :
//   • délais croissants (10 s → 30 s → 90 s) avant d'abandonner ;
//   • un délai dépassé est rapporté comme `timedOut`, JAMAIS confondu avec un
//     fichier illisible ;
//   • chaque sonde lente est loguée avec la charge de la machine, pour qu'une
//     ligne de log suffise à diagnostiquer une saturation.

import { spawn } from "child_process";
import path from "path";
import { loadSnapshot } from "@/lib/cpu-budget";

export const PROBE_TIMEOUTS_MS = [10_000, 30_000, 90_000];
// Au-delà, une sonde est « lente » et on la logue (signal d'alerte précoce).
const SLOW_PROBE_MS = 3_000;

export type ProbeRun = { stderr: string; timedOut: boolean; code: number | null };

/** Un essai unique. `code` = -1 si le binaire n'a pas pu être lancé. */
export function runProbeOnce(binPath: string, args: string[], timeoutMs: number): Promise<ProbeRun> {
  return new Promise((resolve) => {
    let stderr = "";
    let settled = false;
    const done = (timedOut: boolean, code: number | null) => {
      if (!settled) { settled = true; clearTimeout(timer); resolve({ stderr, timedOut, code }); }
    };
    const p = spawn(binPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    p.stderr.on("data", (d: Buffer) => {
      // Une sonde n'écrit que les en-têtes (quelques Ko) : borne de sécurité.
      if (stderr.length < 256_000) stderr += d.toString();
    });
    p.on("error", () => done(false, -1));
    p.on("close", (code) => done(false, code));
    const timer = setTimeout(() => { p.kill("SIGKILL"); done(true, null); }, timeoutMs);
  });
}

/**
 * Lit les en-têtes d'un média, en relançant avec un délai plus long tant que la
 * sonde expire. `timedOut: true` en sortie = la machine n'a jamais répondu à
 * temps : on ne sait RIEN du fichier.
 */
export async function probeInfo(input: string, binPath: string, tag = "probe"): Promise<ProbeRun> {
  let last: ProbeRun = { stderr: "", timedOut: true, code: null };
  const t0 = Date.now();
  for (const [i, ms] of PROBE_TIMEOUTS_MS.entries()) {
    // -probesize 100M : lit plus loin pour trouver l'atome moov quand il est en
    // fin de fichier (enregistrements non « faststart », HEVC de TapRecord…).
    last = await runProbeOnce(binPath, ["-hide_banner", "-probesize", "100M", "-i", input], ms);
    if (!last.timedOut) break;
    console.warn(`[${tag}] sonde "${path.basename(input)}" > ${ms / 1000}s (essai ${i + 1}/${PROBE_TIMEOUTS_MS.length}) — ${loadSnapshot()}`);
  }
  const took = Date.now() - t0;
  if (last.timedOut) {
    console.error(`[${tag}] SATURATION : sonde "${path.basename(input)}" sans réponse après ${Math.round(took / 1000)}s — ${loadSnapshot()}`);
  } else if (took > SLOW_PROBE_MS) {
    console.warn(`[${tag}] sonde lente "${path.basename(input)}" ${took}ms — ${loadSnapshot()}`);
  }
  return last;
}

/** Durée (s) lue dans la ligne « Duration: hh:mm:ss.xx » — 0 si absente. */
export function parseDuration(stderr: string): number {
  const m = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
  return !m ? 0 : parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
}
