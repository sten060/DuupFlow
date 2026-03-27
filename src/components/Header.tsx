"use client";

import Link from "next/link";
import Image from "next/image";
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
    <div className="fixed top-9 left-0 right-0 z-50 px-3 sm:px-6">
      <div
        className="relative flex items-center justify-between px-4 sm:px-8 py-2 sm:py-3.5 rounded-full border border-white/[0.14] backdrop-blur-xl"
        style={{
          background: "rgba(11,15,26,0.25)",
          maxWidth: "1280px",
          margin: "0 auto",
        }}
      >
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <Image src="/icon.png" alt="DuupFlow" width={120} height={40} className="h-7 sm:h-10 w-auto" />
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
          <NavLink href="https://www.duupflow.com/#features" label="Fonctionnalités" />
          <NavLink href="/how-it-works" label="Comment ça marche" />
          <NavLink href="/tarifs" label="Tarifs" />
          <NavLink href="https://www.duupflow.com/#faq" label="FAQ" />
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white/70 hover:text-white transition border border-white/[0.12] hover:border-white/25 hover:bg-white/[0.04]"
          >
            Connexion
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            S&apos;inscrire →
          </Link>
        </div>
      </div>
    </div>
  );
}
