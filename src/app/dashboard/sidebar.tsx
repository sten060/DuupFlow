// src/app/dashboard/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/cn";
import SignOutButton from "@/components/SignOutButton";

const items = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/dashboard/images", label: "Duplication Images" },
  { href: "/dashboard/videos", label: "Duplication Vidéos" },
  { href: "/dashboard/similarity", label: "Détecteur (vert)", accent: "green" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
      <div className="mb-3 text-xs uppercase tracking-wider text-white/50">Menu</div>
      <nav className="space-y-2">
        {items.map((it) => {
          const active = pathname === it.href;
          const ring =
            it.accent === "green"
              ? "ring-emerald-400/40 hover:ring-emerald-400/60"
              : "ring-indigo-400/40 hover:ring-indigo-400/60";
          return (
            <Link
              key={it.href}
              href={it.href}
              prefetch={false}
              className={[
                "block rounded-xl px-3 py-2 border border-white/10 bg-white/[0.02]",
                "transition shadow-sm hover:bg-white/[0.04]",
                "ring-1 ring-inset",
                ring,
                active ? "bg-white/[0.06]" : "",
              ].join(" ")}
            >
              <span className="text-sm">{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-white/10 pt-2">
  <SignOutButton />
</div>
    </aside>
  );
}