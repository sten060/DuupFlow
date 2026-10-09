// src/lib/ai-editor/mcp-tools.ts
//
// Définition + exécution des OUTILS MCP de l'Éditeur IA (séparé de la route pour
// être testable sans l'auth). Lecture seule pour l'instant : donner au Claude du
// user la référence analysée (keyframes EN IMAGES qu'il VOIT + transcript) et la
// matière. La génération viendra avec le moteur de rendu.

import { isUserOnFreePlan } from "@/lib/plan-gate";
import { getLatestProject, projectPaths } from "./store";
import type { Project } from "./store";
import { renderVariant, variantKeyframes, materialKeyframes, ENGINE_BUILD } from "./render";
import { startRenderJob, getRenderJob, cancelRenderJob, waitForJob, runningJobsFor, jobElapsed, jobRenderElapsed, isQueued, queuePosition, queueSnapshot, type RenderJob } from "./render-jobs";
import type { EditPlan } from "./render";
import { CAPTION_FONTS, fontCatalogLines } from "./font-catalog";
import { GAP_BLANK_SEC, BLANK_MAX_RATIO, GAP_MICRO_SEC, GAP_EDGE_TRIM_FALLBACK_SEC, RETAKE_NGRAM, RETAKE_CHAIN_GAP_SEC, RETAKE_STRICT_GAP_SEC, RETAKE_MIN_SPAN_SEC, REF_IMAGES_SHOWN, MCP_IMAGE_WIDTH, MCP_IMAGE_QUALITY } from "./analysis-config";
import { analyzeColor } from "./ref-profile";
import { reserveUsage, releaseUsage, logUsageEvent, logAiEditorRender } from "@/lib/usage";

// Garde-fou quota : chaque rendu de variante (create_variant / update_variant)
// compte comme UNE « vidéo » (le user paie SON Claude, DuupFlow facture le RENDU).
// Pro = illimité. Sans ça, un Claude connecté rendrait des vidéos sans fin.
//
// ⚠ On RÉSERVE l'unité ici, avant de lancer le rendu — on ne se contente pas de
// lire le compteur. Les rendus sont détachés et n'incrémentaient qu'à la fin :
// un Claude qui enchaîne dix create_variant les voyait TOUS passer avec le même
// compteur, et un Starter à 99/100 repartait avec 109 vidéos. Un rendu qui
// échoue rend son unité (releaseVariantQuota).
/* Réservation payée par un CRÉDIT D'ESSAI plutôt que par le quota. La garde et
   la restitution vivent dans deux fonctions séparées (et le rendu est détaché
   entre les deux) : on note donc ici comment l'unité a été payée, sinon un
   rendu raté rendrait du quota jamais débité et offrirait une vidéo. */
const paiementParCredit = new Set<string>();

async function guardVariantQuota(userId: string): Promise<Content | null> {
  // Plan gratuit (src/lib/free-plan.ts) : aucune variante, jamais. Le texte
  // s'adresse à Claude, qui doit l'expliquer au user au lieu de réessayer.
  if (await isUserOnFreePlan(userId).catch(() => false)) {
    return {
      type: "text",
      text:
        "⛔ PLAN GRATUIT — aucune variante ne peut être créée. Le compte DuupFlow de ce user est sur le plan gratuit : " +
        "il peut explorer l'Éditeur IA, mais la création de variantes nécessite un plan (Starter, Solo ou Pro). " +
        "Ne réessaie pas et ne propose aucun contournement. Explique-lui simplement que son plan actuel ne lui permet pas " +
        "de faire des variantes, que tout ce que vous avez préparé pourra être rendu dès qu'il aura choisi un plan, " +
        "et qu'il peut le faire ici : https://www.duupflow.com/dashboard/abonnement",
    };
  }
  const usage = await reserveUsage(userId, "videos", 1).catch(() => null);
  if (usage && !usage.allowed) {
    return { type: "text", text: `⛔ Quota atteint : ${usage.message ?? "limite de vidéos du plan atteinte."} Le rendu est bloqué tant que le user (ou son hôte) n'a pas plus de quota / un plan supérieur.` };
  }
  if (usage?.trialCredit) paiementParCredit.add(userId);
  return null; // autorisé (ou vérif indisponible → on ne bloque pas un render légitime)
}

/** Rendu échoué → l'unité réservée par guardVariantQuota() est rendue. */
function releaseVariantQuota(userId: string): void {
  const surCredit = paiementParCredit.delete(userId);
  void releaseUsage(userId, "videos", 1, surCredit).catch(() => {});
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ── COÛT EN CONTEXTE DES IMAGES ─────────────────────────────────────────────
   Une image 480px en 9:16 ≈ 550 tokens chez le client. Le moteur en renvoyait
   à CHAQUE appel, sans moyen de refuser : une session de production (47
   variantes le 20/08) accumulait ~280 images ≈ 155 000 tokens de vignettes —
   la conversation saturait et devenait inutilisable, travail perdu.
   Règle : les outils de CONSULTATION sont muets par défaut (le texte suffit à
   se repérer), les outils de PRODUCTION montrent le rendu (c'est la boucle
   d'auto-correction, la retirer viderait le moteur de son intérêt). Dans les
   deux cas `images` permet de trancher explicitement. */
const RENDER_KEYFRAMES = Math.max(1, parseInt(process.env.AI_EDITOR_RENDER_KEYFRAMES ?? "3", 10));

/** Fragment de schéma commun — même nom, même sens partout. */
const IMAGES_PROP = {
  images: {
    type: "boolean",
    description: "Renvoyer des images ? Chaque image coûte ~550 tokens de ton contexte. Mets true SEULEMENT si tu as besoin de VOIR (vérifier un cadrage, une position de caption). Sur une longue série, laisse false : le texte suffit à te repérer.",
  },
} as const;

/** Lecture du paramètre `images` avec la valeur par défaut de CET outil. */
function wantImages(args: Record<string, unknown> | undefined, byDefault: boolean): boolean {
  const v = args?.images;
  return typeof v === "boolean" ? v : byDefault;
}

/** Retire les options d'AFFICHAGE d'un objet qui va être persisté comme PLAN.
 *  create_variant reçoit les deux mélangés ; sans ce tri, `images` finissait
 *  enregistré dans le montage et ressortait dans get_variant comme s'il en
 *  faisait partie. */
function stripDisplayOpts<T extends Record<string, unknown>>(o: T): Omit<T, "images"> {
  const { images: _drop, ...plan } = o;
  void _drop;
  return plan;
}

/** Champs d'UNE piste sonore — partagés par `audio` (raccourci) et `audioTracks[]`. */
const AUDIO_TRACK_PROPS = {
  materialId: { type: "string", description: "id (de list_material) d'une matière audio ou vidéo (on prend sa piste son)." },
  atSec: { type: "number", description: "Instant DU MONTAGE (s) où la piste DÉMARRE. Défaut 0. Ex. voix off après un hook de 2,5 s → atSec: 2.5 ; un clic sur l'action à 4,2 s → atSec: 4.2." },
  startSec: { type: "number", description: "Point d'entrée DANS le fichier source (s). Défaut 0. Ex. sauter l'intro d'une musique → startSec: 12." },
  endSec: { type: "number", description: "Seconde DU MONTAGE où la piste S'ARRÊTE. Absent = jusqu'à la fin du fichier (ou du montage)." },
  volume: { type: "number", description: "0-2 (1 = normal). Musique sous une voix : 0.4-0.7." },
  mode: { type: "string", enum: ["mix", "replace"], description: "mix (défaut) = par-dessus le son des plans ; replace = coupe le son des plans PENDANT la fenêtre de cette piste seulement (le reste de la vidéo garde son son)." },
  duck: { description: "La piste BAISSE automatiquement quand une voix parle (son des plans + pistes role \"voice\"), puis remonte. Pour une musique sous de la parole. true = défauts (~12 dB, attack 0.1 s, release 0.4 s), ou { enabled, threshold (0-1), reduction (dB), attack (s), release (s) }.", anyOf: [{ type: "boolean" }, { type: "object", properties: { enabled: { type: "boolean" }, threshold: { type: "number" }, reduction: { type: "number" }, attack: { type: "number" }, release: { type: "number" } } }] },
  role: { type: "string", enum: ["voice", "music", "sfx"], description: "Qui fait baisser qui : \"voice\" déclenche le ducking des pistes duck ; \"music\" et \"sfx\" ne déclenchent rien (un clic ne doit pas creuser la musique). Défaut : music si duck, sinon voice — METS \"sfx\" sur les bruitages." },
  fadeIn: { type: "number", description: "Montée progressive au démarrage de la piste (s, 0-5)." },
  fadeOut: { type: "number", description: "Descente progressive à la fin de la piste (s, 0-5)." },
} as const;

export type Content =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export const TOOLS = [
  {
    name: "get_reference",
    description:
      "Récupère la vidéo de RÉFÉRENCE analysée du dernier projet du user : ses IMAGES CLÉS (que tu peux voir), sa transcription, son rythme (coupes) et ses métadonnées. Sers-t'en pour comprendre la structure à reproduire (hook, rythme, style).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_material",
    description:
      "Liste la MATIÈRE première du user (rushes vidéo / images) du dernier projet, avec la description de chaque fichier et une vignette. C'est le footage à utiliser pour reproduire la référence.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_variant",
    description:
      "Assemble UNE variante vidéo selon TON plan de montage. Contrôles : segments coupés ; captions stylables (contour/box, couleur, contour, taille, position x/y en %, alignement) ; images animées (zoomIn/zoomOut/panLeft/panRight + cadrage cover/contain/blurFill) ; colorimétrie globale (grade) ; fps ; couleur de fond. Le son des plans vidéo est CONSERVÉ. " +
      "IMPORTANT : cet outil te RENVOIE des keyframes du rendu + la durée réelle → REGARDE-LES pour vérifier cadrage/rythme/captions, et rappelle l'outil pour corriger. " +
      "RENDU LONG : si la vidéo n'est pas prête au bout de ~25 s, tu reçois un TICKET (renderId) au lieu d'attendre — récupère-la avec get_render(renderId), qui patiente et répond dès que c'est prêt. Ne relance PAS create_variant dans ce cas : le rendu est déjà en cours. " +
      "⚠ UNE VARIANTE À LA FOIS — le serveur n'en rend que 2 en parallèle. Si le user en demande plusieurs (« fais-m'en 10 »), NE LES LANCE PAS D'UN COUP : tu obtiendrais une file de 8 rendus en attente, chacun repoussé de plusieurs minutes, sans rien accélérer. Lance-en une, récupère-la avec get_render, PUIS lance la suivante. Tu peux au maximum en avoir 2 en vol. Si tu reçois un ticket « ⏸ EN FILE », c'est que tu en as déjà trop lancé : attends, n'en ajoute pas. " +
      "MISE EN PAGE DES CAPTIONS — un texte à deux lignes bien pleines, JAMAIS un mot tout seul en bas. Une caption dont la dernière ligne ne porte qu'un mot, un emoji ou une ponctuation est ratée : elle se lit mal et fait amateur. Le moteur équilibre les lignes et ne coupe plus au milieu d'un nombre, mais il ne peut pas deviner que ton texte est trop long. À toi de : ① écrire COURT (une caption = une idée, 3-6 mots tiennent sur une ligne, 8-12 sur deux) ; ② si le rendu montre 3 lignes ou une ligne famélique, BAISSE fontSize de 10-15 % ou raccourcis le texte, puis rappelle l'outil. Le cadre utile fait 90 % de la largeur. Tu as les keyframes du rendu : REGARDE la caption avant de passer à la suite. Exception : si la réf empile volontairement des lignes courtes, ou si le user le demande. " +
      "ANIMATIONS — PAR DÉFAUT, RIEN. `animation` reste \"none\" et les effets de plan (zoomPunch, shake, transitions autres que le cut) ne s'utilisent PAS de ta propre initiative. Tu n'animes QUE dans deux cas : ① le user le demande ; ② get_reference a MESURÉ l'effet dans la vidéo de référence (captions[].animation, transition d'une coupe, mouvement d'un plan) — une impression ou un « ça ferait joli » ne suffit pas. Ajouter du mouvement non demandé, c'est s'éloigner de la réf, et le user doit tout refaire. Dans le doute : brut. " +
      "SYNCHRO MUSIQUE : les timecodes mesurés sur la matière sonore (get_material → beats, drops, énergie) s'utilisent DIRECTEMENT — cale captions[].startSec et les transitions segments[].transition sur les beats/drops (ex. une transition PILE sur un drop, un caption qui apparaît sur un temps fort). ⚠ Ces timecodes sont en temps DU FICHIER : si la piste est posée avec atSec/startSec, l'instant dans le montage = atSec + (t − startSec). " +
      "SON MULTIPISTE : audioTracks[] pose plusieurs sons sur la timeline — musique dès 0 s (duck), voix off qui démarre après le hook (atSec), bruitages ponctuels (role \"sfx\"). N'ajoute de bruitage QUE si le user en fournit et en veut (ou si la réf en a de MESURÉS) — jamais de son de ta propre initiative. " +
      "FIDÉLITÉ MOTION & RYTHME : reproduis le MONTAGE de la réf, pas seulement son texte. get_reference te donne le rythme (nb de coupes · durée moyenne d'un plan) + par plan le mouvement (type+intensité → motion/motionIntensity/scale), la vitesse (speed), les freeze (freezeAt/freezeDuration) et la transition de chaque coupe (→ transition). Colle à la CADENCE : si la réf coupe ~toutes les 1,2 s, garde des plans courts et punchy ; ne laisse pas de plan mou de 6 s là où la réf en enchaîne cinq. Cale les zoomPunch/shakeAt/transitions percutantes sur les beats/drops de la musique. " +
      "NETTOYAGE DU RUSH (le user envoie ses RUSHS BRUTS, pas une vidéo déjà montée — c'est à TOI de la rendre publiable) : get_material te donne la VOIX horodatée, les MOTS, les ✂️ BLANCS, les ⏱ MICRO-PAUSES et les 🔁 REPRISES. Découpe le rush en PLUSIEURS segments[] du MÊME fichier (même materialId, [startSec,endSec] différents) qui GARDENT la parole et SAUTENT : les ✂️ BLANCS, les plages 🔁 REPRISES (le locuteur se rate puis répète — tu gardes la DERNIÈRE prise, qui commence à la fin de la plage) et toute redite restante visible dans le transcript. Les ⏱ MICRO-PAUSES (0,15-0,5 s, INTRA-phrase) ne se sautent pas : SUBDIVISE le segment en 2 segments contigus (fin du 1er = début de la pause, début du 2e = fin de la pause, cut sec) → débit resserré, raccord invisible. Coupe TOUJOURS aux frontières de silence, jamais en plein mot. " +
      "LIGNE À NE PAS FRANCHIR : tu enlèves seulement le DÉCHET (blancs, hésitations, ratés, redites). Tu ne choisis JAMAIS « le propos », tu ne réordonnes pas, tu ne réécris pas, tu ne sélectionnes pas « le meilleur passage » : le contenu et l'ordre restent ceux du user. C'est SA prise, juste nettoyée. " +
      "B-ROLL / CUTAWAYS : quand la réf insère des plans d'illustration pendant que la voix continue (get_reference → 🎞 CUTAWAY), reproduis-les avec LA MATIÈRE DU USER uniquement : son image/clip en overlay PLEIN CADRE ({ x: 0, y: 0, width: 100, height: 100 }) sur la fenêtre du plan qui parle — le son du plan continue dessous. Choisis l'asset dont la description colle au propos du moment. Pas d'asset adapté → pas de b-roll : JAMAIS de stock, jamais de contenu externe. Même sans réf b-roll, tu PEUX en placer sobrement (1-2 s) pour renourrir l'œil si le user a des assets pertinents. " +
      "Durées : segment libre (borné à la longueur du fichier pour une vidéo) ; défaut image = 2,5 s. Jusqu'à 40 segments (un même rush peut être découpé en DIZAINES de micro-plans : les décodeurs sont mutualisés par fichier — montage rythmé 0,9 s/plan OK), 150 captions (sous-titrage mot-à-mot complet). DURÉE TOTALE MAX = 90 s (cible short-form) : au-delà, le rendu est refusé — retire ou raccourcis des plans.",
    inputSchema: {
      type: "object",
      properties: {
        aspect: { type: "string", enum: ["9:16", "1:1", "16:9"], description: "Format (défaut 9:16)." },
        emojiStyle: { type: "string", enum: ["apple", "3d", "flat"], description: "Style des emojis de TOUTES les captions. RÈGLE : toujours \"apple\" (emojis iPhone, look natif iOS) — c'est le défaut, omets simplement ce champ. N'utilise \"3d\" (Fluent 3D) ou \"flat\" (Twemoji) QUE si le user les demande explicitement ; si le choix te revient, c'est toujours \"apple\". Surchargable par caption." },
        fps: { type: "number", description: "Images/s de sortie (15-60, défaut 30)." },
        background: { type: "string", description: "Couleur de fond des bandes (letterbox) en hex. Défaut noir." },
        grade: {
          type: "object",
          description: "Colorimétrie GLOBALE (optionnel). ⚠️ SOBRIÉTÉ : c'est un ASSAISONNEMENT, pas une sauce — PAS de grade par défaut (omets le champ). N'en mets que si la réf a une ambiance marquée, et alors passe le gradeSuggested de get_reference TEL QUEL (écart MESURÉ réf↔matière) sans l'amplifier. Si tu règles à la main, reste dans ±10-15 % du neutre (ex. saturation 0.9-1.15). Le moteur PLAFONNE de toute façon (saturation ≤ 1.3, contraste 0.7-1.35, brightness ±0.3, température ±0.5) : demander plus n'aura aucun effet.",
          properties: {
            saturation: { type: "number", description: "1 = neutre. Plage utile 0.9-1.15 ; plafond moteur 1.3 ; 0 = noir & blanc (style assumé)." },
            contrast: { type: "number", description: "1 = neutre. Plage utile 0.95-1.15 ; plafond moteur 0.7-1.35." },
            brightness: { type: "number", description: "0 = neutre. Plage utile ±0.08 ; plafond moteur ±0.3." },
            temperature: { type: "number", description: "Teinte : - froid (bleuté) .. + chaud (doré), 0 neutre. Plage utile ±0.2 ; plafond moteur ±0.5." },
            grain: { type: "number", description: "0..1 : grain filmique. Plage utile ≤ 0.25." },
            vignette: { type: "boolean", description: "Assombrit les bords." },
          },
        },
        audio: {
          type: "object",
          description: "RACCOURCI pour UNE seule piste (musique sur toute la variante) — équivaut à audioTracks: [audio]. Dès qu'il y a plus d'un son (voix off + musique, bruitages), utilise audioTracks.",
          properties: AUDIO_TRACK_PROPS,
          required: ["materialId"],
        },
        audioTracks: {
          type: "array",
          description:
            "PISTES SONORES MULTIPLES, chacune posée à SON instant du montage. Cas typique : musique dès 0 s (duck: true, volume 0.6) + voix off qui démarre APRÈS le hook (atSec: 2.5, mode \"replace\" si les plans parlent dessous) + bruitages ponctuels (clic, whoosh : role \"sfx\", atSec calé sur l'action). " +
            "Deux horloges à ne pas confondre : atSec = instant DU MONTAGE où la piste démarre ; startSec = point d'entrée DANS le fichier. endSec = seconde DU MONTAGE où la piste s'arrête. " +
            "Même fichier réutilisable plusieurs fois (10 clics = 10 entrées avec le même materialId). Max 16 pistes. Une piste ignorée (id faux, fichier sans son, fenêtre vide) est SIGNALÉE dans la réponse du rendu — lis-la.",
          items: { type: "object", properties: AUDIO_TRACK_PROPS, required: ["materialId"] },
        },
        segments: {
          type: "array",
          description: "Plans à enchaîner, dans l'ordre.",
          items: {
            type: "object",
            properties: {
              materialId: { type: "string", description: "L'\"id\" EXACT d'un fichier renvoyé par list_material (champ « id: … »). PAS le nom du fichier ni l'UUID du nom." },
              startSec: { type: "number", description: "début de la coupe dans le fichier (s)." },
              endSec: { type: "number", description: "fin de la coupe (s). Pour une image : durée d'affichage." },
              motion: { type: "string", enum: ["none", "zoomIn", "zoomOut", "panLeft", "panRight", "handheld"], description: "Mouvement de caméra simulé — s'applique aux IMAGES **ET aux RUSHES VIDÉO** (punch-in progressif sur un rush). zoomIn/zoomOut, panLeft/panRight, handheld = tremblé continu. Se compose avec scale/offsetX/offsetY. Défaut none. Réf : get_reference → plans[].mouvement (type + intensité)." },
              motionIntensity: { type: "number", description: "Force du mouvement (0.2-3, défaut 1)." },
              fit: { type: "string", enum: ["contain", "cover", "blurFill"], description: "IMAGES, cadrage : blurFill (DÉFAUT, image centrée sur fond flou — idéal vertical) ; cover (remplit en recadrant) ; contain (bandes noires)." },
              transition: { type: "string", enum: ["cut", "fade", "whipPan", "slide", "zoomPunch", "flash", "glitch"], description: "Transition à l'ENTRÉE de ce plan (le 1er reste en cut). flash = passage bref au blanc/noir (coupe sur un drop — voir flashColor) ; glitch = rafale numérique (décalage canaux R/B + bruit) sur l'ouverture du plan (voir glitchIntensity). Défaut cut." },
              transitionDuration: { type: "number", description: "Durée de la transition en s (0.1-0.4 typique ; flash/glitch ~0.15-0.2). Bornée à la durée des plans." },
              flashColor: { type: "string", description: "Pour transition \"flash\" : \"white\" (défaut) ou \"black\", ou hex." },
              glitchIntensity: { type: "number", description: "Pour transition \"glitch\" : 0-1 (défaut 0.6) — ampleur du décalage de canaux et du bruit." },
              volume: { type: "number", description: "Volume du SON DE CE PLAN, 0-2 (défaut 1). 0 = muet — débloque le format « voix off + plans b-roll silencieux »." },
              mute: { type: "boolean", description: "true = plan MUET (raccourci volume 0)." },
              speed: { type: "number", description: "VIDÉO : vitesse de lecture 0.25-4 (défaut 1). <1 = ralenti, >1 = accéléré. L'audio du plan suit (pitch modifié). Ignoré sur les images. Réf : get_reference → plans[].speed." },
              freezeAt: { type: "number", description: "VIDÉO : timecode (s) DANS le fichier où faire un ARRÊT SUR IMAGE (freeze). À utiliser avec freezeDuration. Réf : get_reference signale le freeze + son timecode." },
              freezeDuration: { type: "number", description: "Durée du gel en s (avec freezeAt)." },
              speedRamp: { type: "object", description: "VIDÉO : rampe de vitesse progressive sur le plan (accélération/décélération).", properties: { from: { type: "number", description: "Vitesse de départ (0.25-4)." }, to: { type: "number", description: "Vitesse d'arrivée (0.25-4)." } } },
              reverse: { type: "boolean", description: "VIDÉO : lecture inversée (vidéo + audio). Levier d'unicité." },
              scale: { type: "number", description: "RECADRAGE : zoom/punch-in dans l'image, 1-3 (défaut 1). Se compose avec motion (le mouvement passe par-dessus). Réf : get_reference indique où est le sujet (subject x/y %)." },
              offsetX: { type: "number", description: "RECADRAGE : position horizontale du recadrage, -50 à 50 % (agit si scale>1 → pour punch-in sur un sujet décentré). Défaut 0 (centre)." },
              offsetY: { type: "number", description: "RECADRAGE : position verticale, -50 à 50 %. Défaut 0." },
              flipH: { type: "boolean", description: "Miroir horizontal — levier d'unicité classique en reposting." },
              flipV: { type: "boolean", description: "Miroir vertical." },
              rotate: { type: "number", description: "Rotation en degrés." },
              layout: { type: "string", enum: ["single", "splitH", "splitV", "pip"], description: "COMPOSITION multi-média : single (défaut) ; splitV (2 médias empilés haut/bas) ; splitH (côte à côte) ; pip (incrustation). Le 2e média d'un split, et les incrustations, sont listés dans overlays[]. Réf : get_reference signale si un plan est un split/une incrustation." },
              overlays: {
                type: "array",
                description: "Médias additionnels compositée dans le plan (réaction, avant/après, watermark, écran d'app…). En split, overlays[0] = 2e panneau ; le reste = incrustations. LAYOUTS COMPOSÉS (edits type OpusClip) — 2 patterns clés : ① SPEAKER EN BULLE : le MÊME rush que le plan en overlay avec shape:\"circle\", width 25-35, en bas — le son du plan continue, l'image se réduit en bulle ronde ; ajoute une carte sombre plein cadre DERRIÈRE (zIndex plus petit) et des captions par-dessus pour le look « liste + bulle ». ② B-ROLL/CUTAWAY : un asset du user (image/clip) en overlay PLEIN CADRE (x0 y0 width 100 height 100) sur 1-2 s pendant que la voix du plan continue. ③ CARTE : color sans materialId = panneau/fond/badge de couleur.",
                items: {
                  type: "object",
                  properties: {
                    materialId: { type: "string", description: "id (list_material) du média à incruster. OMIS si `color` (carte de couleur)." },
                    color: { type: "string", description: "CARTE DE COULEUR (sans materialId) : rectangle de couleur unie #RRGGBB — panneau plein cadre derrière une liste, fond de bloc, badge. Combine avec borderRadius/width/height." },
                    x: { type: "number", description: "Position coin haut-gauche, % du cadre (0-100)." },
                    y: { type: "number", description: "Position verticale, % du cadre." },
                    width: { type: "number", description: "Largeur de l'incrustation, % du cadre (5-100)." },
                    height: { type: "number", description: "Hauteur, % du cadre — le média est RECADRÉ (cover) dans la boîte largeur×hauteur. Absent = aspect de la source. Pour une carte : défaut = carrée." },
                    shape: { type: "string", enum: ["rect", "square", "circle"], description: "square = recadre la source en CARRÉ ; circle = BULLE RONDE (le layout « speaker en bulle » des edits face-cam). Défaut rect." },
                    startSec: { type: "number", description: "Apparition, relative au plan." },
                    sourceStartSec: { type: "number", description: "Point d'entrée DANS le média source (s) — sans lui, chaque overlay rejoue sa frame 0 (3 réutilisations du même clip = 3× la même seconde)." },
                    endSec: { type: "number", description: "Disparition, relative au plan." },
                    opacity: { type: "number", description: "0-1 (défaut 1)." },
                    borderRadius: { type: "number", description: "Coins arrondis en px (@1080) — appliqués via masque alpha (marche sur média ET carte)." },
                    zIndex: { type: "number", description: "Ordre d'empilement (petit = dessous)." },
                    enter: { type: "string", enum: ["none", "slideLeft", "slideRight", "slideUp", "slideDown", "fade", "pop"], description: "Comment l'incrustation ENTRE dans le cadre. slide* = direction du MOUVEMENT : slideUp glisse vers le haut (entre par le bas), slideDown par le haut, slideLeft par la droite, slideRight par la gauche. fade = fondu ; pop = fondu rapide. Défaut none (apparition sèche). Une seule fenêtre suffit : ne découpe plus un plan en sous-segments pour bouger l'incrustation." },
                    exit: { type: "string", enum: ["none", "slideLeft", "slideRight", "slideUp", "slideDown", "fade", "pop"], description: "Comment l'incrustation SORT du cadre. Même direction que enter = elle continue dans le même sens (slideUp sort par le haut)." },
                    enterDuration: { type: "number", description: "Durée de l'entrée en s (défaut 0.4, max 3)." },
                    exitDuration: { type: "number", description: "Durée de la sortie en s (défaut 0.4, max 3)." },
                    easing: { type: "string", enum: ["linear", "easeOut", "spring"], description: "Courbe du mouvement : linear (constant) ; easeOut (décélère, défaut) ; spring (léger dépassement puis retour, effet ressort)." },
                  },
                },
              },
              grade: {
                type: "object",
                description: "Colorimétrie PROPRE à CE plan (surcharge le grade global). Ex. assombrir la dernière photo « avant » (brightness négatif) pendant le caption pivot pour la bascule visuelle. Réf : get_reference signale un plan assombri par rapport au reste. ⚠️ Même règle de SOBRIÉTÉ que le grade global : ±10-15 % max, seulement si la réf le justifie (plafonds moteur : sat ≤ 1.3, contraste 0.7-1.35, brightness ±0.3, temp ±0.5).",
                properties: {
                  saturation: { type: "number", description: "1 = neutre. Plage utile 0.9-1.15 ; 0 = noir & blanc." },
                  contrast: { type: "number", description: "1 = neutre. Plage utile 0.95-1.15." },
                  brightness: { type: "number", description: "0 = neutre. Plage utile ±0.08 ; négatif = plus sombre." },
                  temperature: { type: "number", description: "- froid .. + chaud. Plage utile ±0.2." },
                  grain: { type: "number", description: "0..1. Plage utile ≤ 0.25." },
                  vignette: { type: "boolean" },
                },
              },
              freezeGrade: {
                type: "object",
                description: "Colorimétrie appliquée UNIQUEMENT pendant la fenêtre de gel (freezeAt/freezeDuration) — ex. la vidéo tourne en couleur, se fige, et le freeze passe en NOIR ET BLANC (saturation 0) avec un texte dessus. Évite de couper le plan en deux. Mêmes clés que grade.",
                properties: {
                  saturation: { type: "number", description: "0 = noir et blanc." },
                  contrast: { type: "number", description: "1 = neutre." },
                  brightness: { type: "number", description: "0 = neutre (-1..1)." },
                  temperature: { type: "number", description: "-1 froid .. +1 chaud." },
                  grain: { type: "number", description: "0..1." },
                  vignette: { type: "boolean" },
                },
              },
              fadeIn: { type: "number", description: "FONDU d'OUVERTURE : le plan APPARAÎT depuis fadeColor sur N s (0-2). Un fadeOut sur le plan précédent + un fadeIn ici = passage au noir puis réapparition." },
              fadeOut: { type: "number", description: "FONDU de FERMETURE : le plan se fond vers fadeColor sur N s (0-2). C'est le vrai fondu au noir (≠ transition fade, qui est un fondu enchaîné borné à 0,4s)." },
              fadeColor: { type: "string", description: "Couleur du fondu : \"black\" (défaut) ou \"white\" (utile), ou hex #RRGGBB." },
              fadeEasing: { type: "string", enum: ["linear", "easeInOut"], description: "Courbe de l'assombrissement : linear (plat) ou easeInOut (accéléré-décéléré, effet cinéma — défaut)." },
              blurRegions: {
                type: "array",
                description: "MASQUAGE de zones (visage, pseudo, logo, numéro) sur du contenu reposté — nécessité, pas décoration. Chaque zone : position/taille en % du cadre, floutée ou pixelisée, sur une fenêtre. Réf : get_reference signale un flou de zone + sa position.",
                items: {
                  type: "object",
                  properties: {
                    x: { type: "number", description: "Coin haut-gauche, % du cadre (0-100)." },
                    y: { type: "number", description: "Position verticale, % du cadre." },
                    width: { type: "number", description: "Largeur, % du cadre." },
                    height: { type: "number", description: "Hauteur, % du cadre." },
                    intensity: { type: "number", description: "0-1 : force du flou / grossièreté des pixels (défaut 0.8)." },
                    shape: { type: "string", enum: ["rect", "ellipse"], description: "rect (défaut) ou ellipse (idéal pour un visage, bords adoucis)." },
                    mode: { type: "string", enum: ["blur", "pixelate"], description: "blur = flou gaussien (défaut) ; pixelate = mosaïque." },
                    startSec: { type: "number", description: "Apparition, relative au plan (défaut 0)." },
                    endSec: { type: "number", description: "Disparition, relative au plan (défaut : tout le plan)." },
                  },
                },
              },
              shakeAt: {
                type: "array",
                description: "SECOUSSES ponctuelles sur les temps forts (distinct de handheld qui est continu). Passe directement les timecodes de beats/drops que get_material te donne sur la matière audio.",
                items: {
                  type: "object",
                  properties: {
                    t: { type: "number", description: "Instant de la secousse, s relatives au plan." },
                    intensity: { type: "number", description: "0-1 (défaut 0.6)." },
                    duration: { type: "number", description: "Durée de la secousse en s (défaut ~0.18)." },
                  },
                  required: ["t"],
                },
              },
              zoomPunch: {
                type: "object",
                description: "COUP DE ZOOM d'accroche sur un temps fort (l'effet short-form le plus utilisé, à la CapCut) — plus percutant qu'un shakeAt. Cale `at` sur un beat/drop de get_material.",
                properties: {
                  at: { type: "number", description: "Instant du punch, s relatives au plan (0-based)." },
                  duration: { type: "number", description: "Durée du coup en s, 0.05-0.6 (défaut 0.2). Court = plus sec." },
                  amount: { type: "number", description: "Facteur de zoom au pic, 1.05-2.5 (défaut 1.4). 1.2-1.6 = punch net ; >1.8 = très agressif." },
                  direction: { type: "string", enum: ["in", "out"], description: "in (défaut) = zoom vers l'avant sur le beat ; out = le plan est zoomé et RECULE vers le cadre plein sur le beat." },
                  blur: { type: "number", description: "0-1 : flou synchronisé sur le punch (renforce l'impact). Défaut 0." },
                },
                required: ["at"],
              },
            },
            required: ["materialId"],
          },
        },
        captions: {
          type: "array",
          description: "Textes incrustés (optionnel). Pour un rendu « designé » style TikTok — mot multicolore ou police mixte au sein d'une même ligne — utilise `spans` (voir ce champ) au lieu de `text`. ⚠️ MISE EN PAGE : écris court et vérifie sur les keyframes du rendu qu'aucune ligne ne porte un mot ou un emoji tout seul — si c'est le cas, baisse fontSize ou raccourcis, ne laisse pas passer.",
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "Le texte. Les emojis 🔥💪🎉 sont rendus EN COULEUR — style iPhone/Apple par défaut, ou 3D/plat via emojiStyle. Utilise-les librement. OPTIONNEL si `spans` est fourni (le texte vient alors des spans). LONGUEUR : vise 3-6 mots (une ligne) ou 8-12 (deux lignes pleines). Au-delà, le texte part sur trois lignes et la dernière se retrouve avec un mot isolé — baisse fontSize ou coupe la caption en deux." },
              startSec: { type: "number" },
              endSec: { type: "number" },
              position: { type: "string", enum: ["top", "center", "bottom"], description: "Position rapide (défaut bottom). Ignorée si x/y fournis." },
              x: { type: "number", description: "Centre horizontal en % (0-100)." },
              y: { type: "number", description: "Centre vertical en % (0-100). Ex. réf ≈ 13 (haut)." },
              align: { type: "string", enum: ["left", "center", "right"], description: "Alignement des LIGNES à l'intérieur du bloc multi-lignes (défaut center) — ne déplace PAS le bloc à l'écran (ça, c'est x/y)." },
              style: { type: "string", enum: ["outline", "box", "sticker"], description: "outline = gros texte contour (défaut) ; box = fond ; sticker = RACCOURCI style TikTok/IG (fond OPAQUE à coins très arrondis + padding généreux + texte gras sans contour). Avec sticker, donne juste background (couleur du bloc) et color (texte) ; le reste est réglé automatiquement." },
              background: { type: "string", description: "Couleur de fond hex → force le style box ; \"none\" → force outline (sans fond). Le fond est désormais OPAQUE par défaut." },
              backgroundOpacity: { type: "number", description: "Opacité du fond 0-1 (défaut 1 = opaque). Baisse-la pour un fond translucide." },
              borderRadius: { type: "number", description: "Coins arrondis du fond en px (@1080). 30-40 = look sticker arrondi ; 0 = coins droits." },
              padding: { type: "number", description: "Marge intérieure du fond en px (@1080), horizontale ET verticale." },
              paddingX: { type: "number", description: "Marge intérieure horizontale en px (@1080). Prioritaire sur padding." },
              paddingY: { type: "number", description: "Marge intérieure verticale en px (@1080). Prioritaire sur padding." },
              size: { type: "string", enum: ["s", "m", "l"], description: "Taille rapide (défaut m)." },
              fontSize: { type: "number", description: "Taille en px (référence 1080 de large). Prioritaire sur size." },
              color: { type: "string", description: "Couleur du texte en hex. Défaut blanc. Ignoré si `fill` est fourni." },
              fill: {
                type: "object",
                description: "REMPLISSAGE du texte. Prioritaire sur `color`. « gradient » = dégradé CONTINU sur tout le bloc (le premier mot démarre sombre, le dernier finit clair) — c'est le rendu « métallique » gris→blanc ou doré omniprésent en short-form. À utiliser dès que get_reference signale « ⚠ REMPLISSAGE NON UNI ». Le contour et l'ombre restent UNIS.",
                properties: {
                  type: { type: "string", enum: ["solid", "gradient"], description: "solid = couleur unie (équivaut à `color`) ; gradient = dégradé." },
                  color: { type: "string", description: "solid : la couleur hex." },
                  colors: { type: "array", description: "gradient : les couleurs hex DANS L'ORDRE (2 minimum).", items: { type: "string" } },
                  angle: { type: "number", description: "gradient : direction en degrés. 0 = gauche→droite, 90 = haut→bas, 135 = diagonale." },
                  stops: { type: "array", description: "gradient : positions 0-1 des arrêts (défaut : réparties également).", items: { type: "number" } },
                },
                required: ["type"],
              },
              strokeColor: { type: "string", description: "Couleur du contour (style outline). Défaut noir. \"none\" = PAS de contour (style ombre douce seule)." },
              strokeWidth: { type: "number", description: "Épaisseur du contour en px. 0 = pas de contour." },
                            font: { type: "string", enum: CAPTION_FONTS, description: `Famille de police, parmi le catalogue : ${fontCatalogLines()}.` },
              fontWeight: { type: "number", description: "Graisse 100-900." },
              italic: { type: "boolean", description: "Texte en italique." },
              underline: { type: "boolean", description: "Texte souligné." },
              letterSpacing: { type: "number", description: "Interlettrage en px." },
              lineHeight: { type: "number", description: "Interligne (multiplicateur, défaut 1.24)." },
              textTransform: { type: "string", enum: ["none", "uppercase", "lowercase", "capitalize"], description: "uppercase = TOUT EN MAJUSCULES · lowercase = tout en minuscules · capitalize = Première Lettre De Chaque Mot." },
              shadowColor: { type: "string", description: "Ombre portée (hex) — distincte du contour ; \"none\" pour aucune." },
              shadowBlur: { type: "number", description: "Flou de l'ombre en px." },
              shadowOffset: { type: "number", description: "Décalage de l'ombre en px (bas-droite)." },
              emojiStyle: { type: "string", enum: ["apple", "3d", "flat"], description: "Style des emojis de CETTE caption : \"apple\" (iPhone) | \"3d\" (Fluent 3D) | \"flat\" (Twemoji). Prioritaire sur le défaut du plan. RÈGLE : ne renseigne ce champ QUE si le user demande explicitement un style non-Apple ; sinon omets-le, le défaut \"apple\" s'applique toujours." },
              animation: { type: "string", enum: ["none", "fade", "pop", "slideUp", "typewriter", "wordByWord", "karaoke"], description: "Animation d'apparition. DÉFAUT \"none\", ET C'EST LA RÈGLE : n'anime que si le user le demande, ou si get_reference → captions[].animation l'a MESURÉ dans la réf. Pas de mouvement ajouté « pour faire joli » — le user devrait tout refaire. wordByWord = mots l'un après l'autre ; karaoke = tous visibles, mot actif surligné (highlightColor)." },
              animationDuration: { type: "number", description: "Durée de l'animation d'entrée en s (défaut ~0.35)." },
              exitAnimation: { type: "string", enum: ["none", "fade", "pop", "slideUp", "slideDown"], description: "Animation de SORTIE : comment la caption disparaît à endSec — fade (fondu), pop (fondu rapide), slideUp/slideDown (glisse en fondu vers le haut/bas). Défaut none (coupe nette). Compose avec l'animation d'entrée (ex. slideUp d'entrée + slideUp de sortie = passage fluide). Ignorée pour wordByWord/karaoke. NB : fade et pop d'entrée ont déjà un léger fondu de sortie automatique." },
              exitDuration: { type: "number", description: "Durée de la sortie en s (défaut ~0.35, pop ~0.18)." },
              counter: {
                type: "object",
                description: "COMPTEUR ANIMÉ : le texte devient un NOMBRE qui défile de `from` à `to` sur [startSec,endSec], easing easeOut (file vite puis se pose sur la valeur finale) — le classique « 0 € → 10 000 € » du short-form. REMPLACE text/spans/animation ; le style de la caption (police, couleur, contour, position, taille) s'applique au nombre. Séparateur de milliers automatique. Ex. { from: 0, to: 10000, suffix: \" €\" }.",
                properties: {
                  from: { type: "number", description: "Valeur de départ." },
                  to: { type: "number", description: "Valeur finale (affichée exactement à la fin)." },
                  decimals: { type: "number", description: "Nombre de décimales (0-3, défaut 0)." },
                  prefix: { type: "string", description: "Texte avant le nombre (ex. \"+\")." },
                  suffix: { type: "string", description: "Texte après le nombre (ex. \" €\", \" abonnés\")." },
                },
                required: ["from", "to"],
              },
              words: { type: "array", description: "Pour wordByWord/karaoke : timing par mot (sinon réparti automatiquement sur [startSec,endSec]). Utilise les MOTS horodatés de get_material TEL QUEL pour caler sur la voix. `color` (optionnel) = couleur STATIQUE de ce mot (mot-clé en relief dans sa phrase) — compose avec l'animation ; pour une caption FIXE multicolore, utilise plutôt `spans`.", items: { type: "object", properties: { text: { type: "string" }, start: { type: "number" }, end: { type: "number" }, color: { type: "string", description: "Couleur hex de CE mot (ex. mot-clé en jaune) — marche avec wordByWord ET karaoke." } } } },
              highlightColor: { type: "string", description: "karaoke : couleur hex du mot actif." },
              glow: { type: "object", description: "Effet NÉON : cœur clair (color de la caption) + halo saturé autour. Style pivot omniprésent en short-form.", properties: { color: { type: "string", description: "Couleur hex du halo néon." }, intensity: { type: "number", description: "0.2-3 (défaut 1) : taille/densité du halo." } } },
              spans: {
                type: "array",
                description:
                  "Caption « designée » style TikTok : découpe le texte en PORTIONS qui ont chacune leur couleur et/ou leur police — mot multicolore (blanc/vert/jaune), un mot clé en script pendant que le reste est en gras, etc. QUAND tu fournis spans, il REMPLACE `text` : le texte affiché = la concaténation des `text` des spans (séparés par une espace, dans l'ordre). Chaque span hérite des réglages globaux de la caption (color, font, fontWeight, contour, ombre…) SAUF ce qu'il redéfinit. Mets les emojis dans leur propre span (leur couleur est ignorée : rendus en image). Compatible avec startSec/endSec, position, style, glow, textTransform. Ex. multicolore : [{text:\"TO THE\"},{text:\"LOWER\",color:\"#2ecc40\"},{text:\"LEVELS\",color:\"#ffdc00\"},{text:\"👏\"}] — ex. police mixte : [{text:\"think body\"},{text:\"Pilates\",font:\"script\",italic:true},{text:\"is\"}].",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: "La portion de texte (un ou plusieurs mots)." },
                    color: { type: "string", description: "Couleur hex de CETTE portion (sinon couleur globale de la caption)." },
                                        font: { type: "string", enum: CAPTION_FONTS, description: `Police de CETTE portion (sinon police globale). Catalogue : ${fontCatalogLines()}.` },
                    italic: { type: "boolean", description: "Passe CETTE portion en italique." },
                    weight: { type: "number", description: "Graisse 100-900 de CETTE portion (sinon graisse globale)." },
                    fill: { type: "object", description: "Remplissage de CETTE portion (mêmes champs que captions[].fill) — ex. un seul mot en dégradé doré. Écrase le remplissage global.", properties: { type: { type: "string", enum: ["solid", "gradient"] }, color: { type: "string" }, colors: { type: "array", items: { type: "string" } }, angle: { type: "number" }, stops: { type: "array", items: { type: "number" } } } },
                    fontSize: { type: "number", description: "Taille de CETTE portion en px (@1080) — emphase à DEUX TAILLES dans un même bloc (« to have this » petit, « SINK IN » énorme). Sinon taille globale." },
                  },
                  required: ["text"],
                },
              },
            },
            required: ["startSec", "endSec"],
          },
        },
        label: { type: "string", description: "nom court de la variante (ex. hook utilisé)." },
        ...IMAGES_PROP,
      },
      required: ["segments"],
    },
  },
  {
    name: "get_render",
    description:
      "Récupère une variante dont le RENDU EST EN COURS (ticket renvoyé par create_variant / update_variant). Un montage lourd (beaucoup de plans, de sous-titres, rushs 4K) prend couramment 2 à 5 minutes : create_variant te rend alors un ticket au lieu de faire attendre la conversation. " +
      "Appelle get_render avec ce renderId : l'appel PATIENTE jusqu'à ~25 s et te répond dès que la vidéo est prête (avec ses images) ; si c'est encore en cours, rappelle-le. " +
      "NE RELANCE JAMAIS create_variant pour un rendu déjà en cours : tu lancerais un second rendu qui occuperait une place et ralentirait tout. " +
      "FILE D'ATTENTE : le serveur ne rend que 2 variantes à la fois — au-delà, les rendus ATTENDENT LEUR TOUR (statut « ⏸ EN FILE », avec leur position). Un rendu en file ne consomme rien et n'est pas perdu, il n'a simplement pas commencé. " +
      "Sans renderId, l'outil te donne l'état complet : ce qui rend, ce qui attend, et à quelle place. " +
      "Un rendu inutile ou anormalement long peut être STOPPÉ avec cancel_render(renderId) : il libère son créneau en quelques secondes et rien n'est facturé.",
    inputSchema: {
      type: "object",
      properties: {
        renderId: { type: "string", description: "Le ticket renvoyé par create_variant / update_variant (ex. « rj_a1b2c3d4 »). Omis → liste les rendus en cours." },
        ...IMAGES_PROP,
      },
    },
  },
  {
    name: "cancel_render",
    description:
      "ANNULE un rendu en cours ou en file (ticket renvoyé par create_variant / update_variant). Le ffmpeg en cours est tué, le créneau est libéré en quelques secondes et le quota est rendu — rien n'est facturé. " +
      "Sers-t'en quand un rendu est devenu inutile (le user a changé d'avis, un doublon est parti par erreur) ou qu'il bloque la file. Un rendu annulé est PERDU : pour une version corrigée, relance create_variant ensuite.",
    inputSchema: {
      type: "object",
      properties: {
        renderId: { type: "string", description: "Le ticket du rendu à annuler (ex. « rj_a1b2c3d4 »). get_render sans argument liste les tickets en cours." },
      },
      required: ["renderId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_variants",
    description:
      "Liste les variantes déjà générées pour le dernier projet : id, label, durée, date, filiation. RÉPONSE TEXTE — aucune image, pour ne pas saturer ton contexte (une liste de 40 variantes = 40 images = ~22 000 tokens perdus). " +
      "Passe images: true SEULEMENT si tu dois vraiment comparer visuellement. Pour reprendre le travail sur une variante, utilise get_variant : il te rend le PLAN DE MONTAGE complet.",
    inputSchema: { type: "object", properties: { ...IMAGES_PROP }, additionalProperties: false },
  },
  {
    name: "get_variant",
    description:
      "Renvoie LE PLAN DE MONTAGE COMPLET d'une variante déjà rendue : segments[], captions[], audio, grade, aspect, fps, label — exactement le payload qui a servi à la fabriquer, prêt à être relu, modifié et repassé à create_variant / update_variant. " +
      "C'EST TON OUTIL DE REPRISE : si tu arrives sur une conversation neuve (la précédente a été perdue / le user reprend une série commencée ailleurs), appelle-le sur les 1-2 dernières variantes — tu récupères en un appel les réglages exacts (timecodes de coupe, style et calage des captions, musique, colorimétrie) au lieu de tout redeviner. Ne redemande JAMAIS au user des réglages que cet outil peut te rendre. " +
      "Réponse TEXTE par défaut (le JSON, pas d'image). Passe images: true si tu as en plus besoin de VOIR le rendu.",
    inputSchema: {
      type: "object",
      properties: {
        variantId: { type: "string", description: "id de la variante." },
        ...IMAGES_PROP,
      },
      required: ["variantId"],
    },
  },
  {
    name: "get_material",
    description: "Renvoie 4-6 KEYFRAMES d'UN fichier de matière précis (par son id). Appelle-le SEULEMENT sur les 2-3 rushes que tu comptes vraiment utiliser (voir où couper) — pas sur tout, pour ne pas saturer ton contexte. Image → renvoie l'image + ses DIMENSIONS source (avec alerte si < 1080p → risque de flou en plein cadre). Vidéo/audio → beats/drops + la VOIX HORODATÉE (intervalles de parole [start–end]) + les ✂️ BLANCS à couper : cale tes captions sur la voix (sous-titres synchro) ET sers-toi des blancs pour NETTOYER le rush (voir create_variant → NETTOYAGE DU RUSH : garder la parole, sauter blancs/ratés/redites).",
    inputSchema: {
      type: "object",
      properties: {
        materialId: { type: "string", description: "id d'un fichier (de list_material)." },
        ...IMAGES_PROP,
      },
      required: ["materialId"],
    },
  },
  {
    name: "update_variant",
    description: "Modifie une variante existante SANS tout réécrire : donne son id + un patch (mêmes champs que create_variant, seulement ceux à changer). Ex. { captions:[...] } ne touche que les captions, garde les segments. Rend une NOUVELLE variante et renvoie ses keyframes.",
    inputSchema: {
      type: "object",
      properties: {
        variantId: { type: "string", description: "id de la variante à faire évoluer." },
        patch: { type: "object", description: "Champs à remplacer (segments, captions, grade, audio, fps, background, label…). Les champs absents gardent la valeur d'origine. Pour segments/captions : le tableau fourni REMPLACE l'ancien. Donne un label pour distinguer l'itération ; sinon il est auto-suffixé (v2, v3…)." },
      },
      required: ["variantId", "patch"],
    },
  },
  {
    name: "add_material",
    description:
      "AJOUTE de la matière (vidéo, image ou audio) au projet DuupFlow, toi-même, sans que le user ait à l'uploader. Trois sources possibles (UNE par appel) : " +
      "drive_file_id (un fichier Google Drive partagé avec le compte de service DuupFlow), drive_folder_id (tous les médias d'un dossier Drive partagé, 10 max), " +
      "ou url (lien https de téléchargement DIRECT vers le fichier, pas une page web). Mêmes limites que l'upload manuel : 300 Mo, vidéo 2 min, audio 4 min. " +
      "Les vidéos/audios sont analysés en tâche de fond : rappelle list_material avant de monter pour voir leur analyse. Crée le projet s'il n'en existe pas encore.",
    inputSchema: {
      type: "object",
      properties: {
        drive_file_id: { type: "string", description: "Id d'un fichier Google Drive (partagé avec le compte de service DuupFlow)." },
        drive_folder_id: { type: "string", description: "Id d'un dossier Google Drive : ajoute ses médias (10 max par appel)." },
        url: { type: "string", description: "Lien https de téléchargement direct du fichier." },
        description: { type: "string", description: "Description du contenu (ce qu'on voit / entend) — aide le montage." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "export_to_drive",
    description:
      "ENVOIE des variantes rendues dans le Google Drive du user, dans le dossier du créateur « <Créateur> — DuupFlow » (créé automatiquement ; « DuupFlow variantes » pour un compte sans créateurs). Tourne en tâche de fond : renvoie un TICKET (« dx_… ») à suivre avec get_drive_export. " +
      "Nécessite que le propriétaire du compte ait cliqué une fois « Connecter Google Drive » dans DuupFlow (sinon l'outil le dit). " +
      "Une fois terminé, le ticket donne l'id Drive (driveFileId) de chaque fichier créé : c'est à TOI de les déplacer ensuite vers les bons dossiers avec ton connecteur Google Drive. " +
      "Sans variant_ids, exporte toutes les variantes du projet.",
    inputSchema: {
      type: "object",
      properties: {
        variant_ids: { type: "array", items: { type: "string" }, description: "Ids des variantes à envoyer (list_variants). Vide = toutes." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "duplicate_videos",
    description:
      "DUPLIQUE des vidéos (le duplicateur de DuupFlow : copies uniques, indétectables comme doublons) avec TOUS les réglages de la page Duplication. " +
      "Sources : material_ids (vidéos du projet, voir list_material) et/ou urls (liens https directs), 10 max. count = copies PAR source (1-10). " +
      "mode « simple » (défaut) : packs à cocher + options ; mode « advanced » : plages précises par réglage (advanced_ranges). " +
      "Tourne en tâche de fond : renvoie un TICKET (« dup_… ») à suivre avec get_duplication. Consomme le quota vidéos du user (1 copie = 1 vidéo). " +
      "Ensuite, send_duplicates_to_editor envoie les copies en matière de l'Éditeur IA pour faire des variantes.",
    inputSchema: {
      type: "object",
      properties: {
        material_ids: { type: "array", items: { type: "string" }, description: "Ids de vidéos du projet (list_material)." },
        urls: { type: "array", items: { type: "string" }, description: "Liens https de téléchargement direct de vidéos." },
        count: { type: "integer", description: "Copies par vidéo source, 1 à 10 (défaut 1)." },
        mode: { type: "string", enum: ["simple", "advanced"], description: "simple (défaut) ou advanced." },
        packs: {
          type: "array",
          items: { type: "string", enum: ["metadata", "metadata_technical", "pixel_magic", "audio", "motion", "motion_dynamic", "visual"] },
          description: "Mode simple — packs : visual (couleurs), motion (mouvement), motion_dynamic (mouvement poussé), metadata, metadata_technical, pixel_magic, audio. Défaut : visual + motion + metadata_technical.",
        },
        watermark: { type: "boolean", description: "Mode simple — watermark visible aléatoire par copie." },
        options: {
          type: "object",
          description: "Mode simple — options : flip (bool, retournement vertical), mirror (bool, miroir horizontal — à éviter s'il y a du texte à l'écran), shake (bool, tremblement), motion_intensity (« doux » | « fort »), advanced_motion_intensity (« doux » | « fort »), rotation_deg (nombre, rotation aléatoire ± ce nombre de degrés), resize_factor (nombre, ex. 0.98).",
        },
        advanced_ranges: {
          type: "object",
          description: "Mode advanced — { réglage: { enabled, min, max } } pour : flip, reverse, saturation, contrast, brightness, gamma, hue_rad, vignette, noise, lens_k, unsharp, speed, zoom, pixelshift, rotation_deg, fps, dyn_crop, prog_rotate, prog_zoom, shake, border_px, vbitrate, gop, cut_start, cut_end, volume_db, afreq_hz, abitrate_k, pitch, dim_w, dim_h. Le moteur borne lui-même les valeurs.",
        },
        country: { type: "string", description: "Code pays ISO à 2 lettres pour les métadonnées de localisation (ex. FR, US)." },
        iphone_meta: { type: "boolean", description: "Métadonnées réalistes d'iPhone." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "duplicate_images",
    description:
      "DUPLIQUE des images avec les réglages de la page Duplication (réponse directe, pas de ticket). Sources : material_ids (images du projet) et/ou urls (liens https directs), 10 max. " +
      "count = copies PAR image (1-20). Consomme le quota images du user. Ensuite, send_duplicates_to_editor peut les envoyer en matière de l'Éditeur IA.",
    inputSchema: {
      type: "object",
      properties: {
        material_ids: { type: "array", items: { type: "string" }, description: "Ids d'images du projet (list_material)." },
        urls: { type: "array", items: { type: "string" }, description: "Liens https de téléchargement direct d'images." },
        count: { type: "integer", description: "Copies par image, 1 à 20 (défaut 1)." },
        options: { type: "object", description: "fundamentals (bool, défaut true), semi (bool, défaut true), visuals (bool, défaut false), mirror (bool, miroir horizontal)." },
        country: { type: "string", description: "Code pays ISO à 2 lettres (métadonnées de localisation)." },
        iphone_meta: { type: "boolean", description: "Métadonnées réalistes d'iPhone." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_duplication",
    description: "Suit une duplication vidéo (ticket « dup_… ») : progression, puis la liste des copies produites. Patiente jusqu'à ~25 s si c'est en cours. Sans ticket : duplications récentes + copies récentes du créateur.",
    inputSchema: { type: "object", properties: { ticket: { type: "string", description: "Ticket de la duplication." } }, additionalProperties: false },
  },
  {
    name: "send_duplicates_to_editor",
    description:
      "ENVOIE des copies dupliquées en MATIÈRE de l'Éditeur IA (projet du créateur en cours), pour ensuite faire des variantes avec create_variant. " +
      "Donne le ticket d'une duplication vidéo (toutes ses copies) et/ou files (noms de fichiers renvoyés par duplicate_videos / duplicate_images). 20 max. Mêmes limites que la matière (vidéo ≤ 2 min).",
    inputSchema: {
      type: "object",
      properties: {
        ticket: { type: "string", description: "Ticket « dup_… » : envoie toutes ses copies." },
        files: { type: "array", items: { type: "string" }, description: "Noms de fichiers de copies." },
        description: { type: "string", description: "Description de la matière (aide le montage)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drive_status",
    description:
      "Dit si Google Drive est connecté à DuupFlow, avec quel compte, et le dossier Drive du créateur en cours. Si ce n'est pas connecté, renvoie le CHEMIN EXACT à indiquer au user pour le connecter. " +
      "Appelle-le quand le user demande où vont ses exports, ou avant export_to_drive si tu n'es pas sûr.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_drive_export",
    description:
      "Suit un export Drive (ticket « dx_… » renvoyé par export_to_drive) : état de chaque fichier et son driveFileId une fois envoyé. L'appel patiente jusqu'à ~20 s si l'export est en cours. Sans ticket : liste les exports récents.",
    inputSchema: {
      type: "object",
      properties: { ticket: { type: "string", description: "Le ticket de l'export (ex. « dx_a1b2c3d4 »)." } },
      additionalProperties: false,
    },
  },
] as const;

/** dataURI "data:image/jpeg;base64,XXX" → bloc image MCP. */
export function dataUriToImage(dataUri: string): Content | null {
  const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { type: "image", data: m[2], mimeType: m[1] };
}

/** Recompresse une image (data URI) en plus petit → réponse MCP allégée (les
 *  keyframes de réf stockées sont en 480px ; certains clients vident les blocs
 *  image si la réponse est trop lourde). Repli sur l'original si sharp échoue. */
async function shrinkDataUri(dataUri: string, width = MCP_IMAGE_WIDTH, quality = MCP_IMAGE_QUALITY): Promise<string> {
  const m = dataUri.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) return dataUri;
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(Buffer.from(m[1], "base64")).resize({ width, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return dataUri;
  }
}

/** Lignes de synthèse audio (matière sonore) — timecodes prêts pour create_variant. */
function formatAudioLines(a: {
  bpm: number | null; beats: number[]; energy: { t: number; level: number }[];
  drops: { t: number; type: string; intensity: number }[]; durationSec: number; type: string;
}): string[] {
  const lines: string[] = [];
  lines.push(`🎵 AUDIO mesuré — cale coupes/captions/effets dessus : ${a.durationSec ? a.durationSec.toFixed(1) + "s · " : ""}${a.bpm ? `~${a.bpm} BPM · ` : ""}${a.type}`);
  if (a.beats?.length) lines.push(`  · beats (s) [temps forts → segments[].transition & captions[].startSec] : ${a.beats.slice(0, 120).map((b) => b.toFixed(2)).join(", ")}`);
  if (a.drops?.length) lines.push(`  · drops (RUPTURES ≠ beats) : ${a.drops.map((d) => `${d.t.toFixed(2)}s·${d.type}·${d.intensity}`).join("  ")}`);
  if (a.energy?.length) lines.push(`  · énergie (0-1, ~1s) : ${a.energy.filter((_, i) => i % 4 === 0).slice(0, 60).map((e) => e.level.toFixed(2)).join(" ")}`);
  return lines;
}

/** Voix horodatée d'une matière → intervalles de PAROLE (VAD) exploitables pour
 *  la synchro labiale et des sous-titres calés. Renvoie [] si pas de voix. */
function formatVoiceLines(
  transcript: { phrases: { startSec: number; endSec: number; text: string }[]; fullText: string } | null | undefined,
): string[] {
  const phrases = transcript?.phrases ?? [];
  if (!phrases.length) {
    return transcript?.fullText ? [`  · voix : « ${transcript.fullText.slice(0, 300)} » (sans timecodes)`] : [];
  }
  const shown = phrases.slice(0, 40);
  const lines = [
    `  · VOIX — intervalles de parole (s) [synchro labiale / captions calées ; le HORS de ces plages = silence] :`,
    ...shown.map((p) => `    [${p.startSec.toFixed(2)}–${p.endSec.toFixed(2)}s] ${p.text}`),
  ];
  if (phrases.length > shown.length) lines.push(`    … (${phrases.length - shown.length} segment(s) de plus)`);
  return lines;
}

type CleanWord = { startSec: number; endSec: number; text: string };
type CleanSilence = { start: number; end: number };

/** BUG A — l'ASR étire les fins de mots sur le silence qui les suit (« de » à
 *  560 ms). On resserre chaque `endSec` sur la fin acoustique réelle : si une
 *  plage de silence (VAD ~23 ms) DÉMARRE dans le mot, le mot s'arrête là. */
function tightenWords(
  words: CleanWord[] | null | undefined,
  silences: CleanSilence[] | null | undefined,
): CleanWord[] {
  const ws = words ?? [];
  const sil = silences ?? [];
  if (!ws.length) return ws;
  const tightened = !sil.length ? ws.slice() : ws.map((w) => {
    const cut = sil.find((s) => s.start > w.startSec + 0.06 && s.start < w.endSec - 0.02);
    return cut ? { ...w, endSec: Math.round(Math.max(w.startSec + 0.06, cut.start) * 1000) / 1000 } : w;
  });
  // D3 — MONOTONIE garantie : l'ASR peut renvoyer des mots qui se chevauchent
  // (« sera[30.38–30.94] toujours[30.42–30.74] ») et toute logique de découpe
  // qui suppose des intervalles ordonnés casse en silence. Tri par début puis
  // clamp de chaque fin sur le début du mot suivant.
  tightened.sort((a, b) => a.startSec - b.startSec);
  for (let i = 0; i + 1 < tightened.length; i++) {
    if (tightened[i].endSec > tightened[i + 1].startSec) {
      tightened[i] = { ...tightened[i], endSec: Math.round(Math.max(tightened[i].startSec + 0.04, tightened[i + 1].startSec) * 1000) / 1000 };
    }
  }
  return tightened;
}

/** NETTOYAGE DU RUSH — blancs & micro-pauses. Source de vérité : les plages de
 *  SILENCE précises (VAD RMS ~23 ms, analysis.audio.silences). BUG B : chaque
 *  frontière est SNAPPÉE aux mots (resserrés) — un blanc n'empiète jamais sur un
 *  mot. BUG C : deux catégories, car elles ne se traitent pas pareil —
 *  ✂️ BLANCS (≥ 0,5 s) → sauter ENTRE deux segments ; ⏱ MICRO-PAUSES (0,15-0,5 s)
 *  → SUBDIVISER le segment (2 segments contigus, cut sec) et recoller.
 *  Replis (anciennes analyses) : courbe d'énergie 0,25 s, puis trous du transcript. */
function formatSilenceLines(
  transcript: { phrases: { startSec: number; endSec: number; text: string }[]; fullText: string } | null | undefined,
  durationSec: number | null | undefined,
  energy?: { t: number; level: number }[] | null,
  silences?: CleanSilence[] | null,
  words?: CleanWord[] | null,
): string[] {
  const MIN_GAP = GAP_BLANK_SEC;
  const MIN_MICRO = GAP_MICRO_SEC;
  const EDGE_TRIM = GAP_EDGE_TRIM_FALLBACK_SEC; // voie énergie (repli) uniquement
  let gaps: { start: number; end: number }[] = [];

  // ── GARDE-FOU DE BON SENS ────────────────────────────────────────────────
  // Des blancs couvrant l'essentiel d'un fichier, ce n'est pas un rush
  // silencieux : c'est une mesure fausse. Vu le 14/08 sur un hook de 5,7 s avec
  // musique de fond : 4,6 s de « blanc » réclamées à la coupe, soit 81 % du
  // fichier. Le monteur de test a refusé d'obéir ; un autre aurait obéi et rendu
  // une vidéo vide. Un détecteur qui se trompe ET qui donne un ORDRE est plus
  // dangereux qu'un détecteur absent → on ne liste rien et on dit pourquoi.
  const dur = Number(durationSec) || 0;
  const tooMuch = (bl: { start: number; end: number }[]) =>
    dur > 0 && bl.reduce((s, g) => s + (g.end - g.start), 0) > dur * BLANK_MAX_RATIO;
  const BROKEN = `  · ⛔ DÉTECTION DE BLANCS INCOHÉRENTE — les silences mesurés couvrent plus de ${Math.round(BLANK_MAX_RATIO * 100)} % du fichier. Ce n'est pas un rush silencieux, c'est une mesure fausse (musique de fond prise pour du silence, piste sans voix…). Les blancs ne sont donc PAS listés : ne coupe RIEN sur cette base, appuie-toi sur les ⏱ MOMENTS et les SEGMENTS.`;

  const sil = (silences ?? []).filter((s) => s && s.end - s.start >= MIN_MICRO);
  if (sil.length) {
    // ── Voie 1 : silences précis (~23 ms) + snap aux mots ──
    gaps = sil.map((s) => ({ start: s.start, end: s.end }));
    const ws = (words ?? []).slice().sort((a, b) => a.startSec - b.startSec);
    if (ws.length) {
      gaps = gaps.map((g) => {
        let s = g.start, e = g.end;
        for (const w of ws) {
          if (w.startSec < s && w.endSec > s) s = w.endSec;          // mot chevauche le début
          if (w.startSec < e && w.endSec > e) e = w.startSec;        // mot chevauche la fin
          if (w.startSec >= s && w.endSec <= e) e = w.startSec;      // mot DANS le blanc (ASR fait foi)
        }
        return { start: s, end: e };
      });
    }
    gaps = gaps.filter((g) => g.end - g.start >= MIN_MICRO);
    const blanks = gaps.filter((g) => g.end - g.start >= MIN_GAP);
    const micros = gaps.filter((g) => g.end - g.start < MIN_GAP);
    const out: string[] = [];
    if (blanks.length && tooMuch(blanks)) {
      out.push(BROKEN);
    } else if (blanks.length) {
      const total = blanks.reduce((s, g) => s + (g.end - g.start), 0);
      out.push(
        `  · ✂️ BLANCS à couper (${blanks.length} · ~${total.toFixed(1)}s au total) — EXCLUS-les des segments[] : garde chaque plage de PAROLE dans un segment séparé et saute ces trous. Coupe aux frontières ci-dessous (= silence) → coutures nettes :`,
        ...blanks.slice(0, 30).map((g) => `    [${g.start.toFixed(2)}–${g.end.toFixed(2)}s] blanc ${(g.end - g.start).toFixed(1)}s`),
        ...(blanks.length > 30 ? [`    … (${blanks.length - 30} blanc(s) de plus)`] : []),
      );
    }
    if (micros.length) {
      const total = micros.reduce((s, g) => s + (g.end - g.start), 0);
      out.push(
        `  · ⏱ MICRO-PAUSES à resserrer (${micros.length} · ~${total.toFixed(1)}s) — pauses INTRA-phrase (0,15-0,5 s) : ne saute pas, SUBDIVISE le segment en 2 segments contigus du même fichier (fin du 1er = début de la pause, début du 2e = fin de la pause), cut sec sans transition → raccord invisible, débit punchy :`,
        ...micros.slice(0, 30).map((g) => `    [${g.start.toFixed(2)}–${g.end.toFixed(2)}s] pause ${(g.end - g.start).toFixed(2)}s`),
        ...(micros.length > 30 ? [`    … (${micros.length - 30} micro-pause(s) de plus)`] : []),
      );
    }
    return out;
  }

  const e = (energy ?? []).filter((p) => p && Number.isFinite(p.t) && Number.isFinite(p.level));
  if (e.length >= 8) {
    // ── Voie principale : énergie du signal (résolution ~0,25 s) ──
    const step = Math.max(0.05, e.length > 1 ? e[1].t - e[0].t : 0.25);
    const lv = e.map((p) => p.level).sort((a, b) => a - b);
    const p10 = lv[Math.floor(lv.length * 0.10)];
    // Plancher de bruit ×2,5 + marge, borné [0.05, 0.25] : jamais une constante en dur.
    const thr = Math.max(0.05, Math.min(0.25, p10 * 2.5 + 0.03));
    let runStart = -1;
    for (let i = 0; i <= e.length; i++) {
      const silent = i < e.length && e[i].level <= thr;
      if (silent && runStart < 0) runStart = e[i].t;
      if (!silent && runStart >= 0) {
        const runEnd = i < e.length ? e[i].t : e[e.length - 1].t + step;
        if (runEnd - runStart >= MIN_GAP) gaps.push({ start: runStart + EDGE_TRIM, end: runEnd - EDGE_TRIM });
        runStart = -1;
      }
    }
    // Queue de fichier au-delà du dernier point d'énergie.
    if (durationSec && e.length && durationSec - (e[e.length - 1].t + step) >= MIN_GAP) {
      gaps.push({ start: e[e.length - 1].t + step, end: durationSec });
    }
  } else {
    // ── Repli : trous entre les plages de parole du transcript ──
    const phrases = (transcript?.phrases ?? []).filter((p) => p && p.endSec > p.startSec);
    if (phrases.length < 1) return [];
    const sorted = [...phrases].sort((a, b) => a.startSec - b.startSec);
    if (sorted[0].startSec >= MIN_GAP) gaps.push({ start: 0, end: sorted[0].startSec });
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startSec - sorted[i - 1].endSec >= MIN_GAP) gaps.push({ start: sorted[i - 1].endSec, end: sorted[i].startSec });
    }
    const last = sorted[sorted.length - 1].endSec;
    if (durationSec && durationSec - last >= MIN_GAP) gaps.push({ start: last, end: durationSec });
  }

  gaps = gaps.filter((g) => g.end - g.start >= MIN_GAP);
  if (!gaps.length) return [];
  if (tooMuch(gaps)) return [BROKEN];
  const total = gaps.reduce((s, g) => s + (g.end - g.start), 0);
  return [
    `  · ✂️ BLANCS à couper (${gaps.length} · ~${total.toFixed(1)}s au total) — EXCLUS-les des segments[] : garde chaque plage de PAROLE dans un segment séparé et saute ces trous. Coupe aux frontières ci-dessous (= silence) → coutures nettes :`,
    ...gaps.slice(0, 30).map((g) => `    [${g.start.toFixed(2)}–${g.end.toFixed(2)}s] blanc ${(g.end - g.start).toFixed(1)}s`),
    ...(gaps.length > 30 ? [`    … (${gaps.length - 30} blanc(s) de plus)`] : []),
  ];
}

/** MOTS horodatés (word-level) — exposés pour caler captions[].words à la syllabe
 *  près (wordByWord/karaoke sans dérive) et pour vérifier les coupes. */
function formatWordLines(
  words: { startSec: number; endSec: number; text: string }[] | null | undefined,
): string[] {
  const ws = (words ?? []).filter((w) => w && w.text && w.endSec > w.startSec);
  if (!ws.length) return [];
  const shown = ws.slice(0, 250);
  const perLine = 10;
  const lines: string[] = [
    `  · MOTS horodatés (${ws.length}) — passe-les TEL QUEL dans captions[].words ({text,start,end}) pour des sous-titres synchro SANS dérive :`,
  ];
  for (let i = 0; i < shown.length; i += perLine) {
    lines.push(`    ${shown.slice(i, i + perLine).map((w) => `${w.text}[${w.startSec.toFixed(2)}–${w.endSec.toFixed(2)}]`).join(" ")}`);
  }
  if (ws.length > shown.length) lines.push(`    … (${ws.length - shown.length} mot(s) de plus)`);
  return lines;
}

/** REPRISES (prises ratées) — n-grammes de mots répétés à courte distance :
 *  le locuteur se rate puis répète la même phrase. On détecte les séquences de
 *  ≥3 mots identiques (normalisés) répétées à <15 s d'intervalle → la plage
 *  [début 1re occurrence, début DERNIÈRE occurrence] est à couper (la dernière
 *  prise est presque toujours la bonne). Une énumération légitime (« ni A, ni B »)
 *  ne matche pas : les 3 mots consécutifs diffèrent. Nécessite les mots
 *  horodatés — sans eux (anciennes analyses), aucune détection. */
function formatRetakeLines(
  words: { startSec: number; endSec: number; text: string }[] | null | undefined,
): string[] {
  const ws = (words ?? []).filter((w) => w && w.text && w.endSec >= w.startSec);
  if (ws.length < 8) return [];
  const N = RETAKE_NGRAM;
  // Garde-fous anti FAUX POSITIF (un n-gramme banal — « vous donner un » — qui
  // revient 10 s plus loin dans une phrase DIFFÉRENTE n'est PAS une reprise ;
  // le couper détruirait le propos du user) :
  const CHAIN_GAP = RETAKE_CHAIN_GAP_SEC;
  const STRICT_GAP = RETAKE_STRICT_GAP_SEC;
  const MIN_SPAN = RETAKE_MIN_SPAN_SEC;
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9']/g, "");
  const toks = ws.map((w) => norm(w.text));
  // Index des n-grammes → positions de départ.
  const seen = new Map<string, number[]>();
  for (let i = 0; i + N <= toks.length; i++) {
    if (toks[i].length < 2) continue; // n-gramme ancré sur un vrai mot
    const key = toks.slice(i, i + N).join(" ");
    const arr = seen.get(key) ?? [];
    arr.push(i);
    seen.set(key, arr);
  }
  // Candidats : pour chaque n-gramme, on CHAÎNE les occurrences successives tant
  // que l'écart entre deux occurrences consécutives reste < WINDOW (cascades :
  // 5 tentatives « ou que vos… » = 1 chaîne, pas juste la 1re paire). Plage
  // candidate = [début 1re occ → début DERNIÈRE occ de la chaîne].
  const cands: { start: number; end: number; sample: string }[] = [];
  for (const [, idxs] of seen) {
    if (idxs.length < 2) continue;
    let chain: number[] = [];
    const flush = () => {
      if (chain.length >= 2) {
        const first = chain[0], last = chain[chain.length - 1];
        // chevauchement direct (mots contigus, ex. « très très ») → pas une reprise
        if (first + N <= last) {
          const span = ws[last].startSec - ws[first].startSec;
          if (span >= MIN_SPAN) {
            cands.push({
              start: ws[first].startSec,
              end: ws[last].startSec,
              sample: ws.slice(first, Math.min(first + 6, ws.length)).map((w) => w.text).join(" "),
            });
          }
        }
      }
      chain = [];
    };
    // Similarité ÉTENDUE : le mot APRÈS le n-gramme (ou celui d'AVANT) doit
    // correspondre aussi — « vous donner un tips » vs « vous donner un branding »
    // partagent le n-gramme mais pas la suite → réutilisation légitime, pas une
    // reprise. Une vraie reprise répète le début de phrase À L'IDENTIQUE au-delà
    // du n-gramme (« ou que vos posts… / ou que vos posts, »).
    const extended = (a: number, b: number): boolean =>
      (!!toks[a + N] && toks[a + N] === toks[b + N]) || (a > 0 && b > 0 && !!toks[a - 1] && toks[a - 1] === toks[b - 1]);
    for (const i of idxs) {
      if (chain.length) {
        const prev = chain[chain.length - 1];
        const gap = ws[i].startSec - ws[prev].startSec;
        if (gap > CHAIN_GAP || (gap > STRICT_GAP && !extended(prev, i))) flush();
      }
      chain.push(i);
    }
    flush();
  }
  if (!cands.length) return [];
  // Fusion des n-grammes d'une MÊME zone de reprises. La fin du cluster = la fin
  // du candidat ANCRE (celui qui démarre le plus tôt = le début de phrase répété,
  // ex. « ou que vos ») : sa dernière occurrence EST le début de la bonne prise.
  // Les n-grammes plus profonds dans la phrase (fins plus tardives) étendent la
  // zone de recouvrement (spanEnd) mais pas la coupe — sinon on mangerait le
  // début de la bonne prise.
  cands.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number; spanEnd: number; sample: string }[] = [];
  for (const c of cands) {
    const lastM = merged[merged.length - 1];
    if (lastM && c.start <= lastM.spanEnd + 0.3) {
      lastM.spanEnd = Math.max(lastM.spanEnd, c.end);
      // co-ancre (démarre quasi au même mot que l'ancre) → peut étendre la coupe
      if (c.start <= lastM.start + 0.15) lastM.end = Math.max(lastM.end, c.end);
    } else merged.push({ start: c.start, end: c.end, spanEnd: c.end, sample: c.sample });
  }
  const total = merged.reduce((s, c) => s + (c.end - c.start), 0);
  return [
    `  · 🔁 REPRISES détectées (${merged.length} · ~${total.toFixed(1)}s) — le locuteur se rate puis répète : EXCLUS chaque plage des segments[] (tu gardes la DERNIÈRE prise, qui commence à la fin de la plage). Aligne tes coupes sur les blancs voisins, jamais en plein mot :`,
    ...merged.slice(0, 12).map((c) => `    [${c.start.toFixed(2)}–${c.end.toFixed(2)}s] reprise de « ${c.sample} » → coupe cette plage`),
    ...(merged.length > 12 ? [`    … (${merged.length - 12} reprise(s) de plus)`] : []),
  ];
}

/* ── Rendus en tâche de fond (« ticket ») ─────────────────────────────────────
   Un rendu peut dépasser la minute de patience du client MCP (mesuré : 251 s).
   On attend un court instant sous cette limite, puis on rend un TICKET. Les
   petits montages restent instantanés (aucun changement pour eux). */
const FIRST_WAIT_MS = Math.max(3_000, parseInt(process.env.AI_EDITOR_FIRST_WAIT_MS ?? "25000", 10));
const POLL_WAIT_MS = Math.max(3_000, parseInt(process.env.AI_EDITOR_POLL_WAIT_MS ?? "25000", 10));

/** Met en forme l'état d'un rendu : ticket en cours, échec, ou résultat complet. */
async function jobContent(job: RenderJob, images = true): Promise<Content[]> {
  if (job.status === "running") {
    const q = queueSnapshot();
    // ── ATTENTE ≠ TRAVAIL ────────────────────────────────────────────────────
    // Le serveur ne rend que `max` variantes à la fois ; les autres FONT LA
    // QUEUE. Annoncer « rendu en cours · 8 min écoulées » à un job qui n'a pas
    // commencé laissait croire à un serveur bloqué (incident du 20/08 : 5 rendus
    // lancés d'affilée, 3 en file invisible, un 6e « seul » qui semblait ramer).
    if (isQueued(job)) {
      const pos = queuePosition(job);
      return [{
        type: "text",
        text: `⏸ EN FILE D'ATTENTE (ticket ${job.id})${pos ? ` — position ${pos}` : ""} — le rendu n'a PAS encore commencé, il attend son tour depuis ${jobElapsed(job)}. ` +
          `Le serveur ne rend que ${q.max} variante(s) à la fois (${q.active} en cours, ${q.waiting} en attente) : c'est NORMAL, rien n'est bloqué et rien n'est perdu. ` +
          `⏱ Compte ~${q.max ? Math.ceil((pos ?? 1) / q.max) * 3 : 3} à ${q.max ? Math.ceil((pos ?? 1) / q.max) * 5 : 5} minutes avant même le début de CE rendu. ` +
          `Ne relance PAS create_variant — tu ajouterais un rendu de plus derrière celui-ci et tu rallongerais la file pour tout le monde. ` +
          `⚠ Ne lance pas non plus d'autres variantes tant que la file n'est pas résorbée : au-delà de ${q.max} rendus en vol, tu n'accélères rien, tu empiles. ` +
          `Appelle get_render avec renderId "${job.id}" pour suivre (l'appel patiente jusqu'à ~25 s).`,
      }];
    }
    return [{
      type: "text",
      text: `⏳ Rendu EN COURS (ticket ${job.id}) — ${jobRenderElapsed(job) ?? jobElapsed(job)} de rendu effectif (${jobElapsed(job)} depuis la demande, file d'attente comprise). Le serveur travaille, ne relance PAS create_variant : ` +
        `appelle get_render avec renderId "${job.id}" pour récupérer la vidéo (l'appel patiente jusqu'à ~25 s et te répond dès que c'est prêt). ` +
        `Un montage lourd (beaucoup de plans, de sous-titres, rushs 4K) prend couramment 2 à 5 minutes.`,
    }];
  }
  if (job.status === "failed" || !job.result) {
    return [{ type: "text", text: `Rendu impossible : ${job.error ?? "erreur inconnue"} [moteur ${ENGINE_BUILD}]` }];
  }
  const res = job.result, v = res.variant;
  // Ce que le moteur a ignoré/ajusté (piste audio sans son, id faux…) : en TÊTE
  // de réponse, sinon le monteur croit son plan appliqué tel quel.
  const notesTxt = res.notes?.length ? `\n⚠️ AJUSTEMENTS DU MOTEUR (à lire, corrige le plan si besoin) :\n${res.notes.map((n) => `  · ${n}`).join("\n")}` : "";
  const head = `✅ Variante créée${v.label ? ` « ${v.label} »` : ""} (id ${v.id}) · durée ${res.durationSec}s · rendue en ${jobRenderElapsed(job) ?? jobElapsed(job)}${jobRenderElapsed(job) ? ` (${jobElapsed(job)} au total, file d'attente comprise)` : ""} · moteur ${ENGINE_BUILD}.${notesTxt}`;
  if (!images) {
    return [{
      type: "text",
      text: `${head} Images NON renvoyées (images: false) — ton contexte est préservé. ` +
        `Le plan de montage reste relisable à tout moment avec get_variant("${v.id}") ; ajoute images: true si tu as besoin de VOIR le rendu.`,
    }];
  }
  // Borné : 6 images × des dizaines de rendus saturaient la conversation (47
  // variantes le 20/08 → session perdue). 3 suffisent à contrôler cadrage,
  // rythme et position des captions ; get_variant(images:true) en donne plus.
  const shown = res.keyframes.slice(0, RENDER_KEYFRAMES);
  const content: Content[] = [{
    type: "text",
    text: shown.length
      ? `${head} Voici ${shown.length} image(s) du RENDU — vérifie cadrage, rythme, position des captions ; rappelle create_variant pour corriger si besoin. ` +
        `Sur une longue série, passe images: false : tu gardes le plan (get_variant) sans remplir ta conversation de vignettes.`
      : head,
  }];
  for (const kf of shown) {
    const img = dataUriToImage(kf.dataUri);
    if (img) content.push({ type: "text", text: `— rendu à ${kf.t}s —` }, img);
  }
  if (!res.keyframes.length) {
    if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push({ type: "text", text: "Aperçu (poster) :" }, img); }
    content.push({ type: "text", text: "⚠ Impossible d'extraire les images du rendu (voir logs serveur). La variante est bien enregistrée — réessaie get_variant, ou régénère." });
  }
  return content;
}

/** Attente initiale ADAPTÉE. Tenir la réponse 25 s a un sens quand le rendu
 *  TRAVAILLE (il peut finir entre-temps). Quand il fait la QUEUE, c'est 25 s
 *  perdues pour tout le monde : on répond tout de suite sa position, qui est
 *  une information exploitable — et qui dissuade d'en lancer un de plus. */
async function firstWait(job: RenderJob): Promise<RenderJob> {
  const PEEK_MS = Math.min(FIRST_WAIT_MS, 4_000);
  const early = await waitForJob(job, PEEK_MS);
  if (early.status !== "running" || isQueued(early)) return early;
  return waitForJob(early, Math.max(0, FIRST_WAIT_MS - PEEK_MS));
}

async function callToolScoped(userId: string, storeKey: string, name: string, args?: Record<string, unknown>): Promise<{ content: Content[]; isError?: boolean }> {
  const project: Project | null = await getLatestProject(storeKey);

  if (!project) {
    return { content: [{ type: "text", text: "Aucun projet : le user doit d'abord uploader une référence dans l'Éditeur IA de DuupFlow." }], isError: true };
  }

  if (name === "get_reference") {
    const ref = project.reference;
    if (!ref) return { content: [{ type: "text", text: "Aucune référence dans ce projet pour l'instant." }], isError: true };
    const a = ref.analysis;
    const cuts = Array.isArray(a.sceneCuts) ? a.sceneCuts : [];
    const phrases = a.transcript?.phrases ?? [];
    const N_IMG = REF_IMAGES_SHOWN;
    // Beats : échantillonnés sur TOUTE la durée (pas les 48 premiers → sinon le
    // dernier tiers de la réf n'a aucun beat et on ne peut pas y caler les coupes).
    const allBeats = a.audio?.beats ?? [];
    const beatsShown = allBeats.length <= 90 ? allBeats : allBeats.filter((_, i) => i % Math.ceil(allBeats.length / 90) === 0);
    const beatsNote = beatsShown.length < allBeats.length ? ` (${beatsShown.length}/${allBeats.length} répartis)` : "";
    // gradeSuggested = ÉCART réf↔matière (pas la valeur absolue de la réf, qui
    // reflète ses conditions de tournage). On mesure la couleur moyenne de la
    // matière du user (via ses vignettes) et on suggère la correction qui rapproche
    // la matière de la réf. Bornes : ±0.2 sat/bright, ±0.3 temperature. Neutre si proches.
    const warmVal = (w?: string) => (w === "warm" ? 1 : w === "cold" ? -1 : 0);
    // Vignettes de matière exploitables (images + vidéos ont un thumb ; l'audio non).
    const matBufs = project.materials
      .map((m) => m.analysis?.thumb)
      .filter((t): t is string => typeof t === "string" && t.includes(","))
      .map((t) => Buffer.from(t.split(",")[1] || "", "base64"))
      .filter((b) => b.length > 80);
    const matMeasured = matBufs.length;      // combien de vignettes mesurables
    const matTotal = project.materials.length;
    let matColor: { saturation: number; brightness: number; warmCold: string; bw: boolean } | null = null;
    try { if (matMeasured) matColor = await analyzeColor(matBufs); } catch { /* mesure impossible */ }
    let gsSat: number | null = null, gsBri: number | null = null, gsTemp: number | null = null, gsBasis = "";
    if (a.color && matColor) {
      gsSat = Math.round((1 + clampN(a.color.saturation - matColor.saturation, -0.2, 0.2)) * 100) / 100;
      gsBri = Math.round(clampN(a.color.brightness - matColor.brightness, -0.2, 0.2) * 100) / 100;
      gsTemp = Math.round(clampN((warmVal(a.color.warmCold) - warmVal(matColor.warmCold)) * 0.3, -0.3, 0.3) * 100) / 100;
      gsBasis = `écart réf↔ta matière (mesurée sur ${matMeasured}/${matTotal} fichier(s))`;
    } else if (a.color) {
      // Matière NON mesurée → on NE réémet PAS un grade absolu (ça recopierait les
      // conditions de tournage de la réf, bug corrigé). Grade NEUTRE + signal clair.
      gsSat = 1; gsBri = 0; gsTemp = 0;
      gsBasis = matTotal === 0
        ? "AUCUNE matière ajoutée → grade NEUTRE ; ajoute ta matière (image/vidéo) pour un grade calibré sur l'écart réf↔matière"
        : `matière non mesurable (${matMeasured}/${matTotal} vignette(s) exploitable(s) — audio exclu) → grade NEUTRE ; ajoute une image/vidéo pour calibrer`;
    }
    // Couche COMPRÉHENSION (Gemini a REGARDÉ la vidéo) : captions lues à l'écran +
    // contenu des plans + pourquoi ça marche. Valeurs déjà en unités create_variant.
    const comp = a.comprehension;
    let compBlock: string | null = null;
    if (comp) {
      const parts: string[] = [];
      if (comp.captions.length) {
        parts.push(
          `CAPTIONS DE LA RÉF (${comp.captions.length}) — style LU à l'écran, prêt à passer TEL QUEL à create_variant.captions (mêmes unités). REPRODUIS ce style fidèlement, adapte seulement le texte :\n` +
          comp.captions.map((c, i) => {
            const nWords = c.text.trim().split(/\s+/).filter(Boolean).length;
            const stroke = c.hasStroke ? ` · contour ${c.strokeWidthPx}px` : ` · SANS contour (→ strokeColor: "none")`;
            const shadow = c.shadow !== "none" ? ` · ombre douce ${c.shadow} (→ shadowColor: "${c.shadow}")` : "";
            const alignS = c.align !== "center" ? ` · align ${c.align}` : "";
            // ── HONNÊTETÉ DE LA MESURE (règle gravée) ───────────────────
            // Une valeur approximative renvoyée SANS avertissement est pire
            // qu'une valeur absente : le lecteur reproduit l'erreur en croyant
            // être fidèle. C'est arrivé (color #ffffff sur un texte dégradé →
            // rendu blanc plat). L'avertissement est collé À LA CAPTION
            // concernée ; les captions bien mesurées n'en ont AUCUN, pour que
            // le signal ne se banalise pas.
            const grad = c.fillColors ? c.fillColors.split(",").filter(Boolean) : [];
            const fillWarn = c.fillType === "gradient" && grad.length >= 2
              ? `\n     ⚠ REMPLISSAGE NON UNI — dégradé ${grad.join(" → ")} (~${c.fillAngle}°)\n       → passe fill: { type: "gradient", colors: ${JSON.stringify(grad)}, angle: ${c.fillAngle} } (et PAS color)`
              : c.fillType === "texture"
                ? `\n     ⚠ REMPLISSAGE NON MESURABLE — l'image/la vidéo transparaît dans les lettres (texte évidé).\n       NON REPRODUCTIBLE avec les outils actuels : PRÉVIENS LE USER, ne remplace pas par une couleur unie.`
                : "";
            const caveat = c.caveat?.trim() ? `\n     ⚠ MESURE APPROXIMATIVE — ${c.caveat.trim()}` : "";
            const emph = c.emphasisText && c.emphasisMul > 1.1
              ? `\n     ⭐ EMPHASE « ${c.emphasisText} » ×${c.emphasisMul}${c.emphasisColor !== "none" ? ` · ${c.emphasisColor}` : ""} → spans[] : le reste à fontSize ${c.fontSizePx}, cette portion à fontSize ${Math.round(c.fontSizePx * c.emphasisMul)}${c.emphasisColor !== "none" ? ` + color "${c.emphasisColor}"` : ""}`
              : "";
            return `  ${i + 1}. « ${c.text} »${c.emojis ? ` ${c.emojis}` : ""} (${nWords} mot${nWords > 1 ? "s" : ""})\n` +
              `     [${c.startSec}–${c.endSec}s] · x ${c.xPct}% · y ${c.yPct}% · fontSize ${c.fontSizePx} · font "${c.font}" · graisse ${c.fontWeight} · color ${c.color}` +
              `${stroke}${shadow}${alignS}${fillWarn}${caveat}${c.background && c.background !== "none" ? ` · background ${c.background}${c.bgRadiusPx ? ` · coins ${c.bgRadiusPx}px` : ""}${c.bgPaddingPx ? ` · padding ${c.bgPaddingPx}px` : ""}${c.bgRadiusPx >= 24 && c.bgPaddingPx >= 20 ? ` (bloc arrondi & padded → style:"sticker")` : ""}` : " · sans fond"}${c.animation && c.animation !== "none" ? ` · animation "${c.animation}"` : ""}${c.glow && c.glow !== "none" ? ` · NÉON glow ${c.glow} (→ caption.glow)` : ""}${emph}`;
          }).join("\n"),
        );
        // Cadence de sous-titrage mesurée — pour caler le DÉCOUPAGE des tiennes.
        const avgWords = comp.captions.reduce((s, c) => s + c.text.trim().split(/\s+/).filter(Boolean).length, 0) / comp.captions.length;
        const avgDur = comp.captions.reduce((s, c) => s + Math.max(0, c.endSec - c.startSec), 0) / comp.captions.length;
        parts.push(`CADENCE de sous-titrage de la réf : ~${avgWords.toFixed(1)} mots/caption · ~${avgDur.toFixed(2)}s d'affichage — découpe TES captions à la même cadence (pas des blocs de 8 mots si la réf en affiche 3).`);
      } else {
        parts.push("CAPTIONS DE LA RÉF : aucun texte incrusté détecté.");
      }
      if (comp.shots.length) {
        // Intensité MESURÉE (ffmpeg) rattachée au plan Gemini par recouvrement temporel.
        const ffShots = Array.isArray(a.shots) ? a.shots : [];
        const matchIntensity = (st: number, en: number): number => {
          const ov = ffShots.filter((f) => f.endSec > st && f.startSec < en && f.motion !== "static");
          if (!ov.length) return 1;
          return Math.round((ov.reduce((s, f) => s + (f.motionIntensity || 1), 0) / ov.length) * 100) / 100;
        };
        parts.push(
          `CONTENU DES PLANS — à reproduire dans segments[] (motion+intensité, speed, freezeAt/freezeDuration, punch-in scale+offsetX/offsetY, layout+overlays). Le TYPE de mouvement vient de la compréhension (autorité), l'intensité est mesurée. Valeurs neutres = affichées quand même :\n` +
          comp.shots.map((s) => {
            const mo = s.motion ?? "none";
            const inten = mo !== "none" ? ` (intensité ${matchIntensity(s.startSec, s.endSec)})` : "";
            const sp = `vitesse ${s.speed ?? 1}×`;
            const fz = s.freezeAt != null ? `freeze @${s.freezeAt}s` : "pas de freeze";
            const subj = `sujet ${s.subjectX ?? 50}%/${s.subjectY ?? 50}%`;
            const cp = `compo ${s.composition ?? "single"}`;
            const lum = s.relBrightness != null && s.relBrightness <= -0.12 ? ` · ⬛ ASSOMBRI vs le reste (→ segments[].grade.brightness ${s.relBrightness})` : "";
            const sat = s.relSaturation != null && s.relSaturation <= -0.5 ? ` · ◐ ${s.relSaturation <= -0.9 ? "NOIR & BLANC" : "DÉSATURÉ"} vs le reste (→ segments[].grade.saturation ${Math.max(0, 1 + s.relSaturation).toFixed(2)}, ou freezeGrade.saturation 0 si c'est le freeze)` : "";
            const oe = s.overlayEnter && s.overlayEnter !== "none" ? ` · ↳ incrustation ENTRE ${s.overlayEnter} (→ overlays[].enter="${s.overlayEnter}")` : "";
            const ox = s.overlayExit && s.overlayExit !== "none" ? ` · ↰ incrustation SORT ${s.overlayExit} (→ overlays[].exit="${s.overlayExit}")` : "";
            const fi = s.fadeInFrom && s.fadeInFrom !== "none" ? ` · ▷ OUVRE en fondu depuis ${s.fadeInFrom === "white" ? "blanc" : "noir"} (→ segments[].fadeIn + fadeColor "${s.fadeInFrom}")` : "";
            const fo = s.fadeOutTo && s.fadeOutTo !== "none" ? ` · ◁ FERME en fondu vers ${s.fadeOutTo === "white" ? "blanc" : "noir"} (→ segments[].fadeOut + fadeColor "${s.fadeOutTo}")` : "";
            const TR: Record<string, string> = { flash: `⚡ FLASH sur la coupe (→ transition="flash")`, glitch: `▓ GLITCH sur la coupe (→ transition="glitch")`, whip: `filé (→ transition="whipPan")`, slide: `glissement (→ transition="slide")`, zoom: `coupe zoomée (→ transition="zoomPunch")`, fade: `fondu enchaîné (→ transition="fade")` };
            const tr = s.transitionIn && TR[s.transitionIn] ? ` · ${TR[s.transitionIn]}` : "";
            const sk = s.shakeOnBeat ? ` · ⭜ SECOUSSE sur un temps fort (→ segments[].shakeAt:[{t,…}])` : "";
            const bl = s.blurX != null && s.blurX >= 0 && s.blurW ? ` · ▚ FLOU DE ZONE à ${s.blurX}%/${s.blurY}% (${s.blurW}×${s.blurH}% — masquage → segments[].blurRegions:[{x:${s.blurX},y:${s.blurY},width:${s.blurW},height:${s.blurH}}])` : "";
            const pp = s.pipShape && s.pipShape !== "none" && s.pipW > 0 ? ` · 🫧 INCRUSTATION ${s.pipShape === "circle" ? "BULLE RONDE" : s.pipShape} à ${s.pipX}%/${s.pipY}% largeur ${s.pipW}% (→ overlays[]: { materialId: LE MÊME rush que le plan pour un speaker en bulle, shape: "${s.pipShape}", x: ${s.pipX}, y: ${s.pipY}, width: ${s.pipW} })` : "";
            const cd = s.cardColor && s.cardColor !== "none" ? ` · ▮ PANNEAU ${s.cardColor} plein cadre (→ overlays[]: { color: "${s.cardColor}", x: 0, y: 0, width: 100, height: 100, zIndex: 0 } DERRIÈRE bulle/captions — zIndex plus petit que le reste)` : "";
            const br = s.broll ? ` · 🎞 CUTAWAY B-ROLL — visuel d'illustration, la VOIX CONTINUE (→ pose UN DE TES assets de matière en overlay plein cadre { x: 0, y: 0, width: 100, height: 100 } sur la fenêtre du plan qui parle ; choisis l'asset dont la description colle au propos ; si le user n'a pas d'asset adapté : pas de b-roll, JAMAIS de contenu externe)` : "";
            return `  [${s.startSec}–${s.endSec}s] mouvement ${mo}${inten} · ${sp} · ${fz} · ${subj} · ${cp}${lum}${sat}${oe}${ox}${fi}${fo}${tr}${sk}${bl}${pp}${cd}${br}\n      « ${s.content} »`;
          }).join("\n"),
        );
      }
      if (comp.cuts?.length) {
        // Croisement AUDIO (point 4) : un pic d'énergie/drop PILE sur une coupe indique
        // presque toujours un whoosh/impact → plutôt whipPan/zoomPunch qu'un cut sec.
        const drops = a.audio?.drops ?? [];
        const audioHit = (t: number): boolean => drops.some((d) => Math.abs(d.t - t) <= 0.2 && (d.type === "hit" || d.type === "drop") && d.intensity >= 0.4);
        parts.push(
          `TRANSITIONS PAR COUPE — nature détectée sur des bandes de vignettes (±0,3s), en unités create_variant (→ segments[].transition du plan qui SUIT la coupe) :\n` +
          comp.cuts.map((c) => {
            const conf = c.confidence < 0.5 ? ` · ⚠ confiance ${c.confidence}` : "";
            const dur = c.durationSec > 0 ? `, durée ${c.durationSec}s` : "";
            if (c.transition === "other") {
              return `  @${c.t}s : ⧉ NON REPRODUCTIBLE (pas encore au moteur)${conf}\n      vu : « ${c.unmatched || "?"} »`;
            }
            const hint = audioHit(c.t) && (c.transition === "cut" || c.confidence < 0.6)
              ? ` · 🔊 pic audio sur la coupe → penche pour whipPan/zoomPunch (whoosh/impact)` : "";
            return `  @${c.t}s : ${c.transition} (intensité ${c.intensity}${dur}) → transition="${c.transition}"${conf}${hint}`;
          }).join("\n"),
        );
      }
      if (comp.emojisOverall) parts.push(`Emojis marquants : ${comp.emojisOverall}`);
      if (comp.duckingPresent) parts.push(`🎚 DUCKING détecté : la musique baisse quand une voix parle → pose audio.duck: true (ou { reduction, attack, release }) quand tu mets une musique sur des plans qui parlent.`);
      if (comp.whyItWorks) parts.push(`POURQUOI ÇA MARCHE : ${comp.whyItWorks}`);
      compBlock = parts.join("\n");
    }
    const lines = [
      `RÉFÉRENCE : ${ref.label} (${ref.source})`,
      // ÉCHECS BRUYANTS : les dégradations d'analyse (Gemini KO, transcript indispo,
      // extraction partielle…) étaient stockées dans a.notes mais JAMAIS montrées →
      // le consommateur devinait le style de captions sur 5 JPEG. Plus jamais muet.
      a.notes?.length ? `⚠️ ANALYSE PARTIELLE :\n${a.notes.map((n) => `  · ${n}`).join("\n")}` : null,
      !a.comprehension
        ? `🛑 STYLES DE CAPTIONS NON LUS. NE DEVINE PAS le style des sous-titres depuis les images — préviens le user que l'analyse de sa référence est PARTIELLE et propose de la RÉ-UPLOADER (une nouvelle analyse est relancée à chaque upload).${a.notes?.some((x) => /Gemini/i.test(x)) ? " La cause exacte est indiquée dans ⚠️ ANALYSE PARTIELLE ci-dessus — transmets-la telle quelle au user." : ""}`
        : null,
      `Durée : ${a.durationSec.toFixed(1)}s · ${a.width}×${a.height} · ${a.fps} fps · audio: ${a.hasAudio ? "oui" : "non"}`,
      `Rythme : ${a.pacing.cutCount} coupe(s)${a.pacing.avgCutSec ? ` · ~${a.pacing.avgCutSec}s/plan` : ""}`,
      // Règle de PRIORITÉ (pas une interdiction) : sans elle, les durées de la réf
      // étaient transposées telles quelles sur la matière et les coupes tombaient
      // au milieu des gestes (« rien n'est cut au bon moment »).
      `⚖️ La réf donne le RYTHME CIBLE (cadence moyenne, style de transitions, structure). Elle ne donne JAMAIS les POINTS DE COUPE. ` +
      `Les points de coupe se déterminent UNIQUEMENT dans la matière du user : sur un changement d'écran, une fin de geste, une fin de phrase (voir ⏱ MOMENTS dans get_material). ` +
      `Si tenir la durée cible obligeait à couper au milieu d'une action, c'est la DURÉE qui cède, pas le point de coupe.`,
      cuts.length ? `Coupes (timecodes s) : ${cuts.slice(0, 60).map((c) => c.toFixed(2)).join(", ")}` : null,
      // Mouvement : UN SEUL champ consolidé. Si Gemini a regardé la vidéo, c'est LUI
      // qui fait autorité sur le TYPE de mouvement (bloc CONTENU DES PLANS ci-dessous,
      // enrichi de l'intensité MESURÉE ffmpeg) → on masque ce bloc mesuré. Sinon (pas
      // de compréhension), on retombe sur la mesure ffmpeg (type + intensité).
      a.shots?.length && !a.comprehension
        ? `PLANS mesurés (${a.shots.length}) — type ffmpeg (approx) + intensité :\n${a.shots.map((s) => `  #${s.index} [${s.startSec}–${s.endSec}s · ${s.durationSec}s] ${s.motion}${s.motion !== "static" ? ` (intensité ${s.motionIntensity})` : ""}`).join("\n")}`
        : null,
      a.color ? `Colorimétrie réf (mesure 0-1) : saturation ${a.color.saturation} · luminosité ${a.color.brightness} · ${a.color.warmCold}${a.color.bw ? " · N&B" : ""}${matColor ? ` | ta matière : sat ${matColor.saturation} · lum ${matColor.brightness} · ${matColor.warmCold}` : ""}\n  → gradeSuggested [${gsBasis}] — passe-le TEL QUEL à create_variant.grade : { saturation: ${gsSat}, contrast: 1, brightness: ${gsBri}, temperature: ${gsTemp} }` : null,
      a.audio && (a.audio.bpm || allBeats.length)
        ? `AUDIO : type ${a.audio.type}${a.audio.bpm ? ` · ~${a.audio.bpm} BPM` : ""}${allBeats.length ? ` · ${allBeats.length} temps forts détectés` : ""}${beatsShown.length ? `\n  Beats (s)${beatsNote} — CALE tes coupes dessus : ${beatsShown.map((b) => b.toFixed(2)).join(", ")}` : ""}`
        : null,
      a.hookText ? `Hook (parlé) : « ${a.hookText} »` : "Hook parlé : (aucune transcription)",
      phrases.length
        ? `Transcription horodatée :\n${phrases.slice(0, 50).map((p) => `  [${p.startSec.toFixed(1)}–${p.endSec.toFixed(1)}s] ${p.text}`).join("\n")}`
        : a.transcript ? `Transcription : ${a.transcript.fullText}` : "Transcription : indisponible (analyse visuelle).",
      // §5 — mots horodatés de la RÉF (même pipeline que get_material) : croiser
      // la voix avec les captions détectées, mesurer la cadence réelle.
      ...formatWordLines(tightenWords(a.transcript?.words, a.audio?.silences)),
      compBlock ? "" : null,
      compBlock,
      "",
      `Images clés ci-dessous (${Math.min(a.keyframes.length, N_IMG)}/${a.keyframes.length}) — ${compBlock ? "les captions/plans ci-dessus sont MESURÉS (fie-toi à eux) ; les images confirment le style." : "observe le hook, le cadrage, le texte à l'écran, le style."} La taille (Ko) est indiquée pour diagnostic : si tu vois « 0 Ko », l'extraction est vide ; si >0 mais image vide chez toi, c'est ton client qui la jette.`,
    ].filter(Boolean);
    const content: Content[] = [{ type: "text", text: lines.join("\n") }];
    for (const kf of a.keyframes.slice(0, N_IMG)) {
      const small = await shrinkDataUri(kf.dataUri);
      const img = dataUriToImage(small);
      if (img && img.type === "image") {
        const kb = Math.round(((small.split(",")[1] || "").length * 3 / 4) / 1024);
        content.push({ type: "text", text: `— image à ${kf.t}s · ${kb} Ko · ${img.mimeType} —` }, img);
      }
    }
    return { content };
  }

  if (name === "list_material") {
    const mats = project.materials;
    // Réconciliation : compare les lignes en base au nombre de fichiers RÉELLEMENT
    // stockés → un écart révèle une ligne perdue (écriture concurrente) ; on le loggue.
    try {
      const fs = await import("fs/promises");
      const files = await fs.readdir(projectPaths(storeKey, project.id).materialDir).catch(() => [] as string[]);
      const real = files.filter((f) => !f.startsWith(".")).length;
      if (real !== mats.length) console.warn(`[ai-editor/list_material] ÉCART fichiers/base : ${real} fichier(s) stocké(s) vs ${mats.length} ligne(s) — perte possible.`);
    } catch { /* diagnostic best-effort */ }
    const analyzing = mats.filter((m) => m.status === "analyzing").length;
    if (!mats.length) return { content: [{ type: "text", text: "Aucune matière ajoutée pour l'instant." }] };
    const content: Content[] = [{
      type: "text",
      text: `MATIÈRE — ${mats.length} fichier(s)${analyzing ? ` (dont ${analyzing} en cours d'analyse)` : ""}. Pour create_variant, utilise l'"id" EXACT ci-dessous comme segments[].materialId (ce n'est PAS le nom du fichier). Les fichiers « en cours d'analyse » EXISTENT (id déjà stable) — tu peux les utiliser ; leurs beats/drops arrivent quand l'analyse finit (réappelle list_material).`,
    }];
    for (const m of mats) {
      const meta = m.analysis;
      const desc = m.desc?.trim() ? `« ${m.desc.trim()} »` : "(pas de description)";
      const st = m.status === "analyzing" ? " · ⏳ en cours d'analyse" : m.status === "failed" ? " · ⚠ analyse échouée (fichier utilisable, sans beats/drops)" : "";
      const dims = !meta
        ? ""
        : m.kind === "audio"
          ? ` · ${meta.durationSec ? meta.durationSec.toFixed(1) + "s" : "audio"}`
          : ` · ${meta.width}×${meta.height}${meta.durationSec ? ` · ${meta.durationSec.toFixed(1)}s` : ""}`;
      content.push({ type: "text", text: `• id: ${m.id}  ·  ${m.name} [${m.kind}]${dims}${st} — ${desc}` });
      // Résumé audio (matière sonore) : bpm + nb de drops → savoir quel fichier ouvrir
      // sans get_material sur tout.
      const au = meta?.audio;
      if (au && (au.bpm || au.drops?.length || au.beats?.length)) {
        content.push({ type: "text", text: `    ↳ audio : ${au.bpm ? `~${au.bpm} BPM` : "rythme n/d"}${au.drops?.length ? ` · ${au.drops.length} drop(s)` : ""}${au.beats?.length ? ` · ${au.beats.length} beats` : ""} — get_material("${m.id}") pour les timecodes` });
      }
      // Index texte des rushes vidéo (coupes + voix) → Claude sait où couper sans
      // deviner ; get_material(id) pour VOIR un rush précis à la demande.
      if (m.kind === "video" && meta) {
        if (meta.sceneCuts?.length) content.push({ type: "text", text: `    ↳ coupes (s) : ${meta.sceneCuts.slice(0, 30).map((c) => c.toFixed(1)).join(", ")}` });
        if (meta.transcript?.fullText) content.push({ type: "text", text: `    ↳ voix : « ${meta.transcript.fullText.slice(0, 220)} »` });
        content.push({ type: "text", text: `    ↳ get_material("${m.id}") pour les images + la VOIX horodatée et les ✂️ BLANCS (à nettoyer : voir create_variant → NETTOYAGE DU RUSH).` });
      }
      if (meta?.thumb) {
        const img = dataUriToImage(meta.thumb);
        if (img) content.push(img);
      }
    }
    return { content };
  }

  if (name === "create_variant") {
    // Pas de garde sur la référence : elle est OPTIONNELLE (le user peut passer
    // l'étape). Sans réf, Claude compose librement avec la matière ; get_reference
    // le lui dit proprement s'il la demande.
    if (!project.materials.length) return { content: [{ type: "text", text: "Aucune matière : le user doit ajouter des fichiers dans DuupFlow." }], isError: true };
    const blocked = await guardVariantQuota(userId);
    if (blocked) return { content: [blocked], isError: true };
    const job = startRenderJob(storeKey, project.id, stripDisplayOpts(args ?? {}) as unknown as EditPlan, {
      onDone: () => { void logUsageEvent(userId, "videos", 1); void logAiEditorRender(userId); }, // quota déjà réservé
      onFailed: () => releaseVariantQuota(userId),          // rien produit → on rend l'unité
    });
    return { content: await jobContent(await firstWait(job), wantImages(args, true)) };
  }

  if (name === "get_render") {
    const id = String(args?.renderId || "").trim();
    const job = id ? getRenderJob(id) : null;
    // ── SANS renderId : ce n'est PAS une erreur ──────────────────────────────
    // « Où en sont mes rendus ? » est une question légitime, et c'était la seule
    // façon de voir la file. La réponse partait en isError : le client la traitait
    // comme un échec d'outil au lieu d'un état — bonne info, mauvais canal.
    if (!id) {
      const running = runningJobsFor(storeKey);
      const q = queueSnapshot();
      if (!running.length) {
        return { content: [{ type: "text", text: `Aucun rendu en cours pour toi. Le serveur rend ${q.max} variante(s) à la fois (${q.active} créneau(x) occupé(s) au total, ${q.waiting} en attente).` }] };
      }
      const lines = running
        .slice()
        .sort((a, b) => a.startedAt - b.startedAt)
        .map((j) => {
          const pos = queuePosition(j);
          return isQueued(j)
            ? `  ⏸ ${j.id}${j.label ? ` « ${j.label} »` : ""} — EN FILE${pos ? `, position ${pos}` : ""} (pas encore commencé, en attente depuis ${jobElapsed(j)})`
            : `  ⏳ ${j.id}${j.label ? ` « ${j.label} »` : ""} — RENDU EN COURS depuis ${jobRenderElapsed(j) ?? jobElapsed(j)}`;
        });
      return {
        content: [{
          type: "text",
          text: `TES RENDUS — ${running.length} en vol (le serveur en rend ${q.max} à la fois ; ${q.active} créneau(x) occupé(s), ${q.waiting} en attente) :\n${lines.join("\n")}\n\n` +
            `Rappelle get_render avec un renderId précis pour récupérer une vidéo (l'appel patiente jusqu'à ~25 s). ` +
            `Tant qu'il reste des ⏸ EN FILE, NE LANCE PAS de nouvelle variante : tu ne gagnerais rien, tu allongerais la file.`,
        }],
      };
    }
    if (!job || job.userId !== storeKey) {
      const running = runningJobsFor(storeKey);
      return {
        content: [{
          type: "text",
          text: `Ticket introuvable : ${id} (expiré, ou le serveur a redémarré — dans ce cas le rendu est perdu, relance create_variant).${running.length ? ` Tickets en cours : ${running.map((j) => j.id).join(", ")}.` : ""}`,
        }],
        isError: true,
      };
    }
    const done = await waitForJob(job, POLL_WAIT_MS);
    return { content: await jobContent(done, wantImages(args, true)), isError: done.status === "failed" };
  }

  if (name === "cancel_render") {
    const id = String(args?.renderId || "").trim();
    const job = id ? getRenderJob(id) : null;
    if (!job || job.userId !== storeKey) {
      const running = runningJobsFor(storeKey);
      return {
        content: [{
          type: "text",
          text: `Ticket introuvable : ${id || "(vide)"}.${running.length ? ` Tes rendus en cours : ${running.map((j) => j.id).join(", ")}.` : " Aucun rendu en cours pour toi — rien à annuler."}`,
        }],
        isError: true,
      };
    }
    if (cancelRenderJob(job) === "already-finished") {
      return {
        content: [{
          type: "text",
          text: job.status === "done"
            ? `Trop tard pour annuler : ${job.id} est DÉJÀ TERMINÉ (variante rendue en ${jobElapsed(job)}). Récupère-la avec get_render, ou ignore-la simplement.`
            : `Rien à annuler : ${job.id} avait déjà échoué (${job.error ?? "erreur inconnue"}).`,
        }],
      };
    }
    // On laisse quelques secondes au SIGKILL pour libérer le créneau, afin de
    // répondre avec un état de file À JOUR (sinon « annulé » + file inchangée).
    await waitForJob(job, 5_000);
    const q = queueSnapshot();
    return {
      content: [{
        type: "text",
        text: `🛑 Rendu ${job.id}${job.label ? ` « ${job.label} »` : ""} annulé (après ${jobElapsed(job)}). Créneau libéré, quota rendu — rien n'est facturé. ` +
          `État de la file : ${q.active}/${q.max} créneau(x) occupé(s), ${q.waiting} en attente. Un rendu qui attendait son tour démarre automatiquement.`,
      }],
    };
  }

  if (name === "list_variants") {
    if (!project.variants.length) return { content: [{ type: "text", text: "Aucune variante générée pour l'instant." }] };
    // La plus RÉCENTE en premier (variants est déjà unshift-é à la création).
    // Vignettes MUETTES par défaut : la ligne de texte porte déjà tout ce qui
    // sert à se repérer (id, label, durée, date, filiation) ; le poster est le
    // 1er frame — souvent identique d'une variante à l'autre — et coûtait ~550
    // tokens PIÈCE. 47 variantes = 47 images pour zéro information nouvelle.
    const withImages = wantImages(args, false);
    const content: Content[] = [{
      type: "text",
      text: `VARIANTES — ${project.variants.length} (de la + récente à la + ancienne) :`,
    }];
    for (const v of project.variants) {
      const dur = v.durationSec ? ` · ${v.durationSec}s` : "";
      const dt = v.createdAt ? ` · ${new Date(v.createdAt).toISOString().replace("T", " ").slice(0, 16)}` : "";
      const from = v.derivedFrom ? ` · dérivée de ${v.derivedFrom}` : "";
      const plan = v.plan ? "" : " · ⚠ sans plan mémorisé (ancienne)";
      content.push({ type: "text", text: `• id: ${v.id}${v.label ? `  ·  ${v.label}` : ""}${dur}${dt}${from}${plan}` });
      if (withImages && v.poster) { const img = dataUriToImage(v.poster); if (img) content.push(img); }
    }
    content.push({
      type: "text",
      text: withImages
        ? "(images demandées explicitement — sur une longue série, laisse images: false)"
        : "→ get_variant(variantId) te rend le PLAN DE MONTAGE COMPLET d'une variante (segments, captions, audio, grade) : c'est comme ça que tu reprends une série sans rien redeviner. Ajoute images: true ici si tu dois vraiment comparer visuellement.",
    });
    return { content };
  }

  if (name === "get_variant") {
    const id = String(args?.variantId || "");
    const v = project.variants.find((x) => x.id === id);
    if (!v) return { content: [{ type: "text", text: `Variante introuvable : ${id}. Vois list_variants pour les id.` }], isError: true };
    const withImages = wantImages(args, false);

    // ── OUTIL DE REPRISE ─────────────────────────────────────────────────────
    // Il ne renvoyait QUE des keyframes : on voyait le résultat sans pouvoir lire
    // les réglages qui l'avaient produit. Après une perte de conversation, la
    // seule issue était de tout reconstruire à l'aveugle (vu le 20/08 : une série
    // de 47 variantes irrécupérable, et une soirée de tâtonnement sur le calage
    // des captions faute de pouvoir lire les valeurs). Le plan est pourtant
    // persisté depuis toujours (store: ProjectVariant.plan) et update_variant le
    // relit déjà — il n'était simplement jamais exposé. On le rend ici EN ENTIER :
    // tronqué, il ferait repartir le lecteur sur des données partielles, ce qui
    // est pire que pas de données du tout.
    const dur = v.durationSec ? ` · ${v.durationSec}s` : "";
    const dt = v.createdAt ? ` · ${new Date(v.createdAt).toISOString().replace("T", " ").slice(0, 16)}` : "";
    const from = v.derivedFrom ? ` · dérivée de ${v.derivedFrom}` : "";
    const content: Content[] = [{ type: "text", text: `VARIANTE « ${v.label || v.id} » (id ${v.id})${dur}${dt}${from}` }];

    if (v.plan) {
      const plan = v.plan as { segments?: unknown[]; captions?: unknown[]; overlays?: unknown[]; audio?: unknown; audioTracks?: unknown[]; aspect?: unknown; fps?: unknown };
      const nAud = (plan.audio ? 1 : 0) + (Array.isArray(plan.audioTracks) ? plan.audioTracks.length : 0);
      const nSeg = Array.isArray(plan.segments) ? plan.segments.length : 0;
      const nCap = Array.isArray(plan.captions) ? plan.captions.length : 0;
      content.push({
        type: "text",
        text: `PLAN DE MONTAGE COMPLET — ${nSeg} plan(s), ${nCap} caption(s)${nAud ? `, ${nAud} piste(s) son` : ", sans piste son"}${plan.aspect ? `, format ${String(plan.aspect)}` : ""}${plan.fps ? `, ${String(plan.fps)} fps` : ""}. ` +
          `C'est EXACTEMENT le payload qui a produit cette vidéo : timecodes de coupe, textes, position/taille/police des captions, calage de la musique, colorimétrie. ` +
          `Tu peux le relire, le modifier et le repasser tel quel à create_variant, ou n'en changer qu'un morceau avec update_variant("${v.id}", { … }). ` +
          `Ne demande PAS au user des réglages qui sont écrits ci-dessous.`,
      });
      content.push({ type: "text", text: "```json\n" + JSON.stringify(v.plan, null, 1) + "\n```" });
    } else {
      content.push({
        type: "text",
        text: `⚠ AUCUN PLAN MÉMORISÉ pour cette variante — elle a été créée avant que le moteur ne les enregistre. Ses réglages sont IRRÉCUPÉRABLES : ne les invente pas. ` +
          `Pour repartir sur une base lisible, recrée-la une fois avec create_variant (le plan sera alors mémorisé), ou appuie-toi sur une variante plus récente via list_variants.`,
      });
    }

    if (!withImages) {
      content.push({ type: "text", text: "(Images non renvoyées — le plan ci-dessus dit tout ce qu'une vignette ne peut pas dire. Ajoute images: true si tu dois VOIR le rendu, par exemple pour vérifier qu'une caption ne recouvre pas le sujet.)" });
      return { content };
    }

    // Images demandées explicitement : extraction ffmpeg (coûteuse) faite ici
    // seulement — par défaut get_variant est instantané et gratuit.
    const kfs = await variantKeyframes(storeKey, project.id, v.storedName, 5);
    if (!kfs.length) {
      // Échec explicite (plus de « 0 images » muet) : fichier ancien/absent.
      content.push({
        type: "text",
        text: `⚠ Aucune image extractible (fichier ancien ou absent). ${v.plan ? "Le plan ci-dessus reste valable : tu peux le rejouer tel quel avec create_variant." : "RÉGÉNÈRE la variante avec create_variant."}`,
      });
      if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push({ type: "text", text: "Poster (peut être daté) :" }, img); }
      return { content };
    }
    content.push({ type: "text", text: `${kfs.length} image(s) du rendu :` });
    for (const kf of kfs) {
      const img = dataUriToImage(kf.dataUri);
      if (img) content.push({ type: "text", text: `— ${kf.t}s —` }, img);
    }
    return { content };
  }

  if (name === "get_material") {
    const id = String(args?.materialId || "");
    const m = project.materials.find((x) => x.id === id);
    if (!m) return { content: [{ type: "text", text: `Matière introuvable : ${id}. Vois list_material.` }], isError: true };
    // Défaut TRUE, à l'inverse des outils de consultation : voir le rush est le
    // but même de cet outil (où couper, ce que montre le plan) et il n'est appelé
    // que sur 2-3 fichiers par session — il n'a jamais fait partie de l'effet
    // boule de neige. `images: false` reste disponible pour relire les seules
    // mesures (voix, blancs, beats) sans repayer les vignettes.
    const matImages = wantImages(args, true);
    if (m.kind === "image") {
      const w = m.analysis?.width ?? 0, h = m.analysis?.height ?? 0;
      // Dimensions source + alerte : une image plus petite que le canvas (jusqu'à
      // 1080×1920 en 9:16) sera upscalée → floue si mise plein cadre.
      const dim = w && h ? `${w}×${h}px` : "dimensions inconnues";
      const tooSmall = w > 0 && h > 0 && (w < 1080 || h < 1080);
      const warn = tooSmall
        ? ` ⚠ Plus petite que 1080p (${dim}) : elle sera upscalée et paraîtra FLOUE en plein cadre. Utilise-la en incrustation/petit format, ou évite le plein 9:16 (1080×1920).`
        : "";
      const content: Content[] = [{ type: "text", text: `IMAGE « ${m.name} » (id ${m.id})${m.desc?.trim() ? ` — « ${m.desc.trim()} »` : ""} · source ${dim}.${warn}` }];
      const img = matImages && m.analysis?.thumb ? dataUriToImage(m.analysis.thumb) : null;
      if (img) content.push(img);
      else content.push({ type: "text", text: matImages ? "(pas d'aperçu)" : "(aperçu non renvoyé — images: false)" });
      return { content };
    }
    if (m.kind === "audio") {
      const a = m.analysis?.audio;
      const content: Content[] = [{ type: "text", text: `AUDIO « ${m.name} » (id ${m.id}) — pose-le dans create_variant.audioTracks[] (materialId + atSec = où il démarre dans le montage) ; les timecodes ci-dessous se passent DIRECTEMENT dans captions[].startSec et segments[].transition.` }];
      if (a) for (const l of formatAudioLines(a)) content.push({ type: "text", text: l });
      else content.push({ type: "text", text: "(analyse audio indisponible)" });
      for (const l of formatVoiceLines(m.analysis?.transcript)) content.push({ type: "text", text: l });
      {
        // Mots RESSERRÉS sur la fin acoustique (Bug A) → mots, blancs et reprises cohérents.
        const tw = tightenWords(m.analysis?.transcript?.words, a?.silences);
        for (const l of formatWordLines(tw)) content.push({ type: "text", text: l });
        for (const l of formatSilenceLines(m.analysis?.transcript, a?.durationSec, a?.energy, a?.silences, tw)) content.push({ type: "text", text: l });
        for (const l of formatRetakeLines(tw)) content.push({ type: "text", text: l });
      }
      return { content };
    }
    // Images calées sur les MOMENTS (milieu de chaque portion), pas à intervalle
    // fixe : 5 images sur 29 s ne permettaient aucune décision de montage.
    const kfBounds = [
      ...(m.analysis?.moments ?? []).map((x) => x.t),
      ...(m.analysis?.segments ?? []).flatMap((x) => [x.startSec, x.endSec]),
      ...(m.analysis?.sceneCuts ?? []),
    ];
    // Extraction ffmpeg SEULEMENT si les images sont voulues : avec images:false
    // l'appel devient instantané et gratuit (on ne garde que les mesures).
    const kfs = matImages ? await materialKeyframes(storeKey, project.id, m.storedName, 12, kfBounds) : [];
    if (matImages && !kfs.length) return { content: [{ type: "text", text: `⚠ Aucune image extractible du rush « ${m.name} » (id ${m.id}).` }], isError: true };
    const content: Content[] = [{ type: "text", text: `RUSH « ${m.name} » (id ${m.id})${m.analysis?.durationSec ? ` · ${m.analysis.durationSec.toFixed(1)}s` : ""} — ${kfs.length ? `${kfs.length} images (timecodes pour tes coupes)` : "mesures seules (images: false)"} :` }];
    // Échec BRUYANT : sans description, le monteur doit le SAVOIR (sinon il pose
    // le texte sur la mauvaise image en croyant savoir ce qu'elle montre).
    for (const n of m.analysis?.notes ?? []) content.push({ type: "text", text: `⚠️ ${n}` });
    // ── CE QUE MONTRE LE RUSH (§2) : sans ça, le texte se pose sur la mauvaise
    // image (« Ajoute tes vidéos brutes » affiché sur la landing page).
    const segs = m.analysis?.segments ?? [];
    if (segs.length) {
      content.push({ type: "text", text:
        `SEGMENTS (${segs.length}) — ce que montre chaque portion. CHOISIS TON TEXTE D'APRÈS ÇA (une caption doit parler de ce qui est À L'ÉCRAN) :\n` +
        segs.map((sg) => `  [${sg.startSec.toFixed(2)}–${sg.endSec.toFixed(2)}s] « ${sg.content} »` +
          (sg.handheld ? ` · ⚠ DÉJÀ tremblé (filmé à la main) — n'ajoute PAS de motion "handheld" par-dessus` : sg.motion !== "none" ? ` · mouvement ${sg.motion} déjà présent` : "")).join("\n") });
    }
    // ── OÙ COUPER (§1) : le manque n°1. La réf donne le RYTHME, jamais les points.
    const moms = m.analysis?.moments ?? [];
    if (moms.length) {
      content.push({ type: "text", text:
        `⏱ MOMENTS (${moms.length}) — points de coupe CANDIDATS : coupe DESSUS, pas à côté. ` +
        `Un plan doit commencer/finir sur un de ces instants (changement d'écran, fin de geste, fin de mouvement), JAMAIS au milieu d'une action :\n` +
        moms.slice(0, 40).map((mo) => `  ${mo.t.toFixed(2)}s  ${mo.kind === "ecran" ? "changement d'écran" : mo.kind === "geste" ? "geste" : "mouvement"} — ${mo.what}`).join("\n") +
        (moms.length > 40 ? `\n  … (${moms.length - 40} de plus)` : "") });
    } else if (m.analysis?.sceneCuts?.length) {
      content.push({ type: "text", text: `⏱ Changements d'image mesurés (s) — points de coupe candidats : ${m.analysis.sceneCuts.slice(0, 40).map((c) => c.toFixed(2)).join(", ")}` });
    }
    // ── §3 : mouvement RÉELLEMENT présent (mesuré), pour ne pas en empiler.
    const msh = (m.analysis?.shots ?? []).filter((sh) => sh.motion !== "static");
    if (msh.length) {
      content.push({ type: "text", text:
        `🎥 MOUVEMENT DÉJÀ PRÉSENT dans le rush (mesuré) — n'ajoute PAS segments[].motion par-dessus, tu empilerais deux tremblements :\n` +
        msh.slice(0, 12).map((sh) => `  [${sh.startSec}–${sh.endSec}s] ${sh.motion} (intensité ${sh.motionIntensity})`).join("\n") });
    }
    // Son du rush (si présent) : mêmes timecodes exploitables que pour l'audio.
    if (m.analysis?.audio) for (const l of formatAudioLines(m.analysis.audio)) content.push({ type: "text", text: l });
    if (m.analysis?.voiceReliable === false) {
      // Whisper/Deepgram HALLUCINENT sur une piste sans parole et le texte était
      // présenté comme une vraie transcription (« Oh, d'un de nape… » sur un POV
      // muet) → captions inventées. On le dit au lieu de le servir tel quel.
      content.push({ type: "text", text: `  · ⚠ VOIX NON FIABLE — aucune parole nette détectée sur ce rush. Le transcript ci-dessous est probablement du BRUIT (hallucination de l'ASR) : NE L'UTILISE PAS pour écrire des sous-titres, et ne le cite pas au user.` });
    }
    for (const l of formatVoiceLines(m.analysis?.transcript)) content.push({ type: "text", text: l });
    {
      // Mots RESSERRÉS sur la fin acoustique (Bug A) → mots, blancs et reprises cohérents.
      const tw = tightenWords(m.analysis?.transcript?.words, m.analysis?.audio?.silences);
      for (const l of formatWordLines(tw)) content.push({ type: "text", text: l });
      // ── LES DÉTECTEURS SONT CHAÎNÉS ────────────────────────────────────────
      // Blancs et reprises DÉRIVENT du transcript. Si celui-ci est déjà signalé
      // comme non fiable, les publier quand même revient à ordonner des coupes
      // à partir de données reconnues fausses — et l'ordre est écrit à
      // l'impératif (« EXCLUS chaque plage »). Vu le 14/08 : sur un hook de
      // 5,7 s, 4,6 s de « blanc » et une « reprise » qui n'était que le refrain
      // d'une chanson. Le monteur a refusé ; un autre aurait obéi.
      if (m.analysis?.voiceReliable === false) {
        content.push({ type: "text", text: `  · ⛔ BLANCS et REPRISES NON CALCULÉS — ils se déduisent du transcript, or celui-ci vient d'être signalé NON FIABLE ci-dessus. Te les donner reviendrait à te faire couper d'après des données fausses. Pour découper ce rush, appuie-toi sur les ⏱ MOMENTS et les SEGMENTS.` });
      } else {
        const sl = formatSilenceLines(m.analysis?.transcript, m.analysis?.durationSec, m.analysis?.audio?.energy, m.analysis?.audio?.silences, tw);
        for (const l of sl) content.push({ type: "text", text: l });
        // ⛔ 2e maillon du chaînage. Le 1er (voiceReliable) n'attrape pas tout :
        // sur un rush musical dont les silences viennent de la voie ÉNERGIE, la
        // fiabilité restait « vraie » et les REPRISES étaient listées — « coupe
        // cette plage » sur un refrain de chanson, 1,5 s ôtées d'un hook de 5,7 s.
        // Si la détection de blancs s'est déclarée INCOHÉRENTE, la mesure du son
        // de ce fichier n'est pas fiable : les reprises, qui en dépendent aussi,
        // ne doivent pas être émises non plus.
        if (sl.some((l) => l.includes("DÉTECTION DE BLANCS INCOHÉRENTE"))) {
          content.push({ type: "text", text: `  · ⛔ REPRISES NON CALCULÉES — la détection de blancs de ce fichier vient d'être déclarée incohérente ; les reprises reposent sur la même mesure. Ne coupe rien sur cette base.` });
        } else {
          for (const l of formatRetakeLines(tw)) content.push({ type: "text", text: l });
        }
      }
    }
    for (const kf of kfs) { const img = dataUriToImage(kf.dataUri); if (img) content.push({ type: "text", text: `— ${kf.t}s —` }, img); }
    return { content };
  }

  if (name === "update_variant") {
    const id = String(args?.variantId || "");
    const patch = (args?.patch ?? {}) as Record<string, unknown>;
    const v = project.variants.find((x) => x.id === id);
    if (!v) return { content: [{ type: "text", text: `Variante introuvable : ${id}. Vois list_variants.` }], isError: true };
    if (!v.plan) return { content: [{ type: "text", text: `La variante « ${v.label || id} » n'a pas de plan mémorisé (ancienne) — recrée-la une fois avec create_variant, ensuite update_variant marchera.` }], isError: true };
    // Fusion : les champs du patch écrasent ceux du plan d'origine (un tableau
    // segments/captions fourni REMPLACE l'ancien ; les champs absents sont gardés).
    const merged = stripDisplayOpts({ ...v.plan, ...patch }) as unknown as EditPlan;
    // Label : celui du patch, sinon auto-suffixe (v2, v3…) pour distinguer les itérations.
    const patchLabel = typeof patch.label === "string" && patch.label.trim() ? patch.label.trim() : "";
    if (!patchLabel) {
      const base = String((v.plan as { label?: string }).label ?? v.label ?? "variante").replace(/\s*\(v\d+\)\s*$/, "");
      const n = project.variants.filter((x) => String(x.label ?? "").replace(/\s*\(v\d+\)\s*$/, "") === base).length + 1;
      merged.label = `${base} (v${n})`;
    }
    const blocked = await guardVariantQuota(userId);
    if (blocked) return { content: [blocked], isError: true };
    // Même traitement que create_variant : tâche de fond + ticket (un patch de
    // sous-titres sur un montage lourd est le cas qui dépassait la patience du client).
    const job = startRenderJob(storeKey, project.id, merged, {
      derivedFrom: v.id,
      onDone: () => { void logUsageEvent(userId, "videos", 1); void logAiEditorRender(userId); },
      onFailed: () => releaseVariantQuota(userId),
    });
    return { content: await jobContent(await firstWait(job), wantImages(args, true)) };
  }

  return { content: [{ type: "text", text: `Outil inconnu : ${name}` }], isError: true };
}


/* ── Créateurs (workspaces Pro & Agence) ──────────────────────────────────────
   Le Claude d'un VA ne voit QUE les créateurs qui lui sont assignés : le scope
   est relu en base à CHAQUE appel (editorScopeForMcp), donc un créateur ajouté
   ou retiré par le propriétaire est pris en compte immédiatement, sans
   reconnexion. Plusieurs créateurs → argument `creator` explicite, jamais
   d'état « actif » caché qui se mélangerait entre deux onglets. */

const CREATOR_PROP = {
  type: "string",
  description:
    "Nom exact du créateur / de la créatrice sur lequel travailler. Obligatoire si le compte en gère plusieurs (voir list_creators) ; garde le même pour toute la conversation.",
} as const;

const LIST_CREATORS_TOOL = {
  name: "list_creators",
  description:
    "Liste les créateurs (workspaces DuupFlow) auxquels tu as accès, avec leur brief. À appeler en premier si le user gère plusieurs créateurs, pour savoir lequel passer en argument creator.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

const GET_BRIEF_TOOL = {
  name: "get_creator_brief",
  description:
    "Relit le BRIEF enregistré d'un créateur (style de captions, ton, langue, hooks qui marchent, choses à éviter). Le brief est la mémoire permanente du créateur, partagée par toute l'équipe.",
  inputSchema: { type: "object", properties: { creator: CREATOR_PROP }, additionalProperties: false },
};

const SAVE_BRIEF_TOOL = {
  name: "save_creator_brief",
  description:
    "ENREGISTRE dans le brief permanent du créateur une consigne que le user veut voir appliquée à toutes les prochaines variantes (ex. « retiens que ses captions sont jaunes »). " +
    "mode « append » (défaut) ajoute une ligne au brief existant ; « replace » remplace tout le brief — à n'utiliser que si le user le demande explicitement. " +
    "Confirme au user ce qui a été enregistré. Réservé au propriétaire et aux managers (un VA reçoit un refus).",
  inputSchema: {
    type: "object",
    properties: {
      creator: CREATOR_PROP,
      text: { type: "string", description: "La consigne à enregistrer, rédigée clairement (une ou quelques lignes)." },
      mode: { type: "string", enum: ["append", "replace"], description: "append (défaut) ou replace." },
    },
    required: ["text"],
    additionalProperties: false,
  },
};

/** Les outils exposés à CE user : ajoute `creator` + les outils créateurs quand il a des workspaces. */
export async function toolsForUser(userId: string): Promise<unknown[]> {
  const { getWorkspaceContext } = await import("@/lib/workspaces");
  const ctx = await getWorkspaceContext(userId);
  if (!ctx.enabled) return [...TOOLS];
  const withCreator = (TOOLS as unknown as { inputSchema: { properties?: Record<string, unknown> } }[]).map((tool) => ({
    ...tool,
    inputSchema: { ...tool.inputSchema, properties: { ...(tool.inputSchema.properties ?? {}), creator: CREATOR_PROP } },
  }));
  return [LIST_CREATORS_TOOL, GET_BRIEF_TOOL, SAVE_BRIEF_TOOL, ...withCreator];
}

export async function callTool(userId: string, name: string, args?: Record<string, unknown>): Promise<{ content: Content[]; isError?: boolean }> {
  const { editorScopeForMcp, briefBlock, workspaceBrief } = await import("./scope");
  const { creator, ...rest } = args ?? {};

  if (name === "list_creators") {
    const { getWorkspaceContext } = await import("@/lib/workspaces");
    const ctx = await getWorkspaceContext(userId);
    if (!ctx.enabled) return { content: [{ type: "text", text: "Ce compte n'utilise pas de créateurs : appelle les outils sans argument creator." }] };
    if (ctx.workspaces.length === 0) return { content: [{ type: "text", text: "Aucun créateur ne t'est assigné. Demande au propriétaire du compte de t'en assigner un." }], isError: true };
    const { listBriefImages } = await import("@/lib/brief-images");
    const parts = await Promise.all(ctx.workspaces.map(async (w) => {
      const b = await workspaceBrief(w.id);
      const n = (await listBriefImages(w.id)).length;
      return `• « ${w.name} »${n ? ` (${n} image(s) de référence — get_creator_brief pour les voir)` : ""}\n  Brief : ${b ? b.replace(/\n/g, "\n  ") : "(aucun)"}`;
    }));
    return { content: [{ type: "text", text: `CRÉATEURS ACCESSIBLES (${ctx.workspaces.length}) — passe le nom exact en argument creator :\n${parts.join("\n")}` }] };
  }

  const resolved = await editorScopeForMcp(userId, creator);
  if (!resolved.ok) return { content: [{ type: "text", text: resolved.text }], isError: true };
  const { scope } = resolved;

  if (name === "add_material") return addMaterialTool(scope.storeKey, scope.workspace?.name ?? null, rest);
  if (name === "duplicate_videos" || name === "duplicate_images" || name === "get_duplication" || name === "send_duplicates_to_editor") {
    const out = await duplicatorTool(name, userId, scope.storeKey, rest);
    // Le créateur en cours, rappelé en tête (comme les autres outils).
    if (scope.workspace) out.content = [{ type: "text", text: `CRÉATEUR : « ${scope.workspace.name} »` } as Content, ...out.content];
    return out;
  }
  if (name === "drive_status") {
    const g = await import("@/lib/google-drive-oauth");
    const { getWorkspaceContext } = await import("@/lib/workspaces");
    const ctx = await getWorkspaceContext(userId);
    const link = g.driveOAuthConfigured() ? await g.getDriveLink(ctx.ownerId) : null;
    if (!link) return { content: [{ type: "text", text: `Google Drive : NON CONNECTÉ.\n${g.DRIVE_CONNECT_HOWTO}` }] };
    const folder = scope.workspace ? g.creatorFolderName(scope.workspace.name) : g.DRIVE_FOLDER_NAME;
    return { content: [{ type: "text", text: `Google Drive : CONNECTÉ (compte ${link.google_email ?? "Google"}). Les exports de ${scope.workspace ? `« ${scope.workspace.name} »` : "ce compte"} vont dans le dossier « ${folder} » (créé automatiquement). Le user peut l'ouvrir depuis sa fiche créateur (« Ouvrir »).` }] };
  }
  if (name === "export_to_drive" || name === "get_drive_export") return driveExportTool(name, userId, scope.storeKey, scope.workspace ? { id: scope.workspace.id, name: scope.workspace.name } : null, rest);

  if (name === "get_creator_brief" || name === "save_creator_brief") {
    if (!scope.workspace) return { content: [{ type: "text", text: "Ce compte n'utilise pas de créateurs : il n'y a pas de brief à lire ou enregistrer." }], isError: true };
    if (name === "get_creator_brief") {
      const { briefImagesForClaude } = await import("@/lib/brief-images");
      const imgs = await briefImagesForClaude(scope.workspace.id);
      const content: Content[] = [{ type: "text", text: briefBlock(scope) ?? "" }];
      for (const im of imgs) {
        content.push({ type: "text", text: `Image de référence du brief : « ${im.name} »` } as Content);
        content.push({ type: "image", data: im.data, mimeType: im.mimeType } as Content);
      }
      return { content };
    }
    const { saveWorkspaceBrief } = await import("@/lib/workspaces");
    const r = await saveWorkspaceBrief(userId, scope.workspace.id, String(rest.text ?? ""), rest.mode === "replace" ? "replace" : "append");
    if (!r.ok) return { content: [{ type: "text", text: r.error }], isError: true };
    return { content: [{ type: "text", text: `Brief de « ${scope.workspace.name} » enregistré (${r.length}/4000 caractères). Il s'appliquera automatiquement à toutes les prochaines variantes, pour toute l'équipe.\n---\n${r.brief}\n---` }] };
  }

  const out = await callToolScoped(userId, scope.storeKey, name, rest);

  // Le brief en tête des outils que Claude appelle en début de travail : il
  // connaît le créateur sans que le VA ait à le réexpliquer. Les autres
  // réponses rappellent seulement le créateur en cours (pas de répétition du brief).
  const block = briefBlock(scope);
  if (block) {
    const head = name === "get_reference" || name === "list_material"
      ? block
      : `CRÉATEUR : « ${scope.workspace!.name} »`;
    out.content = [{ type: "text", text: head } as Content, ...out.content];
  }
  return out;
}


/* ── Prompts MCP : un prompt par créateur ─────────────────────────────────────
   Dans Claude, le menu « + » / « / » propose « Travailler pour Léa » : un clic
   charge le créateur et son brief dans la conversation. Même filtre d'accès
   que les outils (un VA ne voit que ses créateurs), relu à chaque appel. */

function promptSlug(name: string, id: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `createur-${base || "sans-nom"}-${id.slice(0, 6)}`;
}

export async function promptsForUser(userId: string): Promise<{ name: string; title: string; description: string }[]> {
  const { getWorkspaceContext } = await import("@/lib/workspaces");
  const ctx = await getWorkspaceContext(userId);
  if (!ctx.enabled) return [];
  return ctx.workspaces.map((w) => ({
    name: promptSlug(w.name, w.id),
    title: `Travailler pour ${w.name}`,
    description: `Charge le créateur « ${w.name} » et son brief : toutes les variantes de la conversation seront faites pour lui / elle.`,
  }));
}

type PromptContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
export async function getPromptForUser(userId: string, promptName: string): Promise<{ description: string; messages: { role: "user"; content: PromptContent }[] } | null> {
  const { getWorkspaceContext } = await import("@/lib/workspaces");
  const { workspaceBrief } = await import("./scope");
  const ctx = await getWorkspaceContext(userId);
  if (!ctx.enabled) return null;
  const ws = ctx.workspaces.find((w) => promptSlug(w.name, w.id) === promptName);
  if (!ws) return null;
  const brief = await workspaceBrief(ws.id);
  const text =
    `Pour toute cette conversation, je travaille pour le créateur « ${ws.name} » sur DuupFlow.\n` +
    `Passe creator: "${ws.name}" à CHAQUE outil DuupFlow.\n\n` +
    (brief
      ? `Voici son BRIEF permanent — applique-le à chaque variante sans que j'aie à le répéter :\n---\n${brief}\n---\n\n`
      : `Ce créateur n'a pas encore de brief. Si je te donne des consignes durables (style, ton, hooks…), propose de les enregistrer avec save_creator_brief.\n\n`) +
    `Commence par regarder la référence (get_reference) et ma matière (list_material), puis dis-moi ce que tu proposes.`;
  // Les images du brief suivent le texte : Claude les VOIT dès le chargement du prompt.
  const { briefImagesForClaude } = await import("@/lib/brief-images");
  const imgs = await briefImagesForClaude(ws.id);
  return {
    description: `Travailler pour ${ws.name}`,
    messages: [
      { role: "user", content: { type: "text", text: imgs.length ? `${text}\n\nCi-dessous, ses ${imgs.length} image(s) de référence (style, captions, ambiance) : inspire-t'en pour chaque variante.` : text } },
      ...imgs.map((im) => ({ role: "user" as const, content: { type: "image" as const, data: im.data, mimeType: im.mimeType } })),
    ],
  };
}


/* ── add_material : Claude dépose lui-même la matière ─────────────────────── */

async function addMaterialTool(storeKey: string, creator: string | null, a: Record<string, unknown>): Promise<{ content: Content[]; isError?: boolean }> {
  const fileId = typeof a.drive_file_id === "string" ? a.drive_file_id.trim() : "";
  const folderId = typeof a.drive_folder_id === "string" ? a.drive_folder_id.trim() : "";
  const url = typeof a.url === "string" ? a.url.trim() : "";
  const desc = typeof a.description === "string" ? a.description.slice(0, 500) : "";
  const sources = [fileId, folderId, url].filter(Boolean).length;
  if (sources !== 1) {
    return { content: [{ type: "text", text: "Donne UNE source : drive_file_id, drive_folder_id OU url." }], isError: true };
  }
  const { serviceAccountEmail } = await import("@/lib/google-service-account");
  if ((fileId || folderId) && !serviceAccountEmail()) {
    return { content: [{ type: "text", text: "La lecture Google Drive n'est pas configurée sur le serveur DuupFlow (compte de service absent). Utilise un lien https direct (url), ou demande au user d'uploader le fichier." }], isError: true };
  }
  const { getLatestProject, createProject } = await import("./store");
  const ing = await import("./material-ingest");
  const fsp = await import("fs/promises");
  const project = (await getLatestProject(storeKey)) ?? (await createProject(storeKey));

  // Liste des fichiers à ajouter (un seul, sauf dossier).
  let targets: { kind: "drive"; id: string; name?: string }[] | { kind: "url"; url: string }[];
  try {
    targets = fileId
      ? [{ kind: "drive", id: fileId }]
      : folderId
        ? (await ing.listDriveFolder(folderId, 10)).map((f) => ({ kind: "drive" as const, id: f.id, name: f.name }))
        : [{ kind: "url", url }];
  } catch (e) {
    return { content: [{ type: "text", text: `Impossible de lire le dossier Drive : ${(e as Error).message}` }], isError: true };
  }
  if (targets.length === 0) return { content: [{ type: "text", text: "Aucun média (vidéo / image / audio) trouvé dans ce dossier Drive." }], isError: true };

  const started = Date.now();
  const lines: string[] = [];
  let added = 0;
  for (let i = 0; i < targets.length; i++) {
    // Budget temps : la requête MCP est plafonnée à 300 s.
    if (Date.now() - started > 200_000) {
      lines.push(`⏸ ${targets.length - i} fichier(s) non traité(s) faute de temps : rappelle add_material sur le même dossier, les fichiers déjà présents seront à retirer de la liste.`);
      break;
    }
    const t = targets[i];
    let dl: Awaited<ReturnType<typeof ing.downloadPublicUrl>> | null = null;
    try {
      dl = t.kind === "drive" ? await ing.downloadDriveFile(t.id) : await ing.downloadPublicUrl(t.url);
      const r = await ing.ingestMaterialFile({
        storeKey, projectId: project.id, tmpPath: dl.tmpPath, fileName: dl.fileName, mimeType: dl.mimeType, desc, logTag: "mcp/add_material",
      });
      if (!r.ok) { lines.push(`❌ ${dl.fileName} — ${r.error}`); continue; }
      added++;
      lines.push(`✅ ${dl.fileName} — id ${r.material.id} · ${r.material.kind}${r.material.status === "analyzing" ? " · analyse en cours" : ""}`);
    } catch (e) {
      lines.push(`❌ ${t.kind === "drive" ? (t.name ?? t.id) : t.url} — ${(e as Error).message}`);
    } finally {
      if (dl) await fsp.rm(dl.tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
  return {
    content: [{
      type: "text",
      text: `${added}/${targets.length} fichier(s) ajouté(s) au projet${creator ? ` de « ${creator} »` : ""} (id ${project.id}) :\n${lines.join("\n")}` +
        (added ? "\n\nLes vidéos et audios s'analysent en tâche de fond : appelle list_material dans un moment pour voir leur analyse avant de monter." : ""),
    }],
    isError: added === 0,
  };
}

/* ── export_to_drive / get_drive_export ───────────────────────────────────── */

async function driveExportTool(
  name: "export_to_drive" | "get_drive_export",
  userId: string,
  storeKey: string,
  workspace: { id: string; name: string } | null,
  a: Record<string, unknown>,
): Promise<{ content: Content[]; isError?: boolean }> {
  const creator = workspace?.name ?? null;
  const dx = await import("./drive-export");
  const waitFor = async (job: import("./drive-export").DriveExportJob, ms: number) => {
    const end = Date.now() + ms;
    while (job.status === "running" && Date.now() < end) await new Promise((r) => setTimeout(r, 1000));
    return job;
  };

  if (name === "export_to_drive") {
    const { getLatestProject } = await import("./store");
    const project = await getLatestProject(storeKey);
    if (!project) return { content: [{ type: "text", text: "Aucun projet : rien à exporter." }], isError: true };
    const ids = Array.isArray(a.variant_ids) ? a.variant_ids.filter((x): x is string => typeof x === "string") : [];
    const { getWorkspaceContext } = await import("@/lib/workspaces");
    const ownerId = (await getWorkspaceContext(userId)).ownerId; // Drive du propriétaire du compte
    const job = await dx.startDriveExport({ storeKey, ownerId, userId, projectId: project.id, variantIds: ids, creator, workspace });
    if (!("folderId" in job)) return { content: [{ type: "text", text: job.error }], isError: true };
    await waitFor(job, 20_000);
    return { content: [{ type: "text", text: dx.describeDriveExport(job) }], isError: job.status === "failed" };
  }

  const ticket = typeof a.ticket === "string" ? a.ticket.trim() : "";
  if (!ticket) {
    const list = dx.driveExportsFor(storeKey).slice(0, 10);
    if (!list.length) return { content: [{ type: "text", text: "Aucun export Drive récent." }] };
    return { content: [{ type: "text", text: list.map((j) => dx.describeDriveExport(j)).join("\n\n") }] };
  }
  const job = dx.getDriveExport(ticket);
  // Même périmètre que les rendus : le ticket appartient au créateur en cours.
  if (!job || job.storeKey !== storeKey) {
    return { content: [{ type: "text", text: `Ticket ${ticket} introuvable (expiré après 2 h, ou appartenant à un autre créateur).` }], isError: true };
  }
  await waitFor(job, 20_000);
  return { content: [{ type: "text", text: dx.describeDriveExport(job) }], isError: job.status === "failed" };
}


/* ── Duplicateur (vidéos / images) + envoi des copies dans l'Éditeur IA ────── */

async function duplicatorTool(
  name: "duplicate_videos" | "duplicate_images" | "get_duplication" | "send_duplicates_to_editor",
  userId: string,
  storeKey: string,
  a: Record<string, unknown>,
): Promise<{ content: Content[]; isError?: boolean }> {
  const d = await import("./mcp-duplicate");
  const wait = async (job: import("./mcp-duplicate").DupJob, ms: number) => {
    const end = Date.now() + ms;
    while (job.status === "running" && Date.now() < end) await new Promise((r) => setTimeout(r, 1000));
    return job;
  };
  if (name === "duplicate_images") {
    const r = await d.duplicateImages(userId, storeKey, a);
    return { content: [{ type: "text", text: r.text }], isError: r.isError };
  }
  if (name === "send_duplicates_to_editor") {
    const r = await d.sendDuplicatesToEditor(storeKey, a);
    return { content: [{ type: "text", text: r.text }], isError: r.isError };
  }
  if (name === "duplicate_videos") {
    const r = await d.startVideoDuplication(userId, storeKey, a);
    if (!r.job) return { content: [{ type: "text", text: r.error ?? "Duplication impossible." }], isError: true };
    await wait(r.job, 20_000);
    return { content: [{ type: "text", text: d.describeDupJob(r.job) }], isError: r.job.status === "failed" };
  }
  const ticket = typeof a.ticket === "string" ? a.ticket.trim() : "";
  if (!ticket) {
    const jobs = d.dupJobsFor(storeKey).slice(0, 5);
    const head = jobs.length ? jobs.map((j) => d.describeDupJob(j)).join("\n\n") : "Aucune duplication récente via Claude.";
    return { content: [{ type: "text", text: `${head}\n\n${await d.listDuplicates(storeKey)}` }] };
  }
  const job = d.getDupJob(ticket);
  if (!job || job.storeKey !== storeKey) return { content: [{ type: "text", text: `Ticket ${ticket} introuvable (expiré après 3 h, ou autre créateur).` }], isError: true };
  await wait(job, 25_000);
  return { content: [{ type: "text", text: d.describeDupJob(job) }], isError: job.status === "failed" };
}
