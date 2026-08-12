// src/lib/ai-editor/font-catalog.ts
//
// ── CATALOGUE DE POLICES (manifeste, source unique de vérité) ────────────────
// Une seule table lue par TOUT le monde : le moteur de rendu (render.ts), le
// schéma exposé à Claude (mcp-tools.ts) et la classification de la référence
// (gemini.ts). Ajouter une police = AJOUTER UNE LIGNE ICI, rien d'autre.
//
// `family` = le nom de famille RÉEL du fichier (table `name` du .ttf), c'est
// lui que fontconfig résout. `dir` = le dossier Google Fonts d'origine dans
// fonts/ ; `npm run fonts:install` copie les fichiers correspondants dans
// public/fonts/ (variable si dispo, sinon toutes les graisses statiques).
//
// `desc` sert à DEUX endroits : la description du champ `font` pour Claude, et
// le prompt de classification de la réf. Une seule formulation, pas de dérive.

export const FONT_CATALOG = {
  sans:      { family: "Inter",            dir: "Inter",            desc: "néo-grotesque neutre et moderne (défaut) — le sans-serif par défaut du short-form" },
  geometric: { family: "Poppins",          dir: "Poppins",          desc: "linéale géométrique, lettres très rondes (o parfaitement circulaires)" },
  grotesk:   { family: "Montserrat",       dir: "Montserrat",       desc: "grotesque urbaine large, un peu plus douce qu'Inter" },
  heavy:     { family: "Anton",            dir: "Anton",            desc: "TRÈS grasse et condensée, gros titres qui remplissent la largeur" },
  condensed: { family: "Bebas Neue",       dir: "Bebas_Neue",       desc: "étroite tout en capitales, style affiche/sport" },
  black:     { family: "Archivo Black",    dir: "Archivo_Black",    desc: "massive et large, extrêmement grasse mais PAS condensée" },
  rounded:   { family: "Fredoka",          dir: "Fredoka",          desc: "arrondie et amicale, style TikTok/CapCut" },
  script:    { family: "Caveat",           dir: "Caveat",           desc: "manuscrite fluide, à la main" },
  marker:    { family: "Permanent Marker", dir: "Permanent_Marker", desc: "feutre épais, tracé irrégulier d'annotation" },
  serif:     { family: "Playfair Display", dir: "Playfair_Display", desc: "à empattements élégante, forts contrastes (mode, luxe)" },
  display:   { family: "Bungee",           dir: "Bungee",           desc: "fantaisie massive à empattements carrés (ATTENTION : rend TOUJOURS en majuscules)" },
} as const;

/** Clé de police utilisable dans un plan de montage. */
export type CaptionFont = keyof typeof FONT_CATALOG;

/** Liste des clés — sert d'énumération aux schémas (MCP, Gemini). */
export const CAPTION_FONTS = Object.keys(FONT_CATALOG) as CaptionFont[];

/** Clé → nom de famille réel (ce que fontconfig résout). */
export const FONT_FAMILY: Record<CaptionFont, string> = Object.fromEntries(
  CAPTION_FONTS.map((k) => [k, FONT_CATALOG[k].family]),
) as Record<CaptionFont, string>;

/** Anciennes clés → nouvelles. Les plans déjà enregistrés (variantes du user)
 *  contiennent « impact » : sans alias, ils retomberaient silencieusement sur
 *  la police par défaut et le rendu changerait sans prévenir. */
const FONT_ALIASES: Record<string, CaptionFont> = { impact: "heavy" };

/** Résout une clé de police (avec alias) — null si inconnue. */
export function resolveFontKey(k: unknown): CaptionFont | null {
  const s = String(k ?? "");
  if (s in FONT_CATALOG) return s as CaptionFont;
  return FONT_ALIASES[s] ?? null;
}

/** Une ligne « clé (Famille) : description » par police — pour les prompts et
 *  les descriptions d'outil, générée depuis le manifeste (jamais recopiée). */
export function fontCatalogLines(): string {
  return CAPTION_FONTS.map((k) => `${k} (${FONT_CATALOG[k].family}) = ${FONT_CATALOG[k].desc}`).join(" ; ");
}
