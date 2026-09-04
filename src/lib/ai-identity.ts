// src/lib/ai-identity.ts
//
// Identité « humaine » injectée par le module Détection IA, à la place des
// métadonnées du générateur.
//
// Source de vérité UNIQUE : le pipeline existe en double (une copie pour l'API
// dans ai-detection-pipeline.ts, une pour l'action serveur dans
// dashboard/ai-detection/actions.ts, qui ne peut pas exporter de helper). Les
// deux tables d'identité avaient donc divergé ; elles vivent maintenant ici.
//
// ── Pourquoi cette forme ────────────────────────────────────────────────────
// L'ancienne version écrivait un nom de boîtier (« Nikon Z8 ») sans AUCUNE
// donnée de prise de vue : pas d'ouverture, pas de vitesse, pas d'ISO, pas
// d'objectif. Un vrai boîtier en écrit des dizaines. Un nom d'appareil posé sur
// une fiche vide, ce n'est pas « une photo » : c'est la forme exacte d'un
// fichier nettoyé — donc un marqueur de plus, pas un de moins.
//
// On raconte donc une histoire qui tient debout : **une photo prise au boîtier,
// exportée depuis un logiciel de retouche**. Chaque profil porte son objectif,
// ses valeurs d'exposition plausibles et un logiciel qui correspond.
//
// ⚠️ Et seulement là où c'est crédible : aucun appareil photo ne produit de PNG
// ni de WebP. Sur ces formats on n'invente PAS de boîtier — on se contente
// d'effacer. Mieux vaut pas d'identité qu'une identité impossible.

export type CameraProfile = {
  make: string;
  model: string;
  lens: string;
  /** Focales réellement couvertes par cet objectif (mm). */
  focals: number[];
  /** Ouvertures plausibles pour cet objectif. */
  apertures: string[];
};

const CAMERAS: CameraProfile[] = [
  { make: "Canon",    model: "EOS R6 Mark II", lens: "RF24-105mm F4 L IS USM",     focals: [24, 35, 50, 70, 105], apertures: ["4", "4.5", "5.6", "7.1"] },
  { make: "Sony",     model: "ILCE-7M4",       lens: "FE 24-70mm F2.8 GM II",      focals: [24, 35, 50, 70],      apertures: ["2.8", "3.5", "4", "5.6"] },
  { make: "NIKON CORPORATION", model: "NIKON Z 8", lens: "NIKKOR Z 50mm f/1.8 S",  focals: [50],                  apertures: ["1.8", "2.2", "2.8", "4"] },
  { make: "FUJIFILM", model: "X-T5",           lens: "XF33mmF1.4 R LM WR",          focals: [33],                  apertures: ["1.4", "2", "2.8", "4"] },
];

/* Logiciels d'export crédibles pour une photo de boîtier. Volontairement AUCUN
   logiciel de montage vidéo (Final Cut, DaVinci) : sur une image fixe, c'était
   une incohérence à soi tout seul. */
const PHOTO_SOFTWARE = [
  "Adobe Lightroom Classic 13.2",
  "Adobe Photoshop 25.4",
  "Capture One 23",
  "Luminar Neo 1.18",
];

const NAMES = [
  "Alex Martin", "Sophie Renaud", "Jordan Lee", "Emma Dubois",
  "Lucas Bernard", "Camille Thomas", "Noah Petit", "Léa Moreau",
  "Antoine Durand", "Manon Lefebvre", "Hugo Blanc", "Chloé Simon",
];

/* Vitesses d'obturation courantes en lumière du jour, en notation EXIF. */
const SHUTTERS = ["1/60", "1/125", "1/200", "1/250", "1/400", "1/500", "1/800"];
const ISOS = ["100", "125", "200", "320", "400", "640", "800"];

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function exifDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Formats sur lesquels un boîtier photo est une histoire crédible. */
export function acceptsCameraIdentity(ext: string): boolean {
  return ext === ".jpg" || ext === ".jpeg";
}

/**
 * Construit une identité cohérente pour le format demandé.
 *
 * · JPEG → boîtier + objectif + exposition complète + logiciel d'export.
 *   Le bloc d'exposition va dans IFD2 (l'ExifIFD), là où un vrai appareil
 *   l'écrit — pas dans IFD0.
 * · PNG / WebP → aucune identité inventée : on efface, point.
 *
 * Retourne un objet directement utilisable par `sharp().withMetadata()`.
 */
export function buildHumanMeta(ext: string): { density?: number; icc?: string; exif?: Record<string, Record<string, string>> } | null {
  // Hors JPEG : on ne renvoie RIEN (null), et l'appelant n'appelle alors pas
  // withMetadata() du tout. Un objet vide ne suffirait pas : la bibliothèque
  // écrit dans ce cas un EXIF par défaut à 25,4 ppp / espace « non calibré » —
  // deux valeurs qu'aucun appareil ne produit, donc une signature de machine.
  if (!acceptsCameraIdentity(ext)) return null;

  const cam = pick(CAMERAS);
  const artist = pick(NAMES);
  const shot = new Date(Date.now() - Math.floor(Math.random() * 180) * 86400000 - Math.floor(Math.random() * 86400000));
  const date = exifDate(shot);

  return {
    // C'est `density` qui pilote XResolution/YResolution — une valeur écrite à
    // la main dans IFD0 est écrasée. 240 ppp = ce que sort Lightroom.
    density: 240,
    icc: "srgb",
    exif: {
      IFD0: {
        Make: cam.make,
        Model: cam.model,
        Software: pick(PHOTO_SOFTWARE),
        Artist: artist,
        Copyright: `© ${shot.getFullYear()} ${artist}`,
        DateTime: date,
      },
      IFD2: {
        // Le bloc de prise de vue : c'est son ABSENCE qui trahissait le fichier.
        DateTimeOriginal: date,
        DateTimeDigitized: date,
        ExposureTime: pick(SHUTTERS),
        FNumber: pick(cam.apertures),
        ISOSpeedRatings: pick(ISOS),
        FocalLength: `${pick(cam.focals)}`,
        LensModel: cam.lens,
        LensMake: cam.make,
        ExposureProgram: "3",   // priorité ouverture
        MeteringMode: "5",      // matricielle
        Flash: "16",            // n'a pas déclenché
        WhiteBalance: "0",      // automatique
        ColorSpace: "1",        // sRGB — et non « non calibré » (65535)
      },
    },
  };
}
