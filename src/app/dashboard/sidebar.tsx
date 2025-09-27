"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

function NavLink({
  href,
  label,
}: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={[
        "block rounded-md px-3 py-2 text-sm",
        active
          ? "bg-indigo-600 text-white"
          : "text-gray-300 hover:bg-zinc-800 hover:text-white",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const [openDup, setOpenDup] = React.useState(true);

  return (
    <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900/40">
      <div className="p-4">
        <div className="mb-4 text-xs uppercase tracking-wide text-gray-400">
          Navigation
        </div>

        <nav className="space-y-1">
          <NavLink href="/dashboard" label="Dashboard" />

          {/* Groupe Duplication (collapsable) */}
          <button
            onClick={() => setOpenDup((v) => !v)}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-gray-300 hover:bg-zinc-800 hover:text-white"
          >
            <span>Duplication</span>
            <span className="text-xs opacity-70">{openDup ? "▾" : "▸"}</span>
          </button>

          {openDup && (
            <div className="ml-2 space-y-1">
              <NavLink href="/dashboard/videos" label="Vidéos" />
              <NavLink href="/dashboard/images" label="Images" />
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
}
