// scripts/text-overlay-e2e.mts
//
// TEST DES TEXTES SUR LES DUPLICATIONS (mode Simple, BETA) : vraie vidéo →
// processVideos avec un réglage `textOverlay` → images de contrôle par copie.
// Usage : npx tsx scripts/text-overlay-e2e.mts <video> [copies]

import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const [video, nStr = "2"] = process.argv.slice(2);
const outDir = await fsp.mkdtemp(path.join(os.tmpdir(), "duup_txt_e2e_"));
const tmpIn = path.join(outDir, `src${path.extname(video)}`);
await fsp.copyFile(video, tmpIn);

const { processVideos } = await import("../src/app/dashboard/videos/processVideos");
const style = process.env.SUB_STYLES?.split(",") ?? ["karaoke", "word", "native", "classic"];
const cfg = {
  caption: { enabled: true, text: process.env.CAP_TEXT ?? "POV : tu découvres enfin la méthode", duration: process.env.CAP_FROM ? "range" : "start", seconds: 6, from: Number(process.env.CAP_FROM) || 0, to: process.env.CAP_TO ? Number(process.env.CAP_TO) : null, vary: true,
    fonts: ["sans", "rounded"], bgs: ["lines", "rounded"], textColors: ["#111111"], bgColors: ["#FFFFFF", "#FFD60A"], positions: ["top"], place: process.env.CAP_PLACE ? JSON.parse(process.env.CAP_PLACE) : null, size: Number(process.env.CAP_SIZE) || 58 },
  subtitles: { enabled: true, vary: true, styles: style, fonts: ["black", "sans"], textColors: ["#FFFFFF"],
    accentColors: ["#FFD60A", "#22C55E"], positions: ["bottom"], place: process.env.SUB_PLACE ? JSON.parse(process.env.SUB_PLACE) : null },
};
const fd = new FormData();
fd.append("channel", "simple"); fd.append("mode", "simple"); fd.append("count", nStr);
fd.append("packs", "metadata,metadata_technical"); fd.append("singles", "{}");
fd.append("textOverlay", JSON.stringify(cfg));
const t0 = Date.now();
const out = await processVideos(fd, async (p, m) => { if (p % 25 === 0) console.log(`  ${p} % ${m}`); }, outDir, [{ name: path.basename(video), tmpPath: tmpIn }]);
console.log(`${out.outputPaths.length} copie(s) en ${Math.round((Date.now() - t0) / 1000)} s ; rejets : ${out.rejectedFiles.join(", ") || "aucun"}`);
const shots = path.join(process.cwd(), ".ai-dup-e2e");
for (const [i, f] of out.outputPaths.entries()) {
  const jpg = path.join(shots, `texte-copie-${i + 1}.jpg`);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", "2.3", "-i", f, "-ss", "8.4", "-i", f,
    "-filter_complex", "[0:v]scale=320:-2[a];[1:v]scale=320:-2[b];[a][b]hstack=2", "-frames:v", "1", "-y", jpg]);
  console.log(`copie ${i + 1} : ${path.basename(f)} · images à 2 s et 8 s : ${jpg}`);
}
await fsp.rm(outDir, { recursive: true, force: true });
