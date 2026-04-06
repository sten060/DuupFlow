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
    <header className="fixed top-11 left-0 right-0 z-50 backdrop-blur-md" style={{ background: "rgba(11,15,26,0.2)" }}>
      <div
        className="flex items-center justify-between px-6 sm:px-10 py-3 sm:py-4"
        style={{ maxWidth: "1280px", margin: "0 auto" }}
      >
        {/* Logo */}
        <Link href="/" className="shrink-0 flex items-center gap-2">
          <Image src="/icon.png" alt="DuupFlow" width={160} height={50} className="h-9 sm:h-11 w-auto" />
        </Link>

        {/* Nav — centered */}
        <nav className="hidden md:flex items-center gap-3">
          <NavLink href="https://www.duupflow.com/#features" label="Fonctionnalités" />
          <NavLink href="/tarifs" label="Tarifs" />
          <NavLink href="/avantages" label="Avantages" />
          <NavLink href="https://www.duupflow.com/#faq" label="FAQ" />
        </nav>

        {/* CTA */}
        <Link
          href="/register"
          className="btn-glow inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white"
        >
          Commencer
        </Link>
      </div>
    </header>
  );
}
