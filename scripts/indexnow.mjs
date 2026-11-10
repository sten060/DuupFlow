#!/usr/bin/env node
// Envoi MANUEL d'URLs à IndexNow (Bing…). L'envoi automatique se fait tout seul
// après chaque mise en ligne (src/lib/indexnow-sync.ts) ; ce script sert à
// forcer une page précise.
//
//   node scripts/indexnow.mjs https://www.duupflow.com/pricing https://www.duupflow.com/fr/pricing
//
// Clé : doit rester identique à src/lib/indexnow.ts et au fichier public/<clé>.txt.

const KEY = "4c56a3aecc852a12741ea74655ebdc71";
const HOST = "www.duupflow.com";

const urls = process.argv.slice(2).filter((u) => u.startsWith(`https://${HOST}`));
if (!urls.length) {
  console.error(`Usage : node scripts/indexnow.mjs https://${HOST}/<page> [...]`);
  process.exit(1);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow → HTTP ${res.status} (${urls.length} URL(s))`, res.status === 200 || res.status === 202 ? "✓" : await res.text());
