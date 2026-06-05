"use client";

/**
 * Shared state for the onboarding tour.
 *
 * The CoachmarkTour can run in TWO modes:
 *   • Onboarding (first-time)  — triggered automatically when
 *     `profiles.onboarded_at IS NULL`. Persists step to the DB and calls
 *     markOnboardingDone() at the end.
 *   • Rewatch (chapter replay) — triggered by the user clicking a chapter
 *     in the Guide picker. Runs from `startStep` to `endStep` (inclusive)
 *     without touching the DB and never flips onboarded_at.
 *
 * This context lets any client component (e.g. DashboardHome) launch a
 * rewatch via `launchRewatch(chapter)`, while CoachmarkTour mounted in
 * the dashboard layout listens for changes and switches into rewatch mode
 * when the value flips.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type TourChapter = "images" | "videos" | "similarity" | "variation";

/**
 * Step ranges per chapter. Indices match the STEPS array in CoachmarkTour.
 * IMPORTANT: keep in sync if STEPS is reordered/inserted.
 *
 *   images     → nav-images (1) → img-submit (5)
 *   videos     → nav-videos (6) → video-submit (11)
 *   similarity → nav-similarity (12) → sim-submit (15)
 *   variation  → nav-variation (16) → gen-submit (19)
 */
const CHAPTER_RANGES: Record<TourChapter, { start: number; end: number }> = {
  images:     { start: 1,  end: 5  },
  videos:     { start: 6,  end: 11 },
  similarity: { start: 12, end: 15 },
  variation:  { start: 16, end: 19 },
};

export type RewatchState = { startStep: number; endStep: number; chapter: TourChapter } | null;

type TourContextValue = {
  rewatch: RewatchState;
  /** Start a chapter rewatch — overrides any in-progress rewatch. */
  launchRewatch: (chapter: TourChapter) => void;
  /** Clear the rewatch state. Called by the tour when it finishes. */
  endRewatch: () => void;
};

const TourContext = createContext<TourContextValue>({
  rewatch: null,
  launchRewatch: () => {},
  endRewatch: () => {},
});

export function TourProvider({ children }: { children: ReactNode }) {
  const [rewatch, setRewatch] = useState<RewatchState>(null);

  const value = useMemo<TourContextValue>(
    () => ({
      rewatch,
      launchRewatch: (chapter: TourChapter) => {
        const range = CHAPTER_RANGES[chapter];
        setRewatch({ startStep: range.start, endStep: range.end, chapter });
      },
      endRewatch: () => setRewatch(null),
    }),
    [rewatch],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  return useContext(TourContext);
}
