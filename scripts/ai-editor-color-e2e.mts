// scripts/ai-editor-color-e2e.mts
//
// NON-RÉGRESSION COULEUR (HDR iPhone → SDR).
//
// ⛔ Deux défauts vus en prod le 14/08/2026, invisibles des autres harnais, et
// qui abîmaient VISIBLEMENT chaque vidéo produite (image saturée, blancs virant
// au beige, logos incrustés teintés) :
//
//   1. La conversion HDR→SDR était conditionnée à « TOUS les rushs sont HDR ».
//      Un montage mêlant un rush iPhone HLG et un rush SDR n'était donc JAMAIS
//      converti : le plan HLG entrait brut, ses couleurs BT.2020 lues comme du
//      BT.709. Or convertir un fichier et reporter des étiquettes sont deux
//      décisions INDÉPENDANTES.
//   2. Un fichier dont la ligne couleur n'est pas lisible était écarté du vote
//      « tout HDR ? ». Un projet mixte pouvait donc être déclaré tout-HDR et la
//      sortie recevoir des étiquettes HDR alors qu'elle contient des plans SDR
//      et des PNG → tout le cadre réinterprété par le lecteur.
//
//   3. La conversion HDR→SDR utilisait le pic nominal PAR DÉFAUT de ffmpeg
//      (100 nits) au lieu du pic réel du HDR (1000, BT.2100). Un gris moyen
//      (128) ressortait à 255 : image cramée, dérive de teinte. Deux mires
//      successives ont validé de mauvaises chaînes parce qu'elles étaient
//      encodées SANS `npl` explicite — donc à 100 nits, là où tout paraît juste.
//   4. Le proxy converti était mis en cache SANS marqueur de version : un proxy
//      fabriqué par une ancienne chaîne était réutilisé indéfiniment, donc
//      corriger la conversion ne changeait rien aux fichiers déjà importés.
//
// Ce harnais vérifie les DÉCISIONS (mixte détecté, conversion tentée) ET, si un
// ffmpeg avec `zscale` est présent, la FIDÉLITÉ RÉELLE des couleurs. Sans
// zscale il le dit bruyamment : c'est ce trou qui a laissé passer 2 jours de
// couleurs fausses (voir l'installation indiquée à l'exécution).
//
// Usage : npx tsx scripts/ai-editor-color-e2e.mts

import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = await fs.mkdtemp(path.join(os.tmpdir(), "duup_color_"));
process.env.OUT_BASE = ROOT;
process.env.AI_EDITOR_MAX_RENDERS = "1";

const { createProject, saveReference, addMaterial, projectPaths, materialAbsPath } = await import("../src/lib/ai-editor/store");
const { renderVariant } = await import("../src/lib/ai-editor/render");

const FF = path.join(process.cwd(), "node_modules", "@ffmpeg-installer", `${process.platform}-${process.arch}`, "ffmpeg");
const USER = "color-test";
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "duup_color_src_"));

const mk = (out: string, hdr: boolean) => execFileSync(FF, [
  "-hide_banner", "-loglevel", "error",
  "-f", "lavfi", "-t", "8", "-i", "testsrc2=s=540x960:r=30",
  "-f", "lavfi", "-t", "8", "-i", "sine=frequency=440",
  "-c:v", "libx264", "-preset", "ultrafast",
  // Étiquettes BT.2020 / HLG = ce que sort un iPhone récent.
  ...(hdr ? ["-colorspace", "bt2020nc", "-color_primaries", "bt2020", "-color_trc", "arib-std-b67"] : []),
  "-c:a", "aac", "-shortest", "-y", out,
]);

const sdr = path.join(tmp, "sdr.mp4"); mk(sdr, false);
const hdr = path.join(tmp, "hdr.mp4"); mk(hdr, true);

const project = await createProject(USER);
await saveReference(USER, project.id, {
  srcPath: sdr, ext: ".mp4", source: "file", label: "ref",
  analysis: { durationSec: 8, width: 540, height: 960, fps: 30, hasAudio: true, keyframes: [], transcript: null,
    sceneCuts: [], pacing: { cutCount: 0, avgCutSec: null }, hookText: null, shots: [],
    color: { saturation: 0, brightness: 0, warmCold: "neutral", bw: false },
    audio: { bpm: null, beats: [], energy: [], drops: [], durationSec: 8, type: "unknown" },
    comprehension: null, notes: [] } as never,
});
const mSdr = await addMaterial(USER, project.id, { srcPath: sdr, ext: ".mp4", name: "sdr.mp4", kind: "video", desc: "", analysis: null, status: "ready" });
const mHdr = await addMaterial(USER, project.id, { srcPath: hdr, ext: ".mp4", name: "hdr.mp4", kind: "video", desc: "", analysis: null, status: "ready" });
if (!mSdr || !mHdr) throw new Error("addMaterial a échoué");

// On capture les décisions annoncées par le moteur (elles SONT le contrat ici).
const logs: string[] = [];
for (const k of ["log", "warn"] as const) {
  const orig = console[k].bind(console);
  console[k] = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); orig(...a); };
}

const res = await renderVariant(USER, project.id, {
  segments: [
    { materialId: mSdr.id, startSec: 0, endSec: 2 },
    { materialId: mHdr.id, startSec: 0, endSec: 2 },
  ],
} as never);

let failed = 0;
const check = (ok: boolean, label: string, detail = "") => {
  console.log(`${ok ? "✔" : "✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

console.log("\n─── VÉRIFICATIONS ───");
check(!("error" in res), "la variante est rendue", "error" in res ? res.error.slice(0, 120) : `${res.durationSec}s`);

// 1) Un projet HDR + SDR doit être reconnu MIXTE (donc AUCUNE étiquette HDR sur
//    la sortie). Le contraire teintait tout le cadre, logos compris.
check(logs.some((l) => /matière MIXTE/.test(l)),
  "matière HDR + SDR reconnue comme MIXTE (pas d'étiquettes HDR sur la sortie)");
check(!logs.some((l) => /étiquettes de couleur préservées/.test(l)),
  "aucune étiquette HDR reportée sur un montage mixte");

// 2) Le plan HDR doit être converti — ou, à défaut de binaire capable, la
//    tentative doit être VISIBLE. Avant le correctif, rien n'était même tenté.
check(logs.some((l) => /HDR converti|proxy SDR|zscale/.test(l)),
  "conversion HDR→SDR tentée sur le plan HDR malgré la matière mixte");

// ── 3) FIDÉLITÉ RÉELLE DES COULEURS (exige un ffmpeg avec zscale) ───────────
// On part d'un GRIS MOYEN connu (le repère qui trahit une surexposition), on
// l'encode en HLG FAÇON CAMÉRA (npl=1000, comme un iPhone), on le fait traverser
// le moteur, et on vérifie qu'il ressort lui-même. Mesures du 14/08 sur cette
// mire : conversion directe → 255 (cramé) ; linéaire npl=100 + mobius → 234 ;
// linéaire npl=1000 + mobius → 128 ✔.
const hasZscale = (() => {
  try { return /\szscale\s/.test(execFileSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); }
  catch { return false; }
})();
if (!hasZscale) {
  console.log("△ fidélité des couleurs NON VÉRIFIÉE — pas de ffmpeg avec zscale ici.");
  console.log("  Installe-le : brew tap homebrew-ffmpeg/ffmpeg && brew install homebrew-ffmpeg/ffmpeg/ffmpeg --with-zimg");
  console.log("  (c'est précisément ce trou qui a laissé passer 2 jours de couleurs fausses)");
} else {
  const REF = [128, 128, 128]; // gris moyen : le repère qui trahit une surexposition
  const hlg = path.join(tmp, "iphone_hlg.mp4");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-t", "6", "-i", "color=c=0x808080:s=540x960:r=30",
    "-f", "lavfi", "-t", "6", "-i", "sine=frequency=440",
    // ⚠ `npl` explicite OBLIGATOIRE, et ÉGAL à celui de la conversion (203, le
    // blanc de référence HDR). Sans lui la mire est encodée à 100 nits et une
    // conversion FAUSSE y paraît parfaite — deux déploiements y sont passés.
    // Le réglage a été confirmé sur un VRAI export iPhone, pas sur cette mire.
    "-vf", "format=yuv420p,zscale=min=bt709:tin=bt709:pin=bt709:m=bt2020nc:t=arib-std-b67:p=bt2020:r=tv:npl=203,format=yuv420p10le",
    "-c:v", "libx265", "-crf", "18", "-tag:v", "hvc1",
    "-colorspace", "bt2020nc", "-color_primaries", "bt2020", "-color_trc", "arib-std-b67",
    "-c:a", "aac", "-shortest", "-y", hlg]);
  const mHlg = await addMaterial(USER, project.id, { srcPath: hlg, ext: ".mp4", name: "iphone.mp4", kind: "video", desc: "", analysis: null, status: "ready" });
  const r2 = await renderVariant(USER, project.id, { segments: [{ materialId: mHlg!.id, startSec: 0, endSec: 3 }] } as never);
  if ("error" in r2) {
    check(false, "rendu du plan HLG", r2.error.slice(0, 120));
  } else {
    const outFile = path.join(projectPaths(USER, project.id).variantsDir, r2.variant.storedName);
    const raw = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", "1", "-i", outFile,
      "-vf", "crop=2:2:270:480", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { encoding: "buffer", maxBuffer: 1 << 20 }) as unknown as Buffer;
    // ⛔ Un montage 100 % HDR est le cas où le code CHOISIT de reporter les
    // étiquettes de la source. Si le contenu a été converti mais reste étiqueté
    // bt2020/HLG, tout lecteur applique une SECONDE conversion sur une image qui
    // l'a déjà subie → hautes lumières écrasées deux fois + dérive de teinte.
    const tagsHlg = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
      "stream=color_space,color_primaries,color_transfer", "-of", "default=nw=1", outFile], { encoding: "utf8" });
    check(!/bt2020|arib-std-b67|smpte2084/i.test(tagsHlg),
      "sortie convertie : AUCUNE étiquette HDR résiduelle (sinon double conversion chez le lecteur)",
      tagsHlg.trim().replace(/\n/g, " · "));

    const got = [raw[0], raw[1], raw[2]];
    const ecart = Math.round(got.reduce((s, v, i) => s + Math.abs(v - REF[i]), 0) / 3);
    // Repère : la chaîne `hable` d'origine sortait à 38 ; la conversion directe à 11.
    check(ecart <= 20, "un rush HLG traverse le moteur sans dérive de couleur",
      `obtenu ${got.join("/")} pour ${REF.join("/")} — écart ${ecart} (seuil 20 ; sur un vrai iPhone la conversion directe cramait l'image)`);

    // ⛔ LE PIÈGE QUI A INVALIDÉ UN TEST DU USER : le proxy était mis en cache
    // sous `<fichier>.sdr.mp4`, sans marqueur de version. Un proxy fabriqué par
    // une ANCIENNE chaîne de conversion était donc réutilisé indéfiniment —
    // corriger les couleurs ne changeait RIEN aux fichiers déjà importés, et le
    // retest montrait exactement la même dérive. On dépose ici un vieux proxy
    // volontairement FAUX (vert vif) et on vérifie qu'il est IGNORÉ.
    const stale = materialAbsPath(USER, project.id, mHlg!.storedName).replace(/\.[^.]+$/, "") + ".sdr.mp4";
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-t", "6", "-i", "color=c=0x00FF00:s=540x960:r=30",
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-y", stale]);
    const r3 = await renderVariant(USER, project.id, { segments: [{ materialId: mHlg!.id, startSec: 0, endSec: 3 }] } as never);
    if ("error" in r3) {
      check(false, "un proxy périmé est ignoré", r3.error.slice(0, 120));
    } else {
      const f3 = path.join(projectPaths(USER, project.id).variantsDir, r3.variant.storedName);
      const raw3 = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", "1", "-i", f3,
        "-vf", "crop=2:2:270:480", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        { encoding: "buffer", maxBuffer: 1 << 20 }) as unknown as Buffer;
      const g3 = [raw3[0], raw3[1], raw3[2]];
      const e3 = Math.round(g3.reduce((s, v, i) => s + Math.abs(v - REF[i]), 0) / 3);
      check(e3 <= 20, "un proxy périmé (ancienne chaîne) est IGNORÉ, pas réutilisé",
        `obtenu ${g3.join("/")} — écart ${e3} (le proxy périmé était vert vif : s'il avait été réutilisé, l'écart exploserait)`);
    }
  }
}

await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
await fs.rm(ROOT, { recursive: true, force: true }).catch(() => {});
console.log(failed ? `\n${failed} vérification(s) EN ÉCHEC` : "\nToutes les vérifications passent ✅");
process.exitCode = failed ? 1 : 0;
