"use client";

import Link from "@/components/LocaleLink";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { CTA_GRAD, GradText, Label, NavPill, Footer, SmoothScroll, Brand, FlipInner, SECTION_LEAD, SECTION_TITLE, SECTION_TITLE_STYLE } from "@/components/landing/shell";
import FeatureSections from "@/components/landing/FeatureSections";
import { useInView } from "@/components/landing/useInView";

/* ══════════════════════════════════════════════════════════════
 * LANDING — refonte façon template "Lunera" (thème clair, Geist).
 * Design reproduit ; contenu 100% DuupFlow.
 * Nav / Footer / SmoothScroll / Label / tokens → @/components/landing/shell
 * ══════════════════════════════════════════════════════════════ */

/* Locale courante ("en" à la racine, "fr" sous /fr) — pour le contenu bilingue. */
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
  /* Effet « anti-aimant » : quand la souris approche, chaque pastille s'écarte
     un peu (22 px max) puis revient en douceur. La couche externe garde son
     flottement (lunera-float-*), la couche interne porte la répulsion. */
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const RADIUS = 150, MAX = 22;
    let raf = 0, mx = -9999, my = -9999;
    const apply = () => {
      raf = 0;
      refs.current.forEach((el) => {
        if (!el) return;
        const r = el.parentElement!.getBoundingClientRect();
        const dx = r.left + r.width / 2 - mx, dy = r.top + r.height / 2 - my;
        const d = Math.hypot(dx, dy);
        if (d < RADIUS && d > 0) {
          const f = (1 - d / RADIUS) * MAX;
          el.style.transform = `translate(${(dx / d) * f}px, ${(dy / d) * f}px)`;
        } else {
          el.style.transform = "translate(0, 0)";
        }
      });
    };
    const onMove = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(apply); };
    const onLeave = () => { mx = my = -9999; if (!raf) raf = requestAnimationFrame(apply); };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => { window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] hidden lg:block">
      {FLOAT_SOCIALS.map((s, i) => (
        <div key={s.key} className={`absolute ${s.pos} ${s.anim}`} style={{ animationDelay: s.delay }}>
          <div
            ref={(el) => { refs.current[i] = el; }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_16px_40px_rgba(20,40,90,0.14)] ring-1 ring-black/[0.05] transition-transform duration-500 ease-out"
          >
            <img src={s.src} alt={s.alt} className="h-10 w-10 object-contain" />
          </div>
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
        <span className="duup-flip mb-6 inline-flex max-w-full items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-medium text-[#1a1a1a] shadow-[0_6px_20px_rgba(20,40,90,0.06)] ring-1 ring-black/[0.06] backdrop-blur sm:px-4 sm:text-[13px]">
          <FlipInner>
            <img src="/logo-mark.png" alt="" className="h-4 w-4 object-contain" />
            <span>{en ? <>500 creators &amp; agencies repost with <Brand /></> : <>500 créateurs et agences repost avec <Brand /></>}</span>
          </FlipInner>
        </span>
        <h1 className="mx-auto tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(46px, 6.4vw, 78px)", lineHeight: 1.12, fontWeight: 500 }}>
          {en ? <>Multiply your content<br /><span className="lunera-highlight font-semibold">by 100</span> effortlessly</> : <>Multiplie ton contenu<br /><span className="lunera-highlight font-semibold">par 100</span> sans effort</>}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-[#3a3f4b] sm:text-[19px]">
          {en
            ? "Duplicate your content, let AI create variants, and feed all your accounts in minutes."
            : "Duplique ton contenu, laisse l’IA créer des variantes, et alimente tous tes comptes en quelques minutes."}
        </p>

        {/* Boutons (remplacent le téléphone et les mockups) */}
        <div className="mt-12 flex flex-col items-center gap-7 sm:mt-14">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/register"
              className="duup-flip inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-[15px] font-medium text-white shadow-[0_12px_34px_rgba(90,90,240,0.4)] transition hover:opacity-90"
              style={{ background: CTA_GRAD }}>
              <FlipInner>
                {en ? "Get Started" : "Commencer Maintenant"}
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
          {/* Versions web allégées (faststart = lecture dès les 1ers octets) :
              720p ~2,7 Mo sur mobile, 1080p ~6 Mo ailleurs. Le poster = 1re image
              de la vidéo, donc aucune saute visuelle au démarrage. */}
          <video
            key={isFr ? "fr" : "en"}
            poster={isFr ? "/demo-duupflow-fr-v2-poster.jpg" : "/demo-us-poster.jpg"}
            className="absolute inset-0 h-full w-full object-cover"
            controls
            playsInline
            preload="auto"
            autoPlay
            muted
            loop
          >
            <source media="(max-width: 767px)" src={isFr ? "/demo-duupflow-fr-v2-720.mp4" : "/demo-us-720.mp4"} type="video/mp4" />
            <source src={isFr ? "/demo-duupflow-fr-v2-1080.mp4" : "/demo-us-1080.mp4"} type="video/mp4" />
          </video>
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
      f: { n: "Sacha L.", r: "Agence OFM", q: "Le volume de créatives qu'on peut sortir maintenant est incomparable. Chaque variante est traitée comme du neuf par les algos.", av: 7 },
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
      f: { n: "Sacha L.", r: "OFM agency", q: "The volume of creatives we can ship now is unmatched. Every variant is treated as brand-new by the algorithms.", av: 7 },
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
    <div className={`review-glass absolute inset-0 flex flex-col rounded-3xl p-6 [backface-visibility:hidden] ${back ? "[transform:rotateY(180deg)]" : ""}`}>
      <Stars />
      <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[#1a1a1a]">“{q}”</p>
      <div className="mt-4 flex items-center gap-3">
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
          <h2 className={`mx-auto mt-7 max-w-2xl ${SECTION_TITLE}`} style={SECTION_TITLE_STYLE}>
            {loc === "en" ? <>They already repost with <Brand />.</> : <>Ils repostent déjà avec <Brand />.</>}
          </h2>
        </div>
        <div className="relative mt-12 grid gap-5 md:grid-cols-3">
          {/* Halos derrière les cartes : donnent du relief au verre */}
          <span aria-hidden className="pointer-events-none absolute left-0 top-6 -z-10 h-56 w-[45%] rounded-full bg-[#4f7bff]/25 blur-[70px] sm:-left-10" />
          <span aria-hidden className="pointer-events-none absolute right-0 bottom-0 -z-10 h-56 w-[45%] rounded-full bg-[#7c5cff]/25 blur-[70px] sm:-right-10" />
          {REVIEWS[loc].map((r, i) => (
            <div key={i} className="group h-[250px] [perspective:1400px]">
              <div className="relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                <ReviewFace n={r.f.n} r={r.f.r} q={r.f.q} av={r.f.av} />
                <ReviewFace n={r.b.n} r={r.b.r} q={r.b.q} av={r.b.av} back />
              </div>
            </div>
          ))}
        </div>
        {/* 3 colonnes en mobile = 96 px par stat, avec des libellés sur 3 lignes.
            On empile en dessous de sm. */}
        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-5">
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
    { q: "DuupFlow va me servir à quoi ?", a: "DuupFlow te sert à republier tes meilleurs contenus partout sans être pénalisé. Tu transformes une seule vidéo en dizaines de variantes uniques, prêtes à poster sur plusieurs comptes et plusieurs plateformes — et tu peux même les monter automatiquement avec l'éditeur IA." },
    { q: "Quels sont les avantages d'utiliser DuupFlow ?", a: "Tu fais du volume de contenu sans effort supplémentaire : à partir d'un seul fichier, tu génères autant de variantes uniques que tu veux, chacune ré-encodée en profondeur. Tu alimentes plusieurs comptes, tu testes plus de formats et tu multiplies tes chances de percer — le tout en quelques secondes." },
    { q: "Concrètement, qu'est-ce qui est modifié dans mes vidéos ?", a: "Les métadonnées (appareil, date, encodeur, géolocalisation), une signature visuelle via des micro-variations sous le seuil de perception, et une empreinte binaire unique. Le fichier est ensuite entièrement ré-encodé. Ton montage, ton audio et ton cadrage restent identiques à l'original." },
    { q: "Est-ce que la qualité baisse ?", a: "Non. La résolution et le bitrate d'origine sont conservés : une 1080p reste 1080p, une 4K reste 4K. Aucune perte visible à l'écran." },
    { q: "Combien de variantes puis-je générer ?", a: "Autant que ton plan le permet : jusqu'à 300 vidéos par mois avec Solo, et un nombre illimité avec Pro et Agence. Chaque variante ressort unique, prête à alimenter plusieurs comptes." },
    { q: "Ça marche sur quelles plateformes ?", a: "Toutes. DuupFlow prépare les fichiers, tu postes où tu veux : TikTok, Instagram, YouTube, X, Reddit, Threads…" },
    { q: "L'éditeur IA, c'est quoi ?", a: "Un agent de montage piloté par conversation : tu uploades tes rushes, tu donnes une vidéo de référence et tu décris le montage voulu. L'IA (Claude) assemble la vidéo à ta place, puis en génère autant de variantes différentes que tu veux. Inclus dans les plans Solo, Pro et Agence." },
  ],
  en: [
    { q: "What is DuupFlow for?", a: "DuupFlow lets you repost your best content everywhere without getting penalized. Turn a single video into dozens of unique variants, ready to post across multiple accounts and platforms — and you can even edit them automatically with the AI editor." },
    { q: "What are the benefits of using DuupFlow?", a: "You scale your content with no extra effort: from a single file, generate as many unique variants as you want, each one re-encoded from the ground up. You feed multiple accounts, test more formats and multiply your chances of breaking through — all in a few seconds." },
    { q: "What exactly gets modified in my videos?", a: "The metadata (device, date, encoder, geolocation), a visual signature via micro-variations below the perception threshold, and a unique binary fingerprint. The file is then fully re-encoded. Your edit, audio and framing stay identical to the original." },
    { q: "Does quality drop?", a: "No. The original resolution and bitrate are kept: 1080p stays 1080p, 4K stays 4K. No visible loss on screen." },
    { q: "How many variants can I generate?", a: "As many as your plan allows: up to 300 videos per month on Solo, and unlimited on Pro and Agency. Every variant comes out unique, ready to feed multiple accounts." },
    { q: "Which platforms does it work on?", a: "All of them. DuupFlow prepares the files, you post wherever you want: TikTok, Instagram, YouTube, X, Reddit, Threads…" },
    { q: "What is the AI editor?", a: "A conversation-driven editing agent: you upload your footage, hand it a reference video and describe the edit you want. The AI (Claude) assembles the video for you, then generates as many different variations as you want. Included in the Solo, Pro and Agency plans." },
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
          <h2 className={`mt-7 ${SECTION_TITLE}`} style={SECTION_TITLE_STYLE}>
            {loc === "en" ? <>The questions<br className="hidden sm:block" /> <GradText>you're asking.</GradText></> : <>Les questions<br className="hidden sm:block" /> <GradText>que tu te poses.</GradText></>}
          </h2>
          <p className={`mt-5 max-w-sm ${SECTION_LEAD}`}>
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

/* ─── CTA ─── */
function CTA() {
  const en = useLocale() === "en";
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();
  /* Texte en dégradé clair : lisible sur le fond violet-bleu. */
  const hi = (t: string) => (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#ffffff 0%,#dfe7ff 55%,#efe4ff 100%)" }}>{t}</span>
  );
  return (
    <section className="px-6 pb-10">
      {/* Verre liquide : des nappes violet / bleu qui ondulent lentement DANS le
          bloc (lp-liquid-*, globals.css), recouvertes d'une plaque de verre
          (flou + reflets). Rien ne déborde : overflow-hidden + isolate. */}
      <div ref={viewRef} className={`relative isolate mx-auto max-w-6xl overflow-hidden rounded-[36px] px-8 py-16 text-center sm:py-20 ${inView ? "" : "anim-paused"}`}
        style={{ background: "linear-gradient(135deg,#5b78f6 0%,#7a6cf4 55%,#8f7cf7 100%)" }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <span className="lp-liquid-a absolute -left-[10%] -top-[30%] h-[85%] w-[55%] rounded-full" style={{ background: "radial-gradient(circle at 40% 40%, #38bdf8 0%, rgba(56,189,248,0) 70%)" }} />
          <span className="lp-liquid-b absolute -right-[12%] top-[5%] h-[90%] w-[55%] rounded-full" style={{ background: "radial-gradient(circle at 50% 50%, #a78bfa 0%, rgba(167,139,250,0) 70%)" }} />
          <span className="lp-liquid-c absolute -bottom-[35%] left-[25%] h-[80%] w-[50%] rounded-full" style={{ background: "radial-gradient(circle at 50% 50%, #4f7bff 0%, rgba(79,123,255,0) 70%)" }} />
          <span className="lp-liquid-d absolute left-[45%] -top-[25%] h-[60%] w-[35%] rounded-full" style={{ background: "radial-gradient(circle at 50% 50%, rgba(236,72,153,0.55) 0%, rgba(236,72,153,0) 70%)" }} />
          {/* Plaque de verre : flou des nappes + reflets sur les bords */}
          <span className="absolute inset-0 rounded-[36px] bg-white/[0.06] backdrop-blur-[36px]"
            style={{ boxShadow: "inset 2px 2px 1px -1px rgba(255,255,255,0.55), inset -2px -2px 1px -1px rgba(255,255,255,0.3), inset 0 0 60px rgba(255,255,255,0.18)" }} />
        </div>
        <h2 className={`mx-auto max-w-2xl ${SECTION_TITLE.replace("text-[#1a1a1a]", "text-white")}`} style={SECTION_TITLE_STYLE}>
          {en ? <>{hi("Multiply your content")} across every account.</> : <>{hi("Multiplie ton contenu")} sur tous tes comptes.</>}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[17px] text-white/85">
          {en ? "One video, dozens of unique variants ready to post. Your first copies in 3 minutes." : "Une vidéo, des dizaines de variantes uniques prêtes à poster. Tes premières copies en 3 minutes."}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#3b3fd8] shadow-[0_10px_30px_rgba(30,30,120,0.25)] transition hover:bg-white/90">
            {en ? "Get Started" : "Commencer Maintenant"}
          </Link>
          <Link href="/demo-request" className="rounded-full bg-white/15 px-7 py-3 text-sm font-medium text-white ring-1 ring-white/35 backdrop-blur transition hover:bg-white/25">
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
        {/* Grille fine "blueprint" bleuté/violet qui se fond (Features → Avant/après) */}
        <div className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)",
              backgroundSize: "130px 130px",
              maskImage: "radial-gradient(122% 88% at 50% 32%, #000 42%, transparent 92%)",
              WebkitMaskImage: "radial-gradient(122% 88% at 50% 32%, #000 42%, transparent 92%)",
            }} />
          <div className="relative">
            <FeatureSections />
          </div>
        </div>
        <Testimonials />
        <FAQ />
        <CTA />
        <Footer />
      </div>
    </div>
  );
}
