"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <a
      href={href}
      onClick={onClick}
      className={[
        "px-4 py-2 rounded-lg text-sm transition",
        active
          ? "text-white"
          : "text-white/60 hover:text-white/90",
      ].join(" ")}
      style={active ? { textShadow: "0 0 12px rgba(99,102,241,0.7), 0 0 30px rgba(99,102,241,0.3)" } : undefined}
    >
      {label}
    </a>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop: positioned below promo bar. Mobile: at top (no promo bar) */}
      <header className="fixed top-0 md:top-11 left-0 right-0 z-50 backdrop-blur-md" style={{ background: "rgba(11,15,26,0.2)", boxShadow: "0 1px 0 rgba(99,102,241,0.15), 0 4px 20px rgba(99,102,241,0.06)" }}>
        <div
          className="flex items-center justify-between px-4 sm:px-10 py-3 sm:py-4"
          style={{ maxWidth: "1280px", margin: "0 auto" }}
        >
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <Image src="/icon.png" alt="DuupFlow" width={160} height={50} className="h-8 sm:h-11 w-auto" />
          </Link>

          {/* Nav — desktop only */}
          <nav className="hidden md:flex items-center gap-3">
            <NavLink href="/fonctionnalites" label="Fonctionnalités" />
            <NavLink href="/tarifs" label="Tarifs" />
            <NavLink href="/#features" label="Avantages" />
            <NavLink href="https://www.duupflow.com/#faq" label="FAQ" />
          </nav>

          <div className="flex items-center gap-2">
            {/* CTA — desktop */}
            <Link
              href="/register"
              className="btn-glow hidden sm:inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white"
            >
              Commencer
            </Link>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex flex-col items-center justify-center gap-1.5 w-9 h-9 rounded-lg border border-white/15 bg-white/[0.05]"
              aria-label="Menu"
            >
              <span className={`block w-4 h-0.5 bg-white/70 transition-all ${menuOpen ? "rotate-45 translate-y-1" : ""}`} />
              <span className={`block w-4 h-0.5 bg-white/70 transition-all ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block w-4 h-0.5 bg-white/70 transition-all ${menuOpen ? "-rotate-45 -translate-y-1" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
      </header>

      {/* Mobile sidebar overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
      )}

      {/* Mobile sidebar — slides from right */}
      <div
        className={`md:hidden fixed top-0 right-0 bottom-0 z-[80] w-[65%] max-w-[280px] flex flex-col px-6 py-8 transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "rgba(8,12,30,0.97)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        <button onClick={() => setMenuOpen(false)} className="self-end mb-8 text-white/50 hover:text-white transition" aria-label="Fermer">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <nav className="flex flex-col gap-1">
          <NavLink href="/fonctionnalites" label="Fonctionnalités" onClick={() => setMenuOpen(false)} />
          <NavLink href="/tarifs" label="Tarifs" onClick={() => setMenuOpen(false)} />
          <NavLink href="/#features" label="Avantages" onClick={() => setMenuOpen(false)} />
          <NavLink href="/demo" label="Démo" onClick={() => setMenuOpen(false)} />
          <NavLink href="https://www.duupflow.com/#faq" label="FAQ" onClick={() => setMenuOpen(false)} />
        </nav>
        <div className="mt-auto pt-6">
          <Link
            href="/register"
            onClick={() => setMenuOpen(false)}
            className="btn-glow block text-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
          >
            Commencer gratuitement
          </Link>
        </div>
      </div>
    </>
  );
}
