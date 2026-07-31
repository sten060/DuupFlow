"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { useLocalizedHref } from "@/lib/i18n/href";

function NavLink({ href, label, onClick, light }: { href: string; label: string; onClick?: () => void; light?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <a
      href={href}
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-lg text-[13px] font-medium uppercase tracking-[0.08em] transition",
        light
          ? (active ? "text-slate-900" : "text-slate-500 hover:text-slate-900")
          : (active ? "text-white" : "text-white/55 hover:text-white/90"),
      ].join(" ")}
      style={active && !light ? { textShadow: "0 0 12px rgba(99,102,241,0.7), 0 0 30px rgba(99,102,241,0.3)" } : undefined}
    >
      {label}
    </a>
  );
}

export default function Header() {
  const { t } = useTranslation();
  const lh = useLocalizedHref();
  const [menuOpen, setMenuOpen] = useState(false);
  const light = false; // LP en thème sombre

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 backdrop-blur-md"
        style={light
          ? { background: "rgba(255,255,255,0.72)" }
          : { background: "transparent" }}>
        <div
          className="flex items-center justify-between px-4 sm:px-8 py-2 sm:py-2.5"
          style={{ maxWidth: "1440px", margin: "0 auto" }}
        >
          {/* Logo + brand + nav — grouped on the left so the links sit close to the brand */}
          <div className="flex items-center gap-6 xl:gap-9">
            <Link href={lh("/")} className="shrink-0 flex items-center gap-1.5 sm:gap-2">
              <Image src="/logo-mark.png" alt="DuupFlow" width={64} height={64} priority className="h-10 w-10 sm:h-14 sm:w-14 object-contain" />
              <span className="text-xl sm:text-[28px] font-extrabold tracking-tight">
                <span style={{ color: "#6366F1" }}>Duup</span>
                <span className={light ? "text-slate-800" : "text-white/55"}>Flow</span>
              </span>
            </Link>

            {/* Nav — desktop only */}
            <nav className="hidden xl:flex items-center gap-1">
              <NavLink href={lh("/features")} label={t("nav.fonctionnalites")} light={light} />
              <NavLink href={lh("/pricing")} label={t("nav.tarifs")} light={light} />
              <NavLink href={lh("/#features")} label={t("nav.avantages")} light={light} />
              <NavLink href="https://www.duupflow.com/#faq" label={t("nav.faq")} light={light} />
            </nav>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sign in — desktop */}
            <Link
              href={lh("/login")}
              className={`hidden xl:inline-flex items-center whitespace-nowrap px-3 py-2 text-sm transition ${light ? "text-slate-600 hover:text-slate-900" : "text-white/70 hover:text-white"}`}
            >
              {t("nav.seConnecter")}
            </Link>

            {/* Try — colored glow pill, desktop */}
            <Link
              href={lh("/pricing")}
              className="btn-glow hidden xl:inline-flex items-center whitespace-nowrap rounded-full px-6 py-2.5 text-sm font-semibold text-white"
            >
              {t("nav.essayer")}
            </Link>

            {/* Hamburger — mobile/tablet only */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`xl:hidden flex flex-col items-center justify-center gap-1.5 w-10 h-10 rounded-lg border ${light ? "border-slate-200 bg-slate-100" : "border-white/15 bg-white/[0.05]"}`}
              aria-label={t("nav.menuLabel")}
            >
              <span className={`block w-4 h-0.5 transition-all ${light ? "bg-slate-700" : "bg-white/70"} ${menuOpen ? "rotate-45 translate-y-1" : ""}`} />
              <span className={`block w-4 h-0.5 transition-all ${light ? "bg-slate-700" : "bg-white/70"} ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block w-4 h-0.5 transition-all ${light ? "bg-slate-700" : "bg-white/70"} ${menuOpen ? "-rotate-45 -translate-y-1" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {menuOpen && (
        <div className="xl:hidden fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
      )}

      {/* Mobile sidebar — slides from right */}
      <div
        className={`xl:hidden fixed top-0 right-0 bottom-0 z-[80] w-[72%] max-w-[300px] flex flex-col px-6 py-8 transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "rgba(8,12,30,0.97)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        <button onClick={() => setMenuOpen(false)} className="self-end mb-8 text-white/50 hover:text-white transition" aria-label={t("nav.closeLabel")}>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <nav className="flex flex-col gap-1">
          <NavLink href={lh("/features")} label={t("nav.fonctionnalites")} onClick={() => setMenuOpen(false)} />
          <NavLink href={lh("/pricing")} label={t("nav.tarifs")} onClick={() => setMenuOpen(false)} />
          <NavLink href={lh("/#features")} label={t("nav.avantages")} onClick={() => setMenuOpen(false)} />
          <NavLink href="https://www.duupflow.com/#faq" label={t("nav.faq")} onClick={() => setMenuOpen(false)} />
        </nav>
        <div className="mt-auto pt-6 flex flex-col gap-3">
          <Link
            href={lh("/login")}
            onClick={() => setMenuOpen(false)}
            className="block text-center px-5 py-2 text-sm text-white/70 hover:text-white transition"
          >
            {t("nav.seConnecter")}
          </Link>
          <Link
            href={lh("/pricing")}
            onClick={() => setMenuOpen(false)}
            className="btn-glow block text-center rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t("nav.essayer")}
          </Link>
        </div>
      </div>
    </>
  );
}
