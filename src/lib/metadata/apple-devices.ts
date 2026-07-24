// Référentiel d'appareils Apple — SOURCE DE VÉRITÉ unique, partagée par la
// duplication image et vidéo.
//
// Règle d'or : un fichier = UN appareil. Tout ce qui est écrit (Make, Model,
// Software, HostComputer, LensMake, LensModel, focale, ouverture) doit décrire
// LE MÊME téléphone et LE MÊME objectif.
//
// Le bug historique : l'appareil et l'objectif étaient tirés au sort dans deux
// listes séparées → un fichier annonçait "iPhone 15 Pro Max" en Model et
// "iPhone 16 Pro back triple camera" en LensModel. Incohérence immédiatement
// visible par n'importe quel lecteur EXIF. Ici, les objectifs appartiennent à
// l'appareil : impossible de les désaccorder.

export interface AppleLens {
  /** Libellé Apple de l'optique, ex. "back triple camera" / "front TrueDepth camera". */
  kind: string;
  /** Focale réelle en mm (ex. 2.69). */
  focal: number;
  /** Équivalent 35 mm (ex. 30). */
  focalEq: number;
  /** Ouverture (ex. 1.9). */
  aperture: number;
}

export interface AppleDevice {
  make: "Apple";
  /** Nom exact tel qu'Apple l'écrit — sert à Model ET HostComputer. */
  model: string;
  /** Version d'iOS cohérente avec l'appareil. */
  software: string;
  lenses: AppleLens[];
}

// Focales/ouvertures réelles par appareil. Un objectif n'apparaît que sur les
// appareils qui le possèdent réellement (pas de téléobjectif sur un modèle non-Pro).
export const APPLE_DEVICES: AppleDevice[] = [
  {
    make: "Apple",
    model: "iPhone 15",
    software: "18.1",
    lenses: [
      { kind: "back dual wide camera", focal: 6.86, focalEq: 26, aperture: 1.6 },
      { kind: "back dual camera", focal: 2.22, focalEq: 13, aperture: 2.4 },
      { kind: "front TrueDepth camera", focal: 2.69, focalEq: 30, aperture: 1.9 },
    ],
  },
  {
    make: "Apple",
    model: "iPhone 15 Pro",
    software: "18.2",
    lenses: [
      { kind: "back triple camera", focal: 6.765, focalEq: 24, aperture: 1.78 },
      { kind: "back triple camera", focal: 2.22, focalEq: 13, aperture: 2.2 },
      { kind: "back triple camera", focal: 9, focalEq: 77, aperture: 2.8 },
      { kind: "front TrueDepth camera", focal: 2.69, focalEq: 30, aperture: 1.9 },
    ],
  },
  {
    make: "Apple",
    model: "iPhone 15 Pro Max",
    software: "18.2.1",
    lenses: [
      { kind: "back triple camera", focal: 6.765, focalEq: 24, aperture: 1.78 },
      { kind: "back triple camera", focal: 2.22, focalEq: 13, aperture: 2.2 },
      { kind: "back triple camera", focal: 15.66, focalEq: 120, aperture: 2.8 },
      { kind: "front TrueDepth camera", focal: 2.69, focalEq: 30, aperture: 1.9 },
    ],
  },
  {
    make: "Apple",
    model: "iPhone 16",
    software: "18.3.1",
    lenses: [
      { kind: "back dual wide camera", focal: 5.96, focalEq: 26, aperture: 1.6 },
      { kind: "back dual camera", focal: 2.22, focalEq: 13, aperture: 2.2 },
      { kind: "front TrueDepth camera", focal: 2.69, focalEq: 30, aperture: 1.9 },
    ],
  },
  {
    make: "Apple",
    model: "iPhone 16 Pro",
    software: "18.3.2",
    lenses: [
      { kind: "back triple camera", focal: 6.765, focalEq: 24, aperture: 1.78 },
      { kind: "back triple camera", focal: 2.22, focalEq: 13, aperture: 2.2 },
      { kind: "back triple camera", focal: 9, focalEq: 120, aperture: 2.8 },
      { kind: "front TrueDepth camera", focal: 2.69, focalEq: 30, aperture: 1.9 },
    ],
  },
  {
    make: "Apple",
    model: "iPhone 16 Pro Max",
    software: "18.4.1",
    lenses: [
      { kind: "back triple camera", focal: 6.86, focalEq: 24, aperture: 1.78 },
      { kind: "back triple camera", focal: 2.22, focalEq: 13, aperture: 2.2 },
      { kind: "back triple camera", focal: 9, focalEq: 120, aperture: 2.8 },
      { kind: "front TrueDepth camera", focal: 2.69, focalEq: 30, aperture: 1.9 },
    ],
  },
];

/** Profil complet d'UNE prise de vue : l'appareil et l'objectif s'accordent. */
export interface AppleShotProfile {
  make: string;
  model: string;
  software: string;
  /** HostComputer — sur un vrai iPhone, identique au Model. */
  hostComputer: string;
  lensMake: string;
  /** Ex. "iPhone 15 front TrueDepth camera 2.69mm f/1.9" — format exact d'Apple. */
  lensModel: string;
  /**
   * LensSpecification (focale min, max, ouverture min, max), en fractions.
   * ⚠️ NE PAS écrire via sharp : libvips n'encode pas ce tableau de 4 rationnels
   * et produit un tag VIDE dans le fichier — signature de manipulation bien pire
   * qu'un tag absent (vérifié : format simple ET annoté "(Rational, 4)" échouent).
   * Conservé ici car la donnée est juste et exploitable par un autre encodeur.
   */
  lensSpecification: string;
  focal: number;
  focalEq: number;
  aperture: number;
}

/**
 * Tire au sort UN appareil, puis UN de SES objectifs — les deux sont donc
 * toujours cohérents. C'est le seul point d'entrée autorisé : ne jamais
 * recomposer un profil à la main depuis APPLE_DEVICES.
 */
/** Convertit un décimal en fraction EXIF ("2.69" → "269/100"). */
export function toRational(n: number, denom = 100): string {
  return `${Math.round(n * denom)}/${denom}`;
}

export function pickAppleShotProfile(rand: () => number = Math.random): AppleShotProfile {
  const device = APPLE_DEVICES[Math.floor(rand() * APPLE_DEVICES.length)];
  const lens = device.lenses[Math.floor(rand() * device.lenses.length)];

  // Apple écrit la focale sans zéro inutile : 9mm, pas 9.0mm.
  const focalStr = String(lens.focal);
  const apertureStr = String(lens.aperture);
  const focalRat = toRational(lens.focal);
  const apertureRat = toRational(lens.aperture);

  return {
    make: device.make,
    model: device.model,
    software: device.software,
    hostComputer: device.model,
    lensMake: device.make,
    lensModel: `${device.model} ${lens.kind} ${focalStr}mm f/${apertureStr}`,
    // Optique à focale fixe → focale min = max, ouverture min = max.
    // Écrit en fractions : c'est le seul format que l'encodeur EXIF accepte.
    lensSpecification: `${focalRat} ${focalRat} ${apertureRat} ${apertureRat}`,
    focal: lens.focal,
    focalEq: lens.focalEq,
    aperture: lens.aperture,
  };
}
