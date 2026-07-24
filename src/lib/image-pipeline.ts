// Image duplication pipeline — shared by the dashboard SSE route
// (/api/duplicate-image-sse) and the public API (/api/v1/images/duplicate).
// Extracted verbatim from the SSE route so both paths produce identical copies.
import sharp from "sharp";
import crypto from "crypto";
import { pickLocation } from "@/lib/locations";
import { pickAppleShotProfile, toRational } from "@/lib/metadata/apple-devices";

export const randHex = (n = 2) => crypto.randomBytes(n).toString("hex");
const clampDim = (n: number) => Math.max(32, Math.min(16000, Math.round(n)));

export type Flags = { semi: boolean; fundamentals: boolean; visuals: boolean; reverse: boolean };

export async function processImage(
  buffer: Buffer,
  ext: string,
  flags: Flags,
  opts?: { country?: string; iphoneMeta?: boolean },
): Promise<{ data: Buffer; outExt: string }> {
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  let img = sharp(buffer, { failOn: "none" });

  if (flags.reverse) {
    img = img.flop();
  }

  // Preserve original resolution — no downscale cap.
  // 4K stays 4K, 1080p stays 1080p. Only clamp to Sharp's safety limit (16000px).
  const rawW = meta.width  ?? 1024;
  const rawH = meta.height ?? 1024;
  const baseW = clampDim(rawW);
  const baseH = clampDim(rawH);

  if (flags.semi) {
    const bigPct  = 0.03 + Math.random() * 0.04;  // 3–7%
    const smallPct = Math.random() * 0.01;           // 0–1%
    const dim = Math.min(baseW, baseH);
    const L = Math.floor(dim * bigPct);
    const T = Math.floor(dim * bigPct);
    const R = Math.floor(dim * smallPct);
    const B = Math.floor(dim * smallPct);
    const rawCropW = clampDim(baseW - (L + R));
    const rawCropH = clampDim(baseH - (T + B));
    const safeLeft   = Math.max(0, Math.min(L, baseW - 16));
    const safeTop    = Math.max(0, Math.min(T, baseH - 16));
    const safeWidth  = Math.max(16, Math.min(rawCropW, baseW - safeLeft));
    const safeHeight = Math.max(16, Math.min(rawCropH, baseH - safeTop));

    img = img
      .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
      .resize(baseW, baseH, { fit: "fill", kernel: sharp.kernel.lanczos3 });

    // Légère netteté aléatoire — fait chuter les gradients et le SSIM
    const sigma  = 0.4 + Math.random() * 0.6;   // 0.4–1.0
    const flat   = 0.5 + Math.random() * 1.0;   // 0.5–1.5
    const jagged = 0.3 + Math.random() * 0.7;   // 0.3–1.0
    img = img.sharpen(sigma, flat, jagged);
  }

  if (flags.visuals) {
    // ── Brightness ±3%
    const bDir = Math.random() < 0.5 ? -1 : 1;
    const brightness = 1.0 + bDir * (0.01 + Math.random() * 0.02);
    // ── Saturation ±5%
    const sDir = Math.random() < 0.5 ? -1 : 1;
    const saturation = 1.0 + sDir * (0.02 + Math.random() * 0.03);
    // ── Hue ±3°
    const hue = (Math.random() < 0.5 ? -1 : 1) * Math.floor(1 + Math.random() * 3);
    img = img.modulate({ brightness, saturation, hue });

    // ── Gamma ±3% (1.00–1.03)
    const gamma = 1.00 + Math.random() * 0.03;
    img = img.gamma(gamma);

    // ── Unsharp très doux
    img = img.sharpen(0.5, 0.5, 0.5);
  }

  const lower = ext.toLowerCase();
  const now = new Date();
  // Valeurs de `Software` plausibles : ce qu'un vrai fichier porte après passage
  // par un téléphone ou un éditeur courant.
  // ⚠️ Ne JAMAIS y remettre le nom du produit ("DuupFlow", "Duplicator", …) :
  // c'est une signature qui regroupe tous les fichiers sortis d'ici, et le mot
  // annonce la duplication. Idem pour Artist/Copyright, absents des photos
  // d'appareil normales — on ne les écrit plus du tout.
  const softwareChoices = [
    "Photos 1.0", "Adobe Photoshop 25.9 (Macintosh)", "Lightroom mobile 9.4.0",
    "Snapseed 2.21", "GIMP 2.10.36", "Picasa", "Google Photos 6.8",
  ];
  const software = softwareChoices[Math.floor(Math.random() * softwareChoices.length)];

  const dpiPool = flags.fundamentals ? [60, 72, 96, 120, 150, 180, 240, 300, 600] : [72];
  const dpi = dpiPool[Math.floor(Math.random() * dpiPool.length)];

  const exifLevel = flags.fundamentals ? (Math.random() < 0.5 ? 1 : 2) : 1;

  let exifMeta: sharp.WriteableMetadata;

  if (opts?.iphoneMeta) {
    // ── EXIF iPhone réaliste ────────────────────────────────────────────
    // UN appareil, UN objectif : le profil garantit que Model, HostComputer,
    // LensModel, focale et ouverture décrivent le même téléphone (cf.
    // lib/metadata/apple-devices). Ne jamais retirer au sort séparément.
    const shot = pickAppleShotProfile();
    const daysAgo = Math.floor(Math.random() * 30);
    const d = new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000));
    const pad = (n: number) => String(n).padStart(2, "0");
    const dtStr = `${d.getFullYear()}:${pad(d.getMonth()+1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const subsec = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    const tzH = Math.floor(Math.random() * 12) + 1;
    const offsetTime = `+${pad(tzH)}:00`;
    const iso = Math.floor(Math.random() * 4) * 200 + 50;   // 50, 250, 450, 650
    const exposure = `1/${100 + Math.floor(Math.random() * 9900)}`;
    const shutterSpeed = (6 + Math.random() * 8).toFixed(4);

    // Resolve GPS from a real city in the chosen country (or fall back to
    // France if user picked nothing). Coords are signed: positive = N/E,
    // negative = S/W — must match the GPS*Ref tags below.
    const loc = pickLocation(opts?.country) ?? pickLocation("FR")!;
    const latAbs = Math.abs(loc.lat).toFixed(6);
    const lonAbs = Math.abs(loc.lon).toFixed(6);
    const altStr = Math.abs(loc.alt).toFixed(1);
    const altRef = loc.alt >= 0 ? "0" : "1"; // 0 = above sea level, 1 = below

    // IFD0 = identité de l'image. SEULS les tags qui vivent réellement ici.
    // Y écrire des tags de l'IFD Exif (LensMake, OffsetTime, ColorSpace…) était
    // LE bug : un lecteur ne sait pas les nommer hors de leur IFD et les affiche
    // en numérique brut (42035, 36880…) EN PLUS des noms → doublons "Apple" et
    // "tags dans tous les sens".
    const ifd0: Record<string, string> = {
      Make: shot.make,
      Model: shot.model,
      Software: shot.software,
      HostComputer: shot.hostComputer, // un vrai iPhone le renseigne = Model
      DateTime: dtStr,
      Orientation: "1",
    };

    // IFD2 = Exif IFD, la place normale de tout ce qui suit.
    // Jeu volontairement resserré : ce qu'une vraie photo iPhone porte, rien de plus.
    const exifIfd: Record<string, string> = {
      DateTimeOriginal: dtStr,
      DateTimeDigitized: dtStr,
      OffsetTime: offsetTime,
      OffsetTimeOriginal: offsetTime,
      OffsetTimeDigitized: offsetTime,
      SubSecTimeOriginal: subsec,
      SubSecTimeDigitized: subsec,
      ExposureTime: exposure,
      FNumber: String(shot.aperture),
      ApertureValue: String(shot.aperture),
      ShutterSpeedValue: shutterSpeed,
      ExposureBiasValue: "0",
      ExposureProgram: "2", // Normal program
      ISOSpeedRatings: String(iso),
      MeteringMode: "5",    // Pattern
      Flash: "16",          // Off, did not fire
      WhiteBalance: "0",    // Auto
      SceneCaptureType: "0",// Standard
      FocalLength: String(shot.focal),
      FocalLengthIn35mmFilm: String(shot.focalEq),
      LensMake: shot.lensMake,
      LensModel: shot.lensModel,
      // LensSpecification volontairement OMIS : libvips ne sait pas encoder ce
      // tableau de 4 rationnels et laisse un tag VIDE — plus suspect qu'absent.
      ColorSpace: "65535",  // Uncalibrated (Display P3)
    };

    // IFD3 = GPS. Le noyau que porte toute photo géolocalisée, plus le cap et
    // la précision (présents sur iPhone). Pas de champs exotiques en plus.
    const gps: Record<string, string> = {
      GPSLatitudeRef: loc.latRef,
      GPSLatitude: latAbs,
      GPSLongitudeRef: loc.lonRef,
      GPSLongitude: lonAbs,
      GPSAltitudeRef: altRef,
      GPSAltitude: altStr,
      GPSImgDirectionRef: "T",
      // Rational simple : celui-ci s'encode correctement (vérifié).
      GPSImgDirection: toRational(Math.random() * 360),
      // GPSHPositioningError omis : même problème d'encodage vide que
      // LensSpecification, et c'est justement un champ exotique en trop.
    };

    // Nom de lieu géocodé — un vrai iPhone le met en IPTC ; sharp ne sait pas
    // écrire l'IPTC, ImageDescription (IFD0) est le plus proche équivalent.
    ifd0.ImageDescription = `${loc.city}, ${loc.country}`;

    exifMeta = { density: dpi, exif: { IFD0: ifd0, IFD2: exifIfd, IFD3: gps } as any };
  } else {
    // ── Standard random metadata ──────────────────────────────────────
    const ifd0: Record<string, string> = {
      Software: software,
    };

    // Marque et modèle restent APPARIÉS par l'index — un Galaxy ne doit jamais
    // se retrouver avec Make "Apple" (même exigence de cohérence que le mode iPhone).
    const makes  = ["Apple", "Samsung", "Google", "Xiaomi", "Sony", "OnePlus", "Huawei", "OPPO"];
    const models = ["iPhone 15 Pro", "Galaxy S24 Ultra", "Pixel 9", "Redmi 14", "Xperia 5 V", "Nord 4", "P60 Pro", "Find X7"];
    const idx = Math.floor(Math.random() * makes.length);
    const hh = String(Math.floor(Math.random() * 24)).padStart(2, "0");
    const mm = String(Math.floor(Math.random() * 60)).padStart(2, "0");
    const ss = String(Math.floor(Math.random() * 60)).padStart(2, "0");
    const mo = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
    const dd = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
    const yr = now.getFullYear() - Math.floor(Math.random() * 3);
    Object.assign(ifd0, {
      Make:             makes[idx],
      Model:            models[idx],
      DateTime:         `${yr}:${mo}:${dd} ${hh}:${mm}:${ss}`,
    });

    // Niveau 2 : on fait varier davantage l'empreinte, mais SANS gonfler le
    // fichier de champs bizarres. Une photo réelle n'a pas 120 blocs de hash
    // dans sa description — c'est le genre de trace qui saute aux yeux.
    // On reste donc sur des tags standards, avec des valeurs aléatoires.
    // Niveau 2 : on élargit la variation par des champs STANDARDS (orientation,
    // horodatage secondaire), pas en empilant des champs exotiques.
    if (exifLevel >= 2) {
      ifd0.Orientation = "1";
      ifd0.YCbCrPositioning = String(1 + Math.floor(Math.random() * 2));
    }

    exifMeta = { density: dpi, exif: { IFD0: ifd0 } };
  }

  const chroma: "4:4:4" = "4:4:4";
  const progressive = flags.fundamentals ? Math.random() < 0.5 : false;
  const quality = flags.fundamentals ? (88 + Math.floor(Math.random() * 4)) : 90;

  if (lower === ".webp") {
    return {
      data: await img.withMetadata(exifMeta).webp({ quality, smartSubsample: false }).toBuffer(),
      outExt: ".webp",
    };
  }

  if (lower === ".png") {
    img = img.flatten({ background: { r: 255, g: 255, b: 255 } });
  }

  return {
    data: await img.withMetadata(exifMeta).jpeg({
      quality,
      progressive,
      chromaSubsampling: chroma as "4:2:0" | "4:4:4",
    }).toBuffer(),
    outExt: ".jpeg",
  };
}
