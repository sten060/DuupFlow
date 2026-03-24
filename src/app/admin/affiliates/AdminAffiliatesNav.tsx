"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABS = [
  { label: "Vue globale", href: "/admin/affiliates" },
  { label: "Comptabilité", href: "/admin/affiliates/accounting" },
  { label: "Partenaires", href: "/admin/affiliates/partners" },
];

export default function AdminAffiliatesNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div
      className="sticky top-0 z-10"
      style={{ background: "rgba(6,9,24,0.90)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: title */}
        <p className="text-sm font-semibold text-white/70 shrink-0">Partenariats affiliés</p>

        {/* Center: tabs */}
        <nav className="flex items-center gap-1">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition"
                style={
                  active
                    ? { background: "rgba(99,102,241,0.18)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.30)" }
                    : { color: "rgba(255,255,255,0.35)", border: "1px solid transparent" }
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition px-3 py-1.5 rounded-lg shrink-0"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Déconnexion
        </button>
      </div>
    </div>
  );
}
