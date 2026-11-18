// src/lib/ai-dup/billing.ts
//
// ── FACTURATION CLAUDE DE LA DUPLICATION IA ──────────────────────────────────
// Même modèle que le Claude intégré de l'Éditeur IA (ai-editor/builtin-chat.ts),
// et MÊME ENVELOPPE (décision Sten, 2026-11-16) :
//   • chaque mois, un volume de tokens OFFERT selon le plan, partagé entre
//     l'Éditeur IA et la Duplication IA ;
//   • une fois épuisé, débit sur le solde de tokens du compte (rechargeable
//     dans « Plan & token ») ;
//   • coût réel des appels Claude × marge (AI_EDITOR_CHAT_MARKUP), payé par le
//     PROPRIÉTAIRE du compte (un VA consomme l'enveloppe de son propriétaire).
// La fabrication elle-même (rendu + spoofer) reste comptée en vidéos du quota,
// comme un rendu de l'Éditeur IA.

import { addUsage, emptyUsage, turnBiller, usageCents, allowanceFor, type Allowance } from "@/lib/ai-editor/builtin-chat";
import { AI_DUP_MODEL } from "./config";
import type { UsageSink } from "./types";

export { allowanceFor, type Allowance };

export function aiDupBilling(ownerId: string, plan: string | null, meta: Record<string, unknown>) {
  const biller = turnBiller(ownerId, plan, meta, { reason: "ai_dup", model: AI_DUP_MODEL });
  // Les copies se vérifient en parallèle : les débits passent un par un pour
  // que deux appels ne lisent pas le même reste d'enveloppe.
  let queue: Promise<void> = Promise.resolve();
  // Arrondi au centime UNE SEULE FOIS, sur le cumul du lancement : un contrôle
  // visuel coûte ~0,5 c ; arrondi appel par appel, 50 contrôles auraient été
  // facturés 50 c au lieu de 25 (mesuré le 16/11).
  const total = emptyUsage();
  // Consommation pas encore portée au journal (appels sous le centime) :
  // jointe au prochain débit pour que le détail reste complet.
  let pending = emptyUsage();
  let totalCents = 0;
  const onUsage: UsageSink = (model, usage) => {
    addUsage(total, model, usage);
    addUsage(pending, model, usage);
    const due = usageCents(total) - totalCents;
    if (due <= 0) return;
    totalCents += due;
    const u = pending;
    pending = emptyUsage();
    queue = queue.then(() => biller.charge(due, u)).catch((e) => console.error("[ai-dup/billing] débit échoué :", e));
  };
  return {
    onUsage,
    /** Reste-t-il de quoi payer un appel Claude (offert ou solde) ? */
    async canSpend(): Promise<boolean> { await queue; return (await biller.allowance()).canSend; },
    /** Fin du lancement : écrit la part offerte restée en attente. */
    async flush(): Promise<void> { await queue; await biller.flush(); },
    totalCents: () => totalCents,
  };
}
