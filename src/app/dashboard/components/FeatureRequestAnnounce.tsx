"use client";

/**
 * Annonce de la case « Amélioration » — une seule fois par compte.
 *
 * 1. Popup d'explication → « J'ai compris ! »
 * 2. Comme l'onboarding : la case est entourée dans la sidebar, avec une bulle
 *    « c'est ici ». Sur mobile (sidebar repliée), l'étape 2 est sautée.
 *
 * Qui la voit : décidé côté serveur (layout). « Vue » est enregistrée à la FIN
 * (bulle fermée), pas avant : la server action re-rend le layout, qui retire
 * ce composant — l'enregistrer au « J'ai compris ! » tuait la bulle.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { markOnboardingSeen } from "../actions/onboarding";
import { ANNONCE_AMELIORATION } from "@/lib/launch";
import { getRect, placeNear, CARD_W, type Rect } from "../onboarding/spotlight";
import { OPEN_IDEA_EVENT } from "./FeatureRequestModal";

const TARGET = "sidebar-amelioration";
const ACCENT = "#6366F1";

export default function FeatureRequestAnnounce() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"modal" | "spot" | "done">("modal");
  const [shown, setShown] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const marked = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(id);
  }, []);

  // Étape 2 : suivre la position de la case (redimensionnement, scroll).
  useEffect(() => {
    if (phase !== "spot") return;
    const update = () => setRect(getRect([TARGET]));
    const first = getRect([TARGET]);
    if (!first) { setPhase("done"); return; } // sidebar non visible (mobile)
    setRect(first);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [phase]);

  useEffect(() => {
    if (phase !== "done" || marked.current) return;
    marked.current = true;
    void markOnboardingSeen(ANNONCE_AMELIORATION).catch(() => {});
  }, [phase]);

  function understood() {
    setShown(false);
    setTimeout(() => setPhase("spot"), 200);
  }

  if (phase === "done") return null;

  if (phase === "spot") {
    if (!rect) return null;
    const PAD = 6;
    const pos = placeNear(rect, "right");
    return (
      <>
        <div className="fixed inset-0 z-[98] bg-black/30" onClick={() => setPhase("done")} />
        <div
          className="pointer-events-none fixed z-[99] rounded-xl"
          style={{
            top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            boxShadow: `0 0 0 2px ${ACCENT}, 0 0 0 6px ${ACCENT}33, 0 0 28px ${ACCENT}66`,
            background: "var(--app-sidebar)",
          }}
        />
        {/* La case elle-même reste cliquable au-dessus du voile. */}
        <button
          type="button"
          aria-label={t("dashboard.featureAnnounce.spotTry")}
          onClick={() => { setPhase("done"); window.dispatchEvent(new Event(OPEN_IDEA_EVENT)); }}
          className="fixed z-[100] flex items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--app-text)]"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6" /><path d="M10 22h4" />
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
          </svg>
          {rect.width > 80 && <span>{t("dashboard.sidebar.amelioration")}</span>}
        </button>
        <div className="fixed z-[100]" style={{ top: pos.top, left: pos.left, width: CARD_W, maxWidth: "calc(100vw - 32px)" }}>
          <div className="rounded-2xl p-5" style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", boxShadow: "0 24px 70px rgba(0,0,0,0.45)" }}>
            <h3 className="mb-1.5 text-base font-semibold tracking-tight text-[var(--app-text)]">{t("dashboard.featureAnnounce.spotTitle")}</h3>
            <p className="mb-4 text-[13px] leading-relaxed text-[var(--app-text-muted)]">{t("dashboard.featureAnnounce.spotBody")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPhase("done")}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-bg-2)]"
                style={{ border: "1px solid var(--app-border)" }}
              >
                {t("dashboard.featureAnnounce.spotOk")}
              </button>
              <button
                onClick={() => { setPhase("done"); window.dispatchEvent(new Event(OPEN_IDEA_EVENT)); }}
                className="flex-1 rounded-xl py-2 text-xs font-semibold text-white transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
              >
                {t("dashboard.featureAnnounce.spotTry")}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const points = [
    { ic: "✍️", t: t("dashboard.featureAnnounce.p1t"), d: t("dashboard.featureAnnounce.p1d") },
    { ic: "👀", t: t("dashboard.featureAnnounce.p2t"), d: t("dashboard.featureAnnounce.p2d") },
    { ic: "🚀", t: t("dashboard.featureAnnounce.p3t"), d: t("dashboard.featureAnnounce.p3d") },
  ];

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl transition-all duration-200 ${shown ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-60"
          style={{ background: "radial-gradient(640px 240px at 50% -40px, rgba(99,102,241,.20), transparent 70%)" }}
        />
        <div className="relative px-6 pb-9 pt-10 text-center sm:px-12">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold uppercase tracking-wider" style={{ background: "rgba(99,102,241,.14)", color: ACCENT }}>
            💡 {t("dashboard.featureAnnounce.badge")}
          </span>
          <div className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-2xl text-3xl shadow-md" style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}>
            💡
          </div>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-[var(--app-text)] sm:text-[34px]">{t("dashboard.featureAnnounce.title")}</h2>
          <p className="mx-auto mt-2.5 max-w-xl text-[15px] leading-relaxed text-[var(--app-text-muted)]">{t("dashboard.featureAnnounce.lead")}</p>

          <div className="mt-7 grid gap-3 text-left sm:grid-cols-3">
            {points.map((p) => (
              <div key={p.t} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-2)] px-4 py-4">
                <span className="text-2xl">{p.ic}</span>
                <div className="mt-2 text-[14px] font-bold text-[var(--app-text)]">{p.t}</div>
                <div className="mt-1 text-[12.5px] leading-snug text-[var(--app-text-faint)]">{p.d}</div>
              </div>
            ))}
          </div>

          <button
            onClick={understood}
            className="mt-8 inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)", boxShadow: "0 6px 24px rgba(99,102,241,.35)" }}
          >
            {t("dashboard.featureAnnounce.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
