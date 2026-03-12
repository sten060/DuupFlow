// /src/app/dashboard/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  // Active si chemin exact ou sous-chemin (pour /dashboard/videos/simple etc)
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
      {/* Icon */}
      <span
        className={active ? "text-indigo-300" : "text-white/35"}
        style={active ? { filter: "drop-shadow(0 0 4px rgba(99,102,241,0.7))" } : {}}
      >
        {icon}
      </span>

      {/* Label */}
      <span className="flex-1 leading-tight">{label}</span>

      {/* Badge BETA */}
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

      {/* Active dot */}
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
  return (
    <nav className="flex-1 px-3 pb-6 space-y-0.5">
      <p className="text-[10px] tracking-[0.15em] text-white/25 uppercase px-3 mb-3">Menu</p>
      {NAV_ITEMS.map((item) => (
        <Item key={item.href} {...item} />
      ))}
    </nav>
  );
}
