// Composition Remotion : la couche CAPTIONS du Studio.
// La vidéo de base (déjà recadrée 9:16, découpée, vitesse appliquée — par
// ffmpeg) est lue telle quelle ; on rend par-dessus le hook + les révélations
// séquentielles aux MESURES de la référence (positions, taille, timings).
// Avantages vs ffmpeg/libass : emojis couleur natifs, typo propre, contrôle
// total du style.

import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Miroir de RecipeLayout (src/lib/studio/types.ts) — dupliqué pour garder le
// bundle Remotion autonome (le bundler ne doit pas aspirer le code Next).
// NB : `type` (pas `interface`) — les contraintes Record<string, unknown> de
// Remotion n'acceptent pas les interfaces (pas d'index signature implicite).
export type ReelLayout = {
  revealCount: number;
  revealAtFrac: number[];
  hookYFrac: number;
  stackYFrac: number;
  fontFrac: number;
  maxCharsPerLine: number;
  mode?: "stack" | "replace";
  refDurationSec?: number;
};

// Plan de montage : re-monte la base en jump cuts au rythme de la ref.
export type EditSegment = {
  srcStartSec: number; // position dans la vidéo source
  durationSec: number; // durée du plan dans la sortie
};

export type CaptionedReelProps = {
  videoUrl: string; // vidéo de base (servie par /api/studio/media)
  durationSec: number; // durée de SORTIE (= somme des segments si montage)
  hook: string;
  reveals: string[];
  // Segments du montage au rythme de la ref — null/vide = vidéo entière.
  segments: EditSegment[] | null;
  // Moments d'apparition en SECONDES ABSOLUES — calculés côté serveur par la
  // règle unique computeRevealTimes (adaptation proportionnelle ou rythme
  // conservé selon durée user vs durée ref). Prime sur layout.revealAtFrac.
  revealAtSec: number[];
  // "stack" = les révélations s'empilent ; "replace" = chacune remplace la
  // précédente (même position).
  captionMode: "stack" | "replace";
  layout: ReelLayout | null;
  accentColor: string | null; // couleur du texte (réf) — défaut blanc
  uppercase: boolean;
};

const W = 1080;
const H = 1920;

export const CaptionedReel: React.FC<CaptionedReelProps> = ({
  videoUrl,
  durationSec,
  hook,
  reveals,
  segments,
  revealAtSec,
  captionMode,
  layout,
  accentColor,
  uppercase,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // ── Mesures : celles de la référence, sinon défauts équilibrés ────────────
  const fontSize = Math.round((layout?.fontFrac ?? 0.033) * H);
  const maxChars = layout?.maxCharsPerLine ?? 24;
  const hookTop = (layout?.hookYFrac ?? 0.32) * H;
  const stackTop = (layout?.stackYFrac ?? 0.46) * H;

  // Timings : secondes ABSOLUES fournies par le serveur (règle unique) ;
  // filet de sécurité si absentes (anciens appels).
  const times = reveals.map(
    (_, i) =>
      revealAtSec?.[i] ??
      (0.15 + (0.65 * i) / Math.max(1, reveals.length - 1)) * durationSec
  );

  const color = accentColor ?? "#ffffff";
  const tx = (s: string) => (uppercase ? s.toUpperCase() : s);

  // Style commun : gras, contour noir (multi text-shadow — rend aussi les
  // emojis proprement, sans contour cassé), centré, largeur calée sur la ref.
  const captionStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    width: `min(${Math.round(maxChars * fontSize * 0.62)}px, 92%)`,
    textAlign: "center",
    fontFamily:
      "Inter, -apple-system, 'Helvetica Neue', Arial, 'Apple Color Emoji', sans-serif",
    fontWeight: 800,
    fontSize,
    lineHeight: 1.25,
    color,
    textShadow:
      "-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 0 4px 10px rgba(0,0,0,.55)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  // Empilement : positions calculées d'après la hauteur estimée de chaque bloc
  // (nb de lignes × interligne) + un gap constant, à partir de stackTop.
  const lineH = fontSize * 1.25;
  const blockGap = fontSize * 0.55;
  const estLines = (s: string) =>
    Math.max(1, Math.ceil(s.length / Math.max(8, maxChars)));
  const tops: number[] = [];
  let y = stackTop;
  for (const r of reveals) {
    tops.push(y);
    y += estLines(r) * lineH + blockGap;
  }

  // Mode remplacement : seule la DERNIÈRE révélation atteinte est visible,
  // toujours à la même position (stackTop).
  const lastReached = times.reduce(
    (acc, time, i) => (t >= time ? i : acc),
    -1
  );

  // Montage jump-cut : chaque segment est une Sequence qui lit la base à
  // partir de srcStartSec (startFrom/endAt en frames). Sans segments : la
  // base entière, comme avant.
  const videoStyle: React.CSSProperties = {
    width: W,
    height: H,
    objectFit: "cover",
  };
  let cursor = 0;
  const shots =
    segments && segments.length > 0
      ? segments.map((s, i) => {
          const from = Math.round(cursor * fps);
          const dur = Math.max(1, Math.round(s.durationSec * fps));
          cursor += s.durationSec;
          return (
            <Sequence key={i} from={from} durationInFrames={dur}>
              <OffthreadVideo
                src={videoUrl}
                startFrom={Math.round(s.srcStartSec * fps)}
                endAt={Math.round((s.srcStartSec + s.durationSec) * fps) + 1}
                style={videoStyle}
              />
            </Sequence>
          );
        })
      : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {shots ?? <OffthreadVideo src={videoUrl} style={videoStyle} />}

      {/* Hook — visible dès la 1ʳᵉ frame, apparition instantanée */}
      <div style={{ ...captionStyle, top: hookTop }}>{tx(hook)}</div>

      {/* Révélations — apparition instantanée aux timings mesurés */}
      {captionMode === "replace"
        ? lastReached >= 0 && (
            <div style={{ ...captionStyle, top: stackTop }}>
              {tx(reveals[lastReached])}
            </div>
          )
        : reveals.map((r, i) =>
            t >= times[i] ? (
              <div key={i} style={{ ...captionStyle, top: tops[i] }}>
                {tx(r)}
              </div>
            ) : null
          )}
    </AbsoluteFill>
  );
};
