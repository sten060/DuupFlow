// src/lib/ai-editor/mcp-tools.ts
//
// Définition + exécution des OUTILS MCP de l'Éditeur IA (séparé de la route pour
// être testable sans l'auth). Lecture seule pour l'instant : donner au Claude du
// user la référence analysée (keyframes EN IMAGES qu'il VOIT + transcript) et la
// matière. La génération viendra avec le moteur de rendu.

import { getLatestProject, projectPaths } from "./store";
import type { Project } from "./store";
import { renderVariant, variantKeyframes, materialKeyframes } from "./render";
import type { EditPlan } from "./render";
import { analyzeColor } from "./ref-profile";
import { checkUsageForUser, incrementUsage } from "@/lib/usage";

// Garde-fou quota : chaque rendu de variante (create_variant / update_variant)
// compte comme UNE « vidéo » (le user paie SON Claude, DuupFlow facture le RENDU).
// Pro = illimité. Sans ça, un Claude connecté rendrait des vidéos sans fin.
async function guardVariantQuota(userId: string): Promise<Content | null> {
  const usage = await checkUsageForUser(userId, "videos", 1).catch(() => null);
  if (usage && !usage.allowed) {
    return { type: "text", text: `⛔ Quota atteint : ${usage.message ?? "limite de vidéos du plan atteinte."} Le rendu est bloqué tant que le user (ou son hôte) n'a pas plus de quota / un plan supérieur.` };
  }
  return null; // autorisé (ou vérif indisponible → on ne bloque pas un render légitime)
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const MAX_KEYFRAMES = 6; // borne le nombre d'images renvoyées (coût tokens user)

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
      "SYNCHRO MUSIQUE : les timecodes mesurés sur la matière sonore (get_material → beats, drops, énergie) s'utilisent DIRECTEMENT — cale captions[].startSec et les transitions segments[].transition sur les beats/drops (ex. une transition PILE sur un drop, un caption qui apparaît sur un temps fort). " +
      "Durées : segment libre (borné à la longueur du fichier pour une vidéo) ; défaut image = 2,5 s. Jusqu'à 40 segments, 30 captions. DURÉE TOTALE MAX = 90 s (cible short-form) : au-delà, le rendu est refusé — retire ou raccourcis des plans.",
    inputSchema: {
      type: "object",
      properties: {
        aspect: { type: "string", enum: ["9:16", "1:1", "16:9"], description: "Format (défaut 9:16)." },
        emojiStyle: { type: "string", enum: ["3d", "flat"], description: "Style des emojis de TOUTES les captions : \"3d\" = Fluent 3D brillant (défaut, look premium), \"flat\" = Twemoji plat. Surchargable par caption." },
        fps: { type: "number", description: "Images/s de sortie (15-60, défaut 30)." },
        background: { type: "string", description: "Couleur de fond des bandes (letterbox) en hex. Défaut noir." },
        grade: {
          type: "object",
          description: "Colorimétrie GLOBALE (optionnel).",
          properties: {
            saturation: { type: "number", description: "1 = neutre, >1 plus saturé, <1 désaturé." },
            contrast: { type: "number", description: "1 = neutre." },
            brightness: { type: "number", description: "0 = neutre (-1..1)." },
            temperature: { type: "number", description: "Teinte : -1 froid (bleuté) .. +1 chaud (doré), 0 neutre." },
            grain: { type: "number", description: "0..1 : grain filmique." },
            vignette: { type: "boolean", description: "Assombrit les bords." },
          },
        },
        audio: {
          type: "object",
          description: "Piste sonore optionnelle prise d'une MATIÈRE (fichier audio uploadé, OU le son d'un rush vidéo). Sert à poser une musique/voix sur toute la variante.",
          properties: {
            materialId: { type: "string", description: "id (de list_material) d'une matière audio ou vidéo (on prend sa piste son)." },
            startSec: { type: "number", description: "décalage de départ dans la piste (s). Défaut 0." },
            volume: { type: "number", description: "0-2 (1 = normal). Défaut 1." },
            mode: { type: "string", enum: ["mix", "replace"], description: "mix = par-dessus le son des plans (défaut) ; replace = remplace le son des plans." },
            duck: { description: "MIX only : DUCKING — baisse auto la musique quand une VOIX parle dans les plans, puis la remonte (sinon dialogue + musique se couvrent). true = valeurs par défaut (réduction ~12 dB, attack 0.1s, release 0.4s), ou objet { enabled, threshold (0-1), reduction (dB), attack (s), release (s) }.", anyOf: [{ type: "boolean" }, { type: "object", properties: { enabled: { type: "boolean" }, threshold: { type: "number" }, reduction: { type: "number" }, attack: { type: "number" }, release: { type: "number" } } }] },
          },
          required: ["materialId"],
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
                description: "Médias additionnels compositée dans le plan (réaction, avant/après, watermark, écran d'app…). En split, overlays[0] = 2e panneau ; le reste = incrustations.",
                items: {
                  type: "object",
                  properties: {
                    materialId: { type: "string", description: "id (list_material) du média à incruster." },
                    x: { type: "number", description: "Position coin haut-gauche, % du cadre (0-100)." },
                    y: { type: "number", description: "Position verticale, % du cadre." },
                    width: { type: "number", description: "Largeur de l'incrustation, % du cadre (5-100)." },
                    startSec: { type: "number", description: "Apparition, relative au plan." },
                    endSec: { type: "number", description: "Disparition, relative au plan." },
                    opacity: { type: "number", description: "0-1 (défaut 1)." },
                    borderRadius: { type: "number", description: "Coins arrondis en px." },
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
                description: "Colorimétrie PROPRE à CE plan (surcharge le grade global). Ex. assombrir la dernière photo « avant » (brightness négatif) pendant le caption pivot pour la bascule visuelle. Réf : get_reference signale un plan assombri par rapport au reste.",
                properties: {
                  saturation: { type: "number", description: "1 = neutre." },
                  contrast: { type: "number", description: "1 = neutre." },
                  brightness: { type: "number", description: "0 = neutre (-1..1) ; négatif = plus sombre." },
                  temperature: { type: "number", description: "-1 froid .. +1 chaud." },
                  grain: { type: "number", description: "0..1." },
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
            },
            required: ["materialId"],
          },
        },
        captions: {
          type: "array",
          description: "Textes incrustés (optionnel).",
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "Le texte. Les emojis 🔥💪🎉 sont rendus EN COULEUR — style 3D premium par défaut, ou plat via emojiStyle. Utilise-les librement." },
              startSec: { type: "number" },
              endSec: { type: "number" },
              position: { type: "string", enum: ["top", "center", "bottom"], description: "Position rapide (défaut bottom). Ignorée si x/y fournis." },
              x: { type: "number", description: "Centre horizontal en % (0-100)." },
              y: { type: "number", description: "Centre vertical en % (0-100). Ex. réf ≈ 13 (haut)." },
              align: { type: "string", enum: ["left", "center", "right"], description: "Alignement (défaut center)." },
              style: { type: "string", enum: ["outline", "box"], description: "outline = gros texte contour (défaut) ; box = fond." },
              background: { type: "string", description: "Couleur de fond hex → force le style box ; \"none\" → force outline (sans fond)." },
              size: { type: "string", enum: ["s", "m", "l"], description: "Taille rapide (défaut m)." },
              fontSize: { type: "number", description: "Taille en px (référence 1080 de large). Prioritaire sur size." },
              color: { type: "string", description: "Couleur du texte en hex. Défaut blanc." },
              strokeColor: { type: "string", description: "Couleur du contour (style outline). Défaut noir." },
              strokeWidth: { type: "number", description: "Épaisseur du contour en px." },
              font: { type: "string", enum: ["sans", "rounded", "impact", "serif", "script", "display"], description: "Famille : sans (défaut), rounded (arrondie type TikTok/CapCut), impact (grosse condensée), serif, script (manuscrite), display." },
              fontWeight: { type: "number", description: "Graisse 100-900." },
              letterSpacing: { type: "number", description: "Interlettrage en px." },
              lineHeight: { type: "number", description: "Interligne (multiplicateur, défaut 1.24)." },
              textTransform: { type: "string", enum: ["none", "uppercase"], description: "uppercase = TOUT EN MAJUSCULES." },
              shadowColor: { type: "string", description: "Ombre portée (hex) — distincte du contour ; \"none\" pour aucune." },
              shadowBlur: { type: "number", description: "Flou de l'ombre en px." },
              shadowOffset: { type: "number", description: "Décalage de l'ombre en px (bas-droite)." },
              emojiStyle: { type: "string", enum: ["3d", "flat"], description: "Style des emojis de CETTE caption : \"3d\" (Fluent 3D, défaut) | \"flat\" (Twemoji). Prioritaire sur le défaut du plan." },
              animation: { type: "string", enum: ["none", "fade", "pop", "slideUp", "typewriter", "wordByWord", "karaoke"], description: "Animation d'apparition (défaut none). wordByWord = mots l'un après l'autre ; karaoke = tous visibles, mot actif surligné (highlightColor). Réf : get_reference → captions[].animation." },
              animationDuration: { type: "number", description: "Durée de l'animation d'entrée en s (défaut ~0.35)." },
              words: { type: "array", description: "Pour wordByWord/karaoke : timing par mot (sinon réparti automatiquement sur [startSec,endSec]). Utilise les timecodes de get_material (transcript de la piste audio) pour caler sur la voix.", items: { type: "object", properties: { text: { type: "string" }, start: { type: "number" }, end: { type: "number" } } } },
              highlightColor: { type: "string", description: "karaoke : couleur hex du mot actif." },
              glow: { type: "object", description: "Effet NÉON : cœur clair (color de la caption) + halo saturé autour. Style pivot omniprésent en short-form.", properties: { color: { type: "string", description: "Couleur hex du halo néon." }, intensity: { type: "number", description: "0.2-3 (défaut 1) : taille/densité du halo." } } },
            },
            required: ["text", "startSec", "endSec"],
          },
        },
        label: { type: "string", description: "nom court de la variante (ex. hook utilisé)." },
      },
      required: ["segments"],
    },
  },
  {
    name: "list_variants",
    description: "Liste les variantes déjà générées pour le dernier projet (id + vignette du 1er frame). Pour VOIR une variante en détail, utilise get_variant.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_variant",
    description: "Renvoie plusieurs KEYFRAMES d'une variante déjà rendue (pour la relire et t'auto-corriger). Donne son id (de list_variants / create_variant).",
    inputSchema: {
      type: "object",
      properties: { variantId: { type: "string", description: "id de la variante." } },
      required: ["variantId"],
    },
  },
  {
    name: "get_material",
    description: "Renvoie 4-6 KEYFRAMES d'UN fichier de matière précis (par son id). Appelle-le SEULEMENT sur les 2-3 rushes que tu comptes vraiment utiliser (voir où couper) — pas sur tout, pour ne pas saturer ton contexte. Image → renvoie l'image ; audio → infos texte.",
    inputSchema: {
      type: "object",
      properties: { materialId: { type: "string", description: "id d'un fichier (de list_material)." } },
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
async function shrinkDataUri(dataUri: string, width = 360, quality = 60): Promise<string> {
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

export async function callTool(userId: string, name: string, args?: Record<string, unknown>): Promise<{ content: Content[]; isError?: boolean }> {
  const project: Project | null = await getLatestProject(userId);

  if (!project) {
    return { content: [{ type: "text", text: "Aucun projet : le user doit d'abord uploader une référence dans l'Éditeur IA de DuupFlow." }], isError: true };
  }

  if (name === "get_reference") {
    const ref = project.reference;
    if (!ref) return { content: [{ type: "text", text: "Aucune référence dans ce projet pour l'instant." }], isError: true };
    const a = ref.analysis;
    const cuts = Array.isArray(a.sceneCuts) ? a.sceneCuts : [];
    const phrases = a.transcript?.phrases ?? [];
    const N_IMG = 5;
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
          `CAPTIONS DU MODÈLE (${comp.captions.length}) — LUES à l'écran, prêtes à passer TEL QUEL à create_variant.captions (mêmes unités) :\n` +
          comp.captions.map((c, i) =>
            `  ${i + 1}. « ${c.text} »${c.emojis ? ` ${c.emojis}` : ""}\n` +
            `     [${c.startSec}–${c.endSec}s] · x ${c.xPct}% · y ${c.yPct}% · fontSize ${c.fontSizePx} · font "${c.font}" · color ${c.color}` +
            `${c.hasStroke ? ` · contour ${c.strokeWidthPx}px` : " · sans contour"} · background ${c.background}${c.animation && c.animation !== "none" ? ` · animation "${c.animation}"` : ""}${c.glow && c.glow !== "none" ? ` · NÉON glow ${c.glow} (→ caption.glow)` : ""}`,
          ).join("\n"),
        );
      } else {
        parts.push("CAPTIONS DU MODÈLE : aucun texte incrusté détecté.");
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
            return `  [${s.startSec}–${s.endSec}s] mouvement ${mo}${inten} · ${sp} · ${fz} · ${subj} · ${cp}${lum}${sat}${oe}${ox}${fi}${fo}${tr}${sk}${bl}\n      « ${s.content} »`;
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
      `Durée : ${a.durationSec.toFixed(1)}s · ${a.width}×${a.height} · ${a.fps} fps · audio: ${a.hasAudio ? "oui" : "non"}`,
      `Rythme : ${a.pacing.cutCount} coupe(s)${a.pacing.avgCutSec ? ` · ~${a.pacing.avgCutSec}s/plan` : ""}`,
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
      const files = await fs.readdir(projectPaths(userId, project.id).materialDir).catch(() => [] as string[]);
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
        content.push({ type: "text", text: `    ↳ get_material("${m.id}") pour voir les images de ce rush.` });
      }
      if (meta?.thumb) {
        const img = dataUriToImage(meta.thumb);
        if (img) content.push(img);
      }
    }
    return { content };
  }

  if (name === "create_variant") {
    if (!project.reference) return { content: [{ type: "text", text: "Ajoute d'abord une référence." }], isError: true };
    if (!project.materials.length) return { content: [{ type: "text", text: "Aucune matière : le user doit ajouter des fichiers dans DuupFlow." }], isError: true };
    const blocked = await guardVariantQuota(userId);
    if (blocked) return { content: [blocked], isError: true };
    const res = await renderVariant(userId, project.id, (args ?? {}) as unknown as EditPlan);
    if ("error" in res) return { content: [{ type: "text", text: `Rendu impossible : ${res.error}` }], isError: true };
    await incrementUsage(userId, "videos", 1).catch(() => {}); // rendu réussi → compté
    const v = res.variant;
    const content: Content[] = [{
      type: "text",
      text: `✅ Variante créée${v.label ? ` « ${v.label} »` : ""} (id ${v.id}) · durée ${res.durationSec}s. Voici des images du RENDU — vérifie cadrage, rythme, position des captions ; rappelle create_variant pour corriger si besoin.`,
    }];
    for (const kf of res.keyframes) {
      const img = dataUriToImage(kf.dataUri);
      if (img) content.push({ type: "text", text: `— rendu à ${kf.t}s —` }, img);
    }
    if (!res.keyframes.length) {
      // Échec NON silencieux : le rendu a réussi mais l'extraction n'a rien donné.
      if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push({ type: "text", text: "Aperçu (poster) :" }, img); }
      content.push({ type: "text", text: "⚠ Impossible d'extraire les images du rendu (voir logs serveur). La variante est bien enregistrée — réessaie get_variant, ou régénère." });
    }
    return { content };
  }

  if (name === "list_variants") {
    if (!project.variants.length) return { content: [{ type: "text", text: "Aucune variante générée pour l'instant." }] };
    // La plus RÉCENTE en premier (variants est déjà unshift-é à la création).
    const content: Content[] = [{ type: "text", text: `VARIANTES — ${project.variants.length} (de la + récente à la + ancienne ; get_variant pour + de détail) :` }];
    for (const v of project.variants) {
      const dur = v.durationSec ? ` · ${v.durationSec}s` : "";
      const dt = v.createdAt ? ` · ${new Date(v.createdAt).toISOString().replace("T", " ").slice(0, 16)}` : "";
      const from = v.derivedFrom ? ` · dérivée de ${v.derivedFrom}` : "";
      content.push({ type: "text", text: `• id: ${v.id}${v.label ? `  ·  ${v.label}` : ""}${dur}${dt}${from}` });
      if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push(img); }
    }
    return { content };
  }

  if (name === "get_variant") {
    const id = String(args?.variantId || "");
    const v = project.variants.find((x) => x.id === id);
    if (!v) return { content: [{ type: "text", text: `Variante introuvable : ${id}. Vois list_variants pour les id.` }], isError: true };
    const kfs = await variantKeyframes(userId, project.id, v.storedName, 5);
    if (!kfs.length) {
      // Échec explicite (plus de « 0 images » muet) : fichier ancien/absent → régénérer.
      const content: Content[] = [{
        type: "text",
        text: `⚠ Aucune image extractible pour la variante « ${v.label || v.id} » (id ${v.id}). Le fichier est probablement ancien ou absent — RÉGÉNÈRE-la avec create_variant, puis rappelle get_variant sur la NOUVELLE variante.`,
      }];
      if (v.poster) { const img = dataUriToImage(v.poster); if (img) content.push({ type: "text", text: "Poster (peut être daté) :" }, img); }
      return { content, isError: true };
    }
    const content: Content[] = [{ type: "text", text: `VARIANTE « ${v.label || v.id} » (id ${v.id}) — ${kfs.length} image(s) du rendu :` }];
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
    if (m.kind === "image") {
      const content: Content[] = [{ type: "text", text: `IMAGE « ${m.name} » (id ${m.id})${m.desc?.trim() ? ` — « ${m.desc.trim()} »` : ""} :` }];
      const img = m.analysis?.thumb ? dataUriToImage(m.analysis.thumb) : null;
      if (img) content.push(img); else content.push({ type: "text", text: "(pas d'aperçu)" });
      return { content };
    }
    if (m.kind === "audio") {
      const a = m.analysis?.audio;
      const content: Content[] = [{ type: "text", text: `AUDIO « ${m.name} » (id ${m.id}) — mets-le dans create_variant.audio.materialId ; les timecodes ci-dessous se passent DIRECTEMENT dans captions[].startSec et segments[].transition.` }];
      if (a) for (const l of formatAudioLines(a)) content.push({ type: "text", text: l });
      else content.push({ type: "text", text: "(analyse audio indisponible)" });
      if (m.analysis?.transcript?.fullText) content.push({ type: "text", text: `  · voix : « ${m.analysis.transcript.fullText.slice(0, 300)} »` });
      return { content };
    }
    const kfs = await materialKeyframes(userId, project.id, m.storedName, 5);
    if (!kfs.length) return { content: [{ type: "text", text: `⚠ Aucune image extractible du rush « ${m.name} » (id ${m.id}).` }], isError: true };
    const content: Content[] = [{ type: "text", text: `RUSH « ${m.name} » (id ${m.id})${m.analysis?.durationSec ? ` · ${m.analysis.durationSec.toFixed(1)}s` : ""} — ${kfs.length} images (timecodes pour tes coupes) :` }];
    // Son du rush (si présent) : mêmes timecodes exploitables que pour l'audio.
    if (m.analysis?.audio) for (const l of formatAudioLines(m.analysis.audio)) content.push({ type: "text", text: l });
    if (m.analysis?.transcript?.fullText) content.push({ type: "text", text: `  · voix : « ${m.analysis.transcript.fullText.slice(0, 300)} »` });
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
    const merged = { ...v.plan, ...patch } as unknown as EditPlan;
    // Label : celui du patch, sinon auto-suffixe (v2, v3…) pour distinguer les itérations.
    const patchLabel = typeof patch.label === "string" && patch.label.trim() ? patch.label.trim() : "";
    if (!patchLabel) {
      const base = String((v.plan as { label?: string }).label ?? v.label ?? "variante").replace(/\s*\(v\d+\)\s*$/, "");
      const n = project.variants.filter((x) => String(x.label ?? "").replace(/\s*\(v\d+\)\s*$/, "") === base).length + 1;
      merged.label = `${base} (v${n})`;
    }
    const blocked = await guardVariantQuota(userId);
    if (blocked) return { content: [blocked], isError: true };
    const res = await renderVariant(userId, project.id, merged, { derivedFrom: v.id });
    if ("error" in res) return { content: [{ type: "text", text: `Mise à jour impossible : ${res.error}` }], isError: true };
    await incrementUsage(userId, "videos", 1).catch(() => {}); // rendu réussi → compté
    const nv = res.variant;
    const content: Content[] = [{ type: "text", text: `✅ Mise à jour → NOUVELLE variante « ${nv.label || nv.id} » (id ${nv.id}) · durée ${res.durationSec}s. Images du rendu :` }];
    for (const kf of res.keyframes) { const img = dataUriToImage(kf.dataUri); if (img) content.push({ type: "text", text: `— ${kf.t}s —` }, img); }
    if (!res.keyframes.length) content.push({ type: "text", text: "⚠ Images non extraites (voir logs serveur)." });
    return { content };
  }

  return { content: [{ type: "text", text: `Outil inconnu : ${name}` }], isError: true };
}
