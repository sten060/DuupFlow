// scripts/ai-editor-render-e2e.mts
//
// TEST DE NON-RÉGRESSION DU MOTEUR DE RENDU (ffmpeg réel, projet réel).
// Monte un projet jetable (OUT_BASE temporaire), y injecte un rush synthétique,
// puis appelle le VRAI renderVariant sur des plans de montage typiques et
// VÉRIFIE LA DURÉE OBTENUE. C'est le garde-fou qui manquait : le correctif de
// mutualisation des décodeurs (B1) a cassé le découpage sans être détecté.
//
// Usage :
//   npx tsx scripts/ai-editor-render-e2e.mts
//
// À LANCER AVANT CHAQUE DÉPLOIEMENT touchant render.ts, et à enrichir d'un cas
// à chaque régression trouvée en prod (le cas devient permanent).

import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";

// OUT_BASE doit être posé AVANT l'import du store (lu au chargement du module).
const ROOT = await fs.mkdtemp(path.join(os.tmpdir(), "duup_rtest_"));
process.env.OUT_BASE = ROOT;
process.env.AI_EDITOR_MAX_RENDERS = "1";

const { createProject, saveReference, addMaterial, projectPaths } = await import("../src/lib/ai-editor/store");
const { renderVariant } = await import("../src/lib/ai-editor/render");

const FF = path.join(process.cwd(), "node_modules", "@ffmpeg-installer", `${process.platform}-${process.arch}`, "ffmpeg");
const USER = "test-user";
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "duup_rsrc_"));

// Rush synthétique 25 s (vidéo + son), assez long pour des coupes espacées.
const rush = path.join(tmp, "rush.mp4");
execFileSync(FF, ["-hide_banner", "-loglevel", "error",
  "-f", "lavfi", "-t", "25", "-i", "testsrc2=s=540x960:r=30",
  "-f", "lavfi", "-t", "25", "-i", "sine=frequency=440",
  "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", "-y", rush]);

const project = await createProject(USER);
await saveReference(USER, project.id, {
  srcPath: rush, ext: ".mp4", source: "file", label: "ref-test",
  analysis: { durationSec: 25, width: 540, height: 960, fps: 30, hasAudio: true, keyframes: [], transcript: null,
    sceneCuts: [], pacing: { cutCount: 0, avgCutSec: null }, hookText: null, shots: [],
    color: { saturation: 0, brightness: 0, warmCold: "neutral", bw: false },
    audio: { bpm: null, beats: [], energy: [], drops: [], durationSec: 25, type: "unknown" },
    comprehension: null, notes: [] } as never,
});
const mat = await addMaterial(USER, project.id, { srcPath: rush, ext: ".mp4", name: "rush.mp4", kind: "video", desc: "", analysis: null, status: "ready" });
if (!mat) throw new Error("addMaterial a échoué");
const MID = mat.id;

// Matière SONORE synthétique, une fréquence par rôle → mesurable séparément
// (le rush porte 440 Hz) : musique 220 Hz, voix 1500 Hz, clic = bruit bref.
const mkAudio = async (name: string, lavfi: string, dur: number) => {
  const f = path.join(tmp, name);
  execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-t", String(dur), "-i", lavfi, "-c:a", "aac", "-y", f]);
  const m = await addMaterial(USER, project.id, { srcPath: f, ext: ".m4a", name, kind: "audio", desc: "", analysis: null, status: "ready" });
  if (!m) throw new Error(`addMaterial ${name} a échoué`);
  return m.id;
};
const MUSIC = await mkAudio("music.m4a", "sine=frequency=220", 20);
const VOICE = await mkAudio("voice.m4a", "sine=frequency=1500", 10);
const CLICK = await mkAudio("click.m4a", "anoisesrc=d=0.15:a=0.8", 0.15);

/** Niveau moyen (dB) d'une BANDE de fréquence sur une fenêtre du rendu. */
const bandDbSync = (file: string, from: number, to: number, freq: number): number => {
  const r = spawnSync(FF, ["-hide_banner", "-ss", from.toFixed(2), "-t", (to - from).toFixed(2), "-i", file,
    // Filtre passe-bande ×4 : un seul étage laisse fuir les pistes voisines
    // (220 Hz mesuré à −40 dB dans la bande 440 Hz) et fausse le « silence ».
    "-af", `${Array(4).fill(`bandpass=f=${freq}:width_type=q:w=6`).join(",")},volumedetect`, "-f", "null", "-"], { encoding: "utf8" });
  const m = (r.stderr || "").match(/mean_volume:\s*(-?[\d.]+|-inf) dB/);
  return m ? (m[1] === "-inf" ? -120 : parseFloat(m[1])) : NaN;
};

type Case = {
  name: string; plan: Record<string, unknown>; expect?: number; tol?: number; expectError?: RegExp; env?: Record<string, string>;
  /** Vérifie le CONTENU du rendu (pas seulement sa durée) ; renvoie un message d'échec ou null. */
  check?: (file: string, notes: string[]) => string | null;
};
const LOUD = -45, SILENT = -60; // dB moyens dans la bande : présent / absent
const CASES: Case[] = [
  {
    // ⛔ RÉGRESSION 2026-08-12 : avec 2+ segments du MÊME fichier (décodeur
    // mutualisé), la durée valait endSec au lieu de endSec−startSec → 36 s au
    // lieu de 6 s (Σ des endSec). Cas signalé en prod, doit rester vert.
    name: "3 plans espacés du même rush (décodeur mutualisé)",
    plan: { segments: [
      { materialId: MID, startSec: 0, endSec: 2 },
      { materialId: MID, startSec: 10, endSec: 12 },
      { materialId: MID, startSec: 20, endSec: 22 },
    ] },
    expect: 6, tol: 0.4,
  },
  {
    name: "1 seul plan (chemin non mutualisé)",
    plan: { segments: [{ materialId: MID, startSec: 10, endSec: 12 }] },
    expect: 2, tol: 0.3,
  },
  {
    // Cas « montage rythmé » : le nettoyage de rush produit des dizaines de
    // micro-plans contigus du même fichier — c'est CE cas qui a explosé en prod.
    name: "18 micro-plans contigus (montage rythmé, sous le plafond)",
    plan: { segments: Array.from({ length: 18 }, (_, i) => ({ materialId: MID, startSec: i * 1, endSec: i * 1 + 0.9 })) },
    expect: 16.2, tol: 0.8,
  },
  {
    name: "plans + captions (passes de sous-titres)",
    plan: {
      segments: [{ materialId: MID, startSec: 0, endSec: 3 }, { materialId: MID, startSec: 8, endSec: 11 }],
      captions: [
        { text: "premier", startSec: 0.2, endSec: 2.5, animation: "wordByWord" },
        { spans: [{ text: "mot" }, { text: "CLÉ", color: "#ffdc00", fontSize: 96 }], startSec: 3.2, endSec: 5.5, strokeColor: "none" },
      ],
    },
    expect: 6, tol: 0.5,
  },
  {
    name: "vitesse (pré-rendu retimé) + plan simple",
    plan: { segments: [
      { materialId: MID, startSec: 0, endSec: 4, speed: 2 },
      { materialId: MID, startSec: 10, endSec: 12 },
    ] },
    expect: 4, tol: 0.5, // 4 s à 2× = 2 s, + 2 s
  },
  {
    // Mélange des 3 chemins sur le MÊME fichier : mutualisé (×3), pré-rendu
    // retimé, et composité (b-roll). C'est la forme d'un vrai montage nettoyé —
    // et le cas où le compteur de branches split peut désynchroniser.
    name: "mutualisé + vitesse + overlay b-roll (même fichier)",
    plan: { segments: [
      { materialId: MID, startSec: 0, endSec: 2 },
      { materialId: MID, startSec: 5, endSec: 7, speed: 2 },                   // → 1 s
      { materialId: MID, startSec: 10, endSec: 12 },
      { materialId: MID, startSec: 15, endSec: 17,
        overlays: [{ materialId: MID, x: 0, y: 0, width: 100, height: 100, sourceStartSec: 3, startSec: 0.3, endSec: 1.8 }] },
      { materialId: MID, startSec: 20, endSec: 22 },
    ] },
    expect: 9, tol: 0.8, // 2 + 1 + 2 + 2 + 2
  },
  {
    // ⛔ RÉGRESSION PROD 2026-08-13 : la prod tournait sur ffmpeg 4.1, où `xfade`
    // n'existe pas → TOUTES les transitions retombaient silencieusement en coupe
    // sèche (« No such filter: xfade » dans les logs). Ce cas échoue si le moteur
    // sélectionné est trop ancien : la durée doit être RACCOURCIE par les fondus.
    name: "transitions (fondu/slide) — exige un moteur récent",
    plan: { segments: [
      { materialId: MID, startSec: 0, endSec: 3 },
      { materialId: MID, startSec: 5, endSec: 8, transition: "fade", transitionDuration: 0.4 },
      { materialId: MID, startSec: 10, endSec: 13, transition: "slide", transitionDuration: 0.4 },
    ] },
    expect: 8.2, tol: 0.5, // 9 s − 2 × 0,4 s de recouvrement
  },
  {
    // ⛔ RÉGRESSION PROD 2026-08-14 : le cas « transitions » ci-dessus ne mettait
    // QUE des fondus — or un vrai montage MÉLANGE cuts et transitions. Le cut passe
    // par un concat, qui déclare sa cadence de sortie inconnue (1/0), et le xfade
    // suivant refuse (« constant frame rate; current rate of 1/0 is invalid »).
    // Résultat en prod : AUCUNE transition, et un réencodage de repli à chaque
    // rendu. Le harnais était vert parce qu'il ne testait pas le mélange.
    name: "transitions MÉLANGÉES avec des cuts (concat → xfade)",
    plan: { segments: [
      { materialId: MID, startSec: 0, endSec: 3 },
      { materialId: MID, startSec: 5, endSec: 8, transition: "cut" },
      { materialId: MID, startSec: 10, endSec: 13, transition: "fade", transitionDuration: 0.4 },
      { materialId: MID, startSec: 15, endSec: 18, transition: "cut" },
      { materialId: MID, startSec: 20, endSec: 23, transition: "slide", transitionDuration: 0.4 },
    ] },
    expect: 14.2, tol: 0.5, // 15 s − 2 × 0,4 s de recouvrement
  },
  {
    // AUDIO MULTIPISTE : musique dès 0 s (duckée), voix off qui démarre APRÈS le
    // hook (atSec 2), clic ponctuel. Plans muets → le lit est silencieux, chaque
    // bande mesure UNE piste. On vérifie la PLACE de chaque son, pas sa présence.
    name: "audio multipiste : voix décalée + musique duckée + sfx",
    plan: {
      segments: [{ materialId: MID, startSec: 0, endSec: 7, mute: true }],
      audioTracks: [
        { materialId: MUSIC, volume: 0.6, duck: { reduction: 20, attack: 0.02, release: 0.2 } },
        { materialId: VOICE, atSec: 2, endSec: 4, role: "voice" },
        { materialId: CLICK, atSec: 5.5, role: "sfx" },
      ],
    },
    expect: 7, tol: 0.4,
    check: (f) => {
      const v0 = bandDbSync(f, 0.3, 1.7, 1500), v1 = bandDbSync(f, 2.3, 3.7, 1500), v2 = bandDbSync(f, 4.5, 5.3, 1500);
      const m0 = bandDbSync(f, 0.3, 1.7, 220), m1 = bandDbSync(f, 2.5, 3.7, 220);
      if (!(v0 < SILENT && v1 > LOUD && v2 < SILENT)) return `voix mal placée (bande 1500 Hz : avant ${v0} / pendant ${v1} / après ${v2} dB — attendu silence/son/silence)`;
      if (!(m0 > LOUD)) return `musique absente au début (${m0} dB)`;
      if (!(m0 - m1 > 8)) return `ducking trop faible (20 dB demandés) : musique ${m0} dB seule vs ${m1} dB sous la voix`;
      return null;
    },
  },
  {
    // Ducking piloté par le SON DES PLANS (cas historique) : plan 1 muet, plan 2
    // parlant → la musique doit baisser sur le plan 2 seulement. Avec une
    // transition → passe par le rendu en DEUX PASSES (vidéo / audio séparés).
    name: "ducking par le son des plans + transition (rendu 2 passes)",
    plan: {
      segments: [
        { materialId: MID, startSec: 0, endSec: 3, mute: true },
        { materialId: MID, startSec: 5, endSec: 8, transition: "fade", transitionDuration: 0.3 },
      ],
      audioTracks: [{ materialId: MUSIC, volume: 0.6, duck: true, fadeIn: 0.2 }],
    },
    expect: 5.7, tol: 0.4,
    check: (f) => {
      const a = bandDbSync(f, 0.5, 2.3, 220), b = bandDbSync(f, 3.6, 5.4, 220);
      return a - b > 6 ? null : `musique ${a} dB sur le plan muet vs ${b} dB sur le plan parlant — attendu une baisse ≥ 6 dB`;
    },
  },
  {
    // replace = coupe le son des plans SUR LA FENÊTRE de la piste seulement : le
    // hook parlé (avant) et la suite (après) gardent leur son.
    name: "audio replace sur fenêtre (le son des plans revient après)",
    plan: {
      segments: [{ materialId: MID, startSec: 0, endSec: 6 }],
      audioTracks: [{ materialId: VOICE, atSec: 2, endSec: 4, mode: "replace" }],
    },
    expect: 6, tol: 0.4,
    check: (f) => {
      const a = bandDbSync(f, 0.3, 1.7, 440), b = bandDbSync(f, 2.3, 3.7, 440), c = bandDbSync(f, 4.3, 5.7, 440);
      return a > LOUD && b < SILENT && c > LOUD ? null : `son des plans (440 Hz) : avant ${a} / pendant ${b} / après ${c} dB — attendu son/silence/son`;
    },
  },
  {
    // Rétro-compat : l'ancien champ `audio` (1 piste, replace intégral) doit
    // continuer de remplacer TOUT le son des plans.
    name: "audio historique (champ `audio`, replace intégral)",
    plan: {
      segments: [{ materialId: MID, startSec: 0, endSec: 5 }],
      audio: { materialId: MUSIC, mode: "replace" },
    },
    expect: 5, tol: 0.4,
    check: (f) => {
      const bed = bandDbSync(f, 0.05, 4.9, 440), mus = bandDbSync(f, 0.3, 4.5, 220);
      return bed < SILENT && mus > LOUD ? null : `replace intégral : plans ${bed} dB (attendu muet), musique ${mus} dB`;
    },
  },
  {
    // Une piste inexploitable ne casse pas le rendu, elle est SIGNALÉE.
    name: "piste audio invalide → signalée, rendu conservé",
    plan: {
      segments: [{ materialId: MID, startSec: 0, endSec: 3 }],
      audioTracks: [{ materialId: "nexistepas", atSec: 1 }, { materialId: MUSIC, atSec: 50 }],
    },
    expect: 3, tol: 0.4,
    check: (_f, notes) => notes.length === 2 ? null : `2 avertissements attendus, obtenu ${notes.length} : ${notes.join(" | ")}`,
  },
  {
    // ⛔ RÉGRESSION PROD 2026-08-12 : au-delà du plafond d'entrées, on doit
    // REFUSER proprement (message actionnable) et jamais produire un montage
    // faux — le chemin mutualisé rendait ×9 à ×20 la durée prévue.
    name: "39 micro-plans → refus explicite (plafond d'entrées)",
    plan: { segments: Array.from({ length: 39 }, (_, i) => ({ materialId: MID, startSec: i * 0.6, endSec: i * 0.6 + 0.5 })) },
    expectError: /Trop de plans/,
  },
  {
    // Le chemin mutualisé reste testable pour investigation (env), il ne doit
    // pas régresser en local pendant qu'on cherche la divergence prod.
    name: "mutualisation forcée (investigation) — 16 plans",
    env: { AI_EDITOR_SHARE_FROM: "2" },
    plan: { segments: Array.from({ length: 16 }, (_, i) => ({ materialId: MID, startSec: i * 1.2, endSec: i * 1.2 + 1 })) },
    expect: 16, tol: 0.8,
  },
];

let failed = 0;
for (const c of CASES) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(c.env ?? {})) { saved[k] = process.env[k]; process.env[k] = v; }
  const res = await renderVariant(USER, project.id, c.plan as never);
  for (const [k] of Object.entries(c.env ?? {})) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }

  if (c.expectError) {
    const ok = "error" in res && c.expectError.test(res.error);
    console.log(`${ok ? "✔" : "✖"} ${c.name} — ${"error" in res ? `refus : ${res.error.slice(0, 90)}…` : `RENDU alors qu'un refus était attendu (${res.durationSec}s)`}`);
    if (!ok) failed++;
    continue;
  }
  if ("error" in res) {
    console.log(`✖ ${c.name}\n    ERREUR : ${res.error}`);
    failed++;
    continue;
  }
  let ok = Math.abs(res.durationSec - (c.expect ?? 0)) <= (c.tol ?? 0.5);
  let why = "";
  if (ok && c.check) {
    const file = path.join(projectPaths(USER, project.id).variantsDir, res.variant.storedName);
    const err = c.check(file, res.notes ?? []);
    if (err) { ok = false; why = `\n    CONTENU : ${err}`; }
  }
  console.log(`${ok ? "✔" : "✖"} ${c.name} — attendu ~${c.expect}s, obtenu ${res.durationSec}s${why}`);
  if (!ok) failed++;
}

await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
await fs.rm(ROOT, { recursive: true, force: true }).catch(() => {});
console.log(failed ? `\n${failed} cas EN ÉCHEC` : "\nTous les cas passent ✅");
process.exitCode = failed ? 1 : 0;
void projectPaths;
