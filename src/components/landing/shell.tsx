"use client";

/* ══════════════════════════════════════════════════════════════
 * DuupFlow — "chrome" partagé du branding clair (façon Lunera).
 * Nav, Footer, SmoothScroll, Label + tokens de marque.
 * Utilisé par la landing, le blog et la page contact (demo-request).
 * ══════════════════════════════════════════════════════════════ */

import Link from "@/components/LocaleLink";
import { useState, useEffect, type CSSProperties } from "react";
import { useParams } from "next/navigation";

/* Locale courante ("fr" par défaut, "en" sur /en). */
function useLocale(): "fr" | "en" {
  const params = useParams();
  const l = Array.isArray(params?.locale) ? params?.locale[0] : params?.locale;
  return l === "en" ? "en" : "fr";
}

/* ── Tokens de marque ── */
export const BLUE = "#4686FE";
export const INK = "#1a1a1a";
export const GRAY = "#605f5f";
export const CTA_GRAD = "linear-gradient(135deg,#4f7bff 0%,#7c5cff 100%)";

/* Wordmark "DuupFlow" — "Flow" en dégradé de marque (comme la navbar).
   À utiliser partout où le nom apparaît en texte visible. */
export function Brand({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={className} style={style}>
      Duup<span className="bg-clip-text text-transparent" style={{ backgroundImage: CTA_GRAD }}>Flow</span>
    </span>
  );
}

/* ── Nav : large en haut, se réduit en pilule au 1er scroll ── */
export function NavPill() {
  const en = useLocale() === "en";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:pt-5">
      <nav
        className={`mx-auto flex items-center justify-between gap-4 rounded-full bg-white/95 shadow-[0_10px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 backdrop-blur transition-all duration-500 ease-out ${
          scrolled ? "py-3 pl-5 pr-3" : "py-[1.15rem] pl-8 pr-4"
        }`}
        style={{ maxWidth: scrolled ? "48rem" : "62rem", width: "100%" }}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <img src="/logo-mark.png" alt="" className={`object-contain transition-all duration-500 ${scrolled ? "h-7 w-7" : "h-10 w-10"}`} />
          <Brand className={`font-bold tracking-tight text-[#1a1a1a] transition-all duration-500 ${scrolled ? "text-lg" : "text-2xl"}`} />
        </Link>
        <div className={`hidden items-center text-[#1a1a1a] transition-all duration-500 md:flex ${scrolled ? "gap-7 text-[15px]" : "gap-9 text-[17px]"}`}>
          <Link href="/#features" className="hover:opacity-60 transition">{en ? "Features" : "Fonctionnalités"}</Link>
          <Link href="/blog" className="hover:opacity-60 transition">Blog</Link>
          <Link href="/#faq" className="hover:opacity-60 transition">FAQ</Link>
          <Link href="/demo-request" className="hover:opacity-60 transition">Contact</Link>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link href="/login" aria-label={en ? "Log in" : "Se connecter"}
            className="hidden h-10 w-10 items-center justify-center rounded-full text-[#1a1a1a] ring-1 ring-black/10 transition hover:bg-black/5 sm:flex">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
          </Link>
          <Link href="/pricing"
            className={`rounded-full font-medium text-white shadow-[0_10px_26px_rgba(90,90,240,0.35)] transition-all duration-500 hover:opacity-90 ${scrolled ? "px-5 py-2.5 text-sm" : "px-6 py-3 text-[15px]"}`}
            style={{ background: CTA_GRAD }}>
            {en ? "Get started" : "Commencer"}
          </Link>
        </div>
      </nav>
    </div>
  );
}

/* ── Petit label de section ── */
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-black/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-[#1a1a1a] ring-1 ring-black/5">
      {children}
    </span>
  );
}

/* ── Smooth scroll (fluide, façon Framer) ── */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return; // tactile: scroll natif
    let target = window.scrollY, current = window.scrollY, raf = 0, running = false;
    const clamp = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target = Math.max(0, Math.min(target, max));
    };
    const loop = () => {
      current += (target - current) * 0.13;
      if (Math.abs(target - current) < 0.4) { current = target; running = false; window.scrollTo(0, current); return; }
      window.scrollTo(0, current);
      raf = requestAnimationFrame(loop);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      if (!running) { current = window.scrollY; target = window.scrollY; }
      target += e.deltaY;
      clamp();
      if (!running) { running = true; raf = requestAnimationFrame(loop); }
    };
    const onKey = () => { if (!running) { target = window.scrollY; current = window.scrollY; } };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", clamp);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", clamp);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}

/* ── Footer (bloc bleu + wordmark géant) ── */
const FOOTER_SOCIALS = [
  { name: "TikTok", d: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.17a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.6z" },
  { name: "Instagram", d: "M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 017.8 2zm-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zM12 7a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6z" },
  { name: "YouTube", d: "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
  { name: "X", d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
];
function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <ul className="mt-4 space-y-3">
        {links.map(([l, h], i) => (
          <li key={i}><Link href={h} className="text-sm text-white/70 transition hover:text-white">{l}</Link></li>
        ))}
      </ul>
    </div>
  );
}
export function Footer() {
  const en = useLocale() === "en";
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-8 overflow-hidden text-white"
      style={{ background: "linear-gradient(115deg, rgba(124,60,255,0) 40%, rgba(124,60,255,0.55) 100%), linear-gradient(180deg,#ffffff 0%,#e9f0ff 9%,#4074ff 40%,#2160f4 72%,#1a53ec 100%)" }}>
      <div className="mx-auto max-w-6xl px-6 pt-24">
        <div className="grid gap-10 md:grid-cols-[1.5fr_0.9fr_0.9fr_1.5fr]">
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo-mark.png" alt="" className="h-8 w-8 object-contain brightness-0 invert" />
              <Brand className="text-xl font-semibold tracking-tight" />
            </div>
            <p className="mt-4 max-w-[240px] text-sm leading-relaxed text-white/75">
              {en
                ? "Repost your best content everywhere, without ever publishing the same file twice."
                : "Republie tes meilleurs contenus partout, sans jamais publier deux fois le même fichier."}
            </p>
            <div className="mt-6 flex items-center gap-2.5">
              {FOOTER_SOCIALS.map((s) => (
                <a key={s.name} href="#" aria-label={s.name}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 transition hover:bg-white/25">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d={s.d} /></svg>
                </a>
              ))}
            </div>
          </div>
          <FooterCol title={en ? "Product" : "Produit"} links={[[en ? "Features" : "Fonctionnalités", "/#features"], ["FAQ", "/#faq"], [en ? "Pricing" : "Tarifs", "/pricing"]]} />
          <FooterCol title={en ? "Resources" : "Ressources"} links={[["Blog", "/blog"], ["Contact", "/demo-request"], [en ? "Partners" : "Partenaires", "/partners"]]} />
          <div className="md:max-w-sm md:justify-self-end">
            <h4 className="text-sm font-semibold text-white">{en ? "Stay in the loop" : "Reste informé des nouveautés"}</h4>
            <p className="mt-2 text-sm text-white/70">{en ? "Reposting tips & product updates, no spam." : "Astuces reposting & mises à jour produit, sans spam."}</p>
            <div className="mt-4 flex items-center gap-1 rounded-full bg-white p-1 shadow-[0_10px_30px_rgba(10,30,90,0.25)]">
              <input type="email" placeholder={en ? "Your email address" : "Ton adresse email"}
                className="min-w-0 flex-1 bg-transparent px-4 text-sm text-[#1a1a1a] outline-none placeholder:text-[#9aa2b2]" />
              <Link href="/register" className="shrink-0 rounded-full px-5 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: "#1a53ec" }}>
                {en ? "Subscribe" : "S'inscrire"}
              </Link>
            </div>
            <div className="mt-5 flex gap-5 text-sm text-white/70">
              <Link href="/legal/terms" className="transition hover:text-white">{en ? "Terms" : "CGU"}</Link>
              <Link href="/legal/privacy" className="transition hover:text-white">{en ? "Privacy" : "Confidentialité"}</Link>
              <Link href="/legal" className="transition hover:text-white">{en ? "Legal" : "Mentions légales"}</Link>
            </div>
          </div>
        </div>
        <p className="mt-16 text-xs text-white/60">© {year} <Brand />. {en ? "All rights reserved." : "Tous droits réservés."}</p>
      </div>
      <div aria-hidden className="pointer-events-none -mt-4 select-none overflow-hidden sm:-mt-10" style={{ height: "clamp(64px, 13.5vw, 200px)" }}>
        <div className="mx-auto flex max-w-[1500px] items-center justify-center px-4">
          <Brand className="whitespace-nowrap font-bold leading-none tracking-[-0.045em] text-white/70"
            style={{ fontSize: "clamp(88px, 19vw, 280px)" }} />
        </div>
      </div>
    </footer>
  );
}
