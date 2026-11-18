// scripts/ai-dup-plan-e2e.mts
//
// TEST DU PLANIFICATEUR « DUPLICATION IA EN 1 CLIC » (planner.ts + validate.ts).
//  1. Tests PURS avec un faux Claude : interdits (visage, zone sûre, nombre de
//     textes), bornes, unicité, cas A-E, plan de secours.
//  2. --live : vrai appel Claude sur les analyses de référence, plan affiché.
//
// Usage :
//   npx tsx scripts/ai-dup-plan-e2e.mts          # tests purs
//   npx tsx scripts/ai-dup-plan-e2e.mts --live   # + vrai Claude (coûte quelques centimes)

import fs from "fs";
import { planCopies } from "../src/lib/ai-dup/planner";
import { computeFreeZones, expand, intersects } from "../src/lib/ai-dup/analyze";
import { SAFE_ZONE, FACE_MARGIN_PCT, MAX_TEXT_ELEMENTS } from "../src/lib/ai-dup/config";
import type { AiDupAnalysis, AiDupPlan, Rect } from "../src/lib/ai-dup/types";
import type { RawCopy, RawPlan } from "../src/lib/ai-dup/validate";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

/* ── Analyses de référence (issues des vraies vidéos testées le 15/11) ────── */

const none = { present: false, boxes: [] };
const words = (n: number) => Array.from({ length: n }, (_, i) => ({ startSec: i * 0.4, endSec: i * 0.4 + 0.35, text: `mot${i}` }));

function withZones(a: Omit<AiDupAnalysis, "freeZones">): AiDupAnalysis {
  const prot: Rect[] = [
    ...a.faces.map((f) => expand(f, FACE_MARGIN_PCT)),
    ...a.burnedCaption.boxes.map((b) => expand(b, 3)),
    ...a.existingSubtitles.boxes.map((b) => expand(b, 3)),
    ...a.graphics.map((g) => expand(g, 3)),
  ];
  return { ...a, freeZones: computeFreeZones(prot) };
}

const base = { width: 1080, height: 1920, aspect: "9:16" as const, hasAudio: true, inspected: true, graphics: [], notes: [] };

const A = withZones({ graphics: [], ...base, durationSec: 20, hasVoice: false, language: "fr", contentSummary: "chat roux qui saute sur un plan de travail et fait tomber une tasse / la tasse se brise au sol / le chat regarde la caméra", burnedCaption: none, existingSubtitles: none, faces: [], scenario: "A_no_text" });

const B = withZones({
  ...base, durationSec: 17.1, hasVoice: false, language: "fr",
  contentSummary: "capture d'écran de l'Éditeur IA de DuupFlow / connexion de Claude / montage généré automatiquement à partir de rushes",
  burnedCaption: { present: true, text: "Monteur Vidéos ILLIMITÉ / 1. Va sur l'éditeur IA de DuupFlow", boxes: [
    { x: 10.5, y: 58.5, w: 78.8, h: 3.8, startSec: 0, endSec: 3.5 }, { x: 10.1, y: 62.9, w: 79.7, h: 8.3, startSec: 3.5, endSec: 17 },
  ] },
  existingSubtitles: none, faces: [], scenario: "B_burned_caption",
  // Logos Claude × DuupFlow incrustés au milieu (vus au test navigateur du 16/11 :
  // une caption s'y était posée avant que les graphismes soient protégés).
  graphics: [{ x: 8, y: 35, w: 56, h: 17, startSec: 0, endSec: 17.1, what: "logos Claude et DuupFlow" }],
});

const selfieFaces = [
  { x: 23, y: 27.6, w: 53.4, h: 39.6, startSec: 0, endSec: 60 },
  { x: 24, y: 28.7, w: 53, h: 42.8, startSec: 60, endSec: 120 },
  { x: 25.2, y: 41.5, w: 51.8, h: 42, startSec: 120, endSec: 159.5 },
];
const C = withZones({ graphics: [], ...base, durationSec: 159.5, hasVoice: true, language: "fr", burnedCaption: none, existingSubtitles: none, faces: selfieFaces, scenario: "C_facecam_talk", words: words(300) });

const D = withZones({ graphics: [],
  ...base, durationSec: 30, hasVoice: true, language: "fr",
  burnedCaption: { present: true, text: "POV : tu découvres", boxes: [{ x: 15, y: 14, w: 70, h: 6, startSec: 0, endSec: 30 }] },
  existingSubtitles: none, faces: [{ x: 28, y: 30, w: 44, h: 28, startSec: 0, endSec: 30 }], scenario: "D_facecam_caption", words: words(60),
});

const E = withZones({ graphics: [], ...base, durationSec: 3.7, hasVoice: true, language: "fr", burnedCaption: none, existingSubtitles: none, faces: [], scenario: "E_short", words: words(8) });

/* ── Faux Claude ──────────────────────────────────────────────────────────── */

const copy = (o: Partial<RawCopy> = {}): RawCopy => ({
  caption: { enabled: true, text: "Attends la fin 😳", preset: "white-outline", anchor: "top-center" },
  subtitles: { enabled: false, preset: "white-outline", anchor: "bottom-center" },
  cropPct: 3, cropOffsetX: 10, cropOffsetY: -10, speed: 1.02,
  saturation: 1.03, contrast: 1.02, brightness: 0.01, temperature: 0.03, ...o,
});
const fake = (copies: RawCopy[], language = "fr") => async (): Promise<RawPlan> => ({ language, copies });
let calls = 0;
const counting = (copies: RawCopy[]) => async () => { calls++; return { language: "fr", copies }; };

/* ── Contrôles transverses ────────────────────────────────────────────────── */

const SAFE: Rect = { x: SAFE_ZONE.left, y: SAFE_ZONE.top, w: 100 - SAFE_ZONE.left - SAFE_ZONE.right, h: 100 - SAFE_ZONE.top - SAFE_ZONE.bottom };
const inside = (r: Rect, o: Rect) => r.x >= o.x - 0.15 && r.y >= o.y - 0.15 && r.x + r.w <= o.x + o.w + 0.15 && r.y + r.h <= o.y + o.h + 0.15;

/** Interdits vérifiés sur TOUTES les copies d'un plan. */
function checkForbidden(name: string, plan: AiDupPlan, a: AiDupAnalysis) {
  const problems: string[] = [];
  const existing = (a.burnedCaption.present ? 1 : 0) + (a.existingSubtitles.present ? 1 : 0);
  for (const c of plan.copies) {
    const added = c.texts.filter((t) => !t.replaces).length; // un remplacement prend la place de l'originale
    if (added + existing > MAX_TEXT_ELEMENTS) problems.push(`copie ${c.index + 1} : ${added + existing} textes`);
    for (const t of c.texts) {
      if (t.replaces) continue; // posé SUR l'originale, contrôlé à part (tests de réécriture)
      const placed = t.placement ? [{ box: t.placement.box, s: 0, e: a.durationSec }] : (t.windows ?? []).map((w) => ({ box: w.box, s: w.startSec, e: w.endSec }));
      for (const p of placed) {
        if (!inside(p.box, SAFE)) problems.push(`copie ${c.index + 1} : ${t.kind} hors zone sûre ${JSON.stringify(p.box)}`);
        for (const f of a.faces) {
          const active = (f.startSec ?? 0) < p.e && p.s < (f.endSec ?? a.durationSec);
          if (active && intersects(p.box, f)) problems.push(`copie ${c.index + 1} : ${t.kind} sur un visage`);
        }
        for (const b of [...a.burnedCaption.boxes, ...a.existingSubtitles.boxes]) {
          if (intersects(p.box, b)) problems.push(`copie ${c.index + 1} : ${t.kind} sur le texte existant`);
        }
      }
    }
  }
  check(`${name} : interdits respectés (visage, zone sûre, texte existant, ≤ ${MAX_TEXT_ELEMENTS} textes)`, problems.length === 0, problems.slice(0, 3).join(" ; "));
}

const sigs = (p: AiDupPlan) => p.copies.map((c) => c.texts.map((t) => `${t.kind}|${t.text ?? ""}|${t.preset}|${t.anchor}`).sort().join("§"));

/* ── 1. Tests purs ────────────────────────────────────────────────────────── */

// Mode Invisible : aucun appel Claude, aucune modif visible, graines distinctes.
calls = 0;
const inv = await planCopies({ analysis: A, request: { mode: "invisible", copies: 12 }, brief: null, seed: "s1", callModel: counting([]) });
check("Invisible : aucun appel Claude", calls === 0);
check("Invisible : 12 copies sans texte ni levier visuel", inv.copies.length === 12 && inv.copies.every((c) => !c.texts.length && !c.visual));
check("Invisible : graines spoofer toutes différentes", new Set(inv.copies.map((c) => c.spoofer.seed)).size === 12);
const inv2 = await planCopies({ analysis: A, request: { mode: "invisible", copies: 3 }, brief: null, seed: "s2" });
check("Invisible : deux lancements = graines différentes", inv2.copies[0].spoofer.seed !== inv.copies[0].spoofer.seed);

// Cas A : Claude renvoie 6 fois la même caption → unicité forcée.
const a6 = await planCopies({ analysis: A, request: { mode: "variations", copies: 6 }, brief: null, seed: "s", callModel: fake(Array(6).fill(copy())) });
check("A : 6 copies identiques → 6 combinaisons différentes", new Set(sigs(a6)).size === 6, sigs(a6).join(" | "));
checkForbidden("A", a6, A);

// Bornes : valeurs délirantes écrêtées.
const wild = await planCopies({ analysis: A, request: { mode: "variations", copies: 1 }, brief: null, seed: "s", callModel: fake([copy({ cropPct: 40, speed: 2, saturation: 3, brightness: -1, cropOffsetX: 500 })]) });
const v = wild.copies[0].visual!;
check("bornes : recadrage ≤ 8 %, vitesse ≤ ×1,04, saturation ≤ 1,08", v.cropPct <= 8 && v.speed <= 1.04 && v.color.saturation <= 1.08 && v.color.brightness >= -0.04 && v.cropOffsetX <= 50);

// Caption trop longue retirée ; style inconnu remplacé.
const long = await planCopies({ analysis: A, request: { mode: "variations", copies: 2 }, brief: null, seed: "s", callModel: fake([
  copy({ caption: { enabled: true, text: "x".repeat(120), preset: "white-outline", anchor: "top-center" } }),
  copy({ caption: { enabled: true, text: "ok", preset: "n-existe-pas", anchor: "top-center" } }),
]) });
check("caption > 80 caractères retirée", long.copies[0].texts.length === 0);
check("style inconnu → remplacé par le style classique", long.copies[1].texts[0]?.preset === "classic-white");

// Cas B : ancre du bas (occupée par la caption incrustée) → déplacée, jamais dessus.
const b4 = await planCopies({ analysis: B, request: { mode: "variations", copies: 4 }, brief: null, seed: "s", callModel: fake(Array(4).fill(copy({ caption: { enabled: true, text: "😂", preset: "white-outline", anchor: "bottom-center" } }))) });
check("B : caption déplacée hors du bas occupé", b4.copies.every((c) => c.texts.length === 1 && !c.texts[0].anchor.startsWith("bottom-")), b4.copies.map((c) => c.texts[0]?.anchor).join(","));
checkForbidden("B", b4, B);
const { geometryProblems: geo } = await import("../src/lib/ai-dup/verify");
check("B : aucune caption sur les logos d'origine", b4.copies.every((c) => geo(c, B).length === 0) && b4.copies.every((c) => c.texts.every((t) => !t.anchor.startsWith("middle-"))), b4.copies.map((c) => c.texts[0]?.anchor).join(","));
const onLogo = structuredClone(b4.copies[0]);
if (onLogo.texts[0]?.placement) onLogo.texts[0].placement.box = { x: 20, y: 40, w: 30, h: 6 };
check("vérif : texte posé sur un logo d'origine → détecté", geo(onLogo, B).some((g) => g.problem === "covers_original"));
check("B : 1 seul texte ajouté (caption d'origine comptée)", b4.copies.every((c) => c.texts.length <= 1));

// Cas C (selfie) : sous-titres placés tranche par tranche, jamais sur le visage.
const c3 = await planCopies({ analysis: C, request: { mode: "variations", copies: 3 }, brief: null, seed: "s", callModel: fake(Array(3).fill(copy({
  caption: { enabled: false, text: "", preset: "", anchor: "top-center" },
  subtitles: { enabled: true, preset: "white-outline", anchor: "bottom-center" },
}))) });
const w0 = c3.copies[0].texts[0]?.windows ?? [];
check("C : sous-titres présents", w0.length > 0, w0.map((w) => `${w.startSec}-${w.endSec}@${w.anchor}`).join(" "));
check("C : sous-titres en bas quand le visage le permet, en haut quand il descend",
  w0.some((w) => w.anchor.startsWith("bottom") && w.endSec <= 60) && w0.some((w) => w.anchor.startsWith("top") && w.endSec >= 159));
checkForbidden("C", c3, C);
check("C : 3 copies, 3 combinaisons de sous-titres", new Set(sigs(c3)).size === 3, sigs(c3).join(" | "));

// Cas D : caption existante + Claude veut caption + sous-titres → seuls les sous-titres passent.
const d2 = await planCopies({ analysis: D, request: { mode: "variations", copies: 2 }, brief: null, seed: "s", callModel: fake(Array(2).fill(copy({ subtitles: { enabled: true, preset: "black-box", anchor: "bottom-center" } }))) });
check("D : sous-titres gardés, caption ajoutée refusée", d2.copies.every((c) => c.texts.length === 1 && c.texts[0].kind === "subtitles"), d2.copies.map((c) => c.texts.map((t) => t.kind).join("+")).join(" | "));
checkForbidden("D", d2, D);

// Cas E : sous-titres interdits, caption longue refusée, courte acceptée, bornes réduites.
const e2 = await planCopies({ analysis: E, request: { mode: "variations", copies: 2 }, brief: null, seed: "s", callModel: fake([
  copy({ caption: { enabled: true, text: "Une caption bien trop longue pour 3 secondes", preset: "white-outline", anchor: "top-center" }, subtitles: { enabled: true, preset: "white-outline", anchor: "bottom-center" } }),
  copy({ caption: { enabled: true, text: "Regarde ça", preset: "white-outline", anchor: "top-center" }, cropPct: 8, speed: 1.04 }),
]) });
check("E : pas de sous-titres, caption longue retirée", e2.copies[0].texts.length === 0);
check("E : caption courte acceptée", e2.copies[1].texts[0]?.text === "Regarde ça");
check("E : bornes réduites (recadrage ≤ 4 %, vitesse ≤ ×1,02)", e2.copies[1].visual!.cropPct <= 4 && e2.copies[1].visual!.speed <= 1.02);

// Claude indisponible → plan de secours complet, sans caption inventée.
const fb = await planCopies({ analysis: C, request: { mode: "variations", copies: 5 }, brief: null, seed: "s", callModel: async () => null });
check("secours : 5 copies quand Claude échoue", fb.copies.length === 5 && fb.corrections[0].startsWith("Claude indisponible"));
check("secours : aucune caption inventée, sous-titres variés", fb.copies.every((c) => c.texts.every((t) => t.kind === "subtitles")) && new Set(sigs(fb)).size === 5);
checkForbidden("secours C", fb, C);

// Claude rend moins de copies que demandé → complété.
const short = await planCopies({ analysis: A, request: { mode: "variations", copies: 4 }, brief: null, seed: "s", callModel: fake([copy()]) });
check("Claude rend 1/4 copies → 4 copies au total", short.copies.length === 4);

// 50 copies, toujours la même caption : unicité tant que les combinaisons existent.
const a50 = await planCopies({ analysis: A, request: { mode: "variations", copies: 50 }, brief: null, seed: "s", callModel: fake(Array(50).fill(copy())) });
const uniq = new Set(sigs(a50)).size;
check("50 copies même texte : toutes uniques (styles × positions suffisent)", uniq === 50, `${uniq}/50`);
check("50 copies : réglages visuels tous différents", new Set(a50.copies.map((c) => JSON.stringify(c.visual))).size === 50);
checkForbidden("A×50", a50, A);

// Découpe des sous-titres : ≤ 28 caractères, coupure sur pause et fin de phrase.
const { chunkWords } = await import("../src/lib/ai-dup/to-edit-plan");
const ws = (txt: string, gapAt = -1) => txt.split(" ").map((t, i) => ({ text: t, startSec: i * 0.3 + (gapAt >= 0 && i >= gapAt ? 1 : 0), endSec: i * 0.3 + 0.25 + (gapAt >= 0 && i >= gapAt ? 1 : 0) }));
const ch1 = chunkWords(ws("j'utilise déjà. La méthode depuis plusieurs mois."));
check("sous-titres : coupure en fin de phrase", ch1[0].map((w) => w.text).join(" ") === "j'utilise déjà.", ch1.map((c) => c.map((w) => w.text).join(" ")).join(" | "));
const ch2 = chunkWords(ws("un deux trois quatre", 2));
check("sous-titres : coupure sur un silence", ch2.length === 2);
check("sous-titres : aucun bloc > 28 caractères", chunkWords(ws("voici une phrase vraiment très longue qui doit forcément être découpée en plusieurs blocs")).every((c) => c.map((w) => w.text).join(" ").length <= 28));

// ── Vérification (étape 5) : géométrie, réparation, image à contrôler ──────
const { geometryProblems, repairCopy, frameToCheck } = await import("../src/lib/ai-dup/verify");
check("vérif : plan validé → aucun problème de géométrie", [...a6.copies, ...c3.copies].every((c) => geometryProblems(c, c.texts[0]?.kind === "subtitles" ? C : A).length === 0));
const onFace = structuredClone(c3.copies[0]);
onFace.texts[0].windows![0].box = { x: 40, y: 40, w: 20, h: 6 }; // en plein visage
check("vérif : texte déplacé sur le visage → détecté", geometryProblems(onFace, C).some((g) => g.problem === "text_on_face"));
const outSafe = structuredClone(a6.copies[0]);
outSafe.texts[0].placement!.box = { x: 70, y: 85, w: 25, h: 6 }; // sous l'interface
check("vérif : texte sous l'interface → détecté", geometryProblems(outSafe, A).some((g) => g.problem === "text_outside_safe_zone"));
const fixFace = repairCopy(onFace, ["text_on_face"], C, 1);
check("réparation : texte sur visage → textes retirés, recadrage gardé", fixFace.copy.texts.length === 0 && !!fixFace.copy.visual && fixFace.copy.spoofer.seed !== onFace.spoofer.seed);
const fixRead = repairCopy(a6.copies[2], ["text_unreadable"], A, 1);
check("réparation : illisible → boîte noire, toujours conforme", fixRead.copy.texts[0]?.preset === "black-box" && geometryProblems(fixRead.copy, A).length === 0, fixRead.change);
const fixSubs = repairCopy(c3.copies[1], ["text_unreadable"], C, 1);
check("réparation : sous-titres illisibles → boîte noire, toujours conformes", fixSubs.copy.texts[0]?.preset === "black-box" && geometryProblems(fixSubs.copy, C).length === 0, fixSubs.change);
const same = repairCopy(a6.copies[0], ["file_broken"], A, 1);
check("réparation : fichier cassé → refaite à l'identique, nouvelle identité", same.copy.texts.length === a6.copies[0].texts.length && same.copy.spoofer.seed.endsWith(":r1"));
const fCap = frameToCheck(a6.copies[0], A);
check("image à contrôler : la caption est attendue", fCap.expected.includes("Attends la fin 😳"), `t=${fCap.t}`);
const cW = { ...C, words: words(300).map((w, i) => ({ ...w, text: i % 9 === 8 ? `${w.text}.` : w.text })) };
const fSub = frameToCheck(c3.copies[0], cW);
check("image à contrôler : tombe pendant un sous-titre", fSub.expected.length === 1, `t=${fSub.t} « ${fSub.expected[0] ?? ""} »`);

// ── Réécriture de la caption d'origine ─────────────────────────────────────
const { replaceTarget, toCopyFrame } = await import("../src/lib/ai-dup/replace-caption");
const { copyToEditPlan } = await import("../src/lib/ai-dup/to-edit-plan");
const F = withZones({ graphics: [],
  ...base, durationSec: 20, hasVoice: false, language: "fr",
  contentSummary: "vue d'un lac turquoise depuis une falaise / personne qui saute dans l'eau",
  burnedCaption: { present: true, text: "POV : tu découvres ce spot", boxes: [{ x: 15, y: 20, w: 70, h: 7, startSec: 0, endSec: 20 }] },
  existingSubtitles: none, faces: [], scenario: "B_burned_caption",
});
check("réécriture : caption fixe → remplaçable", !!replaceTarget(F).target, `≤ ${replaceTarget(F).target?.maxChars} car.`);
check("réécriture : caption qui change (2 textes successifs) → gardée", !replaceTarget(B).target && /change/.test(replaceTarget(B).reason ?? ""), replaceTarget(B).reason ?? "");
const Fface = { ...F, faces: [{ x: 30, y: 24, w: 40, h: 30, startSec: 0, endSec: 20 }] };
check("réécriture : caption qui touche un visage → gardée", !replaceTarget(Fface).target, replaceTarget(Fface).reason ?? "");
check("réécriture : pas de caption → rien à faire, aucun message", !replaceTarget(A).target && replaceTarget(A).reason === null);

const rw = (text: string, color = "white", shape = "lines", font = "sans") => ({ enabled: true, text, color, shape, font });
const fTexts = ["POV : tu tombes sur ce spot", "Ce spot, personne ne le connaît", "Tu découvres cet endroit ?", "Le spot que tu ignorais"];
const f4 = await planCopies({ analysis: F, request: { mode: "variations", copies: 4, replaceCaption: true }, brief: null, seed: "s", callModel: fake(fTexts.map((t, i) => copy({
  rewrite: rw(t, ["white", "black", "pink", "violet"][i], ["lines", "rounded", "square", "pill"][i], ["sans", "grotesk", "rounded", "geometric"][i]),
  caption: { enabled: true, text: "😳", preset: "white-outline", anchor: "bottom-center" },
}))) });
const rws = f4.copies.map((c) => c.texts.find((t) => t.replaces));
check("réécriture : chaque copie a sa caption réécrite", rws.every((t, i) => t?.text === fTexts[i]), f4.corrections.slice(0, 2).join(" ; "));
check("réécriture : couleur inconnue ramenée au blanc, forme et police gardées", rws[3]?.preset === "cover:white:pill:geometric", rws[3]?.preset ?? "");
check("réécriture : 4 copies = 4 polices et au moins 3 formes", new Set(rws.map((t) => t?.preset.split(":")[2])).size >= 3 && new Set(rws.map((t) => t?.preset.split(":")[3])).size === 4, rws.map((t) => t?.preset).join(" "));
check("réécriture : bandeau impossible sur une caption courte et large → bloc arrondi", rws[0]?.preset === "cover:white:rounded:sans");
// Caption sur 3 lignes, reformulation de même longueur : le bandeau tient.
const Fl = withZones({ graphics: [], ...base, durationSec: 12, hasVoice: false, language: "fr",
  burnedCaption: { present: true, text: "Pq tu t'habille toujours en large ? T'a un truc à caché ?", boxes: [{ x: 18, y: 55, w: 64, h: 10, startSec: 0, endSec: 6.5 }] },
  existingSubtitles: none, faces: [], scenario: "B_burned_caption" });
const fl = await planCopies({ analysis: Fl, request: { mode: "variations", copies: 1, replaceCaption: true }, brief: null, seed: "s", callModel: fake([copy({ caption: { enabled: false, text: "", preset: "", anchor: "top-center" }, rewrite: rw("Pourquoi tu portes toujours du large ? Tu caches quoi ?", "white", "lines") })]) });
const flt = fl.copies[0].texts.find((t) => t.replaces);
const flCover = toCopyFrame(replaceTarget(Fl).target!.box, fl.copies[0].visual);
check("réécriture : bandeau retenu quand il couvre l'ancienne caption", flt?.preset === "cover:white:lines:sans" && !!flt.placement && flt.placement.box.w >= flCover.w * 0.97 && flt.placement.box.h >= flCover.h * 0.97, flt ? `${flt.preset} box ${JSON.stringify(flt.placement?.box)} cover ${JSON.stringify(flCover)}` : fl.corrections.join(" ; "));
const flFix = repairCopy(fl.copies[0], ["original_visible"], Fl, 1);
check("réparation : bandeau qui laisse voir l'ancienne caption → bloc arrondi, réécriture gardée", flFix.copy.texts.find((t) => t.replaces)?.preset === "cover:white:rounded:sans", flFix.change);
const covers = f4.copies.every((c) => {
  const t = c.texts.find((x) => x.replaces)!; const cover = toCopyFrame(replaceTarget(F).target!.box, c.visual);
  const b = t.placement!.box;
  return b.x <= cover.x + 0.2 && b.y <= cover.y + 0.2 && b.x + b.w >= cover.x + cover.w - 0.2 && b.y + b.h >= cover.y + cover.h - 0.2;
});
check("réécriture : la boîte couvre toute l'ancienne caption (après recadrage)", covers);
check("réécriture : l'autre texte ne touche pas la boîte", f4.copies.every((c) => {
  const r = c.texts.find((x) => x.replaces)!.placement!.box;
  return c.texts.filter((x) => !x.replaces).every((x) => !intersects(x.placement!.box, r));
}));
checkForbidden("F×4 (réécriture)", f4, F);
check("réécriture : contrôle géométrique vert", f4.copies.every((c) => geometryProblems(c, F).length === 0), f4.copies.map((c) => geometryProblems(c, F).map((g) => g.detail).join(",")).filter(Boolean)[0] ?? "");
const ep = copyToEditPlan(f4.copies[0], "m", "m", F);
const epCap = ep.captions?.find((c) => c.text === fTexts[0]);
check("réécriture : rendu = boîte opaque + taille minimale + flou dessous", epCap?.backgroundOpacity === 1 && (epCap?.minBoxWidth ?? 0) > 0 && (epCap?.minBoxHeight ?? 0) > 0 && (ep.segments[0].blurRegions?.length ?? 0) === 1);
const fFrame = frameToCheck(f4.copies[0], F);
check("réécriture : l'image contrôlée montre la caption réécrite", fFrame.expected.includes(fTexts[0]), `t=${fFrame.t}`);
const fLeak = repairCopy(f4.copies[0], ["original_visible"], F, 1);
check("réparation : ancienne caption visible → réécriture retirée, reste gardé", !fLeak.copy.texts.some((t) => t.replaces) && fLeak.copy.texts.length === 1, fLeak.change);

const fBad = await planCopies({ analysis: F, request: { mode: "variations", copies: 3, replaceCaption: true }, brief: null, seed: "s", callModel: fake([
  copy({ rewrite: rw("POV : tu découvres ce spot") }),
  copy({ rewrite: rw("x".repeat(120)) }),
  copy({ rewrite: { enabled: false, text: "", color: "white", shape: "lines", font: "sans" } }),
]) });
check("réécriture : identique / trop longue / absente → caption d'origine gardée", fBad.copies.every((c) => !c.texts.some((t) => t.replaces)));
const fOff = await planCopies({ analysis: F, request: { mode: "variations", copies: 2, replaceCaption: false }, brief: null, seed: "s", callModel: fake([copy({ rewrite: rw("Ce spot de fou") }), copy({ rewrite: rw("Ce spot incroyable") })]) });
check("réécriture : case décochée → jamais appliquée", fOff.copies.every((c) => !c.texts.some((t) => t.replaces)));
const fDup = await planCopies({ analysis: F, request: { mode: "variations", copies: 3, replaceCaption: true }, brief: null, seed: "s", callModel: fake(Array(3).fill(copy({ rewrite: rw("Ce spot de fou"), caption: { enabled: false, text: "", preset: "", anchor: "top-center" } }))) });
check("réécriture : même texte × 3 → styles de boîte variés", new Set(fDup.copies.map((c) => c.texts[0]?.preset)).size === 3);
const edgeOk = [...f4.copies, ...fDup.copies].every((c) => c.texts.filter((t) => t.replaces).every((t) => t.placement!.box.x >= 3.9 && t.placement!.box.x + t.placement!.box.w <= 96.1));
check("réécriture : bloc jamais à moins de 4 % des bords", edgeOk);
const Fwide = { ...F, burnedCaption: { ...F.burnedCaption, boxes: [{ x: 1, y: 20, w: 98, h: 7, startSec: 0, endSec: 20 }], tightBox: { x: 12, y: 20.5, w: 76, h: 6 } } };
const fw = await planCopies({ analysis: Fwide, request: { mode: "variations", copies: 1, replaceCaption: true }, brief: null, seed: "s", callModel: fake([copy({ rewrite: rw("Ce spot de fou", "black", "rounded") })]) });
const fwb = fw.copies[0].texts.find((t) => t.replaces)?.placement?.box;
check("réécriture : calée sur l'étendue mesurée, pas sur la boîte d'inspection trop large", !!fwb && fwb.w < 90, fwb ? `largeur ${fwb.w} %` : "");

/* ── 2. Essai réel ────────────────────────────────────────────────────────── */

if (process.argv.includes("--live")) {
  // Clés lues dans .env.local si absentes de l'environnement.
  for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  for (const [name, a, n, ind] of [
    ["A (sans texte)", A, 8, ""],
    ["B (caption incrustée)", B, 5, ""],
    ["C (selfie qui parle)", C, 5, "captions en anglais, ton humoristique"],
    ["F (caption à réécrire)", F, 6, ""],
  ] as const) {
    const t0 = Date.now();
    const plan = await planCopies({ analysis: a, request: { mode: "variations", copies: n, indications: ind, replaceCaption: a === F }, brief: null, seed: `live-${name}` });
    console.log(`\n── LIVE ${name} · ${n} copies · ${Math.round((Date.now() - t0) / 100) / 10} s · langue ${plan.language}${ind ? ` · indications « ${ind} »` : ""}`);
    for (const c of plan.copies) {
      const texts = c.texts.map((t) => t.replaces ? `RÉÉCRITE « ${t.text} » ${t.preset}` : t.kind === "caption" ? `« ${t.text} » ${t.preset}@${t.anchor}` : `sous-titres ${t.preset}@${t.anchor}`).join(" + ") || "(aucun texte)";
      console.log(`  ${c.index + 1}. ${texts} · crop ${c.visual?.cropPct}% · ×${c.visual?.speed}`);
    }
    if (plan.corrections.length) console.log(`  corrections : ${plan.corrections.slice(0, 6).join(" ; ")}`);
    check(`LIVE ${name} : plan venu de Claude`, !plan.corrections.some((x) => x.startsWith("Claude indisponible") || x.startsWith("plan de secours")), plan.corrections[0] ?? "");
    checkForbidden(`LIVE ${name}`, plan, a);
    if (a === F) {
      const r = plan.copies.map((c) => c.texts.find((t) => t.replaces)?.text);
      check("LIVE F : caption réécrite sur chaque copie, toutes différentes", r.every(Boolean) && new Set(r).size === r.length);
    }
    check(`LIVE ${name} : combinaisons uniques`, new Set(sigs(plan)).size === plan.copies.length || plan.copies.every((c) => !c.texts.length));
  }
}

console.log(failed ? `\n❌ ${failed} échec(s)` : "\n✅ tout est vert");
process.exit(failed ? 1 : 0);
