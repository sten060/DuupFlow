// /src/app/dashboard/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Accueil",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12l9-9 9 9" /><path d="M9 21V9h6v12" />
      </svg>
    ),
  },
  {
    href: "/dashboard/images",
    label: "Duplication Images",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/videos",
    label: "Duplication Vidéos",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="14" height="14" rx="2" /><path d="M17 8l4-2v12l-4-2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/similarity",
    label: "Détecteur",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4" /><path d="M3 12h3M18 12h3M12 3v3M12 18v3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/generate",
    label: "Variation IA",
    badge: "BETA",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l3 5-3 5-3-5 3-5z" /><path d="M5 19h14" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ai-detection",
    label: "Détection IA",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
      </svg>
    ),
  },
];

function Item({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "text-white"
          : "text-white/45 hover:text-white/80 hover:bg-white/[0.04]",
      ].join(" ")}
      style={
        active
          ? {
              background: "rgba(99,102,241,0.15)",
              boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.25), 0 0 12px rgba(99,102,241,0.12)",
            }
          : {}
      }
    >
      <span
        className={active ? "text-indigo-300" : "text-white/35"}
        style={active ? { filter: "drop-shadow(0 0 4px rgba(99,102,241,0.7))" } : {}}
      >
        {icon}
      </span>
      <span className="flex-1 leading-tight">{label}</span>
      {badge && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{
            background: "rgba(56,189,248,0.12)",
            color: "#38BDF8",
            border: "1px solid rgba(56,189,248,0.25)",
          }}
        >
          {badge}
        </span>
      )}
      {active && (
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{
            background: "#38BDF8",
            boxShadow: "0 0 6px rgba(56,189,248,0.8)",
          }}
        />
      )}
    </Link>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Nav items */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] tracking-[0.15em] text-white/25 uppercase px-3 mb-3">Menu</p>
        {NAV_ITEMS.map((item) => (
          <Item key={item.href} {...item} />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-5 shrink-0">
        <div className="mx-2 mb-3" style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

        {/* Paramètres */}
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all w-full"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Paramètres</span>
        </Link>

        {/* User email */}
        {userEmail && (
          <div className="flex items-center gap-2 px-3 py-2 mt-0.5">
            <div
              className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
              style={{ background: "rgba(99,102,241,0.25)", color: "#818CF8" }}
            >
              {userEmail[0].toUpperCase()}
            </div>
            <span className="text-xs text-white/30 truncate flex-1">{userEmail}</span>
          </div>
        )}

        {/* Déconnexion */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/35 hover:text-red-400/80 hover:bg-red-500/[0.06] transition-all w-full mt-0.5"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
