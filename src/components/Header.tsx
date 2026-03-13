"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <a
      href={href}
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
  return (
    <div className="fixed top-4 left-0 right-0 z-50 px-6">
      <div
        className="flex items-center justify-between px-8 py-3.5 rounded-full border border-white/[0.14] backdrop-blur-xl"
        style={{
          background: "rgba(11,15,26,0.25)",
          maxWidth: "1280px",
          margin: "0 auto",
        }}
      >
        {/* Logo */}
        <Link href="/" className="text-lg font-extrabold tracking-tight shrink-0">
          <span style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-white/60">Flow</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          <NavLink href="/#features" label="Fonctionnalités" />
          <NavLink href="/comment-ca-marche" label="Comment ça marche" />
          <NavLink href="/tarifs" label="Tarifs" />
          <NavLink href="/#faq" label="FAQ" />
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium text-white/70 hover:text-white transition border border-white/[0.12] hover:border-white/25 hover:bg-white/[0.04]"
          >
            Connexion
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            S&apos;inscrire →
          </Link>
        </div>
      </div>
    </div>
  );
}
