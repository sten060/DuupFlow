/**
 * PLAN GRATUIT — « on visite, on ne produit rien ».
 *
 * Un compte gratuit (inscription via le bouton « Commencer » de la landing)
 * a accès à TOUTE l'app : il se promène, ouvre chaque module, dépose ses
 * fichiers, règle ses options… comme un vrai abonné. Mais au moment de
 * produire (dupliquer, générer, compresser, faire une variante…), le module
 * s'arrête et explique qu'il faut un plan, avec un bouton vers les plans.
 *
 * Deux verrous, toujours les deux :
 *   1. côté client — `usePlanGate().guard(module)` au clic sur le bouton
 *      d'action : affiche la fenêtre « Ce module nécessite un plan ».
 *   2. côté serveur — `requirePaidPlan()` (src/lib/plan-gate.ts) dans chaque
 *      route qui produit : répond 402 { code: "plan_required", module }.
 *      Le client intercepte ce 402 et affiche la même fenêtre : même un bouton
 *      oublié côté client ne produit jamais rien.
 *
 * Fichier isomorphe (aucun import serveur) : utilisable partout.
 */

import { isPaidPlan } from "@/lib/plans";

export const PLAN_REQUIRED_CODE = "plan_required";

/** Modules verrouillés — la clé choisit le texte de la fenêtre. */
export type LockedModule =
  | "video_duplication"
  | "image_duplication"
  | "ai_auto"
  | "ai_editor"
  | "ai_detection"
  | "compress"
  | "enhance"
  | "generate"
  | "import"
  | "similarity"
  | "manual_editor"
  | "api"
  | "drive"
  | "generic";

export const LOCKED_MODULES: readonly LockedModule[] = [
  "video_duplication",
  "image_duplication",
  "ai_auto",
  "ai_editor",
  "ai_detection",
  "compress",
  "enhance",
  "generate",
  "import",
  "similarity",
  "manual_editor",
  "api",
  "drive",
  "generic",
];

export function isLockedModule(v: unknown): v is LockedModule {
  return typeof v === "string" && (LOCKED_MODULES as readonly string[]).includes(v);
}

/** Plan EFFECTIF (invité / impayé déjà résolus) → est-ce le plan gratuit ? */
export function isFreePlan(plan: string | null | undefined): boolean {
  return !isPaidPlan(plan);
}

/** Corps JSON standard d'un refus « plan requis ». */
export function planRequiredBody(module: LockedModule, locale: "fr" | "en" = "fr") {
  return {
    error:
      locale === "en"
        ? "This module requires a plan. Choose a plan to unlock it."
        : "Ce module nécessite un plan. Choisis un plan pour le débloquer.",
    code: PLAN_REQUIRED_CODE,
    module,
  };
}
