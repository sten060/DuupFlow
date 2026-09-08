// src/lib/trial-credits.ts
//
// ══════════════════════════════════════════════════════════════════════════
// CRÉDITS D'ESSAI — 5 vidéos offertes le premier mois (Starter & Solo)
//
// Le problème qu'ils résolvent : un nouvel abonné n'ose pas « gâcher » son
// quota pour essayer. Il n'essaie donc pas, et ne devient jamais utilisateur.
// Ces crédits se dépensent AVANT le quota du plan — un essai ne coûte rien.
//
// Portée : vidéos uniquement (duplication + Éditeur IA), plans Starter et Solo,
// premier mois depuis la création du compte. Détail et raisons dans
// supabase/migrations/057_trial_credits.sql.
//
// ⚠️ La migration s'applique À LA MAIN dans Supabase. Tant qu'elle ne l'est
// pas, la colonne et les fonctions n'existent pas : TOUT ici doit alors se
// comporter comme « aucun crédit » et laisser le quota normal faire son
// travail. Aucun user ne doit être bloqué par une migration en retard.
// ══════════════════════════════════════════════════════════════════════════

import { createAdminClient } from "./supabase/admin";
import { compteNouveau } from "./launch";

/** Nombre de crédits offerts. */
export const TRIAL_CREDITS = 5;
/** Fenêtre d'éligibilité, en jours depuis la création du compte. */
export const TRIAL_WINDOW_DAYS = 30;

/** Plans qui reçoivent les crédits (plan EFFECTIF, invité et impayé résolus). */
export function planEligibleAuxCredits(plan: string | null | undefined): boolean {
  return plan === "starter" || plan === "solo";
}

/** Une absence de colonne / de fonction ne doit jamais remonter comme une erreur
 *  produit : on la reconnaît pour la traiter en « pas de crédits ». */
function migrationAbsente(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("trial_credits_used") ||
    m.includes("consume_trial_credit") ||
    m.includes("release_trial_credit") ||
    m.includes("schema cache") ||
    m.includes("does not exist")
  );
}

export type EtatCredits = {
  /** Crédits encore disponibles (0 si non éligible ou migration absente). */
  restants: number;
  /** Total offert — pour afficher « 3 / 5 ». */
  total: number;
  /** Le compte est-il dans sa fenêtre d'essai ? */
  dansLaFenetre: boolean;
};

/**
 * État des crédits d'un user, pour l'affichage. Lecture seule, best-effort :
 * en cas de souci on renvoie « aucun crédit » plutôt que de faire échouer la
 * page qui appelle.
 */
export async function etatCredits(userId: string, planEffectif: string | null): Promise<EtatCredits> {
  const vide: EtatCredits = { restants: 0, total: TRIAL_CREDITS, dansLaFenetre: false };
  if (!planEligibleAuxCredits(planEffectif)) return vide;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("created_at, trial_credits_used")
    .eq("id", userId)
    .single();

  if (error || !data) {
    if (error && !migrationAbsente(error.message)) {
      console.warn("[trial-credits] lecture impossible:", error.message);
    }
    return vide;
  }

  const createdAt = (data as { created_at: string }).created_at;
  // Deux conditions, pas une : le compte doit être RÉCENT (fenêtre d'essai) et
  // POSTÉRIEUR à la mise en service. Sans la seconde, un abonné de longue date
  // qui se réinscrit — ou tout compte créé juste avant — recevrait un cadeau de
  // bienvenue alors qu'il connaît déjà le produit.
  if (!compteNouveau(createdAt)) return vide;
  const cree = new Date(createdAt).getTime();
  const dansLaFenetre = Number.isFinite(cree) && Date.now() - cree < TRIAL_WINDOW_DAYS * 86400_000;
  if (!dansLaFenetre) return vide;

  const utilises = Number((data as { trial_credits_used?: number }).trial_credits_used ?? 0);
  return { restants: Math.max(0, TRIAL_CREDITS - utilises), total: TRIAL_CREDITS, dansLaFenetre: true };
}

/**
 * Tente de dépenser UN crédit. Renvoie true si le crédit a été pris — l'appelant
 * ne doit alors PAS toucher au quota du plan.
 *
 * L'atomicité est côté SQL (UPDATE conditionnel) : deux rendus lancés en même
 * temps ne peuvent pas dépenser deux fois le dernier crédit.
 */
export async function consommerCredit(userId: string, planEffectif: string | null): Promise<boolean> {
  if (!planEligibleAuxCredits(planEffectif)) return false;

  // Contrôle d'éligibilité complet AVANT la consommation : la fonction SQL ne
  // vérifie que la fenêtre de 30 jours, elle ignore la date de mise en service.
  // Sans ce garde-fou, un abonné antérieur au lancement dépenserait des crédits
  // que la page ne lui affiche même pas.
  const etat = await etatCredits(userId, planEffectif);
  if (etat.restants <= 0) return false;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_trial_credit", {
    p_user_id: userId,
    p_max: TRIAL_CREDITS,
    p_max_age_days: TRIAL_WINDOW_DAYS,
  });

  if (error) {
    // Migration pas encore appliquée → on retombe simplement sur le quota.
    if (!migrationAbsente(error.message)) {
      console.warn("[trial-credits] consommation impossible:", error.message);
    }
    return false;
  }
  return data !== null && data !== undefined;
}

/** Rend un crédit réservé mais non livré. Best-effort, jamais bloquant. */
export async function rendreCredit(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("release_trial_credit", { p_user_id: userId });
  if (error && !migrationAbsente(error.message)) {
    console.warn("[trial-credits] restitution impossible:", error.message);
  }
}
