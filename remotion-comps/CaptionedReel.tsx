// Composition Remotion : la couche CAPTIONS du Studio.
// La vidéo de base (déjà recadrée 9:16, découpée, vitesse appliquée — par
// ffmpeg) est lue telle quelle ; on rend par-dessus le hook + les révélations
// séquentielles aux MESURES de la référence (positions, taille, timings).
// Avantages vs ffmpeg/libass : emojis couleur natifs, typo propre, contrôle
// total du style.

import React from "react";
import {
  AbsoluteFill,
  interpolate,
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
  fontFrac: number; // taille des révélations
  maxCharsPerLine: number;
  mode?: "stack" | "replace";
  refDurationSec?: number;
  // Tokens visuels mesurés sur la ref (Phase 3)
  hookFontFrac?: number; // taille du hook (souvent > items)
  fontFamily?: "serif" | "sans";
  fontWeight?: "normal" | "bold" | "heavy";
  outline?: "none" | "thin" | "thick";
  shadow?: boolean;
};

// Plan de montage : re-monte la base en jump cuts au rythme de la ref.
export type EditSegment = {
  srcStartSec: number; // position dans la vidéo source
  durationSec: number; // durée du plan dans la sortie
};

// Réalisateur (coordonné) : cadrage animé + caption par plan.
export type Framing = { zoom: number; cx: number; cy: number };
export type EditShot = {
  durationSec: number;
  from: Framing;
  to: Framing;
  caption: string;
};

export type CaptionedReelProps = {
  videoUrl: string; // vidéo de base (servie par /api/studio/media)
  durationSec: number; // durée de SORTIE (= somme des segments si montage)
  hook: string;
  reveals: string[];
  // Montage COORDONNÉ (réalisateur) : plans avec cadrage animé + caption.
  // Quand présent, il PRIME sur segments/reveals (chemin coordonné).
  shots: EditShot[] | null;
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
  shots,
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
  const hookFontSize = Math.round((layout?.hookFontFrac ?? layout?.fontFrac ?? 0.033) * H);
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

  // ── Tokens visuels de la ref → CSS (Phase 3) ───────────────────────────────
  // Police : formes mesurées (serif = look Instagram « classique »).
  const family =
    (layout?.fontFamily ?? "sans") === "serif"
      ? "Georgia, 'Times New Roman', 'Apple Color Emoji', serif"
      : "Inter, -apple-system, 'Helvetica Neue', Arial, 'Apple Color Emoji', sans-serif";
  const weight = { normal: 500, bold: 700, heavy: 800 }[
    layout?.fontWeight ?? "heavy"
  ];
  // Contour : multi text-shadow (rend aussi les emojis proprement).
  const outlinePx = { none: 0, thin: 2, thick: 3 }[layout?.outline ?? "thick"];
  const shadows: string[] = [];
  if (outlinePx > 0) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      shadows.push(`${dx * outlinePx}px ${dy * outlinePx}px 0 #000`);
    }
  }
  if (layout?.shadow ?? true) shadows.push("0 4px 10px rgba(0,0,0,.55)");

  const textStyle = (size: number): React.CSSProperties => ({
    textAlign: "center",
    fontFamily: family,
    fontWeight: weight,
    fontSize: size,
    lineHeight: 1.25,
    color,
    textShadow: shadows.join(", ") || undefined,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  });
  const centered = (size: number): React.CSSProperties => ({
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    width: `min(${Math.round(maxChars * size * 0.62)}px, 92%)`,
  });

  // ── Chemin COORDONNÉ (réalisateur) : plans avec cadrage animé + caption ────
  // Cadrage : transform-origin 0 0, translate puis scale → le point (cx,cy) du
  // rush atterrit au centre, zoomé par `zoom` (formule tx=W/2 - z·cx·W).
  if (shots && shots.length > 0) {
    let cursor = 0;
    return (
      <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
        {shots.map((shot, i) => {
          const from = Math.round(cursor * fps);
          const durF = Math.max(1, Math.round(shot.durationSec * fps));
          cursor += shot.durationSec;
          const local = frame - from;
          const p = durF > 1 ? Math.max(0, Math.min(1, local / durF)) : 1;
          const z = interpolate(p, [0, 1], [shot.from.zoom, shot.to.zoom]);
          const cx = interpolate(p, [0, 1], [shot.from.cx, shot.to.cx]);
          const cy = interpolate(p, [0, 1], [shot.from.cy, shot.to.cy]);
          const trX = W / 2 - z * cx * W;
          const trY = H / 2 - z * cy * H;
          return (
            <Sequence key={i} from={from} durationInFrames={durF}>
              <AbsoluteFill style={{ overflow: "hidden" }}>
                <OffthreadVideo
                  src={videoUrl}
                  style={{
                    width: W,
                    height: H,
                    transformOrigin: "0 0",
                    transform: `translate(${trX}px, ${trY}px) scale(${z})`,
                  }}
                />
              </AbsoluteFill>
              {shot.caption ? (
                <div style={{ ...centered(hookFontSize), top: hookTop, ...textStyle(hookFontSize) }}>
                  {tx(shot.caption)}
                </div>
              ) : null}
            </Sequence>
          );
        })}
      </AbsoluteFill>
    );
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
  const rhythmShots =
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
      {rhythmShots ?? <OffthreadVideo src={videoUrl} style={videoStyle} />}

      {captionMode === "replace" ? (
        /* Mode REMPLACEMENT (refs mot-à-mot) : UNE seule caption à la fois.
           Le hook est la caption n°0 — il est REMPLACÉ par la 1ʳᵉ révélation
           (fini le chevauchement hook fixe / reveals). */
        <div style={{ ...centered(hookFontSize), top: hookTop, ...textStyle(hookFontSize) }}>
          {tx(lastReached >= 0 ? reveals[lastReached] : hook)}
        </div>
      ) : (
        <>
          {/* Hook — visible dès la 1ʳᵉ frame, à SA taille mesurée */}
          <div style={{ ...centered(hookFontSize), top: hookTop, ...textStyle(hookFontSize) }}>
            {tx(hook)}
          </div>

          {/* Révélations — colonne flex à partir de stackTop : le NAVIGATEUR
              fait le wrapping et l'empilement réels (plus d'estimation de
              hauteur par comptage de caractères). */}
          <div
            style={{
              ...centered(fontSize),
              top: stackTop,
              display: "flex",
              flexDirection: "column",
              gap: Math.round(fontSize * 0.55),
            }}
          >
            {reveals.map((r, i) =>
              t >= times[i] ? (
                <div key={i} style={textStyle(fontSize)}>
                  {tx(r)}
                </div>
              ) : null
            )}
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
