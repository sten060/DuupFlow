// Classement "meilleures performances" — score par vidéo, tolérant aux métriques
// manquantes (les vues ne sont pas toujours exposées selon la plateforme/le post).
//
// Principe :
//   • Signal principal = les VUES si connues, sinon les LIKES (proxy de portée).
//   • Bonus qualité   = taux d'engagement (like+comment+share)/vues quand dispo.
//   • Le score est NORMALISÉ 0-100 par rapport à la meilleure vidéo du lot
//     (comparaison relative au compte, pas absolue).
//
// Pas de dépendance à la date ici : la fenêtre est déjà appliquée au scrape.

import crypto from "crypto";
import type { ScrapedVideo, ScoredVideo } from "./types";

function idFor(postUrl: string): string {
  return crypto.createHash("sha1").update(postUrl).digest("hex").slice(0, 12);
}

// Portée brute d'une vidéo : vues si présentes, sinon likes (mis à l'échelle
// pour rester du même ordre de grandeur), sinon 0.
function reach(v: ScrapedVideo): number {
  if (v.views !== null) return v.views;
  if (v.likes !== null) return v.likes * 20; // ~5% de like rate → estimation de portée
  return 0;
}

function engagementRate(v: ScrapedVideo): number | null {
  if (v.views === null || v.views === 0) return null;
  const eng = (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0);
  return eng / v.views;
}

export function rankVideos(videos: ScrapedVideo[]): ScoredVideo[] {
  if (videos.length === 0) return [];

  const reaches = videos.map(reach);
  const maxReach = Math.max(...reaches, 1);

  const scored = videos.map((v, i) => {
    const er = engagementRate(v);
    // Base 0-85 sur la portée relative (échelle racine → compresse les écarts
    // extrêmes d'un viral isolé), + jusqu'à 15 de bonus d'engagement.
    const reachScore = Math.sqrt(reaches[i] / maxReach) * 85;
    const erBonus = er !== null ? Math.min(15, er * 150) : 0;
    const score = Math.round(Math.min(100, reachScore + erBonus));
    return {
      ...v,
      id: idFor(v.postUrl),
      score,
      engagementRate: er,
      rank: 0, // rempli après tri
    } satisfies ScoredVideo;
  });

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((v, i) => (v.rank = i + 1));
  return scored;
}
