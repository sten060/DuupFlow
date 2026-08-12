// scripts/install-fonts.mjs
//
// Copie dans public/fonts/ les fichiers de police correspondant au manifeste
// (src/lib/ai-editor/font-catalog.ts), depuis les dossiers Google Fonts placés
// dans fonts/.
//
//   node scripts/install-fonts.mjs
//
// Règles de sélection, par famille :
//   · on garde le fichier VARIABLE s'il existe (une seule fonte = toutes les
//     graisses) ;
//   · ET toutes les graisses STATIQUES non-italiques dont le nom de FAMILLE
//     RÉEL (lu dans le fichier) correspond exactement à celui du manifeste.
//     C'est ce qui évite le piège des « Inter 24pt » / « Fredoka Condensed » :
//     même dossier, mais autre famille → fontconfig ne les associerait pas.
//   · les italiques sont ignorées (le moteur simule l'italique).
//
// Le manifeste fait foi : ajouter une police = ajouter une ligne au catalogue
// + déposer son dossier dans fonts/, puis relancer ce script.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "fonts");
const OUT_DIR = path.join(ROOT, "public", "fonts");

/* ── Nom de FAMILLE réel d'un .ttf (table `name`, id 16 sinon id 1) ───────── */
function familyOf(file) {
  const b = fs.readFileSync(file);
  const numTables = b.readUInt16BE(4);
  let nameOff = 0;
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    if (b.toString("latin1", o, o + 4) === "name") { nameOff = b.readUInt32BE(o + 8); break; }
  }
  if (!nameOff) return null;
  const count = b.readUInt16BE(nameOff + 2);
  const strOff = nameOff + b.readUInt16BE(nameOff + 4);
  const found = {};
  for (let i = 0; i < count; i++) {
    const r = nameOff + 6 + i * 12;
    const platformId = b.readUInt16BE(r);
    const nameId = b.readUInt16BE(r + 6);
    if (nameId !== 1 && nameId !== 16) continue;
    const len = b.readUInt16BE(r + 8);
    const off = b.readUInt16BE(r + 10);
    const raw = b.subarray(strOff + off, strOff + off + len);
    // Plateforme 3 (Windows) = UTF-16BE ; sinon Mac Roman ≈ latin1.
    const val = platformId === 3 ? Buffer.from(raw).swap16().toString("utf16le") : raw.toString("latin1");
    found[nameId] = val.replace(/\0/g, "").trim();
  }
  return found[16] || found[1] || null;
}

/* ── Manifeste : lu DEPUIS le catalogue TypeScript (source unique) ────────── */
function readCatalog() {
  const ts = fs.readFileSync(path.join(ROOT, "src", "lib", "ai-editor", "font-catalog.ts"), "utf8");
  const body = ts.slice(ts.indexOf("export const FONT_CATALOG"), ts.indexOf("} as const;"));
  const out = [];
  for (const m of body.matchAll(/(\w+):\s*\{\s*family:\s*"([^"]+)",\s*dir:\s*"([^"]+)"/g)) {
    out.push({ key: m[1], family: m[2], dir: m[3] });
  }
  return out;
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ttf|otf)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const catalog = readCatalog();
if (!catalog.length) { console.error("Catalogue illisible — abandon."); process.exit(1); }
fs.mkdirSync(OUT_DIR, { recursive: true });

let copied = 0;
const report = [];
for (const { key, family, dir } of catalog) {
  const srcDir = path.join(SRC_DIR, dir);
  if (!fs.existsSync(srcDir)) { report.push(`✖ ${key.padEnd(10)} dossier manquant : fonts/${dir}`); continue; }
  const files = walk(srcDir).filter((f) => !/italic/i.test(path.basename(f)));
  const keep = [];
  for (const f of files) {
    let fam = null;
    try { fam = familyOf(f); } catch { /* fichier illisible */ }
    if (fam && fam.replace(/\s+/g, " ").trim() === family) keep.push(f);
  }
  if (!keep.length) { report.push(`✖ ${key.padEnd(10)} aucun fichier de famille « ${family} » dans fonts/${dir}`); continue; }
  // Variable en premier (elle porte toutes les graisses), puis les statiques.
  keep.sort((a, b) => (/variable/i.test(b) ? 1 : 0) - (/variable/i.test(a) ? 1 : 0));
  for (const f of keep) {
    fs.copyFileSync(f, path.join(OUT_DIR, path.basename(f)));
    copied++;
  }
  const hasVar = keep.some((f) => /variable/i.test(f));
  report.push(`✔ ${key.padEnd(10)} ${family.padEnd(18)} ${keep.length} fichier(s)${hasVar ? " (variable)" : " (statiques)"}`);
}

console.log(report.join("\n"));
console.log(`\n${copied} fichier(s) copiés dans public/fonts/`);
