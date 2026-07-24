/**
 * Token / pricing constants (pay-per-use AI variation).
 *
 * Marketing concept: 1 token = 0,40 € (= 2,5 tokens / €).
 * Storage / API exchange: integer CENTS (€0.01) — no floats, no rounding bugs.
 *
 * ── Edit pricing here ─────────────────────────────────────────────────────
 *  • To change cost per image: edit IMAGE_COST_CENTS.
 *  • To change topup pack sizes: edit TOPUP_PACKS.
 *  • To change min topup: edit MIN_TOPUP_CENTS.
 *
 * The UI (admin page, billing page, AI lab) imports and displays these
 * values — single source of truth.
 */

/**
 * 1 token = 1 centime (= 0,01 €) → **5 € = 500 tokens**.
 *
 * Le solde est stocké en CENTIMES entiers : à 1 token = 1 centime, le token
 * devient l'unité de stockage elle-même (correspondance 1:1, zéro arrondi).
 *
 * ⚠️ Changer cette constante ne change QUE l'affichage : aucun solde existant
 * ne gagne ni ne perd de valeur (10 € restent 10 €, affichés 1000 tokens au
 * lieu de 25). Ne jamais l'utiliser pour CALCULER un montant à créditer —
 * exprimer les montants directement en centimes (cf. le bonus d'onboarding,
 * qui aurait été divisé par 40 en passant de 40 à 1).
 */
export const CENTS_PER_TOKEN = 1;

/**
 * Coût EN CENTIMES d'une génération (Variation IA), par plan.
 * Stocké en centimes → s'adapte automatiquement au barème des tokens : à
 * 1 token = 1 centime, ces valeurs SONT le nombre de tokens affiché.
 * (Prix réel inchangé par le passage de 40 c à 1 c le token — seul l'affichage
 * change : 110 tokens au lieu de 2,75, pour le même 1,10 €.)
 */
export const IMAGE_COST_CENTS = {
  free: 110, // 1,10 € = 110 tokens — sans abonnement
  solo: 90,  // 0,90 € = 90 tokens
  pro:  70,  // 0,70 € = 70 tokens
} as const;

/* ── Scraper (« Importer depuis un compte ») ──────────────────────────────────
 *
 * Deux débits distincts, parce que les coûts réels sont très asymétriques
 * (mesurés sur des runs Apify réels) :
 *
 *   • LE SCAN domine. Son coût est proportionnel au NOMBRE de vidéos scrapées,
 *     donc à la FENÊTRE choisie — pas au nombre de vidéos retenues. Pour
 *     connaître les 2 meilleures sur 30 j, il faut scraper les ~60 de la période.
 *     Coût constaté : ~15 c (Instagram) à ~30 c (TikTok) pour 30 jours.
 *
 *   • LE TÉLÉCHARGEMENT est marginal côté Instagram (URL CDN directe, ~0 c) mais
 *     réel côté TikTok : chaque vidéo déclenche son propre run Apify (~0,5 c et
 *     surtout ~3 min de traitement). D'où l'écart de tarif entre les deux.
 *
 * Montants en CENTIMES — et comme 1 token = 1 centime, ces nombres SONT les
 * tokens affichés à l'utilisateur.
 */
// Tarif UNIQUE, identique pour tous les plans : une seule grille à maintenir et
// un prix que l'utilisateur peut retenir. (Contrairement à IMAGE_COST_CENTS, qui
// est dégressif par plan — le scraper ne l'est volontairement pas.)
export type ScrapePlatform = "instagram" | "tiktok";

/**
 * Prix volontairement BAS : le scraper est une commodité, pas un achat.
 * Si l'utilisateur hésite avant chaque scan, il ne s'en sert plus — donc le
 * coût doit rester un non-sujet (un usage typique ≈ 0,25 €, soit ~20 usages
 * pour 5 €). La marge se fait sur le VOLUME, pas sur le ticket.
 */

/**
 * UN SEUL PRIX, UN SEUL DÉBIT — au clic sur « Analyser ».
 *
 * L'utilisateur choisit sa fenêtre ET son nombre de vidéos AVANT de lancer le
 * scan : le total est donc connu au moment du clic. On l'affiche, on le débite
 * une fois, et le téléchargement est INCLUS — qu'il télécharge ou non.
 *
 * Pourquoi pas deux débits (scan puis téléchargement) : un scan seul ne sert à
 * rien, l'utilisateur veut ses vidéos. Faire payer la recherche puis à nouveau
 * la récupération est vécu comme un piège, même pour un total identique.
 *
 * Le téléchargement reste dans le calcul (il a un coût réel, surtout sur TikTok
 * où chaque vidéo déclenche son propre run Apify) — mais il ne se voit pas comme
 * une seconde facture.
 */

/** Part fixe, par fenêtre (jours) — couvre le scrape de la période. */
const SCRAPE_WINDOW_CENTS: Record<number, number> = {
  7: 10,
  30: 25,
  90: 40,
  365: 50,
};

/** Part variable, par vidéo demandée. */
const SCRAPE_PER_VIDEO_CENTS: Record<ScrapePlatform, number> = {
  instagram: 1,
  tiktok: 3, // un run Apify (~3 min) par vidéo, contre une URL CDN gratuite chez IG
};

/**
 * Prix TOTAL d'un scrape, tel qu'affiché avant le clic et débité une seule fois.
 * `count` = nombre de vidéos demandé par l'utilisateur (« les N meilleures »).
 */
export function scrapeCostCents(opts: {
  windowDays: number;
  count: number;
  platform: ScrapePlatform;
}): number {
  const tiers = Object.keys(SCRAPE_WINDOW_CENTS).map(Number).sort((a, b) => a - b);
  // Au-delà du plus grand palier on prend le plus grand : le scrape est de
  // toute façon plafonné à 100 vidéos, le coût Apify ne monte plus.
  const tier = tiers.find((t) => opts.windowDays <= t) ?? tiers[tiers.length - 1];
  const base = SCRAPE_WINDOW_CENTS[tier];
  return base + SCRAPE_PER_VIDEO_CENTS[opts.platform] * Math.max(0, opts.count);
}

/**
 * Bonus OFFERT UNE SEULE FOIS à chaque utilisateur : 2 € = 200 tokens (1 tk = 1 c).
 * Crédité une fois pour toutes (pas de récurrence) → aucun problème de cumul.
 * (cf. grantWelcomeBonusIfDue)
 */
export const WELCOME_BONUS_CENTS = 200;

/** Minimum topup amount in cents (prevents fee-only purchases). */
export const MIN_TOPUP_CENTS = 500; // 5 €

/**
 * Predefined topup packs.
 *  - `priceCents`: what Stripe charges the customer.
 *  - `creditCents`: what we add to their balance (≥ priceCents → bonus offered).
 * Bonus = creditCents - priceCents (in cents) → displayed as "+N tokens offerts".
 *
 * Custom amount is also allowed (no bonus, priceCents = creditCents).
 */
export type TopupPack = {
  id: string;
  priceCents: number;
  creditCents: number;
  label: string;
  highlight?: boolean;
};

export const TOPUP_PACKS: TopupPack[] = [
  // 1 token = 1 centime → creditCents EST le nombre de tokens crédités.
  // 10 € → 1000 tokens, sans bonus
  { id: "starter",  priceCents: 1000,  creditCents: 1000,  label: "Starter" },
  // 40 € payés → 4400 tokens (4000 + 400 offerts)
  { id: "standard", priceCents: 4000,  creditCents: 4400,  label: "Standard", highlight: true },
  // 100 € payés → 11200 tokens (10000 + 1200 offerts)
  { id: "power",    priceCents: 10000, creditCents: 11200, label: "Power" },
];

export function packBonusCents(pack: TopupPack): number {
  return Math.max(0, pack.creditCents - pack.priceCents);
}

// ── Display helpers ───────────────────────────────────────────────────────

export function centsToTokens(cents: number): number {
  return cents / CENTS_PER_TOKEN;
}

// 1 token = 1 centime → les tokens sont des ENTIERS. Afficher "500.00 tokens"
// n'aurait aucun sens, d'où 0 décimale par défaut.
export function formatTokens(cents: number, digits = 0): string {
  return centsToTokens(cents).toFixed(digits);
}

/** Format a cent amount as a French-style EUR string ("12,50 €"). */
export function formatEur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

/** Cost (in cents) of one image for the given plan. Falls back to Free. */
export function imageCostCents(plan: string | null | undefined): number {
  if (plan === "pro")  return IMAGE_COST_CENTS.pro;
  if (plan === "solo") return IMAGE_COST_CENTS.solo;
  return IMAGE_COST_CENTS.free;
}

/** How many images the user can afford with `cents` at the given plan tier. */
export function imagesAffordable(cents: number, plan: string | null | undefined): number {
  return Math.floor(cents / imageCostCents(plan));
}
