"use client";

import Link from "@/components/LocaleLink";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { BLUE, CTA_GRAD, Label, NavPill, Footer, SmoothScroll, Brand, FlipInner } from "@/components/landing/shell";

/* ══════════════════════════════════════════════════════════════
 * LANDING — refonte façon template "Lunera" (thème clair, Geist).
 * Design reproduit ; contenu 100% DuupFlow.
 * Nav / Footer / SmoothScroll / Label / tokens → @/components/landing/shell
 * ══════════════════════════════════════════════════════════════ */

/* Locale courante ("fr" par défaut, "en" sur /en) — pour le contenu bilingue. */
function useLocale(): "fr" | "en" {
  const params = useParams();
  const l = Array.isArray(params?.locale) ? params?.locale[0] : params?.locale;
  return l === "en" ? "en" : "fr";
}

/* ─── Icônes réseaux qui flottent tranquillement dans le hero ─── */
const FLOAT_SOCIALS = [
  { key: "ig", pos: "left-[9%] top-[30%]", anim: "lunera-float-a", delay: "0s", src: "/instagram%20(1)%20copie.png", alt: "Instagram" },
  { key: "tt", pos: "left-[16%] top-[64%]", anim: "lunera-float-c", delay: "1.4s", src: "/tik-tok%20copie.png", alt: "TikTok" },
  { key: "yt", pos: "right-[9%] top-[28%]", anim: "lunera-float-b", delay: "0.6s", src: "/youtube%20copie.png", alt: "YouTube" },
  { key: "x", pos: "right-[15%] top-[62%]", anim: "lunera-float-a", delay: "2s", src: "/twitter%20copie.png", alt: "X" },
  { key: "rd", pos: "left-[26%] top-[20%]", anim: "lunera-float-b", delay: "1s", src: "/reddit%20copie.png", alt: "Reddit" },
  { key: "th", pos: "right-[25%] top-[19%]", anim: "lunera-float-c", delay: "2.6s", src: "/threads%20copie.png", alt: "Threads" },
];
function FloatingSocials() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] hidden lg:block">
      {FLOAT_SOCIALS.map((s) => (
        <div key={s.key}
          className={`absolute ${s.pos} ${s.anim} flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_16px_40px_rgba(20,40,90,0.14)] ring-1 ring-black/[0.05]`}
          style={{ animationDelay: s.delay }}>
          <img src={s.src} alt={s.alt} className="h-10 w-10 object-contain" />
        </div>
      ))}
    </div>
  );
}

/* ─── HERO ─── */
function Hero() {
  const en = useLocale() === "en";
  return (
    <section className="relative overflow-hidden pb-14">
      {/* Fond : blanc en haut (titre/nav), bleu ciel plus bas + vague "glass" animée */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* base : blanc en haut → bleu ciel au milieu → clair en bas (transition propre) */}
        {/* champ bleu → violet (même dégradé que le fond de page, continuité avec la vague) */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #b8d0ff 0%, #c6bcf5 100%)" }} />
        {/* voile blanc en haut (zone titre) qui se fond vers le champ coloré */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#ffffff 0%,#ffffff 34%,rgba(255,255,255,0) 60%)" }} />
        {/* halos (couleurs logo) */}
        <div className="lunera-blob-1 absolute bottom-[60px] left-[2%] h-[360px] w-[520px] rounded-full" style={{ background: "radial-gradient(circle, rgba(79,123,255,0.30), transparent 62%)", filter: "blur(60px)" }} />
        <div className="lunera-blob-2 absolute bottom-[30px] left-[36%] h-[400px] w-[560px] rounded-full" style={{ background: "radial-gradient(circle, rgba(124,92,255,0.22), transparent 62%)", filter: "blur(66px)" }} />
        <div className="lunera-blob-3 absolute bottom-[70px] right-[2%] h-[360px] w-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(120,190,255,0.30), transparent 62%)", filter: "blur(58px)" }} />
        {/* vague arrière (profondeur, floue) */}
        <div className="lunera-wave-x absolute bottom-[0px] left-0 h-[430px] w-[200%]"
          style={{ filter: "blur(11px)", opacity: 0.5, animationDuration: "26s", maskImage: "linear-gradient(to bottom,transparent 10%,#000 26%,#000 64%,transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom,transparent 10%,#000 26%,#000 64%,transparent 100%)" }}>
          <svg viewBox="0 0 2880 430" preserveAspectRatio="none" className="h-full w-full">
            <defs><linearGradient id="lwb" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#7bb8ff" /><stop offset="12.5%" stopColor="#4f7bff" /><stop offset="25%" stopColor="#6a4de0" /><stop offset="37.5%" stopColor="#4f7bff" /><stop offset="50%" stopColor="#7bb8ff" /><stop offset="62.5%" stopColor="#4f7bff" /><stop offset="75%" stopColor="#6a4de0" /><stop offset="87.5%" stopColor="#4f7bff" /><stop offset="100%" stopColor="#7bb8ff" /></linearGradient></defs>
            <path d="M0,160 C300,70 540,70 780,150 C1020,230 1260,240 1440,160 C1680,70 1920,70 2160,160 C2400,240 2640,240 2880,160 L2880,430 L0,430 Z" fill="url(#lwb)" />
          </svg>
        </div>
        {/* vague avant : dégradé logo + relief 3D (glass) + brillance sur l'arête */}
        <div className="lunera-wave-x absolute bottom-[26px] left-0 h-[430px] w-[200%]"
          style={{ filter: "blur(0.5px)", maskImage: "linear-gradient(to bottom,transparent 8%,#000 24%,#000 62%,transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom,transparent 8%,#000 24%,#000 62%,transparent 100%)" }}>
          <svg viewBox="0 0 2880 430" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="lwf" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#93c9ff" /><stop offset="12.5%" stopColor="#5a8bff" /><stop offset="25%" stopColor="#8a63ff" /><stop offset="37.5%" stopColor="#5a8bff" /><stop offset="50%" stopColor="#93c9ff" /><stop offset="62.5%" stopColor="#5a8bff" /><stop offset="75%" stopColor="#8a63ff" /><stop offset="87.5%" stopColor="#5a8bff" /><stop offset="100%" stopColor="#93c9ff" /></linearGradient>
              <linearGradient id="lwShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(255,255,255,0.55)" /><stop offset="18%" stopColor="rgba(255,255,255,0)" /><stop offset="60%" stopColor="rgba(20,28,84,0)" /><stop offset="100%" stopColor="rgba(20,28,84,0.45)" /></linearGradient>
            </defs>
            <path d="M0,130 C240,50 480,50 720,130 C960,210 1200,210 1440,130 C1680,50 1920,50 2160,130 C2400,210 2640,210 2880,130 L2880,430 L0,430 Z" fill="url(#lwf)" />
            <path d="M0,130 C240,50 480,50 720,130 C960,210 1200,210 1440,130 C1680,50 1920,50 2160,130 C2400,210 2640,210 2880,130 L2880,430 L0,430 Z" fill="url(#lwShade)" />
            <path d="M0,130 C240,50 480,50 720,130 C960,210 1200,210 1440,130 C1680,50 1920,50 2160,130 C2400,210 2640,210 2880,130" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="8" strokeLinecap="round" />
            <path d="M0,130 C240,50 480,50 720,130 C960,210 1200,210 1440,130 C1680,50 1920,50 2160,130 C2400,210 2640,210 2880,130" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        {/* clarté derrière les boutons/étoiles (lisibilité) */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(52% 38% at 50% 60%, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.42) 44%, transparent 74%)" }} />
      </div>

      <FloatingSocials />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-40 text-center sm:pt-48">
        <span className="duup-flip mb-6 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-[13px] font-medium text-[#1a1a1a] shadow-[0_6px_20px_rgba(20,40,90,0.06)] ring-1 ring-black/[0.06] backdrop-blur">
          <FlipInner>
            <img src="/logo-mark.png" alt="" className="h-4 w-4 object-contain" />
            <span>{en ? <>500 creators &amp; agencies repost with <Brand /></> : <>500 créateurs et agences repost avec <Brand /></>}</span>
          </FlipInner>
        </span>
        <h1 className="mx-auto tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(42px, 5.9vw, 70px)", lineHeight: 1.14, fontWeight: 500 }}>
          {en ? <>Turn one video into<br /><span className="lunera-highlight font-semibold">dozens of variants</span> to repost</> : <>Transforme 1 vidéo en<br /><span className="lunera-highlight font-semibold">plusieurs variantes</span> à reposter</>}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-[#3a3f4b] sm:text-[19px]">
          {en
            ? "Generate dozens of unique variants from a single video, ready to repost across all your accounts."
            : "Génère des dizaines de variantes uniques d'une seule vidéo, prêtes à reposter sur tous tes comptes."}
        </p>

        {/* Boutons (remplacent le téléphone et les mockups) */}
        <div className="mt-12 flex flex-col items-center gap-7 sm:mt-14">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/pricing"
              className="duup-flip inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-[15px] font-medium text-white shadow-[0_12px_34px_rgba(90,90,240,0.4)] transition hover:opacity-90"
              style={{ background: CTA_GRAD }}>
              <FlipInner>
                {en ? "Get started" : "Commencer maintenant"}
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </FlipInner>
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}

/* ─── BLOC DÉMO (placeholder — gros bloc à remplir plus tard) ─── */
function DemoBlock() {
  const params = useParams();
  const isFr = (Array.isArray(params?.locale) ? params?.locale[0] : params?.locale) !== "en";
  return (
    <section className="px-6 pb-20 pt-8">
      <div className="relative mx-auto max-w-6xl">
        {/* Pastille posée sur le cadrant (chevauche le bord supérieur) */}
        <div className="absolute left-1/2 top-0 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <Link href="/#features" aria-label={isFr ? "C'est quoi DuupFlow ?" : "What is DuupFlow?"} className="lunera-bob block">
            <span className="inline-flex items-center gap-2.5 rounded-full px-4 py-2.5 shadow-[0_16px_40px_rgba(100,90,240,0.24)] ring-1 ring-white/80 transition hover:brightness-[0.98]"
              style={{ background: "linear-gradient(135deg,#ffffff 0%,#e9efff 52%,#efe8ff 100%)" }}>
              <img src="/logo-mark.png" alt="" className="h-5 w-5 object-contain" />
              <span className="text-[14px] font-semibold text-[#1a1a1a]">{isFr ? "C'est quoi " : "What is "}<Brand />{isFr ? " ?" : "?"}</span>
            </span>
          </Link>
        </div>
        <div className="relative flex aspect-[16/8] items-center justify-center overflow-hidden rounded-[32px] bg-white ring-1 ring-black/5 shadow-[0_30px_80px_rgba(20,40,90,0.16)]">
          <video
            key={isFr ? "fr" : "en"}
            src={isFr ? "/demo-duupflow-fr.mp4" : "/demo-us.mp4"}
            className="absolute inset-0 h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            autoPlay
            muted
            loop
          />
        </div>
      </div>
    </section>
  );
}

/* ─── FEATURES (bento) ─── */
const CARD_BG = "linear-gradient(180deg,#fcfcfe 0%,#f1f3f7 100%)";
/* Covers vidéo réelles (frames extraites — statiques, pas de lecture) */
const COVERS = ["/videos/cover-1.jpg", "/videos/cover-2.jpg"];
const CLIPS = ["/videos/clip-1.jpg", "/videos/clip-2.jpg", "/videos/clip-3.jpg", "/videos/clip-4.jpg", "/videos/clip-5.jpg", "/videos/clip-6.jpg"];

/* Duplication : 1 média vertical → copies uniques empilées */
function DupStack() {
  return (
    <div className="relative mx-auto h-[210px] w-[176px]">
      <div className="absolute left-[48px] top-[24px] h-[185px] w-[104px] rounded-2xl bg-white ring-1 ring-black/5 shadow-[0_6px_16px_rgba(20,40,90,0.05)]" />
      <div className="absolute left-[24px] top-[12px] h-[185px] w-[104px] rounded-2xl bg-white ring-1 ring-black/5 shadow-[0_10px_24px_rgba(20,40,90,0.07)]" />
      <div className="absolute left-0 top-0 h-[185px] w-[104px] overflow-hidden rounded-2xl ring-1 ring-black/5 shadow-[0_14px_34px_rgba(20,40,90,0.12)]">
        <img src={CLIPS[3]} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="absolute bottom-1 right-0 rounded-full bg-[#1a1a1a] px-3 py-1 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)]">× ∞</div>
    </div>
  );
}
/* Variation automatique : réglages paramétrés tout seuls */
function AutoPanel() {
  const en = useLocale() === "en";
  const rows: [string, string][] = en
    ? [["Metadata", "Device · date · GPS"], ["Re-encoding", "H.264 · bitrate"], ["Magic pixel", "Invisible noise"]]
    : [["Métadonnées", "Appareil · date · GPS"], ["Réencodage", "H.264 · bitrate"], ["Pixel magique", "Bruit invisible"]];
  return (
    <div className="w-full max-w-[262px] rounded-2xl bg-white p-3.5 ring-1 ring-black/5 shadow-[0_10px_28px_rgba(20,40,90,0.08)]">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[#1a1a1a]">{en ? "Settings" : "Réglages"}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#4686FE]/10 px-2 py-0.5 text-[11px] font-medium" style={{ color: BLUE }}>
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 1.9 4.8L18 9.5l-4.1 1.7L12 16l-1.9-4.8L6 9.5l4.1-1.7Z" /></svg>Auto
        </span>
      </div>
      {rows.map(([t, s], i) => (
        <div key={i} className="flex items-center justify-between border-t border-black/[0.06] py-2">
          <div><p className="text-[12px] font-medium text-[#1a1a1a]">{t}</p><p className="text-[10px] text-[#8a8a8a]">{s}</p></div>
          <span className="flex h-4 w-7 items-center rounded-full px-0.5" style={{ background: BLUE }}><span className="ml-auto h-3 w-3 rounded-full bg-white" /></span>
        </div>
      ))}
    </div>
  );
}
/* Anti-détection IA : bouclier + jauge détectée → propre */
function AntiAI() {
  const en = useLocale() === "en";
  return (
    <div className="flex w-full max-w-[220px] flex-col items-center">
      <div className="flex h-[90px] w-[90px] items-center justify-center rounded-full" style={{ background: "radial-gradient(circle, rgba(70,134,254,0.16), transparent 70%)" }}>
        <svg className="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
      </div>
      <div className="mt-4 w-full">
        <div className="flex justify-between text-[10px] font-medium"><span className="text-rose-400 line-through">{en ? "AI detected" : "IA détectée"}</span><span className="text-emerald-500">{en ? "Clean ✓" : "Propre ✓"}</span></div>
        <div className="mt-1.5 h-2 rounded-full bg-black/[0.06]"><div className="h-2 w-full rounded-full bg-gradient-to-r from-rose-300 via-amber-300 to-emerald-400" /></div>
      </div>
    </div>
  );
}
/* Éditeur IA : montage piloté par conversation (Claude) → variantes prêtes */
function AiEditorPanel() {
  const en = useLocale() === "en";
  return (
    <div className="w-full max-w-[300px] rounded-2xl bg-white p-3.5 ring-1 ring-black/5 shadow-[0_10px_28px_rgba(20,40,90,0.08)]">
      {/* En-tête : logo Claude + statut */}
      <div className="mb-3 flex items-center gap-2">
        <img src="/claude-color.svg" alt="Claude" className="h-5 w-5" />
        <span className="text-[12px] font-semibold text-[#1a1a1a]">{en ? "AI Editor" : "Éditeur IA"}</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#4686FE]/10 px-2 py-0.5 text-[10px] font-medium" style={{ color: BLUE }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: BLUE }} />{en ? "Live" : "En ligne"}
        </span>
      </div>
      {/* Prompt utilisateur */}
      <div className="mb-2 ml-auto w-fit max-w-[88%] rounded-2xl rounded-tr-sm bg-[#1a1a1a] px-3 py-2 text-[11px] leading-snug text-white">
        {en ? "Dynamic cut, captions on the beat" : "Montage dynamique, captions sur les beats"}
      </div>
      {/* Réponse IA */}
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-[#605f5f]">
        <img src="/claude-color.svg" alt="" className="h-3.5 w-3.5" />
        {en ? "3 variations ready" : "3 variantes prêtes"}
      </div>
      {/* Variantes générées */}
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative aspect-[9/16] overflow-hidden rounded-lg ring-1 ring-black/5">
            <img src={CLIPS[i]} alt="" className="h-full w-full object-cover" />
            <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white shadow" style={{ background: BLUE }}>
              <svg className="h-2 w-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
/* Scraper : grille du profil, meilleurs clips sélectionnés */
function ScraperGrid() {
  const en = useLocale() === "en";
  const clips: { v: string; best?: boolean }[] = [{ v: "1.2M", best: true }, { v: "840K", best: true }, { v: "12K" }, { v: "3K" }, { v: "620K", best: true }, { v: "9K" }];
  return (
    <div className="w-full max-w-[260px]">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-6 w-6 rounded-full bg-gradient-to-br from-[#dbe6ff] to-[#e6ddff]" />
        <span className="text-[12px] font-semibold text-[#1a1a1a]">{en ? "@your_account" : "@ton_compte"}</span>
        <span className="ml-auto text-[10px] font-medium" style={{ color: BLUE }}>Top clips</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {clips.map((c, i) => (
          <div key={i} className={`relative aspect-[9/16] overflow-hidden rounded-lg ring-1 ring-black/5 ${c.best ? "ring-2 ring-[#4686FE]" : ""}`}>
            <img src={CLIPS[i % CLIPS.length]} alt="" className={`h-full w-full object-cover ${c.best ? "" : "opacity-60 grayscale-[0.3]"}`} />
            {c.best && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-white shadow" style={{ background: BLUE }}>
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
            )}
            <span className="absolute bottom-1 left-1 rounded bg-black/45 px-1 py-px text-[8px] font-semibold text-white">{c.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
const CARD_BACK = "linear-gradient(160deg,#4f7bff 0%,#6a68ff 48%,#8a5cff 100%)";
function FeatCard({ span, title, desc, back, children }: { span: string; title: string; desc: string; back: string; children: React.ReactNode }) {
  return (
    <div className={`${span} group h-[380px] [perspective:1400px]`}>
      <div className="relative h-full w-full transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
        {/* Recto */}
        <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[28px] p-7 ring-1 ring-black/[0.06] [backface-visibility:hidden]" style={{ background: CARD_BG }}>
          <h3 className="text-[22px] font-semibold tracking-tight text-[#1a1a1a]">{title}</h3>
          <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-[#605f5f]">{desc}</p>
          <div className="mt-6 flex flex-1 items-end justify-center">{children}</div>
        </div>
        {/* Verso */}
        <div className="absolute inset-0 flex flex-col justify-center overflow-hidden rounded-[28px] p-7 text-white ring-1 ring-white/10 [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ background: CARD_BACK }}>
          <h3 className="text-[20px] font-semibold tracking-tight">{title}</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-white/90">{back}</p>
        </div>
      </div>
    </div>
  );
}
function FeatCardWide({ span, title, desc, back, children }: { span: string; title: string; desc: string; back: string; children: React.ReactNode }) {
  return (
    <div className={`${span} group h-[340px] [perspective:1600px]`}>
      <div className="relative h-full w-full transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
        {/* Recto */}
        <div className="absolute inset-0 flex items-center gap-6 overflow-hidden rounded-[28px] p-7 ring-1 ring-black/[0.06] [backface-visibility:hidden]" style={{ background: CARD_BG }}>
          <div className="min-w-0 flex-1">
            <h3 className="text-[22px] font-semibold tracking-tight text-[#1a1a1a]">{title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[#605f5f]">{desc}</p>
          </div>
          <div className="flex w-[46%] shrink-0 items-center justify-center">{children}</div>
        </div>
        {/* Verso */}
        <div className="absolute inset-0 flex flex-col justify-center overflow-hidden rounded-[28px] p-8 text-white ring-1 ring-white/10 [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ background: CARD_BACK }}>
          <h3 className="text-[20px] font-semibold tracking-tight">{title}</h3>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-white/90">{back}</p>
        </div>
      </div>
    </div>
  );
}
const FEATURES = [
  {
    wide: false, art: <DupStack />,
    fr: { title: "Duplication vidéos & images", desc: "Transforme 1 fichier en autant de copies uniques que tu veux, en quelques secondes.", back: "Chaque copie est entièrement ré-encodée : une empreinte binaire neuve, tout en conservant ta résolution et ta qualité d'origine (une 1080p reste 1080p, une 4K reste 4K). Fonctionne sur les vidéos (mp4, mov, mkv, avi, webm) comme sur les images." },
    en: { title: "Video & image duplication", desc: "Turn 1 file into as many unique copies as you want, in seconds.", back: "Each copy is fully re-encoded: a brand-new binary fingerprint, while keeping your original resolution and quality (1080p stays 1080p, 4K stays 4K). Works on videos (mp4, mov, mkv, avi, webm) and images alike." },
  },
  {
    wide: false, art: <AutoPanel />,
    fr: { title: "Variation automatique", desc: "Métadonnées, réencodage, pixel magique : DuupFlow paramètre tout à ta place.", back: "DuupFlow applique seul les bons traitements : micro-ajustements visuels (luminosité, saturation, teinte, gamma) sous le seuil de l'œil, réécriture des métadonnées techniques (EXIF, DPI, logiciel plausible, GPS, option iPhone réaliste) et « pixel magique » (micro-recadrage + bruit) qui casse l'empreinte pixel. Zéro réglage." },
    en: { title: "Automatic variation", desc: "Metadata, re-encoding, magic pixel: DuupFlow sets everything up for you.", back: "DuupFlow applies the right treatments on its own: sub-perceptual visual micro-adjustments (brightness, saturation, hue, gamma), rewriting of technical metadata (EXIF, DPI, plausible software, GPS, realistic iPhone option) and a “magic pixel” (micro-crop + noise) that breaks the pixel fingerprint. Zero setup." },
  },
  {
    wide: false, art: <AntiAI />,
    fr: { title: "Anti-détection IA", desc: "Efface les signatures IA (C2PA) pour que tes contenus passent comme du natif.", back: "Retire les signatures d'IA — dont le standard C2PA — de tes fichiers, puis réécrit une identité crédible de contenu « tourné par un humain » : appareil photo réel (Canon, Sony, iPhone…), logiciel d'édition courant, date récente et localisation cohérentes." },
    en: { title: "AI-detection bypass", desc: "Strips AI signatures (C2PA) so your content passes as native.", back: "Removes AI signatures — including the C2PA standard — from your files, then rewrites a credible “shot by a human” identity: real camera (Canon, Sony, iPhone…), common editing software, recent date and consistent location." },
  },
  {
    wide: true, art: <AiEditorPanel />,
    fr: { title: "Éditeur IA", desc: "Décris ton montage : l'IA l'assemble depuis tes rushes et sort autant de variantes que tu veux.", back: "Un agent de montage piloté par Claude : tu uploades tes rushes, tu donnes une vidéo de référence, tu décris le résultat. L'IA reproduit le style — coupes calées sur les beats, sous-titres animés, effets, recadrage — et génère des variantes réellement distinctes, modifiables à la demande." },
    en: { title: "AI Editor", desc: "Describe your edit: the AI builds it from your footage and outputs as many variations as you want.", back: "A Claude-powered editing agent: you upload your footage, hand it a reference video, describe the result. The AI reproduces the style — beat-synced cuts, animated captions, effects, reframing — and generates genuinely distinct variations, editable on demand." },
  },
  {
    wide: true, art: <ScraperGrid />,
    fr: { title: "Scraper de profil", desc: "Sélectionne tes meilleurs clips directement depuis ton compte et duplique-les en un clic.", back: "Connecte ton profil (Instagram, TikTok) : DuupFlow scanne tes publications sur une période donnée, les classe par performance (portée via vues ou likes + taux d'engagement) et fait remonter tes meilleurs clips — prêts à dupliquer directement." },
    en: { title: "Profile scraper", desc: "Pick your best clips straight from your account and duplicate them in one click.", back: "Connect your profile (Instagram, TikTok): DuupFlow scans your posts over a chosen period, ranks them by performance (reach via views or likes + engagement rate) and surfaces your best clips — ready to duplicate directly." },
  },
];
function Features() {
  const loc = useLocale();
  return (
    <section id="features" className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Label>{loc === "en" ? "Features" : "Fonctionnalités"}</Label>
          <h2 className="mx-auto mt-5 max-w-2xl font-semibold tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(30px, 4vw, 46px)", lineHeight: 1.08 }}>
            {loc === "en" ? "Everything to scale your content production." : "Tout pour scaler ta production de contenu."}
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-6">
          {FEATURES.map((f, i) => {
            const c = f[loc];
            return f.wide
              ? <FeatCardWide key={i} span="sm:col-span-3" title={c.title} desc={c.desc} back={c.back}>{f.art}</FeatCardWide>
              : <FeatCard key={i} span="sm:col-span-2" title={c.title} desc={c.desc} back={c.back}>{f.art}</FeatCard>;
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── INTÉGRATIONS (covers vidéo qui pop en séquence horaire) ─── */
// Ordre = sens des aiguilles d'une montre depuis midi (top → droite → bas-droite → bas-gauche → gauche)
// Pool de covers : l'actuelle + 5 autres du dossier, qui tournent toutes les 1,5 s
const INT_POOL = ["/videos/int-cover.jpg", CLIPS[0], CLIPS[1], CLIPS[2], CLIPS[3], CLIPS[4]];
const REEL_TILES = [
  { order: 0, left: "50%", top: "7%", rot: 0 },    // 12h
  { order: 1, left: "91%", top: "27%", rot: 8 },   // 3h
  { order: 2, left: "94%", top: "81%", rot: 14 },  // 5h
  { order: 3, left: "6%", top: "81%", rot: -14 },  // 7h
  { order: 4, left: "9%", top: "27%", rot: -8 },   // 9h
];
const AVOID = {
  fr: ["Le shadow ban de comptes", "Les contenus restreints", "Le contenu non-original"],
  en: ["Account shadow bans", "Restricted content", "Non-original content"],
};
function Integrations() {
  const loc = useLocale();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [cover, setCover] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.55, rootMargin: "0px 0px -14% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const id = setInterval(() => setCover((c) => c + 1), 1500);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="px-6 py-20 sm:py-24">
      <div ref={wrapRef} className="mx-auto max-w-6xl text-center">
        <h2 className="mx-auto max-w-2xl font-semibold tracking-[-0.03em] text-[#1a1a1a]"
          style={{
            fontSize: "clamp(30px, 4vw, 46px)", lineHeight: 1.08,
            opacity: shown ? 1 : 0,
            transform: shown ? "translateY(0)" : "translateY(26px)",
            transition: "opacity .7s ease, transform .8s cubic-bezier(0.16,1,0.3,1)",
          }}>
          {loc === "en" ? "One video, repost everywhere." : "Une vidéo, reposter partout."}
        </h2>
        <div className="mt-16 grid items-center gap-14 lg:mt-20 lg:grid-cols-[1fr_auto_0.9fr] lg:gap-28">
          {/* Gauche : l'arc de covers — se rétrécit + se décale à gauche à l'apparition */}
          <div
            className="relative mx-auto h-[400px] w-full max-w-xl sm:h-[460px]"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? "translateX(0) scale(1)" : "translateX(20%) scale(1.16)",
              transition: "transform 1s cubic-bezier(0.16,1,0.3,1), opacity .7s ease",
            }}
          >
            <div aria-hidden className="absolute inset-x-6 bottom-4 top-[24%] rounded-t-full"
              style={{ background: "radial-gradient(62% 78% at 50% 100%, rgba(116,142,255,0.34), rgba(116,142,255,0.13) 50%, transparent 76%)" }} />
            {/* Texte central */}
            <div className="absolute left-1/2 top-1/2 z-10 w-[200px] -translate-x-1/2 -translate-y-1/2 sm:w-[236px]">
              <p className="font-semibold tracking-[-0.02em] text-[#1a1a1a]" style={{ fontSize: "clamp(20px, 2.6vw, 27px)", lineHeight: 1.2 }}>
                {loc === "en" ? <>Multiply &amp; repost your content effortlessly</> : <>Multiplie &amp; repost ton contenu sans effort</>}
              </p>
            </div>
            {/* Covers vidéo */}
            {REEL_TILES.map((t) => {
              const src = INT_POOL[cover % INT_POOL.length];
              return (
                <div
                  key={t.order}
                  className="absolute w-[66px] sm:w-[82px]"
                  style={{
                    left: t.left,
                    top: t.top,
                    perspective: "700px",
                    opacity: shown ? 1 : 0,
                    transform: `translate(-50%,-50%) rotate(${shown ? t.rot : t.rot - 12}deg) scale(${shown ? 1 : 0.15})`,
                    transition: "opacity .5s ease, transform .7s cubic-bezier(0.34,1.56,0.64,1)",
                    transitionDelay: `${(shown ? t.order : 0) * 0.16}s`,
                  }}
                >
                  <div key={src} className="lunera-flip overflow-hidden rounded-[18px] bg-[#e9edf5] p-1 shadow-[0_16px_40px_rgba(20,40,90,0.16)] ring-1 ring-black/5">
                    <div className="relative aspect-[9/16] overflow-hidden rounded-[13px]">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/85 shadow-sm backdrop-blur-sm sm:h-7 sm:w-7">
                          <svg className="h-3 w-3 translate-x-px text-[#1a1a1a] sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Centre : trait vertical (grandit à l'apparition) */}
          <div aria-hidden className="hidden h-[320px] w-px origin-center bg-gradient-to-b from-transparent via-black/15 to-transparent lg:block"
            style={{ opacity: shown ? 1 : 0, transform: shown ? "scaleY(1)" : "scaleY(0)", transition: "transform .9s cubic-bezier(0.22,1,0.36,1) .35s, opacity .5s ease .35s" }} />

          {/* Droite : "Avec DuupFlow évite" */}
          <div className="text-left">
            <h3 className="font-semibold tracking-[-0.02em] text-[#1a1a1a]"
              style={{
                fontSize: "clamp(22px, 2.6vw, 30px)", lineHeight: 1.15,
                opacity: shown ? 1 : 0,
                transform: shown ? "translateX(0)" : "translateX(32px)",
                transition: "opacity .6s ease .35s, transform .7s cubic-bezier(0.16,1,0.3,1) .35s",
              }}>
              {loc === "en" ? <>With <Brand />, you avoid:</> : <>Avec <Brand />, tu évites :</>}
            </h3>
            <ul className="mt-6 space-y-3">
              {AVOID[loc].map((txt, i) => (
                <li key={i}
                  style={{
                    opacity: shown ? 1 : 0,
                    transform: shown ? "translateX(0) scale(1)" : "translateX(52px) scale(0.94)",
                    transition: "opacity .55s ease, transform .65s cubic-bezier(0.16,1,0.3,1)",
                    transitionDelay: `${(shown ? i : 0) * 0.16 + 0.55}s`,
                  }}
                >
                  <div
                    className="flex items-center gap-3 rounded-2xl px-4 py-3.5 ring-1 ring-black/[0.06] shadow-[0_8px_22px_rgba(20,40,90,0.05)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(20,40,90,0.12)]"
                    style={{ background: CARD_BG }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 ring-1 ring-red-100">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </span>
                    <span className="text-[15px] font-medium text-[#1a1a1a]">{txt}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ─── (2 colonnes : titre gauche, cartes empilées droite) */
function VariantsRow() {
  const en = useLocale() === "en";
  return (
    <div className="w-full">
      <div className="mb-3.5 flex items-center justify-center gap-2 text-[12px] font-medium">
        <span className="rounded-md bg-white px-2.5 py-1 text-[#1a1a1a] ring-1 ring-black/5">reel.mp4</span>
        <svg className="h-4 w-4 text-[#8a8a8a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        <span className="rounded-md px-2.5 py-1 text-white" style={{ background: BLUE }}>{en ? "20 unique" : "20 uniques"}</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="relative aspect-[9/16] overflow-hidden rounded-md ring-1 ring-black/5">
            <img src={COVERS[i % COVERS.length]} alt="" className="h-full w-full object-cover" />
            <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white shadow" style={{ background: BLUE }}>
              <svg className="h-2 w-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
const DISPATCH_NETS = [
  { name: "Instagram", logo: "/instagram%20(1)%20copie.png", handle: "@repost.officiel" },
  { name: "TikTok", logo: "/tik-tok%20copie.png", handle: "@clips.daily" },
  { name: "YouTube", logo: "/youtube%20copie.png", handle: "@shorts.hub" },
  { name: "X", logo: "/twitter%20copie.png", handle: "@viral.feed" },
  { name: "Reddit", logo: "/reddit%20copie.png", handle: "@u/reposter" },
  { name: "Threads", logo: "/threads%20copie.png", handle: "@threads.repost" },
];
function DispatchList() {
  const en = useLocale() === "en";
  // Rotation rapide 1 à 1 : une seule ligne se remplace à chaque tick (round-robin)
  const [rows, setRows] = useState([0, 1, 2]);
  useEffect(() => {
    let turn = 0;   // ligne à remplacer
    let ptr = 3;    // prochain réseau à assigner
    const id = setInterval(() => {
      const r = turn % 3;
      const val = ptr % DISPATCH_NETS.length;
      setRows((prev) => { const n = [...prev]; n[r] = val; return n; });
      turn++; ptr++;
    }, 650);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full space-y-2.5">
      {[0, 1, 2].map((row) => {
        const net = DISPATCH_NETS[rows[row]];
        const avatar = CLIPS[rows[row] % CLIPS.length];
        return (
          <div key={row} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-black/5 shadow-[0_6px_16px_rgba(20,40,90,0.05)]">
            <span key={rows[row]} className="lunera-swap h-8 w-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5">
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#1a1a1a]">{en ? "Variant" : "Variante"} {row + 1}</p>
              <p key={rows[row]} className="lunera-swap text-[11px] text-[#8a8a8a]">{net.handle}</p>
            </div>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 ring-1 ring-emerald-100">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M20 6 9 17l-5-5" /></svg>{en ? "Posted" : "Publié"}
              </span>
              <span key={rows[row]} className="lunera-swap flex h-6 w-6 shrink-0 items-center justify-center">
                <img src={net.logo} alt={net.name} className="h-full w-full object-contain" />
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
function DropArt() {
  const en = useLocale() === "en";
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#c9d3e6] bg-[#f8f9fc] py-6">
      <div className="flex items-end justify-center gap-3">
        {["/videos/up-1.jpg", "/videos/up-2.jpg"].map((src, i) => (
          <div key={i} className="h-[184px] w-[104px] overflow-hidden rounded-xl bg-white ring-1 ring-black/5 shadow-[0_12px_28px_rgba(20,40,90,0.12)]">
            <img src={src} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      <p className="text-xs font-medium text-[#8a8a8a]">{en ? "Drop your videos here — any format" : "Glisse tes vidéos ici — tous formats"}</p>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    fr: { title: "Importe ta vidéo", desc: "Glisse-dépose la vidéo qui a déjà performé. Tous formats, même en lot." },
    en: { title: "Import your video", desc: "Drag & drop the video that already performed. Any format, even in batches." },
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>,
    art: <DropArt />,
  },
  {
    n: "02",
    fr: { title: "Génère tes variantes", desc: "Choisis le nombre de copies uniques — DuupFlow retravaille chaque fichier en profondeur." },
    en: { title: "Generate your variants", desc: "Choose the number of unique copies — DuupFlow reworks each file in depth." },
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.9 4.8L18 9.5l-4.1 1.7L12 16l-1.9-4.8L6 9.5l4.1-1.7L12 3Z" /></svg>,
    art: <VariantsRow />,
  },
  {
    n: "03",
    fr: { title: "Republie partout", desc: "Exporte en un clic et poste sur tous tes comptes, sans doublon. Les vues reviennent." },
    en: { title: "Repost everywhere", desc: "Export in one click and post to all your accounts, no duplicates. The views come back." },
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>,
    art: <DispatchList />,
  },
];

/* "Comment ça marche" — pile de cartes en sticky : la carte active est en grand,
   les précédentes se réduisent à leur en-tête empilé en haut, la suivante pointe
   en bas. Le mouvement vertical se fait au fil du scroll (façon template). */
function HowItWorks() {
  const loc = useLocale();
  const secRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const el = secRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = total > 0 ? Math.min(Math.max(-rect.top, 0), total) / total : 0;
      setActive(Math.min(Math.floor(p * STEPS.length), STEPS.length - 1));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section ref={secRef} id="how" className="bg-[#f6f7f9]">
      <div className="mx-auto max-w-6xl px-6 lg:grid lg:grid-cols-[0.85fr_1fr] lg:gap-16">
        {/* Gauche — titre fixe (sticky, centré) */}
        <div className="pt-20 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-center lg:pt-0">
          <div><Label>{loc === "en" ? "How it works" : "Comment ça marche"}</Label></div>
          <h2 className="mt-6 font-semibold tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(30px, 3.6vw, 48px)", lineHeight: 1.08 }}>
            {loc === "en" ? "From your video to dozens of variants, in three steps." : "De ta vidéo à des dizaines de variantes, en trois étapes."}
          </h2>
          <div className="mt-9 flex items-center gap-2.5">
            {STEPS.map((_, i) => (
              <span key={i} className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: i === active ? 30 : 10, backgroundColor: i <= active ? BLUE : "#d6dbe3" }} />
            ))}
          </div>
        </div>

        {/* Droite — cartes qui s'empilent en sticky (mouvement au scroll) */}
        <div className="pb-[16vh] pt-[10vh] lg:pt-[16vh]">
          {STEPS.map((s, i) => (
            <div key={i} className="sticky"
              style={{ top: "116px", zIndex: i + 1, marginBottom: i < STEPS.length - 1 ? "58vh" : 0 }}>
              <div className="relative flex h-[420px] flex-col overflow-hidden rounded-[28px] p-6 ring-1 ring-black/[0.06] shadow-[0_24px_60px_rgba(20,40,90,0.14)] sm:p-8" style={{ background: CARD_BG }}>
                <span className="pointer-events-none absolute bottom-5 right-6 text-sm font-medium text-black/15">{s.n}</span>
                <div className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: BLUE }}>{s.icon}</span>
                  <div>
                    <h3 className="text-[19px] font-semibold text-[#1a1a1a]">{s[loc].title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#605f5f]">{s[loc].desc}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-1 items-center justify-center">{s.art}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── TÉMOIGNAGES + STATS ─── */
const REVIEWS = {
  fr: [
    {
      f: { n: "Mélanie R.", r: "Créatrice, 6 comptes TikTok", q: "Je reposte mon meilleur reel sur tous mes comptes le même jour, sans jamais me faire flag pour doublon. Mon reach a doublé.", av: 5 },
      b: { n: "Léa M.", r: "Créatrice lifestyle", q: "Avant je ré-uploadais à la main et je me faisais shadowban. Là chaque copie passe pour un original, mes vues sont stables partout.", av: 1 },
    },
    {
      f: { n: "Yanis B.", r: "Agence social media", q: "On gère 12 clients. DuupFlow nous fait gagner des heures : une vidéo devient 20 fichiers uniques en 3 minutes.", av: 6 },
      b: { n: "Thomas D.", r: "Growth agency", q: "On a triplé le nombre de posts sans embaucher. Le batch de 20 variantes en un clic, c'est ce qui nous manquait.", av: 2 },
    },
    {
      f: { n: "Sacha L.", r: "Media buyer e-commerce", q: "Le volume de créatives qu'on peut sortir maintenant est incomparable. Chaque variante est traitée comme du neuf par les algos.", av: 7 },
      b: { n: "Inès B.", r: "E-commerce DNVB", q: "Nos UGC tournent sur 5 comptes en parallèle sans jamais être détectés comme du repost. Le ROAS a suivi.", av: 3 },
    },
  ],
  en: [
    {
      f: { n: "Mélanie R.", r: "Creator, 6 TikTok accounts", q: "I repost my best reel to all my accounts the same day, without ever getting flagged for duplicates. My reach doubled.", av: 5 },
      b: { n: "Léa M.", r: "Lifestyle creator", q: "I used to re-upload by hand and got shadowbanned. Now every copy passes as an original — my views are steady everywhere.", av: 1 },
    },
    {
      f: { n: "Yanis B.", r: "Social media agency", q: "We manage 12 clients. DuupFlow saves us hours: one video becomes 20 unique files in 3 minutes.", av: 6 },
      b: { n: "Thomas D.", r: "Growth agency", q: "We tripled our number of posts without hiring. The one-click batch of 20 variants is exactly what we were missing.", av: 2 },
    },
    {
      f: { n: "Sacha L.", r: "E-commerce media buyer", q: "The volume of creatives we can ship now is unmatched. Every variant is treated as brand-new by the algorithms.", av: 7 },
      b: { n: "Inès B.", r: "E-commerce DNVB", q: "Our UGC runs on 5 accounts in parallel without ever being detected as reposts. ROAS followed.", av: 3 },
    },
  ],
};
const STATS = [
  { value: 500, suffix: "+", decimals: 0, label: { fr: "Créateurs & agences", en: "Creators & agencies" } },
  { value: 99.9, suffix: "%", decimals: 1, label: { fr: "Disponibilité", en: "Uptime" } },
  { value: 40, suffix: "K+", decimals: 0, label: { fr: "Vidéos générées / mois", en: "Videos generated / month" } },
];

/* Compteur qui s'anime de 0 à la valeur quand il entre à l'écran (easeOutExpo). */
function AnimatedStat({ value, suffix = "", decimals = 0, label, locale = "fr" }: { value: number; suffix?: string; decimals?: number; label: string; locale?: "fr" | "en" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0, started = false;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      io.disconnect();
      const dur = 1700, t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
        setDisplay(eased * value);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  const formatted = display.toLocaleString(locale === "en" ? "en-US" : "fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <div ref={ref} className="text-center">
      <p className="font-semibold tracking-tight text-[#1a1a1a]"
        style={{ fontSize: "clamp(28px,4vw,48px)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", lineHeight: 1 }}>
        {formatted}{suffix}
      </p>
      <p className="mt-1.5 text-sm text-[#605f5f]">{label}</p>
    </div>
  );
}
function Stars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="h-4 w-4" viewBox="0 0 24 24" fill="#f6b100"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" /></svg>
      ))}
    </div>
  );
}
function ReviewFace({ n, r, q, av, back = false }: { n: string; r: string; q: string; av: number; back?: boolean }) {
  return (
    <div className={`absolute inset-0 flex flex-col rounded-3xl bg-white p-7 ring-1 ring-black/5 [backface-visibility:hidden] ${back ? "[transform:rotateY(180deg)]" : ""}`}>
      <Stars />
      <p className="mt-4 flex-1 text-[15px] leading-relaxed text-[#1a1a1a]">“{q}”</p>
      <div className="mt-6 flex items-center gap-3">
        <img src={`/testimonials/_ (${av}).jpeg`} alt="" className="h-10 w-10 rounded-full object-cover" />
        <div>
          <p className="text-sm font-semibold text-[#1a1a1a]">{n}</p>
          <p className="text-[13px] text-[#8a8a8a]">{r}</p>
        </div>
      </div>
    </div>
  );
}
function Testimonials() {
  const loc = useLocale();
  return (
    <section className="px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Label>{loc === "en" ? "Testimonials" : "Témoignages"}</Label>
          <h2 className="mx-auto mt-5 max-w-2xl font-semibold tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(30px, 4vw, 46px)", lineHeight: 1.08 }}>
            {loc === "en" ? <>They already repost with <Brand />.</> : <>Ils repostent déjà avec <Brand />.</>}
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {REVIEWS[loc].map((r, i) => (
            <div key={i} className="group h-[300px] [perspective:1400px]">
              <div className="relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                <ReviewFace n={r.f.n} r={r.f.r} q={r.f.q} av={r.f.av} />
                <ReviewFace n={r.b.n} r={r.b.r} q={r.b.q} av={r.b.av} back />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-14 grid grid-cols-3 gap-5">
          {STATS.map((s, i) => (
            <AnimatedStat key={i} value={s.value} suffix={s.suffix} decimals={s.decimals} label={s.label[loc]} locale={loc} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
const FAQS = {
  fr: [
    { q: "Concrètement, qu'est-ce qui est modifié dans mes vidéos ?", a: "Les métadonnées (appareil, date, encodeur, géolocalisation), une signature visuelle via des micro-variations sous le seuil de perception, et une empreinte binaire unique. Le fichier est ensuite entièrement ré-encodé. Ton montage, ton audio et ton cadrage restent identiques à l'original." },
    { q: "Est-ce que la qualité baisse ?", a: "Non. La résolution et le bitrate d'origine sont conservés : une 1080p reste 1080p, une 4K reste 4K. Aucune perte visible à l'écran." },
    { q: "Combien de variantes puis-je générer ?", a: "Autant que ton plan le permet — jusqu'à un nombre illimité sur le plan Pro. Le plan gratuit te laisse démarrer sans carte bancaire." },
    { q: "Ça marche sur quelles plateformes ?", a: "Toutes. DuupFlow prépare les fichiers, tu postes où tu veux : TikTok, Instagram, YouTube, X, Reddit, Threads…" },
    { q: "L'éditeur IA, c'est quoi ?", a: "Un agent de montage piloté par conversation : tu uploades tes rushes, tu donnes une vidéo de référence et tu décris le montage voulu. L'IA (Claude) assemble la vidéo à ta place, puis en génère autant de variantes différentes que tu veux. Inclus dans les plans Solo et Pro." },
  ],
  en: [
    { q: "What exactly gets modified in my videos?", a: "The metadata (device, date, encoder, geolocation), a visual signature via micro-variations below the perception threshold, and a unique binary fingerprint. The file is then fully re-encoded. Your edit, audio and framing stay identical to the original." },
    { q: "Does quality drop?", a: "No. The original resolution and bitrate are kept: 1080p stays 1080p, 4K stays 4K. No visible loss on screen." },
    { q: "How many variants can I generate?", a: "As many as your plan allows — up to unlimited on the Pro plan. The free plan lets you start with no credit card." },
    { q: "Which platforms does it work on?", a: "All of them. DuupFlow prepares the files, you post wherever you want: TikTok, Instagram, YouTube, X, Reddit, Threads…" },
    { q: "What is the AI editor?", a: "A conversation-driven editing agent: you upload your footage, hand it a reference video and describe the edit you want. The AI (Claude) assembles the video for you, then generates as many different variations as you want. Included in the Solo and Pro plans." },
  ],
};
function FAQ() {
  const loc = useLocale();
  return (
    <section id="faq" className="px-6 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        {/* Gauche — titre + CTA */}
        <div className="lg:pt-4">
          <Label>FAQ</Label>
          <h2 className="mt-6 font-semibold tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(32px, 4.2vw, 52px)", lineHeight: 1.04 }}>
            {loc === "en" ? <>The questions<br className="hidden sm:block" /> you're asking.</> : <>Les questions<br className="hidden sm:block" /> que tu te poses.</>}
          </h2>
          <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-[#605f5f]">
            {loc === "en" ? "Everything you need to know before getting started." : "Tout ce qu'il faut savoir avant de te lancer."}
          </p>
          <Link href="/demo-request"
            className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-[#1a1a1a] shadow-[0_10px_30px_rgba(20,40,90,0.08)] ring-1 ring-black/10 transition hover:bg-neutral-50">
            {loc === "en" ? "Ask a question" : "Poser une question"}
          </Link>
        </div>

        {/* Droite — accordéon dans un panneau clair */}
        <div className="rounded-[28px] bg-[#f4f5f8] p-3 sm:p-4">
          <div className="space-y-3">
            {FAQS[loc].map((f, i) => (
              <div key={i} className="group overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06] transition-shadow hover:ring-2 hover:ring-[#4f7bff]">
                <div className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
                  <span className="text-[16px] font-medium text-[#1a1a1a]">{f.q}</span>
                  <span className="shrink-0 text-xl leading-none text-[#8a8a8a] transition-transform duration-300 group-hover:rotate-45">+</span>
                </div>
                <div className="max-h-0 overflow-hidden transition-[max-height] duration-[350ms] ease group-hover:max-h-[320px]">
                  <p className="px-6 pb-6 text-[15px] leading-relaxed text-[#605f5f]">{f.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── BLOG ─── */
const POSTS = {
  fr: [
    { t: "Reposter la même vidéo sur plusieurs comptes : le guide", e: "Pourquoi les plateformes limitent les doublons et comment contourner ça proprement.", c: "from-sky-100 to-indigo-100" },
    { t: "Multi-comptes : comment alimenter une grappe sans se faire flag", e: "La méthode des créateurs qui postent partout sans perdre en reach.", c: "from-violet-100 to-sky-100" },
    { t: "1 vidéo, 20 formats : industrialiser sa production", e: "Le workflow pour transformer un seul contenu gagnant en volume.", c: "from-indigo-100 to-blue-100" },
  ],
  en: [
    { t: "Reposting the same video across accounts: the guide", e: "Why platforms limit duplicates, and how to work around it cleanly.", c: "from-sky-100 to-indigo-100" },
    { t: "Multi-account: how to feed a cluster without getting flagged", e: "The method creators use to post everywhere without losing reach.", c: "from-violet-100 to-sky-100" },
    { t: "1 video, 20 formats: industrialize your production", e: "The workflow to turn a single winning piece into volume.", c: "from-indigo-100 to-blue-100" },
  ],
};
function Blog() {
  const loc = useLocale();
  return (
    <section className="px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Label>Blog</Label>
          <h2 className="mt-5 font-semibold tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(30px, 4vw, 46px)", lineHeight: 1.08 }}>
            {loc === "en" ? "Repost smarter." : "Reposter plus intelligemment."}
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {POSTS[loc].map((p, i) => (
            <Link key={i} href="/blog" className="group block overflow-hidden rounded-3xl bg-white ring-1 ring-black/5 transition hover:shadow-[0_16px_40px_rgba(20,40,90,0.08)]">
              <div className={`aspect-[16/10] bg-gradient-to-br ${p.c}`} />
              <div className="p-6">
                <h3 className="text-[17px] font-semibold leading-snug text-[#1a1a1a]">{p.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#605f5f]">{p.e}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium" style={{ color: BLUE }}>{loc === "en" ? "Read article" : "Lire l'article"} <span className="transition-transform group-hover:translate-x-0.5">→</span></span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ─── */
function CTA() {
  const en = useLocale() === "en";
  return (
    <section className="px-6 pb-10">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[36px] px-8 py-16 text-center sm:py-20"
        style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #202634 60%, #1c2b52 100%)" }}>
        <h2 className="mx-auto max-w-2xl font-semibold tracking-[-0.03em] text-white" style={{ fontSize: "clamp(30px, 4.4vw, 50px)", lineHeight: 1.08 }}>
          {en ? "Give your videos a second life." : "Donne une seconde vie à tes vidéos."}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[17px] text-white/70">
          {en ? "Start for free, no credit card. Your first variants in 3 minutes." : "Commence gratuitement, sans carte bancaire. Tes premières variantes en 3 minutes."}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/pricing" className="rounded-full px-7 py-3 text-sm font-medium text-white shadow-[0_10px_30px_rgba(90,90,240,0.42)] transition hover:opacity-90" style={{ background: CTA_GRAD }}>
            {en ? "Get started" : "Commencer maintenant"}
          </Link>
          <Link href="/demo-request" className="rounded-full bg-white/10 px-7 py-3 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-white/15">
            {en ? "Contact us" : "Nous contacter"}
          </Link>
        </div>
      </div>
    </section>
  );
}


/* ─── PAGE ─── */
export default function LandingPage() {
  return (
    <div className="lunera min-h-screen text-[#1a1a1a]" style={{ background: "linear-gradient(to right, #b8d0ff 0%, #c6bcf5 100%)" }}>
      <SmoothScroll />
      <NavPill />
      {/* Zone bleue : le bleu de la vague descend jusqu'en bas du bloc démo */}
      <Hero />
      <DemoBlock />
      {/* Englobage blanc arrondi à partir de Fonctionnalités */}
      <div className="relative z-10 rounded-t-[40px] bg-white">
        {/* Grille fine "blueprint" bleuté/violet qui se fond (Features → Intégrations) */}
        <div className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)",
              backgroundSize: "130px 130px",
              maskImage: "radial-gradient(122% 88% at 50% 32%, #000 42%, transparent 92%)",
              WebkitMaskImage: "radial-gradient(122% 88% at 50% 32%, #000 42%, transparent 92%)",
            }} />
          <div className="relative">
            <Features />
            <Integrations />
          </div>
        </div>
        <HowItWorks />
        <Testimonials />
        <FAQ />
        <Blog />
        <CTA />
        <Footer />
      </div>
    </div>
  );
}
