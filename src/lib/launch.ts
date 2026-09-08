// src/lib/launch.ts
//
// Date de mise en service du NOUVEAU parcours d'arrivée : carte « par quoi tu
// veux commencer ? », parcours guidé, et 5 vidéos offertes le premier mois.
//
// ⚠️ Pourquoi une date de coupure, et pas seulement « compte de moins d'un
// mois » : les abonnés qui payaient DÉJÀ avant cette mise en service ont eu
// leur propre découverte du produit. Leur rejouer un onboarding est au mieux
// inutile, au pire condescendant — et leur offrir 5 vidéos, c'est offrir un
// cadeau de bienvenue à quelqu'un qui est là depuis des mois.
//
// Un seul repère pour les deux : le compte doit avoir été créé APRÈS.
export const NOUVEAU_PARCOURS_DEPUIS = "2026-09-08T00:00:00Z";

/** Ce compte relève-t-il du nouveau parcours (onboarding + crédits d'essai) ? */
export function compteNouveau(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && t >= new Date(NOUVEAU_PARCOURS_DEPUIS).getTime();
}
