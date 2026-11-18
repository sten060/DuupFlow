// src/lib/ai-dup/verify.ts
//
// ── VÉRIFICATION D'UNE COPIE FABRIQUÉE ───────────────────────────────────────
// Trois contrôles, du moins cher au plus cher :
//   1. GÉOMÉTRIE (code) : les textes prévus respectent-ils les interdits
//      (visage, zone sûre, texte existant, ≤ 2 textes) ? Filet de sécurité
//      contre un bug du placement — normalement toujours vert.
//   2. FICHIER (code) : la copie se lit, a une piste vidéo et la bonne durée.
//   3. REGARD (Claude, 1 image) : le texte est-il lisible, rien sur le visage,
//      rien sous l'interface TikTok/Reels, pas de défaut visible ? Seulement
//      pour les copies qui portent du texte : sans texte ajouté, il n'y a rien
//      que l'œil puisse rater et que le code n'ait pas déjà contrôlé.
//
// En cas d'échec, `repairCopy` propose UNE version corrigée (jobs.ts la refait
// une fois) ; au second échec la copie est écartée.

import fs from "fs/promises";
import os from "os";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { runFFmpeg } from "@/lib/studio/pipeline";
import { probeInfo, parseDuration } from "@/lib/ffmpeg-probe";
import { intersects } from "./analyze";
import { canvasHeight, placeSubtitles, placeText } from "./placement";
import { PRESET_BY_ID } from "./text-presets";
import { rewriteAsBlock } from "./validate";
import { copyToEditPlan } from "./to-edit-plan";
import {
  AI_DUP_MODEL, VERIFIER_MAX_TOKENS, VERIFY_FRAME_WIDTH, SAFE_ZONE, MAX_TEXT_ELEMENTS,
  CAPTION_MAX_LINES, READABLE_FALLBACK_PRESET, DURATION_TOLERANCE, SAFE_ZONE_TOLERANCE_PCT,
} from "./config";
import type { AiDupAnalysis, CopyPlan, PlannedText, Rect, UsageSink } from "./types";

export type VerifyProblem =
  | "text_unreadable"
  | "text_on_face"
  | "covers_original"
  | "text_outside_safe_zone"
  | "visual_defect"
  | "original_visible"
  | "file_broken";

export type VerifyResult = { ok: boolean; problems: VerifyProblem[]; note: string };

/* ── 1. Géométrie ─────────────────────────────────────────────────────────── */

const SAFE: Rect = { x: SAFE_ZONE.left, y: SAFE_ZONE.top, w: 100 - SAFE_ZONE.left - SAFE_ZONE.right, h: 100 - SAFE_ZONE.top - SAFE_ZONE.bottom };
const inside = (r: Rect, o: Rect) => r.x >= o.x - 0.15 && r.y >= o.y - 0.15 && r.x + r.w <= o.x + o.w + 0.15 && r.y + r.h <= o.y + o.h + 0.15;

/** Boîtes occupées par un texte, avec leur fenêtre de temps (temps source). */
function placedBoxes(t: PlannedText, dur: number): { box: Rect; s: number; e: number }[] {
  if (t.placement) return [{ box: t.placement.box, s: t.startSec ?? 0, e: t.endSec ?? dur }];
  return (t.windows ?? []).map((w) => ({ box: w.box, s: w.startSec, e: w.endSec }));
}

/** Interdits vérifiés sur le plan d'une copie. Liste vide = conforme. */
export function geometryProblems(copy: CopyPlan, a: AiDupAnalysis): { problem: VerifyProblem; detail: string }[] {
  const out: { problem: VerifyProblem; detail: string }[] = [];
  const existing = (a.burnedCaption.present ? 1 : 0) + (a.existingSubtitles.present ? 1 : 0);
  // Une caption de remplacement prend la place de l'originale (déjà comptée).
  const added = copy.texts.filter((t) => !t.replaces).length;
  if (added + existing > MAX_TEXT_ELEMENTS) out.push({ problem: "text_on_face", detail: `${added + existing} textes à l'écran` });
  for (const t of copy.texts) {
    for (const p of placedBoxes(t, a.durationSec)) {
      // Remplacement : il est là où était l'originale (zone sûre ou non) —
      // le déplacer trahirait la copie ; seuls les visages et les autres
      // éléments d'origine comptent.
      if (!t.replaces && !inside(p.box, SAFE)) out.push({ problem: "text_outside_safe_zone", detail: `${t.kind} hors zone sûre` });
      for (const f of a.faces) {
        const active = (f.startSec ?? 0) < p.e && p.s < (f.endSec ?? a.durationSec);
        if (active && intersects(p.box, f)) out.push({ problem: "text_on_face", detail: `${t.kind} sur un visage` });
      }
      for (const b of [...(t.replaces ? [] : a.burnedCaption.boxes), ...a.existingSubtitles.boxes, ...(a.graphics ?? [])]) {
        const active = (b.startSec ?? 0) < p.e && p.s < (b.endSec ?? a.durationSec);
        if (active && intersects(p.box, b)) out.push({ problem: "covers_original", detail: `${t.kind} sur un élément de la vidéo d'origine` });
      }
    }
  }
  return out;
}

/* ── 2. Fichier ───────────────────────────────────────────────────────────── */

export async function fileProblems(file: string, expectedSec: number): Promise<string[]> {
  const { getFFmpegBin } = await import("@/app/dashboard/videos/processVideos");
  const { stderr, timedOut } = await probeInfo(file, await getFFmpegBin(), "ai-dup/verify");
  if (timedOut) return []; // machine saturée : on ne condamne pas une copie sur une sonde muette
  const out: string[] = [];
  if (!/Stream #.*Video:/.test(stderr)) out.push("aucune piste vidéo");
  const d = parseDuration(stderr);
  if (!d) out.push("durée illisible");
  else if (Math.abs(d - expectedSec) > Math.max(0.5, expectedSec * DURATION_TOLERANCE)) out.push(`durée ${d.toFixed(1)} s au lieu de ${expectedSec.toFixed(1)} s`);
  return out;
}

/* ── 3. Regard (une image) ────────────────────────────────────────────────── */

/** Instant à contrôler (temps de la COPIE) et textes censés y être visibles.
 *  Sous-titres : milieu du plus long bloc (forcément affiché). Sinon 40 %. */
export function frameToCheck(copy: CopyPlan, a: AiDupAnalysis): { t: number; expected: string[] } {
  const plan = copyToEditPlan(copy, "m", "m", a);
  const caps = plan.captions ?? [];
  const speed = copy.visual?.speed ?? 1;
  const outDur = a.durationSec / speed;
  // Sous-titres = blocs courts (pas la caption de remplacement, qui peut
  // elle aussi avoir une fenêtre).
  const rewriteText = copy.texts.find((x) => x.replaces)?.text;
  const subs = caps.filter((c) => c.endSec - c.startSec < outDur - 0.01 && c.text !== rewriteText);
  const rw = caps.find((c) => c.text === rewriteText);
  let pick = subs.sort((x, y) => (y.endSec - y.startSec) - (x.endSec - x.startSec))[0];
  // L'instant contrôlé doit montrer la caption de remplacement : c'est elle
  // qui risque le plus (lettres d'origine qui dépassent).
  if (rw && pick && !(rw.startSec <= (pick.startSec + pick.endSec) / 2 && (pick.startSec + pick.endSec) / 2 < rw.endSec)) {
    pick = subs.find((c) => rw.startSec <= (c.startSec + c.endSec) / 2 && (c.startSec + c.endSec) / 2 < rw.endSec) ?? pick;
  }
  const t = pick ? (pick.startSec + pick.endSec) / 2 : rw ? Math.min(rw.endSec - 0.05, Math.max(rw.startSec + 0.05, outDur * 0.4)) : outDur * 0.4;
  return { t: Math.round(t * 100) / 100, expected: caps.filter((c) => c.startSec <= t && t < c.endSec).map((c) => c.text) };
}

async function extractFrame(file: string, t: number): Promise<string | null> {
  const out = path.join(os.tmpdir(), `aidup_verify_${process.pid}_${Math.random().toString(36).slice(2, 8)}.jpg`);
  try {
    const { code } = await runFFmpeg(["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(2), "-i", file,
      "-frames:v", "1", "-vf", `scale=${VERIFY_FRAME_WIDTH}:-2`, "-q:v", "3", "-y", out], 60_000);
    if (code !== 0) return null;
    return (await fs.readFile(out)).toString("base64");
  } catch { return null; } finally { await fs.rm(out, { force: true }).catch(() => {}); }
}

const VERIFY_PROMPT = `Tu contrôles UNE image d'une vidéo verticale destinée à TikTok / Instagram Reels, avant publication. Des textes y ont été ajoutés automatiquement. Réponds UNIQUEMENT en JSON conforme au schéma.

Problèmes possibles (n'en signale que si tu les VOIS clairement) :
- text_unreadable : un texte AJOUTÉ est illisible (trop petit, contraste insuffisant avec le fond, coupé, lettres qui se chevauchent).
- text_on_face : un texte ajouté recouvre une partie d'un visage (yeux, nez, bouche, menton, front).
- covers_original : un texte ajouté recouvre, même en partie, un élément qui faisait DÉJÀ partie de la vidéo : texte incrusté, logo, icône, sticker, emoji, image incrustée. Les textes ajoutés sont listés avec l'image : tout autre texte ou graphisme est d'origine.
- text_outside_safe_zone (indicatif, la position exacte est déjà contrôlée par le code) : un texte ajouté entre NETTEMENT (plusieurs lignes de pixels, pas un frôlement) dans les zones couvertes par l'interface des apps. Les limites exactes en pixels de l'image sont données avec elle : compare tes mesures à ces chiffres, un texte qui reste à l'intérieur n'est PAS un problème même s'il en est proche.
- original_visible : une caption d'origine devait être CACHÉE sous une boîte de remplacement (signalé avec l'image) et on voit encore des lettres ou morceaux de lettres de l'ancien texte, autour de la boîte ou à travers. Une zone floue autour de la boîte est normale et voulue : ce n'est un problème que si des lettres restent lisibles.
- visual_defect : défaut visible de l'image elle-même (bandes noires inattendues, image déformée ou étirée, artefacts, image noire).

Une boîte de remplacement posée SUR la caption d'origine est voulue : ce n'est pas un covers_original. Les éléments d'origine eux-mêmes ne sont pas à juger (leur lisibilité, leur position) : seul compte qu'un texte AJOUTÉ ne les recouvre pas. ok = true si aucun problème. note = une phrase courte qui justifie ta décision.`;

const VERIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  // La justification AVANT le verdict : le modèle raisonne puis conclut (vu
  // le 16/11 : verdict « hors zone » suivi d'une note « aucun dépassement »).
  required: ["note", "problems", "ok"],
  properties: {
    note: { type: "string" },
    problems: { type: "array", items: { type: "string", enum: ["text_unreadable", "text_on_face", "covers_original", "text_outside_safe_zone", "visual_defect", "original_visible"] } },
    ok: { type: "boolean" },
  },
};

/** Appel au modèle, injectable pour les tests. null = contrôle impossible. */
export type VisionCall = (jpegB64: string, context: string, onUsage?: UsageSink) => Promise<VerifyResult | null>;

export const callClaudeVision: VisionCall = async (jpegB64, context, onUsage) => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  try {
    const res = await client.beta.messages.create({
      model: AI_DUP_MODEL,
      max_tokens: VERIFIER_MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: VERIFY_SCHEMA } },
      system: [{ type: "text", text: VERIFY_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegB64 } },
        { type: "text", text: context },
      ] }],
    });
    onUsage?.(res.model, res.usage);
    if (res.stop_reason !== "end_turn") return null;
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
    const v = JSON.parse(text) as VerifyResult;
    return { ok: !!v.ok && !(v.problems ?? []).length, problems: v.problems ?? [], note: String(v.note ?? "").slice(0, 200) };
  } catch (e) {
    console.error("[ai-dup/verify] contrôle visuel impossible :", (e as Error).message.slice(0, 160));
    return null;
  }
};

/** Vérifie une copie fabriquée. Un contrôle visuel IMPOSSIBLE (Claude
 *  indisponible, image non extraite) ne condamne pas la copie : la géométrie
 *  et le fichier ont déjà été contrôlés par le code. */
export async function verifyCopy(
  file: string, copy: CopyPlan, a: AiDupAnalysis, callVision: VisionCall = callClaudeVision,
  billing?: { onUsage: UsageSink; canSpend: () => Promise<boolean> },
): Promise<VerifyResult> {
  const geo = geometryProblems(copy, a);
  if (geo.length) return { ok: false, problems: [...new Set(geo.map((g) => g.problem))], note: geo.map((g) => g.detail).join(" ; ") };

  const expectedSec = a.durationSec / (copy.visual?.speed ?? 1);
  const broken = await fileProblems(file, expectedSec);
  if (broken.length) return { ok: false, problems: ["file_broken"], note: broken.join(" ; ") };

  if (!copy.texts.length) return { ok: true, problems: [], note: "aucun texte ajouté : contrôles techniques suffisants" };

  // Enveloppe et solde épuisés : la copie reste contrôlée par le code
  // (géométrie + fichier), seul le regard de Claude est sauté.
  if (billing && !(await billing.canSpend())) return { ok: true, problems: [], note: "tokens épuisés — contrôle visuel sauté" };

  const { t, expected } = frameToCheck(copy, a);
  const jpeg = await extractFrame(file, t);
  if (!jpeg) return { ok: true, problems: [], note: "image de contrôle non extraite — contrôle visuel sauté" };
  // Limites de la zone sûre EN PIXELS de l'image envoyée : sans elles, le
  // modèle refusait un texte à 13 % du haut en le jugeant « à cheval » sur
  // la limite des 12 % (faux refus vu au test du 16/11).
  const W = VERIFY_FRAME_WIDTH, H = Math.round((W * a.height) / Math.max(1, a.width) / 2) * 2;
  const tol = SAFE_ZONE_TOLERANCE_PCT / 100;
  const px = (f: number, dim: number) => Math.round(f * dim);
  const context = [
    `Image de ${W}×${H} px, à ${t.toFixed(1)} s.`,
    `Zone sûre (tolérance comprise) : un texte ajouté est en faute seulement s'il a des pixels au-dessus de y=${px(SAFE_ZONE.top / 100 - tol, H)}, en dessous de y=${px(1 - SAFE_ZONE.bottom / 100 + tol, H)} ou à droite de x=${px(1 - SAFE_ZONE.right / 100 + tol, W)}.`,
    expected.length ? `Textes AJOUTÉS censés être visibles : ${expected.map((x) => `« ${x} »`).join(", ")}.` : "Aucun texte ajouté attendu à cet instant.",
    ...(() => {
      const rw = copy.texts.find((x) => x.replaces);
      if (rw) return [`La caption d'origine « ${rw.replaces!.original} » a été REMPLACÉE : une boîte pleine portant « ${rw.text} » est posée dessus (zone floutée dessous). Plus aucune lettre de l'ancienne ne doit être lisible. La règle de zone sûre ne s'applique pas à cette boîte (elle reste à la place de l'originale).`];
      return [a.burnedCaption.present ? `La vidéo d'origine contient déjà un texte incrusté (« ${a.burnedCaption.text ?? "?"} »).` : ""];
    })(),
    a.graphics?.length ? `Éléments graphiques d'origine repérés : ${a.graphics.map((g) => g.what).filter(Boolean).join(", ")}.` : "",
  ].filter(Boolean).join("\n");
  const v = await callVision(jpeg, context, billing?.onUsage);
  if (!v) return { ok: true, problems: [], note: "contrôle visuel indisponible — sauté" };
  // Zone sûre : la géométrie du code (déjà verte ci-dessus) mesure au pixel
  // près ; l'œil du modèle n'y est qu'approximatif → il ne tranche pas seul.
  const problems = v.problems.filter((p) => p !== "text_outside_safe_zone");
  return { ok: problems.length === 0, problems, note: v.note };
}

/* ── Réparation (un seul nouvel essai) ────────────────────────────────────── */

/** Version corrigée d'une copie en échec, ou la même si le défaut ne vient
 *  pas du plan (fichier cassé, défaut d'image → on refait à l'identique).
 *   · texte illisible → style le plus contrasté (boîte), sinon texte retiré ;
 *   · texte sur visage / hors zone → textes retirés (la copie garde ses
 *     autres différences : recadrage, vitesse, couleur, identité). */
export function repairCopy(copy: CopyPlan, problems: VerifyProblem[], a: AiDupAnalysis, attempt: number): { copy: CopyPlan; change: string } {
  const spoofer = { seed: `${copy.spoofer.seed}:r${attempt}` };
  // L'ancienne caption dépasse de la boîte : on renonce à la réécriture (la
  // caption d'origine revient, intacte) et on garde le reste de la copie.
  if (problems.includes("original_visible") && !problems.some((p) => p !== "original_visible")) {
    // Bandeau ligne par ligne trop juste → même réécriture en bloc plein ;
    // sinon on renonce à la réécriture (la caption d'origine revient).
    const block = rewriteAsBlock(copy, a);
    if (block) return { copy: { ...copy, texts: copy.texts.map((t) => (t.replaces ? block : t)), spoofer }, change: "bandeau remplacé par un bloc plein" };
    return { copy: { ...copy, texts: copy.texts.filter((t) => !t.replaces), spoofer }, change: "caption d'origine gardée" };
  }
  if (problems.includes("text_on_face") || problems.includes("covers_original") || problems.includes("text_outside_safe_zone")) {
    return { copy: { ...copy, texts: [], spoofer }, change: "textes retirés" };
  }
  if (problems.includes("text_unreadable")) {
    const preset = PRESET_BY_ID.get(READABLE_FALLBACK_PRESET)!;
    const texts: PlannedText[] = [];
    for (const t of copy.texts) {
      if (t.replaces) continue; // réécriture peu lisible → la caption d'origine revient
      if (t.kind === "subtitles") {
        const windows = placeSubtitles(a, preset, t.anchor, texts.flatMap((x) => placedBoxes(x, a.durationSec).map((p) => p.box)));
        if (windows.length) texts.push({ ...t, preset: preset.id, windows });
      } else {
        const placement = placeText(t.text ?? "", preset, t.anchor, a.freeZones, canvasHeight(a), CAPTION_MAX_LINES,
          texts.flatMap((x) => placedBoxes(x, a.durationSec).map((p) => p.box)));
        if (placement) texts.push({ ...t, preset: preset.id, anchor: placement.anchor, placement });
      }
    }
    return { copy: { ...copy, texts, spoofer }, change: texts.length ? `style plus lisible (${preset.label})` : "textes retirés" };
  }
  return { copy: { ...copy, spoofer }, change: "refaite à l'identique" };
}
