// src/lib/ai-editor/file-name.ts
//
// Label affiché d'une variante → nom de FICHIER de téléchargement.
// LA règle unique, partagée par le téléchargement unitaire, l'archive zip et
// l'envoi Drive : le fichier doit porter LE MÊME nom que la carte de la galerie
// (accents et espaces conservés), sinon le user ne s'y retrouve plus.
// Aucune dépendance : importable côté serveur comme côté client.

/** Tirets/apostrophes typographiques normalisés, caractères interdits d'un nom
 *  de fichier retirés, espaces effondrés. Renvoie "" si rien d'affichable. */
export function cleanFileName(label: string): string {
  return label
    .replace(/[—–]/g, "-")
    .replace(/[’]/g, "'")
    .replace(/[^\w\-.' À-ÿ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
