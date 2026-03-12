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
        "group relative px-3 py-2 rounded-lg text-sm transition",
        active ? "text-white" : "text-white/60 hover:text-white/90",
      ].join(" ")}
    >
      {label}
    </a>
  );
}

export default function Header() {
  return (
    <div className="sticky top-4 z-40">
      <div className="max-w-5xl mx-auto px-4">
        <div
          className="flex items-center justify-between px-5 py-3 rounded-2xl border border-white/[0.10] backdrop-blur-md"
          style={{ background: "rgba(11,15,26,0.80)", boxShadow: "0 8px 30px rgba(0,0,0,.35)" }}
        >
          {/* Logo */}
          <Link href="/" className="text-lg font-extrabold tracking-tight shrink-0">
            <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
              Duup
            </span>
            <span className="text-white/70">Flow</span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="#features" label="Fonctionnalités" />
            <NavLink href="#how" label="Comment ça marche" />
            <NavLink href="#faq" label="FAQ" />
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#5B5BEA,#FF3FD1)" }}
            >
              Accéder →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
