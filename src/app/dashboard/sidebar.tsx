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
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/dashboard/images",
    label: "Images",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    href: "/dashboard/videos",
    label: "Vidéos",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="14" height="14" rx="2" />
        <path d="M16 9l5-3v12l-5-3V9z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/similarity",
    label: "Comparateur",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    href: "/dashboard/generate",
    label: "Variation IA",
    badge: "BETA",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ai-detection",
    label: "Détection IA",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

function NavItem({ href, label, icon, badge }: { href: string; label: string; icon: React.ReactNode; badge?: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        active ? "text-white" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]",
      ].join(" ")}
      style={active ? {
        background: "rgba(99,102,241,0.13)",
        boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.22)",
      } : {}}
    >
      <span className={active ? "text-indigo-300" : "text-white/30"}>
        {icon}
      </span>
      <span className="flex-1 leading-tight">{label}</span>
      {badge && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: "rgba(56,189,248,0.10)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.22)" }}
        >
          {badge}
        </span>
      )}
      {active && (
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ background: "#38BDF8", boxShadow: "0 0 5px rgba(56,189,248,0.7)" }}
        />
      )}
    </Link>
  );
}

type Profile = { first_name: string; agency_name: string; is_guest: boolean; host_user_id: string | null };

export default function Sidebar() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hostAgency, setHostAgency] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("first_name, agency_name, is_guest, host_user_id")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        // If guest, load host's agency name
        if (data.is_guest && data.host_user_id) {
          const { data: hostProfile } = await supabase
            .from("profiles")
            .select("agency_name")
            .eq("id", data.host_user_id)
            .single();
          if (hostProfile) setHostAgency(hostProfile.agency_name);
        }
      }
    }
    loadProfile();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = profile?.first_name ?? "—";
  const displayAgency = profile?.is_guest ? hostAgency : profile?.agency_name;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto pt-1">
        <p className="text-[10px] tracking-[0.14em] text-white/20 uppercase px-3 mb-2.5">Navigation</p>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-5 shrink-0">
        <div className="mx-2 mb-3" style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/35 hover:text-white/65 hover:bg-white/[0.04] transition-all w-full mb-1"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Paramètres</span>
        </Link>

        {/* User card */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1"
          style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80 truncate leading-none mb-0.5">
              {displayName}
            </p>
            {displayAgency && (
              <p className="text-[10px] text-white/30 truncate leading-none">{displayAgency}</p>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/30 hover:text-red-400/70 hover:bg-red-500/[0.05] transition-all w-full mt-1"
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
