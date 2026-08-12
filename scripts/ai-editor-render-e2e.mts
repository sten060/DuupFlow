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
import { execFileSync } from "child_process";

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

type Case = { name: string; plan: Record<string, unknown>; expect: number; tol: number };
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
    name: "20 micro-plans contigus (montage rythmé)",
    plan: { segments: Array.from({ length: 20 }, (_, i) => ({ materialId: MID, startSec: i * 1, endSec: i * 1 + 0.9 })) },
    expect: 18, tol: 0.8,
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
    // Le cas EXACT signalé en prod : rush de 50 s découpé en ~39 micro-plans
    // contigus (nettoyage). Attendu ≈ la somme des (endSec − startSec).
    name: "39 micro-plans contigus (cas prod Branding.MP4)",
    plan: { segments: Array.from({ length: 39 }, (_, i) => ({ materialId: MID, startSec: i * 0.6, endSec: i * 0.6 + 0.5 })) },
    expect: 19.5, tol: 1,
  },
];

let failed = 0;
for (const c of CASES) {
  const res = await renderVariant(USER, project.id, c.plan as never);
  if ("error" in res) {
    console.log(`✖ ${c.name}\n    ERREUR : ${res.error}`);
    failed++;
    continue;
  }
  const ok = Math.abs(res.durationSec - c.expect) <= c.tol;
  console.log(`${ok ? "✔" : "✖"} ${c.name} — attendu ~${c.expect}s, obtenu ${res.durationSec}s`);
  if (!ok) failed++;
}

await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
await fs.rm(ROOT, { recursive: true, force: true }).catch(() => {});
console.log(failed ? `\n${failed} cas EN ÉCHEC` : "\nTous les cas passent ✅");
process.exitCode = failed ? 1 : 0;
void projectPaths;
