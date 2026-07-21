"use client";

// Aperçu LIVE d'une variante dans le navigateur : le même composant Remotion
// (CaptionedReel) que le rendu serveur, rejoué par @remotion/player à partir du
// plan éditable. C'est le socle de l'éditeur — quand on modifiera le plan, cet
// aperçu bougera en direct, sans re-render serveur.

import { Player } from "@remotion/player";
import type { ComponentType } from "react";
import { CaptionedReel } from "../../../../remotion-comps/CaptionedReel";
import type { ReelPlan } from "@/lib/studio/types";

const FPS = 30;
const W = 1080;
const H = 1920;

// Le plan (ReelPlan) est structurellement identique aux props de CaptionedReel ;
// le Player attend des props indexables (Record<string, unknown>).
const Comp = CaptionedReel as unknown as ComponentType<Record<string, unknown>>;

export default function ReelPlayer({ plan }: { plan: ReelPlan }) {
  return (
    <Player
      component={Comp}
      inputProps={plan as unknown as Record<string, unknown>}
      durationInFrames={Math.max(1, Math.round(plan.durationSec * FPS))}
      fps={FPS}
      compositionWidth={W}
      compositionHeight={H}
      style={{ width: "100%", height: "100%" }}
      controls
      loop
    />
  );
}
