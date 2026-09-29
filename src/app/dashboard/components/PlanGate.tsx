"use client";

/**
 * Verrou CLIENT du plan gratuit — voir src/lib/free-plan.ts pour la règle.
 *
 * Monté une fois dans le layout du dashboard. Fournit :
 *   • usePlanGate().guard(module) — à appeler au clic sur un bouton d'action
 *     (Dupliquer, Générer, Compresser…). Renvoie `true` si l'action peut
 *     continuer ; sinon ouvre la fenêtre « Ce module nécessite un plan » et
 *     renvoie `false`.
 *   • un filet de sécurité : toute réponse 402 { code: "plan_required" } d'une
 *     route API ouvre la même fenêtre, même si un bouton a oublié le guard.
 *
 * La fenêtre mène aux plans (UpgradePlanModal = le sélecteur de plans de l'app,
 * qui lance directement le paiement Stripe).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n/context";
import {
  PLAN_REQUIRED_CODE,
  isFreePlan,
  isLockedModule,
  type LockedModule,
} from "@/lib/free-plan";
import UpgradePlanModal from "./UpgradePlanModal";

type PlanGateValue = {
  /** Plan effectif (invité / impayé résolus). */
  plan: string;
  /** True = plan gratuit : aucune action de production possible. */
  isFree: boolean;
  /** Au clic sur une action : true = on continue, false = fenêtre ouverte. */
  guard: (module: LockedModule) => boolean;
  /** Ouvre la fenêtre sans condition (ex. réponse serveur 402). */
  showPlanRequired: (module: LockedModule) => void;
  /** Ouvre directement le sélecteur de plans. */
  openPlans: () => void;
};

const PlanGateContext = createContext<PlanGateValue>({
  plan: "pro",
  isFree: false,
  guard: () => true,
  showPlanRequired: () => {},
  openPlans: () => {},
});

export function usePlanGate() {
  return useContext(PlanGateContext);
}

/** Détecte le corps d'un refus « plan requis » renvoyé par une route API. */
export function isPlanRequiredPayload(data: unknown): data is { code: string; module?: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { code?: unknown }).code === PLAN_REQUIRED_CODE
  );
}

export function PlanGateProvider({
  plan,
  isGuest,
  overdue = false,
  children,
}: {
  plan: string;
  isGuest: boolean;
  /** Abonné en défaut de paiement (retombé en « free ») : il a DÉJÀ un
   *  abonnement — on l'envoie régulariser, jamais souscrire un second plan. */
  overdue?: boolean;
  children: ReactNode;
}) {
  const isFree = isFreePlan(plan);
  const [lockedModule, setLockedModule] = useState<LockedModule | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);

  const showPlanRequired = useCallback((module: LockedModule) => {
    setPlansOpen(false);
    setLockedModule(module);
  }, []);

  const openPlans = useCallback(() => {
    setLockedModule(null);
    if (overdue) window.location.href = "/dashboard/abonnement";
    else setPlansOpen(true);
  }, [overdue]);

  const guard = useCallback(
    (module: LockedModule) => {
      if (!isFree) return true;
      showPlanRequired(module);
      return false;
    },
    [isFree, showPlanRequired],
  );

  // Filet de sécurité : intercepte les 402 « plan_required » de nos routes API.
  // On lit un CLONE de la réponse : l'appelant garde un corps intact.
  const showRef = useRef(showPlanRequired);
  showRef.current = showPlanRequired;
  useEffect(() => {
    const original = window.fetch;
    const wrapped: typeof window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 402) {
        res
          .clone()
          .json()
          .then((data: unknown) => {
            if (isPlanRequiredPayload(data)) {
              const m = (data as { module?: unknown }).module;
              showRef.current(isLockedModule(m) ? m : "generic");
            }
          })
          .catch(() => {});
      }
      return res;
    };
    window.fetch = wrapped;
    return () => {
      if (window.fetch === wrapped) window.fetch = original;
    };
  }, []);

  const value = useMemo(
    () => ({ plan, isFree, guard, showPlanRequired, openPlans }),
    [plan, isFree, guard, showPlanRequired, openPlans],
  );

  return (
    <PlanGateContext.Provider value={value}>
      {children}
      <PlanRequiredModal
        module={lockedModule}
        isGuest={isGuest}
        onClose={() => setLockedModule(null)}
        onSeePlans={openPlans}
      />
      <UpgradePlanModal open={plansOpen} onClose={() => setPlansOpen(false)} currentPlan="free" />
    </PlanGateContext.Provider>
  );
}

/* ─── Textes par module ───────────────────────────────────────────────────── */

type Copy = { emoji: string; name: string; action: string; perks: string[] };

const COPY: Record<"fr" | "en", Record<LockedModule, Copy>> = {
  fr: {
    video_duplication: {
      emoji: "🎬",
      name: "Duplication vidéo",
      action: "dupliquer tes vidéos",
      perks: [
        "Des copies uniques de chaque vidéo, prêtes à reposter",
        "Chaque fichier est lu comme neuf par les plateformes",
        "Jusqu'à l'illimité selon ton plan",
      ],
    },
    image_duplication: {
      emoji: "🖼️",
      name: "Duplication photo",
      action: "dupliquer tes photos",
      perks: [
        "Des copies uniques de chaque photo, prêtes à reposter",
        "Métadonnées d'appareil réelles sur chaque copie",
        "Jusqu'à l'illimité selon ton plan",
      ],
    },
    ai_auto: {
      emoji: "✨",
      name: "IA automatique",
      action: "laisser l'IA créer tes variantes",
      perks: [
        "L'IA analyse chaque vidéo et fabrique tes duplications",
        "Une recette d'unicité différente pour chaque copie",
        "Tout se règle en discutant, sans rien paramétrer",
      ],
    },
    ai_editor: {
      emoji: "🤖",
      name: "Éditeur IA",
      action: "générer des variantes avec l'Éditeur IA",
      perks: [
        "Claude reproduit le montage de tes meilleures vidéos",
        "Des variantes prêtes à publier en quelques minutes",
        "Rendus inclus dans le quota de ton plan",
      ],
    },
    ai_detection: {
      emoji: "🛡️",
      name: "Détection IA",
      action: "traiter tes fichiers contre la détection IA",
      perks: [
        "Les métadonnées IA (EXIF, C2PA…) effacées de tes fichiers",
        "Une identité d'appareil cohérente sur chaque fichier",
        "Inclus dès le plan Starter",
      ],
    },
    compress: {
      emoji: "📦",
      name: "Compresseur",
      action: "compresser tes vidéos",
      perks: [
        "Des fichiers bien plus légers, sans perte visible",
        "Idéal pour envoyer et publier plus vite",
        "Inclus dans tous les plans",
      ],
    },
    enhance: {
      emoji: "🔆",
      name: "Amélioration",
      action: "améliorer tes fichiers",
      perks: [
        "Qualité et netteté améliorées en un clic",
        "Tes contenus prêts à publier",
        "Inclus dans les plans payants",
      ],
    },
    generate: {
      emoji: "🎨",
      name: "Variation IA",
      action: "générer des visuels avec l'IA",
      perks: [
        "Des variations IA de tes visuels",
        "Crédits IA disponibles avec ton plan",
        "Des résultats prêts à publier",
      ],
    },
    import: {
      emoji: "📥",
      name: "Scraper",
      action: "importer les vidéos d'un compte",
      perks: [
        "Récupère les meilleures vidéos d'un compte en un clic",
        "Envoie-les directement en duplication",
        "Inclus dans les plans payants",
      ],
    },
    similarity: {
      emoji: "🔍",
      name: "Comparateur",
      action: "tester la similarité de tes fichiers",
      perks: [
        "Vérifie que tes copies sont bien uniques",
        "Un score clair avant de publier",
        "Inclus dans les plans payants",
      ],
    },
    manual_editor: {
      emoji: "✂️",
      name: "Éditeur manuel",
      action: "exporter tes retouches",
      perks: [
        "Retouche chaque variante à la main",
        "Exports prêts à publier",
        "Inclus dans les plans payants",
      ],
    },
    api: {
      emoji: "🔌",
      name: "API DuupFlow",
      action: "utiliser l'API",
      perks: [
        "Automatise tes duplications depuis tes outils",
        "Clés API et documentation complète",
        "Réservée au plan Pro",
      ],
    },
    drive: {
      emoji: "☁️",
      name: "Google Drive",
      action: "envoyer tes fichiers vers Google Drive",
      perks: [
        "Tes copies rangées directement dans ton Drive",
        "Import depuis Drive en un clic",
        "Inclus dans les plans payants",
      ],
    },
    generic: {
      emoji: "🔒",
      name: "Ce module",
      action: "utiliser ce module",
      perks: [
        "Tous les modules de DuupFlow débloqués",
        "Duplication vidéo et photo, Éditeur IA, Compresseur…",
        "Sans engagement, annulable à tout moment",
      ],
    },
  },
  en: {
    video_duplication: {
      emoji: "🎬",
      name: "Video duplication",
      action: "duplicate your videos",
      perks: [
        "Unique copies of every video, ready to repost",
        "Each file is read as brand-new by the platforms",
        "Up to unlimited, depending on your plan",
      ],
    },
    image_duplication: {
      emoji: "🖼️",
      name: "Photo duplication",
      action: "duplicate your photos",
      perks: [
        "Unique copies of every photo, ready to repost",
        "Real device metadata on every copy",
        "Up to unlimited, depending on your plan",
      ],
    },
    ai_auto: {
      emoji: "✨",
      name: "Automatic AI",
      action: "let the AI create your variants",
      perks: [
        "The AI analyzes each video and builds your duplicates",
        "A different uniqueness recipe for every copy",
        "Everything is set by chatting — no settings to tweak",
      ],
    },
    ai_editor: {
      emoji: "🤖",
      name: "AI Editor",
      action: "generate variants with the AI Editor",
      perks: [
        "Claude recreates the edit of your best videos",
        "Ready-to-post variants in minutes",
        "Renders included in your plan's quota",
      ],
    },
    ai_detection: {
      emoji: "🛡️",
      name: "AI detection",
      action: "process your files against AI detection",
      perks: [
        "AI metadata (EXIF, C2PA…) wiped from your files",
        "A consistent device identity on every file",
        "Included from the Starter plan",
      ],
    },
    compress: {
      emoji: "📦",
      name: "Compressor",
      action: "compress your videos",
      perks: [
        "Much lighter files, no visible loss",
        "Send and publish faster",
        "Included in every plan",
      ],
    },
    enhance: {
      emoji: "🔆",
      name: "Enhance",
      action: "enhance your files",
      perks: [
        "Better quality and sharpness in one click",
        "Content ready to publish",
        "Included in paid plans",
      ],
    },
    generate: {
      emoji: "🎨",
      name: "AI Variation",
      action: "generate visuals with AI",
      perks: [
        "AI variations of your visuals",
        "AI credits available with your plan",
        "Ready-to-post results",
      ],
    },
    import: {
      emoji: "📥",
      name: "Scraper",
      action: "import videos from an account",
      perks: [
        "Grab an account's best videos in one click",
        "Send them straight to duplication",
        "Included in paid plans",
      ],
    },
    similarity: {
      emoji: "🔍",
      name: "Comparator",
      action: "test your files' similarity",
      perks: [
        "Check that your copies are truly unique",
        "A clear score before you post",
        "Included in paid plans",
      ],
    },
    manual_editor: {
      emoji: "✂️",
      name: "Manual editor",
      action: "export your edits",
      perks: [
        "Touch up each variant by hand",
        "Ready-to-post exports",
        "Included in paid plans",
      ],
    },
    api: {
      emoji: "🔌",
      name: "DuupFlow API",
      action: "use the API",
      perks: [
        "Automate your duplications from your own tools",
        "API keys and full documentation",
        "Pro plan only",
      ],
    },
    drive: {
      emoji: "☁️",
      name: "Google Drive",
      action: "send your files to Google Drive",
      perks: [
        "Your copies saved straight into your Drive",
        "Import from Drive in one click",
        "Included in paid plans",
      ],
    },
    generic: {
      emoji: "🔒",
      name: "This module",
      action: "use this module",
      perks: [
        "Every DuupFlow module unlocked",
        "Video & photo duplication, AI Editor, Compressor…",
        "No commitment, cancel anytime",
      ],
    },
  },
};

function PlanRequiredModal({
  module,
  isGuest,
  onClose,
  onSeePlans,
}: {
  module: LockedModule | null;
  isGuest: boolean;
  onClose: () => void;
  onSeePlans: () => void;
}) {
  const { locale } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!module) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [module, onClose]);

  if (!module || !mounted) return null;

  const en = locale === "en";
  const c = COPY[en ? "en" : "fr"][module];

  const content = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,22,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="plan-required-modal"
    >
      <div
        className="relative w-full max-w-xl rounded-2xl px-8 py-9 sm:px-11 sm:py-10"
        style={{
          background: "var(--app-surface)",
          border: "1px solid var(--app-border)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={en ? "Close" : "Fermer"}
          className="absolute right-4 top-4 h-9 w-9 rounded-xl flex items-center justify-center text-[var(--app-text-muted)] transition hover:text-[var(--app-text)] hover:bg-[var(--app-border)]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center text-[28px]"
            style={{
              background: "linear-gradient(135deg, rgba(79,123,255,0.16), rgba(124,92,255,0.16))",
              border: "1px solid rgba(99,102,241,0.30)",
            }}
          >
            {c.emoji}
          </div>
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ background: "rgba(99,102,241,0.12)", color: "#6366F1" }}
            >
              <span aria-hidden>🔒</span>
              <span>{c.name}</span>
            </span>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-[var(--app-text)]">
              {en ? "This module requires a plan" : "Ce module nécessite un plan"}
            </h2>
          </div>
        </div>

        <p className="mt-6 text-[15px] leading-relaxed text-[var(--app-text-muted)]">
          {isGuest
            ? en
              ? <>Your workspace is on the free plan. To {c.action}, the workspace owner needs to pick a plan.</>
              : <>Ton espace d&apos;équipe est sur le plan gratuit. Pour {c.action}, le propriétaire de l&apos;espace doit choisir un plan.</>
            : en
              ? <>Your free account lets you explore all of DuupFlow. To <strong className="text-[var(--app-text)]">{c.action}</strong>, choose a plan.</>
              : <>Ton compte gratuit te permet d&apos;explorer tout DuupFlow. Pour <strong className="text-[var(--app-text)]">{c.action}</strong>, choisis un plan.</>}
        </p>

        <div
          className="mt-6 rounded-2xl p-5"
          style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6366F1]">
            {en ? "With a plan" : "Avec un plan"}
          </p>
          <ul className="mt-3 space-y-2.5">
            {c.perks.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-[var(--app-text)]">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#10B981" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-3 text-sm font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
            style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
          >
            {en ? "Keep exploring" : "Continuer à explorer"}
          </button>
          {!isGuest && (
            <button
              type="button"
              onClick={onSeePlans}
              className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#4f7bff,#7c5cff)", boxShadow: "0 8px 26px rgba(99,102,241,0.35)" }}
            >
              {en ? "See plans →" : "Voir les plans →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
