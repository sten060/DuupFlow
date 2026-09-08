/**
 * L'étape en cours DANS l'Éditeur IA, publiée pour le parcours guidé.
 *
 * Les panneaux d'explication ne s'enchaînent pas au bouton : chacun apparaît
 * quand le user ARRIVE vraiment à l'étape qu'il explique. Le module est donc la
 * source de vérité, et le guide se cale dessus. Sans ça, on expliquait la
 * référence à quelqu'un qui n'avait pas encore connecté son Claude.
 */

export type EtapeEditeur = "connect" | "ref" | "material" | "editor";

let etape: EtapeEditeur | null = null;
const abonnes = new Set<() => void>();

export function setEtapeEditeur(e: EtapeEditeur | null) {
  if (e === etape) return;
  etape = e;
  for (const f of abonnes) f();
}

export function subscribeEtapeEditeur(f: () => void) {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

export function etapeEditeurSnapshot() {
  return etape;
}
