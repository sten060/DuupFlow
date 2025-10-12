// /src/app/dashboard/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client"; // ton helper côté client

function Item({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const p = usePathname();
  const active = p === href;
  return (
    <Link
      href={href}
      className={[
        "group flex items-center gap-3 rounded-xl px-3 py-3",
        "border border-white/10 bg-white/5 hover:bg-white/[0.08]",
        "transition-colors",
        active ? "ring-1 ring-white/10" : "",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-8 w-8 items-center justify-center rounded-lg",
          "bg-white/[0.06] border border-white/10",
        ].join(" ")}
        aria-hidden
      >
        {icon}
      </span>
      <span className="font-medium text-white group-hover:text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-indigo-400 transition-colors">
        {label}
      </span>
      {/* petit point d’état à droite */}
      <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_8px_#34d399]" />
    </Link>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut().catch(() => {});
    // redirection propre vers la home
    router.push("/");
    router.refresh();
  };

  return (
    <aside
      className={[
        // largeur un peu plus grande + décollée du bord
        "w-[280px] shrink-0",
        "pl-6 pr-4",
      ].join(" ")}
    >
      <div
        className={[
          "rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md",
          "shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)]",
          "p-4",
        ].join(" ")}
      >
        <div className="text-xs tracking-wider text-white/50 px-1 pb-2">
          MENU
        </div>

        <div className="space-y-3">
          <Item
            href="/dashboard"
            label="Accueil"
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-white/80"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 12l9-9 9 9" />
                <path d="M9 21V9h6v12" />
              </svg>
            }
          />
          <Item
            href="/dashboard/images"
            label="Duplication Images"
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-pink-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            }
          />
          <Item
            href="/dashboard/videos"
            label="Duplication Vidéos"
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-blue-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="5" width="14" height="14" rx="2" />
                <path d="M17 8l4-2v12l-4-2z" />
              </svg>
            }
          />
          <Item
            href="/dashboard/similarity"
            label="Détecteur"
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-emerald-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M3 12h3M18 12h3M12 3v3M12 18v3" />
              </svg>
            }
          />
          <Item
            href="/dashboard/generate"
            label="Variation IA (BETA)"
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-fuchsia-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2l3 5-3 5-3-5 3-5z" />
                <path d="M5 19h14" />
              </svg>
            }
          />
        </div>

        {/* Séparateur */}
        <div className="my-4 h-px bg-white/10" />

        <button
          onClick={logout}
          className={[
  "w-full flex items-center gap-3 rounded-xl px-3 py-3",
  "border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,.5)]",
  "text-white/80 hover:text-rose-300 transition",
].join(" ")}
        >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] border border-white/10"
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
            </svg>
          </span>
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}