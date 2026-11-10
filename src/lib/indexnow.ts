// IndexNow — prévient Bing (et Yandex, Seznam, Naver…) dès qu'une page change.
// Bing alimente aussi la recherche de ChatGPT.
//
// La clé est PUBLIQUE par conception : elle doit être servie à
// https://www.duupflow.com/<clé>.txt (fichier dans public/) pour prouver que
// le domaine nous appartient. La changer = renommer ce fichier aussi.
//
// Déclenchement automatique : src/lib/indexnow-sync.ts (au démarrage en prod).
// Envoi manuel : node scripts/indexnow.mjs <url> [<url>…]

export const INDEXNOW_KEY = "4c56a3aecc852a12741ea74655ebdc71";
export const INDEXNOW_HOST = "www.duupflow.com";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS = 10_000; // limite du protocole par requête

/** Envoie une liste d'URLs absolues (www.duupflow.com uniquement). */
export async function submitToIndexNow(urls: string[]): Promise<{ ok: boolean; status: number; sent: number }> {
  const list = [...new Set(urls)].filter((u) => u.startsWith(`https://${INDEXNOW_HOST}`));
  if (!list.length) return { ok: true, status: 0, sent: 0 };
  let status = 0;
  for (let i = 0; i < list.length; i += MAX_URLS) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
        urlList: list.slice(i, i + MAX_URLS),
      }),
    });
    status = res.status;
    // 200 = reçu, 202 = reçu (clé en cours de vérification) ; le reste = refus
    if (res.status !== 200 && res.status !== 202) {
      return { ok: false, status, sent: i };
    }
  }
  return { ok: true, status, sent: list.length };
}
