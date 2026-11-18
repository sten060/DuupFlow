// scripts/ai-dup-analyze-e2e.mts
//
// TEST DE L'ANALYSE « DUPLICATION IA EN 1 CLIC » (src/lib/ai-dup/analyze.ts).
//  1. Tests PURS (sans réseau) : grille de la zone sûre, zones libres, cas A-E.
//  2. Fichiers réels (optionnel) : analyse matière + inspection Gemini, puis
//     affiche ce que le module a compris — à relire à l'œil.
//
// Usage :
//   npx tsx scripts/ai-dup-analyze-e2e.mts                 # tests purs seuls
//   npx tsx scripts/ai-dup-analyze-e2e.mts video1.mp4 ...  # + fichiers réels

import fs from "fs/promises";
import os from "os";
import path from "path";

const ROOT = await fs.mkdtemp(path.join(os.tmpdir(), "duup_aidup_"));
process.env.OUT_BASE = ROOT; // avant l'import du store

const { safeZoneCells, computeFreeZones, pickScenario, isFaceCam, expand } = await import("../src/lib/ai-dup/analyze");
const { SAFE_ZONE, FACE_MARGIN_PCT } = await import("../src/lib/ai-dup/config");

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

/* ── 1. Tests purs ────────────────────────────────────────────────────────── */

const cells = safeZoneCells();
check("9 cases dans la zone sûre", cells.length === 9);
check("aucune case hors zone sûre", cells.every((c) =>
  c.x >= SAFE_ZONE.left - 0.1 && c.y >= SAFE_ZONE.top - 0.1 &&
  c.x + c.w <= 100 - SAFE_ZONE.right + 0.1 && c.y + c.h <= 100 - SAFE_ZONE.bottom + 0.1));

// Face cam typique : visage centré dans le tiers haut-milieu.
const face = { x: 30, y: 20, w: 40, h: 25, startSec: 0, endSec: 20 };
const free = computeFreeZones([expand(face, FACE_MARGIN_PCT)]);
check("visage centré → la case centre-haut est bloquée", !free.some((z) => z.anchor === "top-center"));
check("visage centré → le bas reste libre", free.some((z) => z.anchor === "bottom-center"));

// Caption incrustée en bas → le bas-centre est bloqué.
const capZone = expand({ x: 10, y: 60, w: 70, h: 8 }, 3);
const freeCap = computeFreeZones([capZone]);
check("caption en bas → aucune zone ne la touche", freeCap.every((z) => !(z.x < capZone.x + capZone.w && capZone.x < z.x + z.w && z.y < capZone.y + capZone.h && capZone.y < z.y + z.h)));
const underCap = freeCap.find((z) => z.anchor === "bottom-center");
check("caption en bas → la bande SOUS la caption reste utilisable", !!underCap && underCap.y >= 71 - 0.01, JSON.stringify(underCap));

check("rien de protégé → 9 zones libres", computeFreeZones([]).length === 9);

// Cas réel (rush selfie 1.MOV, boîtes Gemini vérifiées à l'œil le 15/11) :
// gros plan visage → seule la bande AU-DESSUS de la tête est libre.
const selfie = [
  { x: 23, y: 27.6, w: 53.4, h: 39.6 }, { x: 24, y: 28.7, w: 53, h: 42.8 }, { x: 25.2, y: 41.5, w: 51.8, h: 42 },
].map((f) => expand(f, FACE_MARGIN_PCT));
const freeSelfie = computeFreeZones(selfie);
const topC = freeSelfie.find((z) => z.anchor === "top-center");
check("selfie → bande libre au-dessus de la tête", !!topC && topC.y === SAFE_ZONE.top && topC.y + topC.h <= 22.7, JSON.stringify(topC));
check("selfie → rien au milieu ni en bas", freeSelfie.every((z) => z.anchor.startsWith("top-")), freeSelfie.map((z) => z.anchor).join(","));
check("aucune zone libre ne touche un visage", freeSelfie.every((z) => !selfie.some((p) => z.x < p.x + p.w && p.x < z.x + z.w && z.y < p.y + p.h && p.y < z.y + z.h)));

// Bande libre sur le torse : visage qui s'arrête à 60 % → bas-centre libre sous le menton.
const freeChest = computeFreeZones([expand({ x: 25, y: 25, w: 50, h: 35 }, FACE_MARGIN_PCT)]);
const botC = freeChest.find((z) => z.anchor === "bottom-center");
check("bande sous le menton conservée", !!botC && botC.y >= 65 - 0.01, JSON.stringify(botC));

check("face cam détectée", isFaceCam([face], 20));
check("petit visage ≠ face cam", !isFaceCam([{ x: 45, y: 40, w: 5, h: 5, startSec: 0, endSec: 20 }], 20));
check("visage bref ≠ face cam", !isFaceCam([{ ...face, endSec: 4 }], 20));

const base = { durationSec: 20, hasVoice: false, faceCam: false, burnedCaption: false, existingSubtitles: false };
check("cas A", pickScenario(base) === "A_no_text");
check("cas B", pickScenario({ ...base, burnedCaption: true }) === "B_burned_caption");
check("cas C", pickScenario({ ...base, faceCam: true, hasVoice: true }) === "C_facecam_talk");
check("cas D", pickScenario({ ...base, faceCam: true, hasVoice: true, burnedCaption: true }) === "D_facecam_caption");
check("cas E prioritaire", pickScenario({ ...base, durationSec: 4, faceCam: true, hasVoice: true }) === "E_short");
check("face cam muette → pas de sous-titres (A)", pickScenario({ ...base, faceCam: true }) === "A_no_text");
check("sous-titres existants → pas de nouveaux (B)", pickScenario({ ...base, faceCam: true, hasVoice: true, existingSubtitles: true }) === "B_burned_caption");

/* ── 2. Fichiers réels ────────────────────────────────────────────────────── */

const files = process.argv.slice(2);
if (files.length) {
  const { createProject, addMaterial, materialAbsPath } = await import("../src/lib/ai-editor/store");
  const { analyzeMaterial } = await import("../src/lib/ai-editor/analyze");
  const { analyzeForDuplication } = await import("../src/lib/ai-dup/analyze");
  const USER = "test-user";
  const project = await createProject(USER);
  for (const f of files) {
    const abs = path.resolve(f);
    const t0 = Date.now();
    console.log(`\n── ${path.basename(abs)} ──`);
    const ext = path.extname(abs).toLowerCase();
    const analysis = await analyzeMaterial(abs, ext === ".mov" ? "video/quicktime" : "video/mp4");
    const mat = await addMaterial(USER, project.id, { srcPath: abs, ext, name: path.basename(abs), kind: "video", desc: "", analysis });
    const a = await analyzeForDuplication(mat, materialAbsPath(USER, project.id, mat.storedName));
    console.log(JSON.stringify({ ...a, words: a.words ? `${a.words.length} mots` : undefined }, null, 2));
    console.log(`(${Math.round((Date.now() - t0) / 1000)} s)`);
  }
}

await fs.rm(ROOT, { recursive: true, force: true }).catch(() => {});
console.log(failed ? `\n❌ ${failed} échec(s)` : "\n✅ tout est vert");
process.exit(failed ? 1 : 0);
