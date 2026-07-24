// Persistance locale du dernier scrape — pour que l'utilisateur retrouve ses
// vidéos en revenant sur le module, sans relancer (donc sans repayer) un scan.
//
// Expiration : 1 h. C'est aligné sur le serveur, qui purge ses jobs de scan
// au bout d'1 h : au-delà, le scan référencé n'existe plus et un téléchargement
// échouerait — mieux vaut repartir d'une page propre.
//
// Fichier client-only (localStorage) : aucun import Node.

import type { AccountDownloadSnapshot, AccountScanSnapshot } from "./types";

const KEY = "duup_scrape_last";
export const SCRAPE_TTL_MS = 60 * 60 * 1000; // 1 h

interface Persisted {
  savedAt: number;
  scan: AccountScanSnapshot;
  selected: string[];
  download: AccountDownloadSnapshot | null;
}

export function saveScrape(
  scan: AccountScanSnapshot,
  selected: string[],
  download: AccountDownloadSnapshot | null
): void {
  if (typeof window === "undefined") return;
  // On persiste dès que le scan est LANCÉ (scraping) ET quand il est prêt :
  //  • "scraping" → si l'utilisateur actualise/quitte, on retrouve le jobId au
  //    retour et on se raccroche au scan qui tourne toujours côté serveur.
  //  • "ready"    → on restaure vidéos + sélection + téléchargements.
  // On ignore "error" : rien à reprendre.
  if (scan.status !== "scraping" && scan.status !== "ready") return;
  try {
    const payload: Persisted = { savedAt: Date.now(), scan, selected, download };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota dépassé (gros scan) → on renonce silencieusement à la persistance */
  }
}

// Restaure le dernier scrape s'il a moins d'1 h ; purge et renvoie null sinon.
export function loadScrape(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as Persisted;
    if (!payload?.scan || Date.now() - payload.savedAt > SCRAPE_TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function clearScrape(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien à faire */
  }
}

// Millisecondes restantes avant expiration (0 si expiré/absent).
export function remainingMs(savedAt: number): number {
  return Math.max(0, savedAt + SCRAPE_TTL_MS - Date.now());
}
