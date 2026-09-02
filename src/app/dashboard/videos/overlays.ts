// src/app/dashboard/videos/overlays.ts
//
// Couche COMMUNE à toutes les incrustations vidéo (watermark visible, assets
// visuels…). Avant, le watermark était la seule couche possible et son
// filtergraph était écrit en dur dans runFFmpegSafe : impossible d'en poser
// deux. Ici on décrit une incrustation de façon neutre, et
// `buildOverlayFilterComplex()` en empile autant que nécessaire :
//
//   [0:v]<filtres vidéo>[v0] ; <source 1>[ov0] ; [v0][ov0]overlay=…[v1] ;
//                              <source 2>[ov1] ; [v1][ov1]overlay=…[vout]
//
// L'ordre du tableau = l'ordre d'empilement (le dernier est au-dessus).

export type VideoOverlay = {
  /** PNG (ou vidéo) à incruster — chemin sur disque. */
  moviePath: string;
  /** Largeur cible en px (0 = ne pas redimensionner). */
  scaleW: number;
  /** Hauteur cible en px. Absent → -2 (ratio conservé, dimension paire). */
  scaleH?: number;
  /** Opacité finale, 0–1. */
  opacity: number;
  /** Expressions de position FFmpeg (vars W/H/w/h/t). */
  x: string;
  y: string;
  /**
   * Teinte optionnelle (fractions 0–1) : applique une couleur sur un PNG blanc
   * via colorchannelmixer (utilisé par le watermark aléatoire du mode simple).
   */
  tint?: { r: number; g: number; b: number };
};

/** Échappe un chemin pour l'option `movie=` d'un filtergraph FFmpeg. */
export function escapeMoviePath(p: string): string {
  return p.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

/**
 * Construit le `-filter_complex` complet : les filtres vidéo classiques, puis
 * les incrustations empilées. La sortie porte toujours le label `[vout]`.
 * Appeler UNIQUEMENT avec au moins une incrustation (sinon un simple -vf suffit).
 */
export function buildOverlayFilterComplex(vfParts: string[], overlays: VideoOverlay[]): string {
  const base = vfParts.length ? vfParts.join(",") : "null";
  const parts: string[] = [`[0:v]${base}[v0]`];

  overlays.forEach((ov, i) => {
    const scale = ov.scaleW > 0 ? `,scale=${ov.scaleW}:${ov.scaleH ?? -2}` : "";
    const op = ov.opacity.toFixed(3);
    // PNG blanc → couleur via colorchannelmixer (rr/gg/bb), l'opacité passant
    // toujours par l'alpha (aa) que la teinte soit demandée ou non.
    const cmix = ov.tint
      ? `colorchannelmixer=rr=${ov.tint.r.toFixed(3)}:gg=${ov.tint.g.toFixed(3)}:bb=${ov.tint.b.toFixed(3)}:aa=${op}`
      : `colorchannelmixer=aa=${op}`;
    // Dernière couche → [vout] ; les autres alimentent la suivante.
    const out = i === overlays.length - 1 ? "vout" : `v${i + 1}`;
    parts.push(`movie=${escapeMoviePath(ov.moviePath)},format=rgba,${cmix}${scale}[ov${i}]`);
    parts.push(`[v${i}][ov${i}]overlay=x='${ov.x}':y='${ov.y}':format=auto[${out}]`);
  });

  return parts.join(";");
}
