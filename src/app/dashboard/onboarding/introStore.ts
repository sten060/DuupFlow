/**
 * Petit store partagé : « une fenêtre d'intro est ouverte ».
 *
 * Trois guides visent les mêmes pages (parcours guidé, coach de module, intro
 * de module). Empilés, ils donnent la fenêtre fantôme déjà vue une fois. Ce
 * drapeau laisse l'intro passer devant : elle explique le module AVANT qu'on
 * montre quoi que ce soit dedans.
 */

let ouverte = false;
const abonnes = new Set<() => void>();

export function setIntroOuverte(v: boolean) {
  if (v === ouverte) return;
  ouverte = v;
  for (const f of abonnes) f();
}

export function subscribeIntro(f: () => void) {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

export function introSnapshot() {
  return ouverte;
}
