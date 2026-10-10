// Budget CPU UNIQUE pour tout le travail ffmpeg lourd du serveur.
//
// Avant : la duplication (+ compresseur) et l'Éditeur IA avaient chacun leur
// file (2 + 2), sans se voir. Aux heures de pointe les deux tournaient à fond en
// même temps sur les mêmes cœurs : les tâches COURTES (sondes ffmpeg de 1 s,
// requêtes HTTP) passaient derrière et expiraient — d'où des vidéos valides
// rejetées comme « corrompues » (incident API du 10/10/2026).
//
// Deux protections, indépendantes :
//   1. un plafond GLOBAL de travaux lourds simultanés (MAX_HEAVY_JOBS), en plus
//      du plafond propre à chaque voie (encode / render) ;
//   2. les ffmpeg lourds tournent en priorité basse (nice), donc une tâche
//      courte obtient le CPU tout de suite même quand la machine est pleine.
//
// Pas d'interblocage possible : un détenteur de créneau n'en demande jamais un
// second (render.ts n'appelle pas processVideos, et inversement).

import os from "os";
import type { ChildProcess } from "child_process";

export type Lane = "encode" | "render";

const LANE_MAX: Record<Lane, number> = {
  encode: Math.max(1, parseInt(process.env.MAX_CONCURRENT_ENCODES ?? "2", 10)),
  render: Math.max(1, parseInt(process.env.AI_EDITOR_MAX_RENDERS ?? "2", 10)),
};
// Plafond toutes voies confondues. Par défaut : la plus grande voie + 1, soit
// 3 avec les réglages par défaut (2/2), 9 en prod si MAX_CONCURRENT_ENCODES=8.
// Avant : encode + render s'additionnaient sans limite (jusqu'à 10 en prod).
// On ne bride jamais une voie en dessous de son propre plafond.
const MAX_HEAVY = Math.max(
  1,
  parseInt(process.env.MAX_HEAVY_JOBS ?? "", 10) || Math.max(LANE_MAX.encode, LANE_MAX.render) + 1,
);

const active: Record<Lane, number> = { encode: 0, render: 0 };
type Waiter = { lane: Lane; grant: () => void };
const waiters: Waiter[] = [];

const totalActive = () => active.encode + active.render;
const fits = (lane: Lane) => active[lane] < LANE_MAX[lane] && totalActive() < MAX_HEAVY;

/** Réveille, dans l'ordre d'arrivée, tous les waiters qui tiennent dans le budget. */
function pump() {
  for (let i = 0; i < waiters.length; ) {
    const w = waiters[i];
    if (fits(w.lane)) {
      waiters.splice(i, 1);
      active[w.lane]++;
      w.grant();
    } else i++;
  }
}

/**
 * Attend un créneau sur `lane`. Si `signal` s'annule PENDANT l'attente, on sort
 * de la file et on rejette "stopped" — un appelant annulé ne reçoit jamais un
 * créneau qu'il ne libérerait pas.
 */
export async function acquireHeavySlot(lane: Lane, signal?: AbortSignal): Promise<void> {
  if (waiters.length === 0 && fits(lane)) { active[lane]++; return; }
  if (signal?.aborted) throw new Error("stopped");
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      const idx = waiters.indexOf(w);
      if (idx !== -1) waiters.splice(idx, 1);
      reject(new Error("stopped"));
    };
    const w: Waiter = { lane, grant: () => { signal?.removeEventListener("abort", onAbort); resolve(); } };
    waiters.push(w);
    signal?.addEventListener("abort", onAbort, { once: true });
    pump(); // un créneau a pu se libérer entre-temps
  });
}

export function releaseHeavySlot(lane: Lane): void {
  active[lane] = Math.max(0, active[lane] - 1);
  pump();
}

export function heavyStats() {
  return {
    encode: { active: active.encode, max: LANE_MAX.encode, waiting: waiters.filter((w) => w.lane === "encode").length },
    render: { active: active.render, max: LANE_MAX.render, waiting: waiters.filter((w) => w.lane === "render").length },
    heavy: { active: totalActive(), max: MAX_HEAVY },
  };
}

/** Une ligne de contexte pour les logs : charge machine + travaux lourds en cours. */
export function loadSnapshot(): string {
  const [l1, l5] = os.loadavg();
  const s = heavyStats();
  return `load1=${l1.toFixed(1)} load5=${l5.toFixed(1)} encodes=${s.encode.active}/${s.encode.max}(+${s.encode.waiting}) renders=${s.render.active}/${s.render.max}(+${s.render.waiting})`;
}

// Priorité basse des ffmpeg lourds (0 = normal, 19 = la plus basse).
const HEAVY_NICE = Math.min(19, Math.max(0, parseInt(process.env.FFMPEG_NICE ?? "10", 10)));

/**
 * Passe un ffmpeg lourd en priorité basse juste après son lancement. Les fils
 * que ffmpeg crée ensuite héritent de cette priorité. Sans effet (et sans
 * erreur) si le système refuse.
 */
export function deprioritize(child: ChildProcess): void {
  if (!HEAVY_NICE || !child.pid) return;
  try { os.setPriority(child.pid, HEAVY_NICE); } catch { /* best-effort */ }
}

// Options qui signalent un vrai travail (décodage complet, filtres, encodage).
// Une sonde `ffmpeg -i fichier` n'en contient aucune.
const HEAVY_FLAGS = new Set(["-filter_complex", "-lavfi", "-vf", "-af", "-c:v", "-c:a", "-codec:v", "-map", "-f", "-vframes", "-frames:v"]);

/** true si cette ligne de commande ffmpeg fait du vrai travail (≠ simple sonde). */
export function isHeavyFfmpegArgs(args: string[]): boolean {
  return args.some((a) => HEAVY_FLAGS.has(a));
}
