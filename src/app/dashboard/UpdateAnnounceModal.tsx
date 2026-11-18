"use client";

/**
 * Annonce de la mise à jour « Textes & Duplication IA » (novembre 2026) —
 * une seule fois par compte, aux comptes créés AVANT la mise en ligne
 * (MAJ_TEXTES_DEPUIS, src/lib/launch.ts).
 *
 * Même mécanique que ClaudeBuiltinAnnounceModal : « vue » est enregistré à la
 * FERMETURE (profiles.onboarding_progress), jamais à l'affichage.
 *
 * Le visuel est animé en CSS pur (aucune vidéo à charger) et montre les
 * nouveautés EN ACTION : une caption qu'on glisse à la souris et qui s'aimante
 * au centre, des sous-titres karaoké, et trois copies au style différent.
 * prefers-reduced-motion → tout est figé dans son état final.
 *
 * La carte « Duplication IA » n'apparaît que si la beta est ouverte
 * (NEXT_PUBLIC_AI_AUTO_BETA=1) : on n'annonce pas une page invisible.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { markOnboardingSeen } from "./actions/onboarding";
import { ANNONCE_MAJ_TEXTES } from "@/lib/launch";
import { startUpdateTour } from "./onboarding/UpdateTour";

const AI_DUP_OPEN = process.env.NEXT_PUBLIC_AI_AUTO_BETA === "1";

const CSS = `
@keyframes upd-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes upd-pop { 0% { opacity: 0; transform: translate(-50%,0) scale(.6) } 70% { opacity: 1; transform: translate(-50%,0) scale(1.06) } 100% { opacity: 1; transform: translate(-50%,0) scale(1) } }
@keyframes upd-fan-l { from { opacity: 0; transform: translateX(60px) rotate(0) scale(.9) } to { opacity: 1; transform: translateX(0) rotate(-8deg) scale(.86) } }
@keyframes upd-fan-r { from { opacity: 0; transform: translateX(-60px) rotate(0) scale(.9) } to { opacity: 1; transform: translateX(0) rotate(8deg) scale(.86) } }
@keyframes upd-phone { from { opacity: 0; transform: translateY(18px) scale(.94) } to { opacity: 1; transform: none } }
/* La caption est glissée vers le haut puis s'aimante au centre (boucle 6 s). */
@keyframes upd-drag { 0%, 22% { top: 56% } 48%, 100% { top: 17% } }
@keyframes upd-cursor {
  0%, 12% { opacity: 0; top: 63%; left: 66% }
  20% { opacity: 1; top: 60%; left: 60% }
  48% { opacity: 1; top: 21%; left: 60% }
  62% { opacity: 1; top: 21%; left: 60% }
  72%, 100% { opacity: 0; top: 24%; left: 72% }
}
@keyframes upd-snap { 0%, 44% { opacity: 0 } 48%, 64% { opacity: 1 } 72%, 100% { opacity: 0 } }
/* Karaoké : un mot s'allume après l'autre (boucle 2,4 s). */
@keyframes upd-kara { 0%, 30% { color: #ffd84d } 34%, 100% { color: #fff } }
@keyframes upd-shine { 0% { transform: translateX(-120%) } 60%, 100% { transform: translateX(220%) } }
@keyframes upd-glow { 0%, 100% { opacity: .55 } 50% { opacity: .9 } }
.upd-rise { animation: upd-rise .6s cubic-bezier(.2,.8,.2,1) both }
.upd-phone { animation: upd-phone .7s cubic-bezier(.2,.8,.2,1) .15s both }
.upd-fan-l { animation: upd-fan-l .8s cubic-bezier(.2,.8,.2,1) .55s both }
.upd-fan-r { animation: upd-fan-r .8s cubic-bezier(.2,.8,.2,1) .65s both }
.upd-pop { animation: upd-pop .5s cubic-bezier(.2,.8,.2,1) both }
.upd-drag { animation: upd-drag 6s cubic-bezier(.65,0,.35,1) 1.4s infinite both }
.upd-cursor { animation: upd-cursor 6s cubic-bezier(.65,0,.35,1) 1.4s infinite both }
.upd-snap { animation: upd-snap 6s linear 1.4s infinite both }
.upd-kara > span { animation: upd-kara 2.4s steps(1) infinite }
.upd-shine { animation: upd-shine 3.2s ease-in-out 1.6s infinite }
.upd-glow { animation: upd-glow 4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) {
  .upd-rise, .upd-phone, .upd-fan-l, .upd-fan-r, .upd-pop, .upd-shine, .upd-glow, .upd-kara > span { animation: none !important }
  .upd-fan-l { transform: rotate(-8deg) scale(.86) } .upd-fan-r { transform: rotate(8deg) scale(.86) }
  .upd-pop { transform: translate(-50%,0) }
  .upd-drag { animation: none !important; top: 20% !important } .upd-cursor, .upd-snap { display: none }
}
`;

const SCENES = [
  "linear-gradient(165deg,#e9d5c8 0%,#c79c86 48%,#5d4337 100%)",
  "linear-gradient(165deg,#cfd9ea 0%,#8ea2c4 48%,#3f5174 100%)",
  "linear-gradient(165deg,#d4e6da 0%,#8db29c 48%,#3f5f4f 100%)",
];

/** Faux téléphone 9:16 avec une silhouette (la « vidéo »). */
function Phone({ w, scene, className = "", style, children }: { w: number; scene: number; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[18px] ring-1 ring-black/10 ${className}`}
      style={{ width: w, aspectRatio: "9 / 16", background: SCENES[scene], boxShadow: "0 24px 48px -20px rgba(20,24,60,.55)", ...style }}
    >
      <div className="absolute left-1/2 top-[34%] h-[15%] w-[25%] -translate-x-1/2 rounded-full bg-white/35" />
      <div className="absolute bottom-0 left-1/2 h-[36%] w-[64%] -translate-x-1/2 rounded-t-[999px] bg-white/25" />
      {children}
    </div>
  );
}

function Feature({ icon, title, desc, delay, beta }: { icon: React.ReactNode; title: string; desc: string; delay: number; beta?: string }) {
  return (
    <div className="upd-rise flex gap-3.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-2)] p-4" style={{ animationDelay: `${delay}s` }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-indigo-500" style={{ background: "rgba(99,102,241,.12)" }}>{icon}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-[var(--app-text)]">
          {title}
          {beta && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-500" style={{ background: "rgba(99,102,241,.14)" }}>{beta}</span>}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--app-text-muted)]">{desc}</p>
      </div>
    </div>
  );
}

const ic = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

export default function UpdateAnnounceModal() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(true);
  const [shown, setShown] = useState(false);
  const marked = useRef(false);

  useEffect(() => {
    // setTimeout plutôt que rAF : rAF est suspendu tant que l'onglet est caché.
    const id = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(id);
  }, []);

  const close = () => {
    if (!marked.current) {
      marked.current = true;
      void markOnboardingSeen(ANNONCE_MAJ_TEXTES).catch(() => {});
    }
    setShown(false);
    setTimeout(() => setMounted(false), 220);
  };

  if (!mounted) return null;

  const kara = t("dashboard.updateNov.demoKaraoke").split(" ");
  const features = [
    ...(AI_DUP_OPEN ? [{ icon: ic(<path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />), title: t("dashboard.updateNov.f1t"), desc: t("dashboard.updateNov.f1d"), beta: "Beta" }] : []),
    { icon: ic(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 15h4M13 15h4M7 11h10" /></>), title: t("dashboard.updateNov.f2t"), desc: t("dashboard.updateNov.f2d"), beta: "Beta" },
    { icon: ic(<><path d="M4 6h16M4 12h10M4 18h7" /><path d="m16 16 2 2 4-4" /></>), title: t("dashboard.updateNov.f3t"), desc: t("dashboard.updateNov.f3d") },
    { icon: ic(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>), title: t("dashboard.updateNov.f4t"), desc: t("dashboard.updateNov.f4d") },
  ];

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="upd-title">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`} onClick={close} />

      <div
        className={`relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl transition-all duration-300 ${shown ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[.97] opacity-0"}`}
      >
        <button
          onClick={close}
          aria-label={t("dashboard.updateNov.later")}
          className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full text-[var(--app-text-muted)] transition hover:bg-[var(--app-bg-2)] hover:text-[var(--app-text)]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        {/* ── Scène animée ── */}
        <div className="relative overflow-hidden px-6 pt-9 sm:px-10" style={{ background: "linear-gradient(180deg, rgba(99,102,241,.10), transparent 85%)" }}>
          <div className="upd-glow pointer-events-none absolute left-1/2 top-6 h-64 w-[520px] -translate-x-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(129,140,248,.45), rgba(236,72,153,.18), transparent)" }} />

          <div className="relative text-center">
            <span className="upd-rise inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold uppercase tracking-wider text-indigo-500" style={{ background: "rgba(99,102,241,.14)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> {t("dashboard.updateNov.badge")}
            </span>
            <h2 id="upd-title" className="upd-rise mt-4 text-[28px] font-extrabold leading-tight tracking-tight text-[var(--app-text)] sm:text-[34px]" style={{ animationDelay: ".08s" }}>
              {t("dashboard.updateNov.title")}
            </h2>
            <p className="upd-rise mx-auto mt-2.5 max-w-xl text-[15px] leading-relaxed text-[var(--app-text-muted)]" style={{ animationDelay: ".16s" }}>
              {t("dashboard.updateNov.lead")}
            </p>
          </div>

          {/* Trois copies : au centre la démo (glisser + karaoké), autour deux copies au style différent */}
          <div className="relative mx-auto mt-6 flex h-[268px] items-end justify-center" aria-hidden>
            <Phone w={118} scene={1} className="upd-fan-l -mr-8 mb-3 origin-bottom">
              <div className="upd-pop absolute left-1/2 top-[18%] w-max max-w-[84%] rounded-[10px] bg-[#111] px-2.5 py-1 text-center text-[9.5px] font-semibold leading-tight text-white" style={{ animationDelay: "1.2s" }}>
                {t("dashboard.updateNov.demoCap2")}
              </div>
              <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 text-[13px] font-extrabold uppercase text-white" style={{ WebkitTextStroke: "2px #000", paintOrder: "stroke fill" }}>{kara[kara.length - 1]}</div>
            </Phone>

            <Phone w={146} scene={0} className="upd-phone relative z-10">
              {/* repère d'aimantation au centre */}
              <div className="upd-snap absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-pink-500/90" />
              {/* caption qu'on déplace */}
              <div className="upd-drag absolute left-0 right-0">
                <div className="upd-pop absolute left-1/2 w-max max-w-[82%] rounded-[7px] bg-white px-2.5 py-1.5 text-center text-[10.5px] font-semibold leading-tight text-[#111] shadow-sm ring-2 ring-pink-500/80" style={{ animationDelay: ".9s" }}>
                  {t("dashboard.updateNov.demoCap1")}
                </div>
              </div>
              {/* curseur */}
              <svg viewBox="0 0 24 24" className="upd-cursor absolute h-5 w-5 drop-shadow" aria-hidden>
                <path d="M5 3l14 7-6 2-2 6L5 3z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              {/* sous-titres karaoké */}
              <div className="upd-kara absolute bottom-[20%] left-1/2 flex -translate-x-1/2 gap-1 whitespace-nowrap text-[12.5px] font-extrabold uppercase text-white" style={{ WebkitTextStroke: "2.4px #000", paintOrder: "stroke fill" }}>
                {kara.map((w, i) => <span key={i} style={{ animationDelay: `${(i * 2.4) / kara.length}s` }}>{w}</span>)}
              </div>
            </Phone>

            <Phone w={118} scene={2} className="upd-fan-r -ml-8 mb-3 origin-bottom">
              <div className="upd-pop absolute left-1/2 top-[18%] w-max max-w-[84%] px-2 py-0.5 text-center text-[10px] font-bold leading-tight text-[#111]" style={{ background: "#ffd84d", fontFamily: "Poppins, ui-sans-serif", animationDelay: "1.35s" }}>
                {t("dashboard.updateNov.demoCap3")}
              </div>
              <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold text-white" style={{ background: "#ff3b6b" }}>{t("dashboard.updateNov.demoKaraoke")}</div>
            </Phone>
          </div>
        </div>

        {/* ── Nouveautés ── */}
        <div className="px-6 pb-7 pt-6 sm:px-10">
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((f, i) => <Feature key={f.title} {...f} delay={0.5 + i * 0.08} />)}
          </div>

          <div className="upd-rise mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4" style={{ animationDelay: ".85s" }}>
            <Link
              href="/dashboard/videos/simple"
              onClick={() => { startUpdateTour("captions"); close(); }}
              className="relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-6 py-3 text-[14.5px] font-semibold text-white transition hover:brightness-110"
              style={{ background: "linear-gradient(180deg,#6366F1,#4F46E5 55%,#4338CA)", boxShadow: "0 10px 28px -10px rgba(79,70,229,.8), inset 0 1px 0 rgba(255,255,255,.35)" }}
            >
              <span className="upd-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/25" />
              {t("dashboard.updateNov.cta")}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
            </Link>
            {AI_DUP_OPEN && (
              <Link
                href="/dashboard/videos"
                onClick={() => { startUpdateTour("aidup"); close(); }}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-3 text-[14px] font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-bg-2)]"
              >
                {t("dashboard.updateNov.cta2")}
              </Link>
            )}
            <button onClick={close} className="px-2 py-2 text-[13px] font-medium text-[var(--app-text-faint)] transition hover:text-[var(--app-text-muted)]">
              {t("dashboard.updateNov.later")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
