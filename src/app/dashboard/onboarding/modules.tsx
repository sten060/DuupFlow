import type { ReactNode } from "react";

/**
 * Config for the self-paced onboarding.
 *
 *   • ONBOARDING_MODULES drives BOTH the overview card (icon + name + tagline)
 *     and the per-module coach (spotlight steps).
 *   • Each `key` doubles as the progress key (see markOnboardingSeen) and must
 *     match the route. `i18n` is the namespace suffix under `onb.*`.
 *   • Coach steps point at `data-tour-id` anchors that already exist on each
 *     module page. Steps are intentionally short — essentials only.
 */

export type CoachStep = {
  /** One or more data-tour-id anchors. The spotlight is their union box. */
  target: string[];
  titleKey: string;
  bodyKey: string;
  /** Preferred tooltip side relative to the target. Falls back automatically. */
  placement?: "right" | "below";
};

export type OnboardingModule = {
  /** Progress key + identity. Matches the route's last segment. */
  key: string;
  /** Exact pathname that triggers this module's coach. */
  route: string;
  /** Namespace under `onb.modules.*` / `onb.coach.*`. */
  i18n: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  icon: ReactNode;
  /** Empty = no spotlight coach (overview-only module). */
  steps: CoachStep[];
};

const IconImages = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const IconVideos = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="5" width="14" height="14" rx="2" />
    <path d="M16 9l5-3v12l-5-3V9z" />
  </svg>
);

const IconSimilarity = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const IconGenerate = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
  </svg>
);

const IconDetection = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const ONBOARDING_MODULES: OnboardingModule[] = [
  {
    key: "images",
    route: "/dashboard/images",
    i18n: "images",
    accent: "#C026D3",
    accentBg: "rgba(192,38,211,0.10)",
    accentBorder: "rgba(192,38,211,0.30)",
    icon: IconImages,
    steps: [
      { target: ["img-dropzone"],              titleKey: "onb.coach.images.s1t", bodyKey: "onb.coach.images.s1b", placement: "right" },
      { target: ["img-copies"],                titleKey: "onb.coach.images.s2t", bodyKey: "onb.coach.images.s2b", placement: "right" },
      { target: ["img-country", "img-options"], titleKey: "onb.coach.images.s3t", bodyKey: "onb.coach.images.s3b", placement: "right" },
      { target: ["img-submit"],                titleKey: "onb.coach.images.s4t", bodyKey: "onb.coach.images.s4b", placement: "right" },
    ],
  },
  {
    key: "videos",
    route: "/dashboard/videos",
    i18n: "videos",
    accent: "#6366F1",
    accentBg: "rgba(99,102,241,0.10)",
    accentBorder: "rgba(99,102,241,0.30)",
    icon: IconVideos,
    steps: [
      { target: ["video-mode-simple", "video-mode-advanced"], titleKey: "onb.coach.videos.s1t", bodyKey: "onb.coach.videos.s1b", placement: "below" },
    ],
  },
  {
    key: "similarity",
    route: "/dashboard/similarity",
    i18n: "similarity",
    accent: "#10B981",
    accentBg: "rgba(16,185,129,0.10)",
    accentBorder: "rgba(16,185,129,0.30)",
    icon: IconSimilarity,
    steps: [
      { target: ["sim-file1-dropzone", "sim-file2-dropzone"], titleKey: "onb.coach.similarity.s1t", bodyKey: "onb.coach.similarity.s1b", placement: "below" },
      { target: ["sim-submit"],                               titleKey: "onb.coach.similarity.s2t", bodyKey: "onb.coach.similarity.s2b", placement: "right" },
    ],
  },
  {
    key: "generate",
    route: "/dashboard/generate",
    i18n: "generate",
    accent: "#38BDF8",
    accentBg: "rgba(56,189,248,0.10)",
    accentBorder: "rgba(56,189,248,0.30)",
    icon: IconGenerate,
    steps: [
      { target: ["gen-dropzone"],    titleKey: "onb.coach.generate.s1t", bodyKey: "onb.coach.generate.s1b", placement: "below" },
      { target: ["gen-mode-toggle"], titleKey: "onb.coach.generate.s2t", bodyKey: "onb.coach.generate.s2b", placement: "below" },
      { target: ["gen-submit"],      titleKey: "onb.coach.generate.s3t", bodyKey: "onb.coach.generate.s3b", placement: "below" },
    ],
  },
  {
    key: "ai-detection",
    route: "/dashboard/ai-detection",
    i18n: "aidetection",
    accent: "#F59E0B",
    accentBg: "rgba(245,158,11,0.10)",
    accentBorder: "rgba(245,158,11,0.30)",
    icon: IconDetection,
    steps: [
      { target: ["aidetect-dropzone"], titleKey: "onb.coach.aidetection.s1t", bodyKey: "onb.coach.aidetection.s1b", placement: "below" },
    ],
  },
];

/**
 * Extra coaches for sub-pages that aren't top-level modules (so they don't
 * appear in the overview card / replay menu, but still get a first-open coach).
 */
const EXTRA_COACHES: OnboardingModule[] = [
  {
    key: "videos-simple",
    route: "/dashboard/videos/simple",
    i18n: "videosSimple",
    accent: "#6366F1",
    accentBg: "rgba(99,102,241,0.10)",
    accentBorder: "rgba(99,102,241,0.30)",
    icon: IconVideos,
    steps: [
      { target: ["video-dropzone"],              titleKey: "onb.coach.videosSimple.s1t", bodyKey: "onb.coach.videosSimple.s1b", placement: "right" },
      { target: ["video-copies"],                titleKey: "onb.coach.videosSimple.s2t", bodyKey: "onb.coach.videosSimple.s2b", placement: "right" },
      { target: ["video-packs", "video-options"], titleKey: "onb.coach.videosSimple.s3t", bodyKey: "onb.coach.videosSimple.s3b", placement: "right" },
      { target: ["video-submit"],                titleKey: "onb.coach.videosSimple.s4t", bodyKey: "onb.coach.videosSimple.s4b", placement: "right" },
    ],
  },
  {
    key: "videos-advanced",
    route: "/dashboard/videos/advanced",
    i18n: "videosAdvanced",
    accent: "#6366F1",
    accentBg: "rgba(99,102,241,0.10)",
    accentBorder: "rgba(99,102,241,0.30)",
    icon: IconVideos,
    steps: [
      { target: ["vadv-dropzone"], titleKey: "onb.coach.videosAdvanced.s1t", bodyKey: "onb.coach.videosAdvanced.s1b", placement: "right" },
      { target: ["vadv-settings"], titleKey: "onb.coach.videosAdvanced.s2t", bodyKey: "onb.coach.videosAdvanced.s2b", placement: "right" },
      { target: ["vadv-submit"],   titleKey: "onb.coach.videosAdvanced.s3t", bodyKey: "onb.coach.videosAdvanced.s3b", placement: "right" },
    ],
  },
];

/** Every coachable page (top-level modules + sub-page coaches). */
const ALL_COACHES: OnboardingModule[] = [...ONBOARDING_MODULES, ...EXTRA_COACHES];

/** The coach that should run on a given pathname (exact match). */
export function moduleForPath(pathname: string): OnboardingModule | null {
  return ALL_COACHES.find((m) => m.route === pathname) ?? null;
}
