// Transfert des vidéos scrapées vers un autre module (duplication simple/avancée).
//
// Les vidéos vivent côté serveur (.studio-local/uploads, servies par
// /api/studio/media/<id>). La dropzone de duplication attend des objets File du
// navigateur. On passe donc par sessionStorage : le module scraper y dépose la
// liste, le module duplication la consomme au montage (fetch → Blob → File) et
// l'injecte dans la dropzone via son `addFilesRef` — exactement le mécanisme
// déjà utilisé par DriveImportButton.
//
// Fichier client-only (sessionStorage) : aucun import Node.

const HANDOFF_KEY = "duup_scrape_handoff";
// Au-delà, la remise est considérée périmée (l'user a navigué ailleurs entre-temps).
const HANDOFF_TTL_MS = 10 * 60 * 1000;

export interface HandoffFile {
  url: string; // /api/studio/media/<id> — same-origin, streamable
  name: string; // nom affiché/déposé (ex: "natgeo_1.mp4")
}

interface HandoffPayload {
  savedAt: number;
  files: HandoffFile[];
}

// Dépose les fichiers à transférer, juste avant de naviguer vers le module cible.
export function putHandoff(files: HandoffFile[]): void {
  if (typeof window === "undefined" || files.length === 0) return;
  const payload: HandoffPayload = { savedAt: Date.now(), files };
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    /* quota/private mode → le transfert sera simplement ignoré */
  }
}

// Dernière remise déjà réclamée dans CETTE page (mémoire du module, pas du
// composant). En dev, React StrictMode monte/démonte/remonte : sans ce garde,
// le 1ᵉʳ passage consommerait la remise et le 2ᵉ ne trouverait plus rien.
// La clé est l'horodatage : une NOUVELLE remise (autre savedAt) passe toujours.
let lastClaimedAt = 0;

// Récupère et consomme la remise. Idempotent pour un même dépôt : deux appels
// rapprochés (StrictMode) ne renvoient les fichiers qu'une seule fois.
export function claimHandoff(): HandoffFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return [];
    const payload = JSON.parse(raw) as HandoffPayload;
    if (!payload?.files?.length) return [];
    if (payload.savedAt === lastClaimedAt) return []; // déjà réclamée
    if (Date.now() - payload.savedAt > HANDOFF_TTL_MS) {
      sessionStorage.removeItem(HANDOFF_KEY);
      return [];
    }
    lastClaimedAt = payload.savedAt;
    sessionStorage.removeItem(HANDOFF_KEY);
    return payload.files;
  } catch {
    return [];
  }
}

// Télécharge les fichiers transférés et les convertit en File pour la dropzone.
// Séquentiel : ce sont des vidéos, on évite de saturer la mémoire du navigateur.
export async function fetchHandoffFiles(files: HandoffFile[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    try {
      const res = await fetch(f.url);
      if (!res.ok) continue;
      const blob = await res.blob();
      out.push(new File([blob], f.name, { type: blob.type || "video/mp4" }));
    } catch {
      /* un fichier illisible ne doit pas casser le transfert des autres */
    }
  }
  return out;
}
