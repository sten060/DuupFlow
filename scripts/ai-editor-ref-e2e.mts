// scripts/ai-editor-ref-e2e.mts
//
// TEST DE BOUT EN BOUT de l'analyse de référence (voir src/lib/ai-editor/ANALYSE-REF.md).
// Fabrique une FAUSSE RÉF synthétique (2 plans + 2 captions incrustées avec le
// moteur de rendu réel) puis la passe dans la chaîne d'analyse COMPLÈTE
// (analyzeReferenceVideo : probe, coupes, keyframes, plans, couleur, audio,
// silences, transcript, compréhension Gemini) et imprime ce qui en sort.
//
// Usage (clés lues automatiquement dans .env.local si absentes de l'env) :
//   npx tsx scripts/ai-editor-ref-e2e.mts
//
// Ce qu'on doit voir passer :
//   · keyframes = milieux de plans (pas les coupes)
//   · CAPTIONS détectées avec texte/position/style (sinon → notes explicites)
//   · le modèle Gemini choisi par la cascade (log [ai-editor/gemini])
//
// À METTRE À JOUR si la chaîne d'analyse change (nouveau champ, nouvelle étape).

import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

// ── Clés : env d'abord, sinon .env.local (script de dev uniquement) ──────────
for (const k of ["GEMINI_API_KEY", "DEEPGRAM_API_KEY", "GROQ_API_KEY"]) {
  if (!process.env[k]) {
    try {
      const env = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");
      const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
      if (m) process.env[k] = m[1].trim().replace(/^["']|["']$/g, "");
    } catch { /* pas de .env.local */ }
  }
}

const { captionPng } = await import("../src/lib/ai-editor/render");
const { analyzeReferenceVideo } = await import("../src/lib/ai-editor/analyze");

const FF = path.join(process.cwd(), "node_modules", "@ffmpeg-installer", `${process.platform}-${process.arch}`, "ffmpeg");
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_e2e_"));

// 1) Deux captions rendues par le VRAI moteur (spans multicolores + emphase).
const cap1 = path.join(dir, "cap1.png");
await captionPng({
  text: "", startSec: 0, endSec: 3, y: 20, textTransform: "uppercase", style: "outline", fontSize: 72, font: "rounded",
  spans: [{ text: "TO THE" }, { text: "LOWER", color: "#2ecc40" }, { text: "LEVELS", color: "#ffdc00" }],
} as never, 1080, 1920, cap1, "3d");
const cap2 = path.join(dir, "cap2.png");
await captionPng({
  text: "", startSec: 0, endSec: 3, y: 50, fontSize: 60, font: "sans", style: "outline",
  spans: [{ text: "to have this" }, { text: "SINK IN", fontSize: 96, color: "#ffd7e8" }],
} as never, 1080, 1920, cap2, "3d");

// 2) Fausse réf : 2 plans (fond animé puis carte sombre), captions incrustées, son.
const ref = path.join(dir, "fake-ref.mp4");
execFileSync(FF, [
  "-hide_banner", "-loglevel", "error",
  "-f", "lavfi", "-t", "3", "-i", "testsrc2=s=540x960:r=30",
  "-f", "lavfi", "-t", "3", "-i", "color=c=#1a2a4a:s=540x960:r=30",
  "-f", "lavfi", "-t", "6", "-i", "sine=frequency=330",
  "-i", cap1, "-i", cap2,
  "-filter_complex",
  "[0:v][1:v]concat=n=2:v=1:a=0[bg];[3:v]scale=540:960[c1];[4:v]scale=540:960[c2];" +
  "[bg][c1]overlay=0:0:enable='between(t,0.3,2.8)'[v1];[v1][c2]overlay=0:0:enable='between(t,3.2,5.8)'[v]",
  "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
  "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-y", ref,
]);
console.log("✔ fausse réf générée :", ref);

// 3) Chaîne d'analyse COMPLÈTE (celle de l'upload d'une réf).
const a = await analyzeReferenceVideo(ref);

// 4) Rapport.
console.log("\n─── RÉSULTAT ───");
console.log(`durée ${a.durationSec.toFixed(1)}s · ${a.width}×${a.height} · coupes: [${a.sceneCuts.join(", ")}]`);
console.log(`keyframes (${a.keyframes.length}) aux t =`, a.keyframes.map((k) => k.t).join(", "), "(attendu : milieux de plans, pas les coupes)");
console.log(`plans mesurés: ${a.shots.length} · audio: ${a.audio.type} · silences: ${a.audio.silences?.length ?? "absent"}`);
if (a.notes.length) console.log("notes:", a.notes.join(" | "));
if (!a.comprehension) {
  console.log("✖ COMPRÉHENSION ABSENTE — vérifier GEMINI_API_KEY / réseau (les notes ci-dessus disent pourquoi)");
  process.exitCode = 1;
} else {
  console.log(`✔ compréhension via ${a.comprehension.model} · ${a.comprehension.captions.length} caption(s) :`);
  for (const c of a.comprehension.captions) {
    console.log(`   « ${c.text} » [${c.startSec}–${c.endSec}s] font=${c.font} weight=${c.fontWeight} color=${c.color} y=${c.yPct}%` +
      `${c.emphasisText ? ` ⭐ emphase « ${c.emphasisText} » ×${c.emphasisMul}` : ""}`);
  }
  const okCount = a.comprehension.captions.length >= 2;
  const okEmph = a.comprehension.captions.some((c) => c.emphasisText && c.emphasisMul > 1.15);
  console.log(`\n${okCount ? "✔" : "✖"} ≥ 2 captions détectées · ${okEmph ? "✔" : "△"} emphase deux-tailles repérée (SINK IN)`);
  if (!okCount) process.exitCode = 1;
}
await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
