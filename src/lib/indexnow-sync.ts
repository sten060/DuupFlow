// Au démarrage du serveur de prod (= après chaque mise en ligne), on relit
// chaque page du sitemap, on calcule une empreinte de son contenu visible, et on
// envoie à IndexNow UNIQUEMENT les pages dont l'empreinte a changé depuis la
// dernière fois (+ les nouvelles pages, + les anciennes adresses /en une seule
// fois, pour que Bing voie leurs redirections 301).
//
// Mémoire des empreintes : un petit fichier JSON privé dans Supabase Storage
// (bucket « seo-state », créé tout seul) — pas de migration à appliquer.
//
// INDEXNOW=0 désactive tout. Déclenché depuis src/instrumentation.ts.

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import sitemap from "@/app/sitemap";
import { SITE_URL, enInternalPath } from "@/lib/i18n/routes";
import { submitToIndexNow } from "@/lib/indexnow";

const BUCKET = "seo-state";
const FILE = "indexnow.json";
const MOVED = "moved"; // empreinte fixe des anciennes adresses /en (redirigées)

type State = Record<string, string>;

/** Empreinte du contenu qui compte pour un moteur : titre, canonical, texte visible. */
export function pageFingerprint(html: string): string {
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "";
  const text = html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(`${title}\n${canonical}\n${text}`).digest("hex");
}

async function loadState(admin: ReturnType<typeof createAdminClient>): Promise<State | null> {
  const { data, error } = await admin.storage.from(BUCKET).download(FILE);
  if (data) return JSON.parse(await data.text()) as State;
  // Première fois : bucket ou fichier absent → état vide. Toute autre erreur → on
  // s'abstient (mieux vaut ne rien envoyer que tout renvoyer à chaque démarrage).
  const msg = `${error?.message ?? ""} ${(error as { statusCode?: string })?.statusCode ?? ""}`;
  if (/not.?found|404|does not exist|bucket/i.test(msg)) {
    await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {});
    return {};
  }
  console.warn("[indexnow] état illisible, rien envoyé :", msg.trim());
  return null;
}

async function saveState(admin: ReturnType<typeof createAdminClient>, state: State) {
  const body = new Blob([JSON.stringify(state)], { type: "application/json" });
  const { error } = await admin.storage.from(BUCKET).upload(FILE, body, { upsert: true, contentType: "application/json" });
  if (error) console.warn("[indexnow] état non enregistré :", error.message);
}

export async function syncIndexNow(origin = `http://127.0.0.1:${process.env.PORT || 3000}`) {
  const live = sitemap().map((e) => e.url);
  // Anciennes adresses /en des pages anglaises : signalées une fois (→ 301)
  const legacy = live
    .filter((u) => !u.startsWith(`${SITE_URL}/fr`))
    .map((u) => `${SITE_URL}${enInternalPath(u.slice(SITE_URL.length) || "/")}`);

  const next: State = {};
  for (const url of live) {
    try {
      const res = await fetch(origin + (url.slice(SITE_URL.length) || "/"), {
        redirect: "manual",
        headers: { "User-Agent": "DuupFlow-IndexNow-Sync", "Accept-Language": "en" },
      });
      if (res.status !== 200) continue; // page cassée : on ne la signale pas
      next[url] = pageFingerprint(await res.text());
    } catch {
      /* page injoignable : on réessaiera au prochain démarrage */
    }
  }
  for (const url of legacy) next[url] = MOVED;

  const admin = createAdminClient();
  const prev = await loadState(admin);
  if (!prev) return;

  const changed = Object.keys(next).filter((u) => prev[u] !== next[u]);
  // Pages retirées du sitemap depuis la dernière fois : à signaler aussi (404/301)
  const removed = Object.keys(prev).filter((u) => !(u in next));
  const toSend = [...changed, ...removed];
  if (!toSend.length) {
    console.log(`[indexnow] ${live.length} pages vérifiées, aucune modifiée`);
    return;
  }

  const result = await submitToIndexNow(toSend);
  if (!result.ok) {
    console.warn(`[indexnow] refusé (HTTP ${result.status}) — réessai au prochain démarrage`);
    return;
  }
  await saveState(admin, next);
  console.log(`[indexnow] ${toSend.length} URL(s) envoyées (HTTP ${result.status}) :`, toSend.slice(0, 10).join(" "), toSend.length > 10 ? "…" : "");
}
