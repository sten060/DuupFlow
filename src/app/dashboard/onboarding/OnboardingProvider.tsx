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
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { markOnboardingSeen } from "../actions/onboarding";
import { ONBOARDING_MODULES } from "./modules";
import type { CleParcours } from "./parcours";

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

  /* ── Parcours guidé ────────────────────────────────────────────────────
     Le parcours traverse les pages : son état ne peut pas vivre dans la page.
     Il vit ici (le provider est dans le layout du dashboard, donc conservé
     d'une route à l'autre) ET dans localStorage, pour survivre à un vrai
     rechargement — un clic sur un lien externe ne doit pas tout perdre. */
  parcours: CleParcours | null;
  etape: number;
  lancerParcours: (p: CleParcours) => void;
  allerEtape: (i: number) => void;
  quitterParcours: () => void;
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
  parcours: null,
  etape: 0,
  lancerParcours: () => {},
  allerEtape: () => {},
  quitterParcours: () => {},
});

const CLE_STOCKAGE = "duup_parcours";

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

  const [parcours, setParcours] = useState<CleParcours | null>(null);
  const [etape, setEtape] = useState(0);

  // Reprise après un rechargement complet de la page.
  useEffect(() => {
    try {
      const brut = localStorage.getItem(CLE_STOCKAGE);
      if (!brut) return;
      const d = JSON.parse(brut) as { p?: CleParcours; e?: number };
      if (d?.p === "dup" || d?.p === "ai") { setParcours(d.p); setEtape(Number(d.e) || 0); }
    } catch { /* stockage indisponible : le parcours ne survit pas au reload, tant pis */ }
  }, []);

  const memoriser = (p: CleParcours | null, e: number) => {
    try {
      if (p) localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ p, e }));
      else localStorage.removeItem(CLE_STOCKAGE);
    } catch { /* sans effet */ }
  };

  const lancerParcours = useCallback((p: CleParcours) => { setParcours(p); setEtape(0); memoriser(p, 0); }, []);
  const allerEtape = useCallback((i: number) => {
    setEtape(i);
    setParcours((p) => { memoriser(p, i); return p; });
  }, []);
  const quitterParcours = useCallback(() => { setParcours(null); setEtape(0); memoriser(null, 0); }, []);

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
      parcours,
      etape,
      lancerParcours,
      allerEtape,
      quitterParcours,
    }),
    [enabled, grandfathered, isSeen, markSeen, forcedOverview, forcedModule, replayOverview, replayModule,
     parcours, etape, lancerParcours, allerEtape, quitterParcours],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
