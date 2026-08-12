// src/lib/ai-editor/gemini.ts
//
// Couche « COMPRÉHENSION » de la référence : un modèle qui REGARDE réellement la
// vidéo (Gemini ingère le .mp4 en natif, échantillonné à fps élevé) et renvoie un
// profil STRUCTURÉ — contenu des plans, captions (texte + style + position),
// mouvement, emojis, « pourquoi ça marche ». Tout est exprimé dans les UNITÉS que
// create_variant accepte (x/y %, fontSize px @1080, couleur hex, une des 6 polices)
// pour être passable tel quel par le monteur.
//
// Best-effort : sans GEMINI_API_KEY (ou en cas d'erreur), renvoie null → le reste
// du profil (beats, colorimétrie, keyframes, transcription) fonctionne quand même.
//
// Aucune dépendance : appels REST bruts (fetch) à l'API Files + generateContent.
// La clé est fournie par le user (jamais lue ici en clair) : process.env.GEMINI_API_KEY.

import fs from "fs/promises";
import path from "path";

import { GEMINI_DEFAULT_MODEL, GEMINI_DEFAULT_FPS } from "./analysis-config";
import { CAPTION_FONTS, fontCatalogLines, type CaptionFont } from "./font-catalog";

const API = "https://generativelanguage.googleapis.com";

export type GeminiShot = {
  startSec: number;
  endSec: number;
  content: string;                 // ce qu'on voit dans le plan
  motion: "none" | "zoomIn" | "zoomOut" | "panLeft" | "panRight" | "handheld";
  speed: number;                   // vitesse estimée (1 = normal, <1 ralenti, >1 accéléré)
  freezeAt: number | null;         // timecode (s) d'un arrêt sur image dans le plan, sinon null
  subjectX: number | null;         // % (0-100) position H du sujet principal (pour punch-in), null si aucun
  subjectY: number | null;         // % (0-100) position V du sujet
  composition: "single" | "splitH" | "splitV" | "pip" | "overlay"; // multi-média détecté (chantier 4)
  relBrightness: number;           // luminosité RELATIVE au reste du montage (0=idem, <0 plus sombre, >0 plus clair)
  relSaturation: number;           // saturation RELATIVE au reste (0=idem, -1 = N&B/désaturé, >0 plus saturé)
  overlayEnter: "none" | "slideLeft" | "slideRight" | "slideUp" | "slideDown" | "fade" | "pop"; // l'incrustation ENTRE-t-elle dans le cadre, et par où
  overlayExit: "none" | "slideLeft" | "slideRight" | "slideUp" | "slideDown" | "fade" | "pop";  // …et en SORT-elle
  fadeInFrom: "none" | "black" | "white";  // le plan APPARAÎT-il depuis un fondu (noir/blanc) ?
  fadeOutTo: "none" | "black" | "white";   // le plan se FOND-il vers le noir/blanc à la fin (séparation de séquences) ?
  transitionIn: "cut" | "fade" | "flash" | "glitch" | "whip" | "slide" | "zoom"; // comment ce plan ARRIVE (transition entrante)
  shakeOnBeat: boolean;            // secousse ponctuelle sur un temps fort dans ce plan ?
  blurX: number; blurY: number;    // % : centre d'une zone FLOUTÉE/masquée (visage/pseudo/logo), -1 si aucune
  blurW: number; blurH: number;    // % : taille de la zone floutée, 0 si aucune
  // ── Layouts composés (edits face-cam type OpusClip) ──
  pipShape: "none" | "rect" | "square" | "circle"; // FORME de l'incrustation (composition pip/overlay) — circle = speaker en BULLE ronde
  pipX: number; pipY: number;      // % : coin haut-gauche de l'incrustation, -1 si aucune
  pipW: number;                    // % : largeur de l'incrustation, 0 si aucune
  cardColor: string;               // fond/panneau de COULEUR UNIE plein cadre derrière le contenu (hex), "none" sinon
  broll: boolean;                  // CUTAWAY/B-ROLL : plan d'illustration (produit, écran, lieu) pendant que la voix off CONTINUE
};

// Une caption LUE à l'écran, déjà convertie aux unités de create_variant.captions.
export type GeminiCaption = {
  text: string;
  startSec: number;
  endSec: number;
  xPct: number;          // centre horizontal en % (0-100)
  yPct: number;          // centre vertical en % (0-100)
  fontSizePx: number;    // px à la référence 1080 de large (== create_variant.fontSize)
  color: string;         // hex
  hasStroke: boolean;    // contour présent ?
  strokeWidthPx: number; // épaisseur du contour (px @1080), 0 si aucun
  background: string;    // "none" ou hex (fond derrière le texte)
  bgRadiusPx: number;    // rayon des coins du fond (px @1080), 0 si coins droits / pas de fond
  bgPaddingPx: number;   // marge intérieure du fond autour du texte (px @1080), 0 si aucune
  font: CaptionFont;     // meilleur match dans le CATALOGUE (font-catalog.ts)
  emojis: string;        // emojis présents dans/à côté de la caption ("" si aucun)
  animation: "none" | "fade" | "pop" | "slideUp" | "typewriter" | "wordByWord" | "karaoke"; // type d'anim détecté
  glow: string;          // effet néon : couleur hex du halo, "none" si aucun
  fontWeight: number;    // graisse estimée du trait : 400 | 700 | 900
  shadow: string;        // ombre portée DOUCE (voile diffus, ≠ contour ≠ néon) : hex, "none" si aucune
  align: "left" | "center" | "right";
  // EMPHASE : une portion du MÊME bloc nettement plus grosse que le reste
  // (« to have this » petit / « SINK IN » énorme) — motif central du short-form.
  emphasisText: string;  // la portion agrandie, "" si tout le bloc est uniforme
  emphasisMul: number;   // rapport de taille emphase/reste (ex. 1.6), 1 si uniforme
  emphasisColor: string; // couleur de l'emphase si différente du reste, "none" sinon
  // ── REMPLISSAGE du texte : uni, dégradé, ou non mesurable ──
  fillType: "solid" | "gradient" | "texture"; // texture = la vidéo/une image transparaît dans les lettres
  fillColors: string;    // dégradé : "#8a95b0,#ffffff" (dans l'ordre) ; sinon ""
  fillAngle: number;     // dégradé : 0 = gauche→droite, 90 = haut→bas
  // Réserve d'HONNÊTETÉ : ce que le modèle n'a PAS pu mesurer fidèlement
  // (police hors catalogue, graisse plus lourde que tout ce qu'on a, texte trop
  // petit/flou pour lire la couleur…). "" si la mesure est fiable.
  caveat: string;
};

// Une COUPE analysée sur une bande de vignettes (±0,3s), en unités create_variant.
export type GeminiCut = {
  t: number;                       // timecode de la coupe (s)
  transition: "cut" | "fade" | "whipPan" | "slide" | "zoomPunch" | "flash" | "glitch" | "other"; // enum FERMÉ (= create_variant) ; "other" = non reproductible
  durationSec: number;             // durée estimée de la transition (s)
  intensity: number;               // 0-1
  unmatched: string;               // si "other" : ce que Gemini a vu, en texte libre (roadmap) ; sinon ""
  confidence: number;              // 0-1 : confiance dans le classement
};

export type GeminiComprehension = {
  whyItWorks: string;
  shots: GeminiShot[];
  captions: GeminiCaption[];
  cuts: GeminiCut[];               // transitions PAR COUPE (bandes de vignettes)
  emojisOverall: string;
  duckingPresent: boolean;         // la musique baisse-t-elle quand une voix parle (ducking) ?
  model: string;
};

// Vignettes-bandes autour des coupes, fournies par l'appelant (analyze.ts).
export type CutStrip = { t: number; b64: string }; // b64 = JPEG (bande de 6 vignettes)

export function geminiKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}
export function isGeminiAvailable(): boolean {
  return !!geminiKey();
}

function mimeFor(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  if (ext === ".m4v" || ext === ".mp4") return "video/mp4";
  return "video/mp4";
}

// Schéma de sortie structuré (sous-ensemble OpenAPI attendu par Gemini).
const SCHEMA = {
  type: "OBJECT",
  properties: {
    whyItWorks: { type: "STRING" },
    shots: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          startSec: { type: "NUMBER" },
          endSec: { type: "NUMBER" },
          content: { type: "STRING" },
          motion: { type: "STRING", enum: ["none", "zoomIn", "zoomOut", "panLeft", "panRight", "handheld"] },
          speed: { type: "NUMBER" },
          hasFreeze: { type: "BOOLEAN" },
          freezeAt: { type: "NUMBER" },
          subjectX: { type: "NUMBER" },
          subjectY: { type: "NUMBER" },
          composition: { type: "STRING", enum: ["single", "splitH", "splitV", "pip", "overlay"] },
          relBrightness: { type: "NUMBER" },
          relSaturation: { type: "NUMBER" },
          overlayEnter: { type: "STRING", enum: ["none", "slideLeft", "slideRight", "slideUp", "slideDown", "fade", "pop"] },
          overlayExit: { type: "STRING", enum: ["none", "slideLeft", "slideRight", "slideUp", "slideDown", "fade", "pop"] },
          fadeInFrom: { type: "STRING", enum: ["none", "black", "white"] },
          fadeOutTo: { type: "STRING", enum: ["none", "black", "white"] },
          transitionIn: { type: "STRING", enum: ["cut", "fade", "flash", "glitch", "whip", "slide", "zoom"] },
          shakeOnBeat: { type: "BOOLEAN" },
          blurX: { type: "NUMBER" },
          blurY: { type: "NUMBER" },
          blurW: { type: "NUMBER" },
          blurH: { type: "NUMBER" },
          pipShape: { type: "STRING", enum: ["none", "rect", "square", "circle"] },
          pipX: { type: "NUMBER" },
          pipY: { type: "NUMBER" },
          pipW: { type: "NUMBER" },
          cardColor: { type: "STRING" },
          broll: { type: "BOOLEAN" },
        },
        // subjectX/Y/composition/relBrightness/relSaturation/overlay*/fade*/transitionIn/shakeOnBeat/blur*/pip*/cardColor/broll en REQUIRED : sinon Gemini les omet.
        required: ["startSec", "endSec", "content", "motion", "speed", "subjectX", "subjectY", "composition", "relBrightness", "relSaturation", "overlayEnter", "overlayExit", "fadeInFrom", "fadeOutTo", "transitionIn", "shakeOnBeat", "blurX", "blurY", "blurW", "blurH", "pipShape", "pipX", "pipY", "pipW", "cardColor", "broll"],
      },
    },
    captions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          startSec: { type: "NUMBER" },
          endSec: { type: "NUMBER" },
          xPct: { type: "NUMBER" },
          yPct: { type: "NUMBER" },
          fontSizePx: { type: "NUMBER" },
          color: { type: "STRING" },
          hasStroke: { type: "BOOLEAN" },
          strokeWidthPx: { type: "NUMBER" },
          background: { type: "STRING" },
          bgRadiusPx: { type: "NUMBER" },
          bgPaddingPx: { type: "NUMBER" },
          font: { type: "STRING", enum: CAPTION_FONTS },
          emojis: { type: "STRING" },
          animation: { type: "STRING", enum: ["none", "fade", "pop", "slideUp", "typewriter", "wordByWord", "karaoke"] },
          glow: { type: "STRING" },
          fontWeight: { type: "NUMBER" },
          shadow: { type: "STRING" },
          align: { type: "STRING", enum: ["left", "center", "right"] },
          emphasisText: { type: "STRING" },
          emphasisMul: { type: "NUMBER" },
          emphasisColor: { type: "STRING" },
          fillType: { type: "STRING", enum: ["solid", "gradient", "texture"] },
          fillColors: { type: "STRING" },
          fillAngle: { type: "NUMBER" },
          caveat: { type: "STRING" },
        },
        required: ["text", "startSec", "endSec", "xPct", "yPct", "fontSizePx", "color", "font", "fontWeight", "shadow", "align", "emphasisText", "emphasisMul", "emphasisColor", "fillType", "fillColors", "fillAngle", "caveat"],
      },
    },
    cuts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          t: { type: "NUMBER" },
          transition: { type: "STRING", enum: ["cut", "fade", "whipPan", "slide", "zoomPunch", "flash", "glitch", "other"] },
          durationSec: { type: "NUMBER" },
          intensity: { type: "NUMBER" },
          unmatched: { type: "STRING" },
          confidence: { type: "NUMBER" },
        },
        required: ["t", "transition", "durationSec", "intensity", "unmatched", "confidence"],
      },
    },
    emojisOverall: { type: "STRING" },
    duckingPresent: { type: "BOOLEAN" },
  },
  required: ["whyItWorks", "shots", "captions", "duckingPresent"],
};

const FONT_LINES = fontCatalogLines();
const PROMPT = `Tu analyses une vidéo courte (Reel/TikTok) qui a PERFORMÉ, pour qu'un monteur en fabrique des variantes. Réponds UNIQUEMENT en JSON conforme au schéma.

Objectif : décrire la STRUCTURE et le STYLE, pas raconter le contenu. Sois précis et mesuré, pas bavard.

1) shots : découpe en plans. Pour chaque plan : startSec, endSec, content (1 phrase : ce qu'on voit / cadrage), motion = le mouvement DE CAMÉRA le plus proche parmi : none, zoomIn, zoomOut, panLeft, panRight, handheld (caméra à la main, tremblante) — ne devine pas un zoom sur un plan fixe. ET la VITESSE : speed = vitesse de lecture estimée du plan (1 = normal, 0.5 = ralenti/slow-mo, 2 = accéléré) ; hasFreeze = true s'il y a un ARRÊT SUR IMAGE (freeze), avec freezeAt = son timecode en s (dans le plan). ET le CADRAGE : subjectX/subjectY = OBLIGATOIRE, position en % (0-100, 50/50 = centre) du SUJET / point d'intérêt principal dans le cadre — sert au monteur pour punch-in (recadrer) sur le sujet. Donne TOUJOURS une valeur, même approximative (jamais null) : si plan large sans sujet net, mets le centre d'intérêt (souvent 50/50). ET la COMPOSITION : composition = single (un seul média plein cadre) | splitV (2 médias empilés haut/bas) | splitH (2 médias côte à côte) | pip (petite incrustation dans un coin) | overlay (élément incrusté par-dessus, ex. écran d'app, watermark). ET relBrightness = luminosité de CE plan RELATIVEMENT au reste du montage : 0 = comme le reste, négatif (jusqu'à -1) = plus SOMBRE (souvent un plan assombri pour une bascule visuelle), positif = plus clair. OBLIGATOIRE. ET si le plan contient une INCRUSTATION (pip/overlay/2e panneau) : overlayEnter = comment elle ENTRE dans le cadre, overlayExit = comment elle en SORT — valeurs : none (elle est là d'un coup / statique), slideLeft/slideRight/slideUp/slideDown = elle GLISSE (indique la direction du MOUVEMENT : slideUp = glisse vers le haut donc entre par le bas, slideDown par le haut, slideLeft vers la gauche donc entre par la droite, slideRight par la gauche), fade = fondu, pop = apparition rapide. Regarde bien : une incrustation qui monte depuis le bas = overlayEnter "slideUp". Si pas d'incrustation OU si elle apparaît sèchement : "none". ET relSaturation = saturation de CE plan RELATIVEMENT au reste : 0 = comme le reste, négatif (jusqu'à -1) = plus DÉSATURÉ, -1 = NOIR ET BLANC total (souvent sur un freeze ou un plan « souvenir »), positif = plus saturé. OBLIGATOIRE. ET les FONDUS au noir/blanc qui séparent des séquences : fadeInFrom = le plan APPARAÎT-il depuis un écran plein (none | black | white) ; fadeOutTo = le plan se FOND-il vers un écran plein à la fin (none | black | white). Un fondu au noir complet entre deux séquences = le plan d'avant a fadeOutTo "black" et le plan d'après fadeInFrom "black". Ne confonds pas avec un simple cut : réserve black/white à un vrai assombrissement/éclaircissement progressif jusqu'à l'écran plein. ET transitionIn = comment ce plan ARRIVE par rapport au précédent : cut (coupe sèche, défaut), fade (fondu enchaîné), flash (l'image passe brièvement au blanc/noir sur la coupe — fréquent sur un drop), glitch (rafale numérique : canaux R/B décalés, bruit, déchirures bref), whip (filé de caméra), slide (glissement), zoom (coupe zoomée). ET shakeOnBeat = true s'il y a une SECOUSSE ponctuelle de l'image sur un temps fort DANS ce plan (distinct d'un handheld continu). ET le MASQUAGE : si une zone est FLOUTÉE ou PIXELISÉE (visage, pseudo, logo, numéro cachés), donne blurX/blurY = centre en % (0-100) et blurW/blurH = taille en % ; si AUCUN flou de zone, blurX=blurY=-1 et blurW=blurH=0. ET les LAYOUTS COMPOSÉS : si le plan contient une incrustation (composition pip/overlay), donne sa FORME : pipShape = rect | square | circle (circle = le speaker/média réduit dans une BULLE RONDE — layout classique des edits face-cam), et sa géométrie : pipX/pipY = coin haut-gauche en % (0-100), pipW = largeur en % ; si aucune incrustation : pipShape "none", pipX=pipY=-1, pipW=0. ET cardColor = si le FOND du plan est un PANNEAU DE COULEUR UNIE (écran sombre/clair derrière une liste de texte, carte plein cadre — pas une scène filmée), sa couleur hex approximative (ex. "#0b0b12") ; sinon "none". ET broll = true si ce plan est un CUTAWAY / B-ROLL : un plan d'ILLUSTRATION (produit, écran d'app, lieu, objet, mains) inséré pendant que la VOIX du narrateur CONTINUE — le narrateur n'est pas à l'écran mais on l'entend toujours ; false si la personne qui parle est visible ou si le plan est autonome.

2) captions : CHAQUE texte incrusté à l'écran (hook, sous-titres stylés, mots-clés animés…). Pour chacune, EXPRIME les valeurs dans ces unités exactes (celles du moteur de rendu) :
   - text : le texte exact (avec ses emojis s'il y en a).
   - startSec / endSec : quand elle apparaît / disparaît.
   - xPct / yPct : position du CENTRE de la caption en % de la frame (0 = gauche/haut, 100 = droite/bas). Ex. un texte centré en bas ≈ x 50, y 85.
   - fontSizePx : hauteur de police en px RAMENÉE à une largeur de 1080 (si la frame fait 1080 de large, c'est la taille en px ; sinon convertis). Grosse caption ≈ 70-110, sous-titre ≈ 40-60.
   - color : couleur du texte en hex (#RRGGBB).
   - hasStroke : true s'il y a un contour autour des lettres ; strokeWidthPx : son épaisseur (px @1080), sinon 0.
   - background : "none" si pas de fond, sinon la couleur hex du bloc/boîte derrière le texte.
   - bgRadiusPx : s'il y a un fond, le rayon des COINS ARRONDIS du bloc en px (@1080). 0 = coins droits ; ~30-40 = look « sticker » très arrondi (fréquent sur TikTok/IG). 0 si pas de fond.
   - bgPaddingPx : s'il y a un fond, la MARGE INTÉRIEURE entre le texte et le bord du bloc en px (@1080). Un « sticker » a une marge généreuse (~30-50) ; un fond collé au texte ~10. 0 si pas de fond.
   - font : la famille la PLUS PROCHE parmi EXACTEMENT ces clés (ne donne PAS le nom réel de la fonte, indevinable — donne le meilleur match) : ${FONT_LINES}. Si aucune ne colle vraiment, prends la plus proche ET dis-le dans le champ caveat (ex. « proche de sans mais plus étroite »).
   - emojis : les emojis de cette caption ("" si aucun).
   - animation : le type d'animation d'apparition, parmi EXACTEMENT : none (statique), fade (fondu), pop (apparition avec rebond/scale), slideUp (glisse depuis le bas), typewriter (lettre par lettre), wordByWord (mot après mot qui apparaissent), karaoke (tous les mots visibles, le mot dit est surligné). Choisis le plus proche.
   - glow : si la caption a un effet NÉON / halo lumineux coloré autour du texte, donne sa couleur hex (#RRGGBB) ; sinon "none".
   - fontWeight : la GRAISSE estimée du trait : 400 (normal), 700 (gras), 900 (très gras / black). Le short-form est massivement en 700-900 — regarde l'épaisseur réelle, ne mets pas 400 par défaut.
   - shadow : ombre portée DOUCE derrière les lettres (voile diffus légèrement décalé, SANS bord net — à distinguer du contour, qui a un bord franc, et du néon) : sa couleur hex ; "none" si aucune. Beaucoup de réfs modernes n'ont AUCUN contour, seulement cette ombre douce — dans ce cas hasStroke=false ET shadow=#hex.
   - align : alignement du bloc de texte : left | center | right.
   - emphasisText / emphasisMul / emphasisColor : si une PORTION du même bloc est NETTEMENT plus grosse que le reste (ex. « to have this » petit puis « SINK IN » énorme — deux tailles dans un même bloc, motif CENTRAL du short-form actuel, cherche-le activement), donne : le texte exact de la portion agrandie, le RAPPORT de taille (hauteur emphase / hauteur du reste, ex. 1.6), et sa couleur si elle diffère du reste ("none" sinon). Bloc uniforme → emphasisText "", emphasisMul 1, emphasisColor "none".
   - fillType / fillColors / fillAngle : le REMPLISSAGE des lettres. Regarde ATTENTIVEMENT l'intérieur des glyphes, pas seulement leur teinte dominante : "solid" = couleur unie ; "gradient" = DÉGRADÉ continu sur le bloc (très courant : « métallique » gris-bleuté → blanc, doré, etc. — le début du texte est plus sombre que la fin) ; "texture" = la VIDÉO OU UNE IMAGE TRANSPARAÎT dans les lettres (texte évidé/masque). Pour un dégradé : fillColors = les couleurs hex dans l'ordre séparées par une virgule (ex. "#8a95b0,#ffffff") et fillAngle = la direction (0 = gauche→droite, 90 = haut→bas, 135 = diagonale). Sinon fillColors = "" et fillAngle = 0. NE SIMPLIFIE PAS un dégradé en couleur unie : c'est une erreur visible au rendu.
   - caveat : PHRASE COURTE d'honnêteté, ou "" si tout est fiable. Écris-la dès qu'une valeur que tu donnes est APPROXIMATIVE : la vraie police n'existe pas dans les 6 du catalogue (« proche de sans mais plus étroite et plus lourde »), la graisse réelle dépasse tout ce qui est proposé, le texte est trop petit/flou pour lire la couleur avec certitude, le remplissage est une texture non reproductible… Une valeur approximative annoncée comme sûre est PIRE qu'une valeur absente : celui qui te lit reproduira l'erreur en croyant être fidèle.
   S'il n'y a AUCUN texte incrusté, renvoie captions: [].

3) cuts : la NATURE de chaque transition, à partir des BANDES DE COUPES fournies (une bande = 6 vignettes gauche→droite couvrant ±0,3s autour d'une coupe). Rends UNE entrée par bande, avec le "t" exact donné. Pour chaque coupe :
   - transition : UNE valeur parmi EXACTEMENT cette liste (ce sont les seuls effets reproductibles) : cut (coupe sèche, l'image change d'un coup sans effet), fade (fondu enchaîné progressif entre les 2 plans), whipPan (filé de caméra flou horizontal/vertical, souvent avec un whoosh), slide (un plan pousse l'autre par glissement), zoomPunch (coupe avec un à-coup de zoom), flash (l'image passe brièvement au blanc ou noir sur la coupe), glitch (déchirures numériques, décalage de couleurs, bruit bref). Si la bande montre clairement une transition qui n'entre dans AUCUNE de ces cases, mets transition="other".
   - durationSec : durée estimée de la transition (0 pour un cut sec ; 0,1-0,4 typique sinon).
   - intensity : 0-1 (force de l'effet).
   - unmatched : SI transition="other", décris en une phrase ce que tu as vu (sinon ""). Ce champ sert à mesurer les effets à ajouter au moteur.
   - confidence : 0-1, ta confiance dans le classement (mets bas si la bande est ambiguë).
   S'il n'y a aucune bande fournie, renvoie cuts: [].

5) emojisOverall : les emojis marquants de la vidéo en général ("" si aucun).

6) duckingPresent : true si la MUSIQUE de fond BAISSE nettement quand quelqu'un PARLE (voix off / dialogue) puis remonte quand la voix s'arrête (ducking). false si la musique reste au même niveau, ou s'il n'y a pas de musique, ou pas de voix.

7) whyItWorks : 2-3 phrases — pourquoi ce format accroche (hook, rythme, promesse, structure). Actionnable.`;

async function gfetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** Liste les modèles generateContent RÉELLEMENT visibles par cette clé, ORDONNÉS
 *  (les plus susceptibles de marcher d'abord) — et LOG la liste pour diagnostic.
 *  Certaines clés récentes voient les alias nus (gemini-2.0-flash) mais les 404 à
 *  l'appel (« not available to new users ») → on préfère les noms versionnés/latest
 *  et on ESSAIE en cascade (un 404 est instantané et gratuit). */
async function listCandidateModels(key: string): Promise<string[]> {
  try {
    const r = await gfetch(`${API}/v1beta/models?key=${key}`, { method: "GET" }, 20_000);
    if (!r.ok) { console.warn("[ai-editor/gemini] ListModels KO:", r.status); return []; }
    const j = await r.json().catch(() => null) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] } | null;
    const all = (j?.models ?? [])
      .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => m.name!.replace(/^models\//, ""))
      // on écarte ce qui ne fait pas de compréhension vidéo texte utile (génération
      // d'image, robotique, TTS, embeddings, computer-use…).
      .filter((n) => /gemini/.test(n) && !/(embedding|aqa|imagen|image|tts|learnlm|robotics|computer-use)/.test(n));
    console.log(`[ai-editor/gemini] modèles dispo (${all.length}) : ${all.join(", ")}`);
    // On veut le MEILLEUR flash récent NON-lite (précision des captions) qui marche.
    const score = (n: string) => {
      const vm = n.match(/gemini-(\d+(?:\.\d+)?)/);
      let ver = vm ? parseFloat(vm[1]) : 0;
      if (!ver && /latest/.test(n)) ver = 2.9;    // alias roulant "flash-latest" = récent
      let s = ver * 100;                          // version = poids dominant (3.6 > 2.5 > 2.0)
      if (/flash/.test(n)) s += 50;               // flash > pro (coût/vitesse/vidéo)
      if (/lite/.test(n)) s -= 40;                // lite = moins précis → à éviter
      if (/latest/.test(n)) s += 8;
      if (/-\d{3}$/.test(n)) s += 4;              // versionné explicite
      if (/(preview|exp|thinking|omni)/.test(n)) s -= 60; // instable → seulement en dernier recours
      if (/^gemini-\d+(?:\.\d+)?-flash$/.test(n)) s -= 5;  // alias nu (parfois gaté) : léger malus, on tente quand même
      return s;
    };
    return all.sort((a, b) => score(b) - score(a));
  } catch { return []; }
}

/**
 * Analyse la vidéo de référence avec Gemini (couche compréhension).
 * Best-effort : renvoie null si pas de clé / échec / timeout.
 */
export async function analyzeReferenceWithGemini(videoPath: string, cutStrips: CutStrip[] = []): Promise<GeminiComprehension | null> {
  const key = geminiKey();
  if (!key) return null;
  // Défaut = ALIAS ROULANT "gemini-flash-latest" : Google RETIRE les modèles
  // versionnés (gemini-2.0-flash est mort en 2026 → chaque analyse commençait
  // par un 404). L'alias suit le flash stable du moment ; le repli en cascade
  // (listCandidateModels) couvre les clés où l'alias n'existe pas.
  const model = process.env.AI_EDITOR_GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const fps = Math.max(1, Math.min(10, Number(process.env.AI_EDITOR_GEMINI_FPS) || GEMINI_DEFAULT_FPS));

  try {
    const bytes = await fs.readFile(videoPath);
    const mime = mimeFor(videoPath);
    console.log(`[ai-editor/gemini] appel démarré · model=${model} fps=${fps} · ${(bytes.length / 1e6).toFixed(1)} Mo`);

    // 1) Démarrer un upload résumable (Files API).
    const startRes = await gfetch(`${API}/upload/v1beta/files?key=${key}`, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.length),
        "X-Goog-Upload-Header-Content-Type": mime,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { displayName: "reference" } }),
    }, 30_000);
    const uploadUrl = startRes.headers.get("x-goog-upload-url");
    if (!startRes.ok || !uploadUrl) {
      console.warn("[ai-editor/gemini] upload start KO:", startRes.status);
      return null;
    }

    // 2) Envoyer les octets + finaliser.
    const upRes = await gfetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(bytes.length),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: new Uint8Array(bytes),
    }, 120_000);
    if (!upRes.ok) { console.warn("[ai-editor/gemini] upload KO:", upRes.status); return null; }
    const upJson = await upRes.json().catch(() => null) as { file?: { name?: string; uri?: string; state?: string; mimeType?: string } } | null;
    const file = upJson?.file;
    if (!file?.name || !file?.uri) { console.warn("[ai-editor/gemini] upload sans file.uri"); return null; }

    // 3) Attendre que la vidéo soit traitée (state ACTIVE).
    let state = file.state || "PROCESSING";
    let uri = file.uri;
    let fileMime = file.mimeType || mime;
    const deadline = Date.now() + 120_000;
    while (state === "PROCESSING" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const st = await gfetch(`${API}/v1beta/${file.name}?key=${key}`, { method: "GET" }, 20_000);
      const stJson = await st.json().catch(() => null) as { state?: string; uri?: string; mimeType?: string } | null;
      if (stJson?.state) state = stJson.state;
      if (stJson?.uri) uri = stJson.uri;
      if (stJson?.mimeType) fileMime = stJson.mimeType;
    }
    if (state !== "ACTIVE") { console.warn("[ai-editor/gemini] fichier non ACTIVE:", state); return null; }

    // 4) generateContent (sortie structurée + fps élevé) — avec REPLI auto si le
    //    modèle est indisponible pour cette clé (404, ex. gemini-2.5-flash).
    // Bandes de vignettes AUTOUR des coupes (±0,3s, 6 vignettes gauche→droite). La
    // vidéo est échantillonnée à ~2 img/s → une transition de 0,2s n'apparaît sur
    // aucune image ; ces bandes la montrent. Envoyées en inline, une par coupe.
    const strips = cutStrips.slice(0, 16);
    const stripParts = strips.length
      ? [
          { text: `BANDES DE COUPES (${strips.length}) — chaque image est une bande de 6 vignettes prises sur ±0,3s AUTOUR d'une coupe (gauche→droite = avant→après la coupe). Sers-t'en pour remplir "cuts" : une entrée par coupe, avec le "t" donné.` },
          ...strips.flatMap((s) => [
            { text: `Coupe à t=${s.t}s :` },
            { inlineData: { mimeType: "image/jpeg", data: s.b64 } },
          ]),
        ]
      : [];
    const buildBody = (m: string) => ({
      contents: [{
        role: "user",
        parts: [
          { fileData: { mimeType: fileMime, fileUri: uri }, videoMetadata: { fps } },
          ...stripParts,
          { text: PROMPT },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 8192,
        // thinkingConfig n'existe QUE sur 2.5+ (l'envoyer à 2.0-flash = 400). Sur
        // 2.5 on coupe le thinking pour réserver tous les tokens au JSON.
        ...(/2\.5|thinking/.test(m) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });
    const runGen = (m: string) => gfetch(`${API}/v1beta/models/${m}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildBody(m)),
    }, 150_000);

    // Cascade : si AI_EDITOR_GEMINI_MODEL est forcé, on l'essaie d'abord ; sinon on
    // essaie les modèles réellement visibles par la clé, dans l'ordre, en sautant les
    // 404 (instantanés/gratuits) jusqu'à ce qu'un réponde.
    const candidates: string[] = [];
    if (process.env.AI_EDITOR_GEMINI_MODEL) candidates.push(model);
    candidates.push(...await listCandidateModels(key));
    if (!candidates.length) candidates.push(model);

    let usedModel = "";
    let genRes: Response | null = null;
    let lastInfo = "";
    const tried = new Set<string>();
    for (const m of candidates) {
      if (tried.has(m)) continue;
      tried.add(m);
      if (tried.size > 8) break; // garde-fou
      const r = await runGen(m);
      if (r.ok) { genRes = r; usedModel = m; break; } // premier 2xx = gagné
      // Sinon (404 indispo, 400 param, 5xx transitoire) : on passe au suivant. Les
      // 404/400 sont rejetés AVANT tout traitement vidéo → instantanés et gratuits.
      lastInfo = `${m}→${r.status}`;
      console.warn(`[ai-editor/gemini] "${m}" échoue (${r.status}) → suivant`);
    }
    if (!genRes) {
      console.warn(`[ai-editor/gemini] aucun modèle n'a répondu OK — essayés : ${[...tried].join(", ")} (dernier : ${lastInfo})`);
      return null;
    }
    const genJson = await genRes.json().catch(() => null) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    } | null;
    const raw = genJson?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const u = genJson?.usageMetadata;
    if (!raw.trim()) {
      console.warn(`[ai-editor/gemini] réponse vide · finishReason=${genJson?.candidates?.[0]?.finishReason ?? "?"} · tokens in=${u?.promptTokenCount ?? "?"} out=${u?.candidatesTokenCount ?? "?"}`);
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<GeminiComprehension>;
    // Nettoyage/normalisation dans les unités attendues.
    const clamp = (v: unknown, lo: number, hi: number, d: number) => {
      const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
    };
    const FONTS = CAPTION_FONTS;
    const MOTIONS = ["none", "zoomIn", "zoomOut", "panLeft", "panRight", "handheld"] as const;
    const ANIMS = ["none", "fade", "pop", "slideUp", "typewriter", "wordByWord", "karaoke"] as const;
    const COMPS = ["single", "splitH", "splitV", "pip", "overlay"] as const;
    const OANIM = ["none", "slideLeft", "slideRight", "slideUp", "slideDown", "fade", "pop"] as const;
    const oanim = (v: unknown): GeminiShot["overlayEnter"] => (OANIM as readonly string[]).includes(String(v)) ? (v as GeminiShot["overlayEnter"]) : "none";
    const FADETO = ["none", "black", "white"] as const;
    const fadeto = (v: unknown): GeminiShot["fadeInFrom"] => (FADETO as readonly string[]).includes(String(v)) ? (v as GeminiShot["fadeInFrom"]) : "none";
    const TRANSIN = ["cut", "fade", "flash", "glitch", "whip", "slide", "zoom"] as const;
    const transin = (v: unknown): GeminiShot["transitionIn"] => (TRANSIN as readonly string[]).includes(String(v)) ? (v as GeminiShot["transitionIn"]) : "cut";

    const shots: GeminiShot[] = Array.isArray(parsed.shots) ? parsed.shots.slice(0, 40).map((s) => {
      const sf = s as unknown as { hasFreeze?: boolean; freezeAt?: number; subjectX?: number; subjectY?: number };
      const freezeAt = sf?.hasFreeze && Number.isFinite(Number(sf.freezeAt)) ? Math.round(clamp(sf.freezeAt, 0, 100000, 0) * 100) / 100 : null;
      const subj = (v: unknown): number => Math.round(clamp(v, 0, 100, 50)); // toujours un nombre (défaut 50)
      return {
        startSec: Math.round(clamp(s?.startSec, 0, 100000, 0) * 100) / 100,
        endSec: Math.round(clamp(s?.endSec, 0, 100000, 0) * 100) / 100,
        content: String(s?.content ?? "").slice(0, 240),
        motion: (MOTIONS as readonly string[]).includes(String(s?.motion)) ? (s!.motion as GeminiShot["motion"]) : "none",
        speed: Math.round(clamp((s as { speed?: number })?.speed, 0.25, 4, 1) * 100) / 100,
        freezeAt,
        subjectX: subj(sf?.subjectX),
        subjectY: subj(sf?.subjectY),
        composition: (COMPS as readonly string[]).includes(String((s as { composition?: string })?.composition)) ? ((s as { composition?: string }).composition as GeminiShot["composition"]) : "single",
        relBrightness: Math.round(clamp((s as { relBrightness?: number })?.relBrightness, -1, 1, 0) * 100) / 100,
        relSaturation: Math.round(clamp((s as { relSaturation?: number })?.relSaturation, -1, 1, 0) * 100) / 100,
        overlayEnter: oanim((s as { overlayEnter?: string })?.overlayEnter),
        overlayExit: oanim((s as { overlayExit?: string })?.overlayExit),
        fadeInFrom: fadeto((s as { fadeInFrom?: string })?.fadeInFrom),
        fadeOutTo: fadeto((s as { fadeOutTo?: string })?.fadeOutTo),
        transitionIn: transin((s as { transitionIn?: string })?.transitionIn),
        shakeOnBeat: !!(s as { shakeOnBeat?: boolean })?.shakeOnBeat,
        blurX: Math.round(clamp((s as { blurX?: number })?.blurX, -1, 100, -1)),
        blurY: Math.round(clamp((s as { blurY?: number })?.blurY, -1, 100, -1)),
        blurW: Math.round(clamp((s as { blurW?: number })?.blurW, 0, 100, 0)),
        blurH: Math.round(clamp((s as { blurH?: number })?.blurH, 0, 100, 0)),
        pipShape: (["none", "rect", "square", "circle"] as readonly string[]).includes(String((s as { pipShape?: string })?.pipShape)) ? ((s as { pipShape?: string }).pipShape as GeminiShot["pipShape"]) : "none",
        pipX: Math.round(clamp((s as { pipX?: number })?.pipX, -1, 100, -1)),
        pipY: Math.round(clamp((s as { pipY?: number })?.pipY, -1, 100, -1)),
        pipW: Math.round(clamp((s as { pipW?: number })?.pipW, 0, 100, 0)),
        cardColor: /^#[0-9a-fA-F]{6}$/.test(String((s as { cardColor?: string })?.cardColor ?? "")) ? String((s as { cardColor?: string }).cardColor) : "none",
        broll: !!(s as { broll?: boolean })?.broll,
      };
    }) : [];

    const captions: GeminiCaption[] = Array.isArray(parsed.captions) ? parsed.captions.slice(0, 30).map((c) => ({
      text: String(c?.text ?? "").slice(0, 300),
      startSec: Math.round(clamp(c?.startSec, 0, 100000, 0) * 100) / 100,
      endSec: Math.round(clamp(c?.endSec, 0, 100000, 0) * 100) / 100,
      xPct: Math.round(clamp(c?.xPct, 0, 100, 50)),
      yPct: Math.round(clamp(c?.yPct, 0, 100, 85)),
      fontSizePx: Math.round(clamp(c?.fontSizePx, 12, 300, 64)),
      color: String(c?.color ?? "#ffffff").slice(0, 9),
      hasStroke: !!c?.hasStroke,
      strokeWidthPx: Math.round(clamp(c?.strokeWidthPx, 0, 40, 0)),
      background: String(c?.background ?? "none").slice(0, 9),
      bgRadiusPx: Math.round(clamp((c as { bgRadiusPx?: number })?.bgRadiusPx, 0, 120, 0)),
      bgPaddingPx: Math.round(clamp((c as { bgPaddingPx?: number })?.bgPaddingPx, 0, 120, 0)),
      font: (FONTS as readonly string[]).includes(String(c?.font)) ? (c!.font as GeminiCaption["font"]) : "sans",
      emojis: String(c?.emojis ?? ""),
      animation: (ANIMS as readonly string[]).includes(String((c as { animation?: string })?.animation)) ? ((c as { animation?: string }).animation as GeminiCaption["animation"]) : "none",
      glow: String((c as { glow?: string })?.glow ?? "none").slice(0, 9),
      fontWeight: ((): number => {
        const w = Math.round(clamp((c as { fontWeight?: number })?.fontWeight, 100, 900, 800));
        return w >= 850 ? 900 : w >= 550 ? 700 : 400; // snap sur les 3 graisses réelles
      })(),
      shadow: /^#[0-9a-fA-F]{6}$/.test(String((c as { shadow?: string })?.shadow ?? "")) ? String((c as { shadow?: string }).shadow) : "none",
      align: (["left", "center", "right"] as readonly string[]).includes(String((c as { align?: string })?.align)) ? (String((c as { align?: string }).align) as GeminiCaption["align"]) : "center",
      emphasisText: String((c as { emphasisText?: string })?.emphasisText ?? "").slice(0, 120),
      emphasisMul: Math.round(clamp((c as { emphasisMul?: number })?.emphasisMul, 1, 4, 1) * 100) / 100,
      emphasisColor: /^#[0-9a-fA-F]{6}$/.test(String((c as { emphasisColor?: string })?.emphasisColor ?? "")) ? String((c as { emphasisColor?: string }).emphasisColor) : "none",
      fillType: (["solid", "gradient", "texture"] as readonly string[]).includes(String((c as { fillType?: string })?.fillType)) ? (String((c as { fillType?: string }).fillType) as GeminiCaption["fillType"]) : "solid",
      fillColors: String((c as { fillColors?: string })?.fillColors ?? "").split(",").map((x) => x.trim()).filter((x) => /^#[0-9a-fA-F]{6}$/.test(x)).slice(0, 4).join(","),
      fillAngle: Math.round(clamp((c as { fillAngle?: number })?.fillAngle, 0, 360, 90) / 45) * 45,
      caveat: String((c as { caveat?: string })?.caveat ?? "").slice(0, 200),
    })) : [];

    const TRANS = ["cut", "fade", "whipPan", "slide", "zoomPunch", "flash", "glitch", "other"] as const;
    const cuts: GeminiCut[] = Array.isArray(parsed.cuts) ? parsed.cuts.slice(0, 16).map((c) => {
      const tr = (TRANS as readonly string[]).includes(String((c as { transition?: string })?.transition)) ? ((c as { transition?: string }).transition as GeminiCut["transition"]) : "cut";
      return {
        t: Math.round(clamp((c as { t?: number })?.t, 0, 100000, 0) * 100) / 100,
        transition: tr,
        durationSec: Math.round(clamp((c as { durationSec?: number })?.durationSec, 0, 5, 0) * 100) / 100,
        intensity: Math.round(clamp((c as { intensity?: number })?.intensity, 0, 1, 0.5) * 100) / 100,
        unmatched: tr === "other" ? String((c as { unmatched?: string })?.unmatched ?? "").slice(0, 200) : "",
        confidence: Math.round(clamp((c as { confidence?: number })?.confidence, 0, 1, 0.5) * 100) / 100,
      };
    }) : [];
    const nUnmatched = cuts.filter((c) => c.transition === "other").length;

    console.log(`[ai-editor/gemini] OK · model=${usedModel} · tokens in=${u?.promptTokenCount ?? "?"} out=${u?.candidatesTokenCount ?? "?"} total=${u?.totalTokenCount ?? "?"} · ${captions.length} caption(s), ${shots.length} plan(s), ${cuts.length} coupe(s)${nUnmatched ? ` (${nUnmatched} non reproductible·s → roadmap)` : ""}`);

    return {
      whyItWorks: String(parsed.whyItWorks ?? "").slice(0, 1000),
      shots,
      captions,
      cuts,
      emojisOverall: String(parsed.emojisOverall ?? ""),
      duckingPresent: !!(parsed as { duckingPresent?: boolean })?.duckingPresent,
      model: usedModel,
    };
  } catch (e) {
    console.warn("[ai-editor/gemini] analyse échouée:", (e as Error)?.message?.slice(0, 200));
    return null;
  }
}
