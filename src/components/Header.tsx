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
        active ? "text-white" : "text-white/60 hover:text-white/90",
      ].join(" ")}
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
      <header className="fixed top-0 md:top-11 left-0 right-0 z-50 backdrop-blur-md" style={{ background: "rgba(11,15,26,0.2)" }}>
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
            <NavLink href="https://www.duupflow.com/#features" label="Fonctionnalités" />
            <NavLink href="/tarifs" label="Tarifs" />
            <NavLink href="/avantages" label="Avantages" />
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
        {menuOpen && (
          <div
            className="md:hidden border-t border-white/[0.08] px-4 py-4 space-y-1"
            style={{ background: "rgba(11,15,26,0.95)" }}
          >
            <NavLink href="https://www.duupflow.com/#features" label="Fonctionnalités" onClick={() => setMenuOpen(false)} />
            <NavLink href="/tarifs" label="Tarifs" onClick={() => setMenuOpen(false)} />
            <NavLink href="/avantages" label="Avantages" onClick={() => setMenuOpen(false)} />
            <NavLink href="/demo" label="Démo" onClick={() => setMenuOpen(false)} />
            <NavLink href="https://www.duupflow.com/#faq" label="FAQ" onClick={() => setMenuOpen(false)} />
            <div className="pt-2">
              <Link
                href="/register"
                onClick={() => setMenuOpen(false)}
                className="btn-glow block text-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
              >
                Commencer gratuitement
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
