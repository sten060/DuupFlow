// FirstPromoter (programme d'affiliation) — helper côté client.
//
// Quand un visiteur arrive via un lien de parrainage (?ref=...), le script
// FirstPromoter chargé dans le layout racine pose un cookie `_fprom_tid`.
// Ce `tid` identifie la visite et doit être transmis à Stripe Checkout (dans
// `metadata.fp_tid`) pour attribuer la vente à l'affilié.
//
// Ce helper récupère ce `tid` de façon robuste : on lit d'abord l'objet
// `window.FPROM` exposé par le script, avec repli sur le cookie `_fprom_tid`
// (au cas où le script ne serait pas encore prêt).

type FpromWindow = Window & {
  FPROM?: { data?: { tid?: string } };
};

/**
 * Retourne le `tid` FirstPromoter à transmettre à Stripe, ou `undefined`
 * si le visiteur n'est pas venu via un lien de parrainage.
 * À appeler uniquement côté client (dans un handler de clic, par ex.).
 */
export function getFpTid(): string | undefined {
  if (typeof window === "undefined") return undefined;

  // 1) Objet exposé par le script FirstPromoter (méthode officielle).
  const fromScript = (window as FpromWindow).FPROM?.data?.tid;
  if (fromScript) return fromScript;

  // 2) Repli : lecture directe du cookie `_fprom_tid`.
  const match = document.cookie.match(/(?:^|;\s*)_fprom_tid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}
