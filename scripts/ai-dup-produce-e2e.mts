// scripts/ai-dup-produce-e2e.mts
//
// TEST DE BOUT EN BOUT DE LA FABRICATION (sans Supabase ni quota) :
// vraie vidéo → analyse → plan (vrai Claude) → rendu moteur → spoofer.
// Vérifie chaque copie produite : lisible, pas plus lourde que la source,
// métadonnées iPhone présentes, et sauve une image par copie pour l'œil.
//
// Usage :
//   npx tsx scripts/ai-dup-produce-e2e.mts <video> <mode> <copies> [indications]
//   ex. npx tsx scripts/ai-dup-produce-e2e.mts "public/clip.mp4" variations 2

import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const ROOT = await fsp.mkdtemp(path.join(os.tmpdir(), "duup_aidup_prod_"));
process.env.OUT_BASE = ROOT; // avant l'import du store

const [video, mode = "variations", nStr = "2", indications = ""] = process.argv.slice(2);
if (!video) { console.error("usage : <video> <mode> <copies> [indications]"); process.exit(2); }

const { createProject, addMaterial, materialAbsPath } = await import("../src/lib/ai-editor/store");
const { analyzeMaterial } = await import("../src/lib/ai-editor/analyze");
const { analyzeForDuplication } = await import("../src/lib/ai-dup/analyze");
const { planCopies } = await import("../src/lib/ai-dup/planner");
const { produceCopy } = await import("../src/lib/ai-dup/produce");
const { summarizeCopy } = await import("../src/lib/ai-dup/summary");
const { creatorOutDir } = await import("../src/lib/creator-out-dir");
const { getFFmpegBin } = await import("../src/app/dashboard/videos/processVideos");

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`); if (!ok) failed++; };

const USER = "test-user";
const abs = path.resolve(video);
const ext = path.extname(abs).toLowerCase();
const t0 = Date.now();
const project = await createProject(USER);
const mat = await addMaterial(USER, project.id, {
  srcPath: abs, ext, name: path.basename(abs), kind: "video", desc: "",
  analysis: await analyzeMaterial(abs, ext === ".mov" ? "video/quicktime" : "video/mp4"),
});
const matPath = materialAbsPath(USER, project.id, mat.storedName);
const analysis = await analyzeForDuplication(mat, matPath);
console.log(`analyse : ${analysis.scenario} · ${analysis.width}×${analysis.height} · zones libres ${analysis.freeZones.map((z) => z.anchor).join(",") || "aucune"} (${Math.round((Date.now() - t0) / 1000)} s)`);
if (analysis.notes.length) console.log(`notes : ${analysis.notes.join(" · ")}`);

const plan = await planCopies({ analysis, request: { mode: mode as "invisible" | "variations", copies: Number(nStr), indications, replaceCaption: process.env.AIDUP_KEEP_CAPTION !== "1" }, brief: null, seed: `e2e-${Date.now()}` });
if (plan.corrections.length) console.log(`corrections : ${plan.corrections.join(" ; ")}`);

const FF = await getFFmpegBin();
const srcSize = fs.statSync(abs).size;
const shots = path.join(process.cwd(), ".ai-dup-e2e");
await fsp.mkdir(shots, { recursive: true });

for (const copy of plan.copies) {
  const t1 = Date.now();
  let out;
  try {
    out = await produceCopy({
      storeKey: USER, projectId: project.id, materialId: mat.id, materialName: mat.name, materialPath: matPath,
      analysis, copy, maxShortEdge: Infinity, onStage: (s) => console.log(`  copie ${copy.index + 1} : ${s}…`),
    });
  } catch (e) {
    check(`copie ${copy.index + 1} fabriquée`, false, (e as Error).message);
    continue;
  }
  const file = path.join(creatorOutDir(USER), out.fileName);
  let stderr = "";
  try { execFileSync(FF, ["-hide_banner", "-i", file], { stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { stderr = String((e as { stderr?: Buffer }).stderr ?? ""); }
  const size = fs.statSync(file).size;
  const res = stderr.match(/Video:.*?(\d{3,5})x(\d{3,5})/);
  // 3 images (25 / 50 / 75 % de la durée) côte à côte : un sous-titre absent
  // à un instant précis peut juste être un silence.
  const shot = path.join(shots, `${path.basename(abs, ext)}-${mode}-${copy.index + 1}.jpg`);
  const ts = [0.25, 0.5, 0.75].map((f) => (analysis.durationSec * f).toFixed(2));
  execFileSync(FF, ["-hide_banner", "-loglevel", "error", ...ts.flatMap((t) => ["-ss", t, "-i", file]),
    "-filter_complex", "[0:v]scale=300:-2[a];[1:v]scale=300:-2[b];[2:v]scale=300:-2[c];[a][b][c]hstack=3",
    "-frames:v", "1", "-y", shot]);
  const { copyToEditPlan } = await import("../src/lib/ai-dup/to-edit-plan");
  const ep = copyToEditPlan(copy, mat.id, mat.name, analysis);
  console.log(`   textes posés dans le montage : ${ep.captions?.length ?? 0} (mots transcrits : ${analysis.words?.length ?? 0})`);
  console.log(`\n── copie ${copy.index + 1} (${Math.round((Date.now() - t1) / 1000)} s) : ${summarizeCopy(copy, out.deviceLabel)}`);
  console.log(`   ${out.fileName} · ${res ? `${res[1]}×${res[2]}` : "?"} · ${(size / 1e6).toFixed(1)} Mo (source ${(srcSize / 1e6).toFixed(1)} Mo) · image : ${shot}`);
  const { verifyCopy } = await import("../src/lib/ai-dup/verify");
  const v = await verifyCopy(file, copy, analysis);
  console.log(`   vérification : ${v.ok ? "OK" : `REFUS (${v.problems.join(", ")})`} — ${v.note}`);
  check(`copie ${copy.index + 1} : vérification passée`, v.ok);
  check(`copie ${copy.index + 1} : pas plus lourde que la source`, size <= srcSize * 1.02);
  check(`copie ${copy.index + 1} : métadonnées iPhone présentes`, !!out.deviceLabel, out.deviceLabel ?? "");
  check(`copie ${copy.index + 1} : aucune trace FFmpeg/Lavf dans les métadonnées`, !/encoder\s*:\s*Lavf|encoded_by|DuupFlow/i.test(stderr.split("Stream #")[0]));
}

// AIDUP_BAD=1 : copie SABOTÉE (texte en plein visage, hors validation) →
// le regard de Claude doit la refuser. Prouve que le contrôle visuel voit.
if (process.env.AIDUP_BAD === "1" && analysis.faces.length) {
  const { callClaudeVision } = await import("../src/lib/ai-dup/verify");
  const { PRESET_BY_ID } = await import("../src/lib/ai-dup/text-presets");
  const f = analysis.faces[0];
  const p = PRESET_BY_ID.get("white-outline")!;
  const bad = {
    index: 99, texts: [{ kind: "caption" as const, text: "Regarde bien ça", preset: p.id, anchor: "middle-center" as const,
      placement: { anchor: "middle-center" as const, x: f.x + f.w / 2, y: f.y + f.h / 2, align: "center" as const, fontSize: 70, box: { x: f.x, y: f.y + f.h / 2 - 3, w: f.w, h: 6 } } }],
    visual: { cropPct: 2, cropOffsetX: 0, cropOffsetY: 0, speed: 1, color: { saturation: 1, contrast: 1, brightness: 0, temperature: 0 } },
    spoofer: { seed: "bad" },
  };
  const out = await produceCopy({ storeKey: USER, projectId: project.id, materialId: mat.id, materialName: mat.name, materialPath: matPath, analysis, copy: bad, maxShortEdge: Infinity });
  const file = path.join(creatorOutDir(USER), out.fileName);
  const t = (analysis.durationSec * 0.4).toFixed(2);
  const jpg = path.join(shots, "sabotee.jpg");
  execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-ss", t, "-i", file, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "3", "-y", jpg]);
  const v = await callClaudeVision(fs.readFileSync(jpg).toString("base64"), "Textes AJOUTÉS censés être visibles : « Regarde bien ça ».");
  console.log(`\n── copie sabotée (texte sur le visage) : ${v ? `${v.ok ? "OK" : `REFUS (${v.problems.join(", ")})`} — ${v.note}` : "contrôle impossible"} · image : ${jpg}`);
  check("copie sabotée refusée par le regard de Claude (texte sur le visage)", !!v && !v.ok && v.problems.includes("text_on_face"));
}

console.log(`\ntotal ${Math.round((Date.now() - t0) / 1000)} s`);
await fsp.rm(ROOT, { recursive: true, force: true }).catch(() => {});
console.log(failed ? `❌ ${failed} échec(s)` : "✅ tout est vert");
process.exit(failed ? 1 : 0);
