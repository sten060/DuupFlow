"use client";

/**
 * State for the self-paced onboarding.
 *
 * Two surfaces consume it:
 *   • AppOverview  — the one-time overview card on the dashboard home.
 *   • ModuleCoach  — the one-time short coach on each module's first open.
 *
 * `progress` mirrors profiles.onboarding_progress. We update it optimistically
 * (so a surface never re-triggers within the session) and persist best-effort
 * via markOnboardingSeen. A "grandfathered" flag (set for pre-existing users)
 * disables every surface.
 *
 * Replay: the header "Revoir la visite" menu can force a surface back open even
 * once seen — replayOverview() / replayModule(key). Forced runs never re-mark
 * progress.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { markOnboardingSeen } from "../actions/onboarding";
import { ONBOARDING_MODULES } from "./modules";

type Progress = Record<string, boolean | undefined>;

type OnboardingValue = {
  /** False for guests / pre-existing (grandfathered) users → nothing shows. */
  enabled: boolean;
  /** True once an area is seen (or the user is grandfathered). */
  isSeen: (area: string) => boolean;
  /** Persist an area as seen + update local state. */
  markSeen: (area: string) => void;
  /** Forced replays (override "seen"). null = not forced. */
  forcedOverview: boolean;
  forcedModule: string | null;
  replayOverview: () => void;
  replayModule: (key: string) => void;
  clearForcedOverview: () => void;
  clearForcedModule: () => void;
};

const OnboardingContext = createContext<OnboardingValue>({
  enabled: false,
  isSeen: () => true,
  markSeen: () => {},
  forcedOverview: false,
  forcedModule: null,
  replayOverview: () => {},
  replayModule: () => {},
  clearForcedOverview: () => {},
  clearForcedModule: () => {},
});

export function OnboardingProvider({
  enabled,
  initialProgress,
  children,
}: {
  enabled: boolean;
  initialProgress: Progress;
  children: ReactNode;
}) {
  const router = useRouter();
  const grandfathered = initialProgress?.grandfathered === true;
  const [progress, setProgress] = useState<Progress>(initialProgress ?? {});
  const [forcedOverview, setForcedOverview] = useState(false);
  const [forcedModule, setForcedModule] = useState<string | null>(null);

  const isSeen = useCallback(
    (area: string) => grandfathered || progress[area] === true,
    [grandfathered, progress],
  );

  const markSeen = useCallback((area: string) => {
    setProgress((p) => (p[area] ? p : { ...p, [area]: true }));
    void markOnboardingSeen(area).catch(() => {});
  }, []);

  const replayOverview = useCallback(() => setForcedOverview(true), []);

  const replayModule = useCallback(
    (key: string) => {
      const mod = ONBOARDING_MODULES.find((m) => m.key === key);
      if (!mod) return;
      setForcedModule(key);
      router.push(mod.route);
    },
    [router],
  );

  const value = useMemo<OnboardingValue>(
    () => ({
      enabled: enabled && !grandfathered,
      isSeen,
      markSeen,
      forcedOverview,
      forcedModule,
      replayOverview,
      replayModule,
      clearForcedOverview: () => setForcedOverview(false),
      clearForcedModule: () => setForcedModule(null),
    }),
    [enabled, grandfathered, isSeen, markSeen, forcedOverview, forcedModule, replayOverview, replayModule],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
