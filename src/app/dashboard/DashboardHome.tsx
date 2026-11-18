"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n/context";
import VariationAnnouncementModal from "./VariationAnnouncementModal";
import TikTokAnnouncementModal, { TIKTOK_DEST, TIKTOK_SEEN_KEY } from "./TikTokAnnouncementModal";
import StarterAnnounceModal, { STARTER_SEEN_KEY } from "./StarterAnnounceModal";
import ReplayMenu from "./onboarding/ReplayMenu";
import PromoPopup from "./PromoPopup";
import ActivityDashboard from "./home/ActivityDashboard";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

/* ─── News Modal ─── */
function NewsModal({ onClose }: { onClose: () => void }) {
  const { t, locale } = useTranslation();

  // Textes FR/EN : l'ancienne version était en dur, en français sans accents.
  // La mise à jour « Textes & Duplication IA » passe en tête et réutilise les
  // textes de son pop-up d'annonce (dashboard.updateNov.*).
  const fr = locale === "fr";
  const L = (a: string, b: string) => (fr ? a : b);
  const NEWS_SECTIONS = [
    {
      title: t("dashboard.updateNov.badge"),
      color: "#6366F1",
      items: [
        ...(process.env.NEXT_PUBLIC_AI_AUTO_BETA === "1" ? [{ name: t("dashboard.updateNov.f1t"), desc: t("dashboard.updateNov.f1d"), detail: "" }] : []),
        { name: t("dashboard.updateNov.f2t"), desc: t("dashboard.updateNov.f2d"), detail: "" },
        { name: t("dashboard.updateNov.f3t"), desc: t("dashboard.updateNov.f3d"), detail: "" },
        { name: t("dashboard.updateNov.f4t"), desc: t("dashboard.updateNov.f4d"), detail: "" },
      ],
    },
    {
      title: t("dashboard.home.moduleVideos"),
      color: "#0EA5E9",
      items: [
        { name: L("Priorité d'algorithme", "Algorithm priority"), desc: L("Simule un vrai iPhone (métadonnées Apple, .mov)", "Simulates a real iPhone (Apple metadata, .mov)"), detail: "" },
        { name: L("Pixel magique", "Magic pixel"), desc: L("Bruit imperceptible pour une empreinte unique", "Invisible noise for a unique fingerprint"), detail: "" },
        { name: L("Métadonnées technique", "Technical metadata"), desc: L("Débit, GOP, FPS et profil H.264 aléatoires", "Random bitrate, GOP, FPS and H.264 profile"), detail: "" },
        { name: L("Localisation pays", "Country location"), desc: L("Le pays inscrit dans les métadonnées", "The country written into the metadata"), detail: "" },
        { name: L("Qualité d'origine préservée", "Original quality kept"), desc: L("Plus de limite à 1920 px : la 4K reste en 4K", "No more 1920 px cap: 4K stays 4K"), detail: "" },
      ],
    },
    {
      title: t("dashboard.home.moduleImages"),
      color: "#C026D3",
      items: [
        { name: L("Priorité d'algorithme", "Algorithm priority"), desc: L("EXIF Apple authentiques (appareil, GPS, focale)", "Authentic Apple EXIF (device, GPS, focal length)"), detail: "" },
        { name: L("Localisation pays", "Country location"), desc: L("Le pays inscrit dans l'EXIF", "The country written into the EXIF"), detail: "" },
      ],
    },
    {
      title: t("dashboard.home.moduleComparateur"),
      color: "#10B981",
      items: [
        { name: L("Analyse des métadonnées", "Metadata analysis"), desc: L("Compare les métadonnées exactes de deux fichiers", "Compares the exact metadata of two files"), detail: "" },
        { name: L("Score de similarité", "Similarity score"), desc: L("Le pourcentage de ressemblance", "How alike the two files are, in percent"), detail: "" },
        { name: L("Glisser-déposer", "Drag & drop"), desc: L("Glisse tes fichiers directement", "Drop your files straight in"), detail: "" },
      ],
    },
    {
      title: t("dashboard.sidebar.support"),
      color: "#F59E0B",
      items: [
        { name: L("Chatbot", "Chatbot"), desc: L("Toute l'aide en un clic, avec recherche", "All the help in one click, with search"), detail: "" },
        { name: L("Page Aide", "Help page"), desc: L("La doc de chaque module, les problèmes fréquents, Telegram et email", "Every module's guide, common problems, Telegram and email"), detail: "" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(6,9,24,0.88)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "var(--app-surface)",
          border: "1px solid rgba(56,189,248,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(56,189,248,0.10)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--app-text)] tracking-tight">{t("dashboard.home.newsTitle")}</h2>
            <p className="text-xs text-[var(--app-text-faint)] mt-1">{t("dashboard.home.newsSubtitle")}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--app-text-faint)] hover:text-[var(--app-text-muted)] transition h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--app-surface)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
          {/* Featured: TikTok solution — permanent entry. Plain <a> = full nav so the
              redirect can't be cancelled by closing the modal (App-Router gotcha). */}
          <a
            href={TIKTOK_DEST}
            className="block rounded-xl p-4 transition hover:opacity-95"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.16), rgba(56,189,248,0.12))",
              border: "1px solid rgba(56,189,248,0.30)",
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                style={{ background: "linear-gradient(90deg,#6366F1,#38BDF8)" }}
              >
                {t("dashboard.tiktokAnnounce.pill")}
              </span>
              <span className="text-sm font-semibold text-[var(--app-text)]">{t("dashboard.tiktokAnnounce.newsTitle")}</span>
            </div>
            <p className="text-[13px] text-[var(--app-text-muted)] leading-relaxed">{t("dashboard.tiktokAnnounce.newsBody")}</p>
            <span className="mt-2 inline-block text-[12px] font-semibold text-sky-300">
              {t("dashboard.tiktokAnnounce.cta")} →
            </span>
          </a>

          {NEWS_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3
                className="text-sm font-semibold mb-3 flex items-center gap-2"
                style={{ color: section.color }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: section.color }}
                />
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-lg px-4 py-3 text-sm"
                    style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
                  >
                    <div>
                      <span className="font-medium text-[var(--app-text-muted)]">{item.name}</span>
                      <span className="text-[var(--app-text-faint)]"> — {item.desc}</span>
                    </div>
                    {item.detail && (
                      <p className="mt-1.5 text-xs text-[var(--app-text-faint)] leading-relaxed">{item.detail}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardHome({
  firstName,
  agencyName,
  variationAnnouncementPending = false,
  tiktokAnnouncementPending = false,
  effectivePlan = "free",
  starterAnnounceEligible = false,
  promoEligible = false,
  promoLoginKey = null,
}: {
  firstName: string | null;
  agencyName: string | null;
  /** True only for legacy users (variation_ia_announced_at IS NULL). */
  variationAnnouncementPending?: boolean;
  /** True while tiktok_announce_seen_at IS NULL (one-shot TikTok launch pop-up). */
  tiktokAnnouncementPending?: boolean;
  /** User's effective plan, used by the announcement modal. */
  effectivePlan?: "free" | "starter" | "solo" | "pro" | "agency";
  /** True ONLY for genuinely free users (comp-Pro / guests / paying excluded) →
   *  gates the one-shot Starter launch pop-up. */
  starterAnnounceEligible?: boolean;
  /** True for activated free users → shows the -15% launch promo pop-up. */
  promoEligible?: boolean;
  /** Changes on every sign-in (last_sign_in_at) so the promo re-shows per login. */
  promoLoginKey?: string | null;
  /** True ONLY for users who existed before the affiliate-program launch →
   *  gates the one-shot affiliate announcement (new signups never see it). */
}) {
  const [showReplay, setShowReplay] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [showVariationAnnouncement, setShowVariationAnnouncement] = useState(
    variationAnnouncementPending,
  );
  // TikTok pop-up: gated by the server flag AND a localStorage guard (so it never
  // re-loops in local/dev before migration 034 runs). Init false → set in effect
  // to avoid an SSR/hydration mismatch on the localStorage read.
  const [showTikTok, setShowTikTok] = useState(false);
  useEffect(() => {
    if (tiktokAnnouncementPending && localStorage.getItem(TIKTOK_SEEN_KEY) !== "1") {
      setShowTikTok(true);
    }
  }, [tiktokAnnouncementPending]);
  const closeTikTok = () => {
    try { localStorage.setItem(TIKTOK_SEEN_KEY, "1"); } catch {}
    setShowTikTok(false);
  };

  // Starter-plan launch pop-up — FREE users only, shown once (localStorage guard).
  // Deferred if another one-shot announcement is due, so pop-ups never stack.
  const [showStarter, setShowStarter] = useState(false);
  useEffect(() => {
    // Free users ONLY — comp-Pro, guests and paying users are excluded upstream
    // (starterAnnounceEligible), so a paying user never sees this pop-up.
    if (!starterAnnounceEligible) return;
    const tiktokWillShow = tiktokAnnouncementPending && localStorage.getItem(TIKTOK_SEEN_KEY) !== "1";
    if (variationAnnouncementPending || tiktokWillShow) return;
    if (localStorage.getItem(STARTER_SEEN_KEY) !== "1") setShowStarter(true);
  }, [starterAnnounceEligible, variationAnnouncementPending, tiktokAnnouncementPending]);


  const { t } = useTranslation();

  return (
    <div className="p-4 sm:p-8 w-full">

      {/* Header — les actions sont sur la ligne du « Bonjour », à droite. */}
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-medium text-[var(--app-text-faint)] tracking-[0.14em] uppercase mb-2">
          {agencyName ?? t("dashboard.home.dashboard")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--app-text)] tracking-tight">
            {firstName ? (
              <>{t("dashboard.home.bonjour")} <span className={G}>{firstName}</span></>
            ) : (
              <>{t("dashboard.home.tableauDeBord")}</>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/dashboard/support" className="dash-btn">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              {t("dashboard.docs.button")}
            </a>
            <button type="button" onClick={() => setShowNews(true)} className="dash-btn">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-sky-500" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M13 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM5 5h6M5 8h6M5 11h3" />
              </svg>
              {t("dashboard.home.nouveautes")}
            </button>
            <button type="button" onClick={() => setShowReplay(true)} className="dash-btn">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 8a6 6 0 1 1 1.8 4.3" />
                <path d="M2 12V9h3" />
              </svg>
              {t("onb.replayCta")}
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-sm text-[var(--app-text-faint)]">{t("dashboard.home.homeSubtitle")}</p>
      </div>

      {/* Activité de l'équipe : courbes, journal, temps économisé. */}
      <ActivityDashboard />

      {/* Replay menu — re-open the overview or any module coach on demand. */}
      {showReplay && <ReplayMenu onClose={() => setShowReplay(false)} />}

      {/* News modal */}
      {showNews && <NewsModal onClose={() => setShowNews(false)} />}

      {/* One-shot AI Variation launch announcement (legacy users only) */}
      {showVariationAnnouncement && (
        <VariationAnnouncementModal
          plan={effectivePlan}
          onDone={() => setShowVariationAnnouncement(false)}
        />
      )}

      {/* One-shot TikTok solution launch announcement */}
      {showTikTok && <TikTokAnnouncementModal onDone={closeTikTok} />}
      {showStarter && <StarterAnnounceModal onDone={() => setShowStarter(false)} />}


      {/* -15% launch promo — activated free users only (slides in from the right). */}
      {promoEligible && <PromoPopup loginKey={promoLoginKey} />}
    </div>
  );
}
