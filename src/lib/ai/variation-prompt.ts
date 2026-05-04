/**
 * Prompt builder for the AI variation feature (Seedream 4.5 edit on WaveSpeed).
 *
 * Goal: keep IDENTITY + DECOR + LIGHTING + STYLE locked, but force a
 * VISIBLY different action / pose in each variation. The model is told
 * exactly which action to perform via `ACTION_VARIATIONS` — picked at
 * random per generation so 3 variations = 3 distinct poses.
 *
 * ── How to tweak ────────────────────────────────────────────────────────
 * 1. Edit `BASE_PROMPT` for the structural rules (preservation + style).
 * 2. Edit `ACTION_VARIATIONS` to add / remove / reword specific poses.
 *    More variety here = more diverse outputs.
 * 3. No rebuild needed in dev — hot reload picks up the file instantly.
 *
 * Tips:
 *  • Lead with what must CHANGE (the new pose / action).
 *  • Be extremely concrete on the action — Seedream follows literal poses
 *    much better than vague hints ("a different gesture" ≠ useful).
 *  • Avoid words like "subtle", "tiny", "frame later" — they push the
 *    model toward near-identical outputs, which is the opposite of what
 *    we want here.
 */

const BASE_PROMPT = `Show the SAME exact person — identical face shape, identical facial features, same eye color, same skin tone, same hair color and hairstyle, same makeup, same body proportions. The outfit, clothing, jewelry and accessories must remain strictly identical, no changes. The background, room, decor and any objects must stay exactly the same as in the reference image. Lighting, shadows, color grading, time of day and image style must match the source. Photorealistic, natural, same camera angle, same framing, same image quality.`;

const ACTION_INSTRUCTION = `In this new image, the person performs a CLEARLY DIFFERENT pose or action than in the source — the pose change must be obvious and visible, not a micro-adjustment. The specific action to perform is:`;

/**
 * Pool of concrete pose/action variations. Add as many as you want —
 * the system picks one at random per generation.
 */
export const ACTION_VARIATIONS: string[] = [
  "she lifts one arm and lightly runs her fingers through her hair near the temple",
  "she brings one hand up to softly brush a strand of hair away from her face",
  "she rests one hand gently on her collarbone, fingers spread naturally",
  "her arm passes in front of her chest in a relaxed natural gesture",
  "she places one hand near her chin in a thoughtful pose, elbow slightly bent",
  "she tilts her head sideways while one hand touches her cheek",
  "she looks up gently toward the ceiling with a soft smile, chin raised",
  "she laughs softly, head tilted slightly back, eyes briefly closed",
  "she crosses her arms loosely in front of her body in a relaxed way",
  "she leans slightly forward and rests one hand on her thigh",
  "she stretches one arm back behind her head, elbow bent",
  "she holds a small object near her face with one hand",
  "she gives a subtle wink, one hand near her shoulder",
  "she places both hands together near her chest as if cupping something",
  "she turns her head and shoulders to the side, looking off camera",
];

/**
 * Build a complete prompt with one randomly-picked action.
 * Call this once per Seedream generation so each variation has a
 * different pose. If `forcedActionIndex` is provided, use that specific
 * action (handy for debugging or guaranteed diversity across N calls).
 */
export function buildVariationPrompt(forcedActionIndex?: number): string {
  const idx =
    typeof forcedActionIndex === "number"
      ? forcedActionIndex % ACTION_VARIATIONS.length
      : Math.floor(Math.random() * ACTION_VARIATIONS.length);
  const action = ACTION_VARIATIONS[idx];
  return `${ACTION_INSTRUCTION} ${action}. ${BASE_PROMPT}`;
}

/**
 * Backward-compat default — kept exported in case anything still imports it.
 * Prefer `buildVariationPrompt()` for actual generation calls.
 */
export const VARIATION_PROMPT = buildVariationPrompt(0);
