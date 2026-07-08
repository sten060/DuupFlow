// Racine Remotion — enregistre la composition CaptionedReel.
// La durée est DYNAMIQUE : calculée depuis props.durationSec (durée réelle de
// la vidéo de base) via calculateMetadata.

import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { CaptionedReel, type CaptionedReelProps } from "./CaptionedReel";

const FPS = 30;

const calculateMetadata: CalculateMetadataFunction<CaptionedReelProps> = ({
  props,
}) => ({
  durationInFrames: Math.max(1, Math.round(props.durationSec * FPS)),
  props,
});

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CaptionedReel"
      component={CaptionedReel}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={30 * 10} // placeholder — remplacé par calculateMetadata
      defaultProps={{
        videoUrl: "",
        durationSec: 10,
        hook: "Hook de test",
        reveals: [],
        revealAtSec: [],
        captionMode: "stack" as const,
        layout: null,
        accentColor: null,
        uppercase: false,
      }}
      calculateMetadata={calculateMetadata}
    />
  );
};
