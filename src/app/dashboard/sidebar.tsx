"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/context";
import { bindNotificationsUser } from "./components/notificationStore";

const COLLAPSE_KEY = "duupflow_sidebar_collapsed";

function NavItem({
  href, label, icon, badge, tourId, collapsed,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  tourId?: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      data-tour-id={tourId}
      title={collapsed ? label : undefined}
      className={[
        "flex items-center rounded-lg text-sm font-medium transition-all",
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
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
      {!collapsed && <span className="flex-1 leading-tight">{label}</span>}
      {!collapsed && badge && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: "rgba(56,189,248,0.10)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.22)" }}
        >
          {badge}
        </span>
      )}
      {!collapsed && active && (
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ background: "#38BDF8", boxShadow: "0 0 5px rgba(56,189,248,0.7)" }}
        />
      )}
    </Link>
  );
}

function BottomLink({
  href, label, icon, tourId, collapsed, badge,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  tourId?: string;
  collapsed: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      data-tour-id={tourId}
      title={collapsed ? label : undefined}
      className={[
        "flex items-center rounded-lg text-sm text-white/35 hover:text-white/65 hover:bg-white/[0.04] transition-all w-full mb-1",
        collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2",
      ].join(" ")}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && badge && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
          style={{ background: "rgba(56,189,248,0.10)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.22)" }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

type Profile = { first_name: string; agency_name: string; is_guest: boolean; host_user_id: string | null };

export default function Sidebar() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hostAgency, setHostAgency] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslation();

  // Close the mobile drawer whenever the route changes (a nav link was tapped).
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  // Skip the persist write on the very first effect pass (before we've read
  // the stored value).
  const skipPersist = useRef(true);

  // Nav grouped per spec — a separator is drawn between each group:
  //   Accueil · [Images, Vidéos] · [Compresseur, Comparateur] · [Variation IA, Détection IA]
  const NAV_GROUPS: Array<
    Array<{ href: string; label: string; icon: React.ReactNode; badge?: string; tourId?: string }>
  > = [
    [
      {
        href: "/dashboard",
        label: t("dashboard.sidebar.accueil"),
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        ),
      },
    ],
    [
      {
        href: "/dashboard/images",
        label: t("dashboard.sidebar.images"),
        tourId: "nav-images",
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
        label: t("dashboard.sidebar.videos"),
        tourId: "nav-videos",
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="5" width="14" height="14" rx="2" />
            <path d="M16 9l5-3v12l-5-3V9z" />
          </svg>
        ),
      },
      {
        href: "/dashboard/import",
        label: "Scraper",
        badge: t("dashboard.sidebar.nouveau"),
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        ),
      },
    ],
    [
      {
        href: "/dashboard/compress",
        label: t("dashboard.sidebar.compresseur"),
        tourId: "nav-compress",
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        ),
      },
      {
        href: "/dashboard/similarity",
        label: t("dashboard.sidebar.comparateur"),
        tourId: "nav-similarity",
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        ),
      },
    ],
    [
      {
        href: "/dashboard/generate",
        label: t("dashboard.sidebar.variationIA"),
        tourId: "nav-variation",
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
          </svg>
        ),
      },
      {
        href: "/dashboard/ai-detection",
        label: t("dashboard.sidebar.detectionIA"),
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
      },
    ],
  ];

  // Restore persisted collapse state on mount. With no saved preference yet,
  // start collapsed on mobile only (≤767px, below Tailwind's md breakpoint);
  // desktop/tablet keep the expanded default.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored === "1") {
        setCollapsed(true);
      } else if (stored === null && window.matchMedia("(max-width: 767px)").matches) {
        setCollapsed(true);
      }
    } catch {}
  }, []);

  // Persist whenever the user toggles (skip the initial pass).
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

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
    // Empty the (per-user) notification panel immediately so it can't flash to
    // the next account that signs in on this browser.
    bindNotificationsUser(null);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = profile?.first_name ?? "—";
  const displayAgency = profile?.is_guest ? hostAgency : profile?.agency_name;

  return (
    <>
    {/* ===== Desktop sidebar (hidden on mobile — replaced by the hamburger) ===== */}
    <aside
      className={[
        "hidden md:flex shrink-0 flex-col overflow-y-auto relative z-10 transition-[width] duration-300 ease-out",
        collapsed ? "w-16" : "w-56",
      ].join(" ")}
      style={{
        background: "rgba(8,12,30,0.95)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Brand — logo doubles as the "expand" trigger when collapsed; the
          chevron button (expanded only) collapses it. */}
      <div className={["shrink-0 flex items-center pt-6 pb-5", collapsed ? "justify-center px-2" : "gap-2.5 px-5"].join(" ")}>
        <button
          type="button"
          onClick={() => { if (collapsed) setCollapsed(false); }}
          title={collapsed ? t("dashboard.sidebar.expandMenu") : undefined}
          aria-label={collapsed ? t("dashboard.sidebar.expandMenu") : "DuupFlow"}
          className={collapsed ? "cursor-pointer transition-transform hover:scale-105" : "cursor-default shrink-0"}
        >
          <Image
            src="/logo-mark.png"
            alt="DuupFlow"
            width={200}
            height={200}
            className={collapsed ? "h-8 w-8 object-contain" : "h-9 w-auto object-contain"}
            priority
          />
        </button>
        {!collapsed && (
          <span className="text-2xl font-extrabold tracking-tight leading-none whitespace-nowrap">
            <span style={{ color: "#818CF8" }}>Duup</span>
            <span className="text-white/55">Flow</span>
          </span>
        )}
      </div>

      <div
        className={[collapsed ? "mx-2" : "mx-4", "mb-3 shrink-0"].join(" ")}
        style={{ height: "1px", background: "rgba(255,255,255,0.07)" }}
      />

      <div className="flex flex-col flex-1 min-h-0">
        <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto pt-1">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="space-y-0.5">
              {gi > 0 && (
                <div
                  className={[collapsed ? "mx-2" : "mx-3", "my-2"].join(" ")}
                  style={{ height: "1px", background: "rgba(255,255,255,0.06)" }}
                />
              )}
              {group.map((item) => (
                <NavItem key={item.href} {...item} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-5 shrink-0">
          <div
            className={[collapsed ? "mx-1" : "mx-2", "mb-3"].join(" ")}
            style={{ height: "1px", background: "rgba(255,255,255,0.07)" }}
          />

          <BottomLink
            href="/dashboard/abonnement"
            tourId="nav-abonnement"
            label={t("dashboard.sidebar.abonnement")}
            collapsed={collapsed}
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" />
                <path d="M1 10h22" />
              </svg>
            }
          />

          <BottomLink
            href="/dashboard/developers"
            label="API"
            collapsed={collapsed}
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            }
          />

          <BottomLink
            href="/dashboard/support"
            label={t("dashboard.sidebar.support")}
            collapsed={collapsed}
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
          />

          {/* User card — doubles as the entry point to the settings page
              (the Paramètres nav link was removed; the card is now the way in).
              Full card when expanded, avatar-only when collapsed. */}
          {collapsed ? (
            <Link
              href="/dashboard/settings"
              className="flex justify-center mt-1"
              title={t("dashboard.sidebar.parametres")}
            >
              <div
                className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-white/85"
                style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
              >
                <UserIcon />
              </div>
            </Link>
          ) : (
            <Link
              href="/dashboard/settings"
              title={t("dashboard.sidebar.parametres")}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1 transition-colors hover:bg-white/[0.06]"
              style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div
                className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-white/85"
                style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
              >
                <UserIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/80 truncate leading-none mb-0.5">
                  {displayName}
                </p>
                {displayAgency && (
                  <p className="text-[10px] text-white/30 truncate leading-none">{displayAgency}</p>
                )}
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/25" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          )}

          <button
            onClick={handleLogout}
            title={collapsed ? t("dashboard.sidebar.deconnexion") : undefined}
            className={[
              "flex items-center rounded-lg text-sm text-white/30 hover:text-red-400/70 hover:bg-red-500/[0.05] transition-all w-full mt-1",
              collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2",
            ].join(" ")}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && <span>{t("dashboard.sidebar.deconnexion")}</span>}
          </button>
        </div>
      </div>
    </aside>

    {/* ===== Mobile top bar (hamburger) — visible below md ===== */}
    <div
      className="md:hidden fixed top-0 inset-x-0 z-[90] h-14 flex items-center gap-3 px-4"
      style={{ background: "rgba(8,12,30,0.92)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}
    >
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label={t("nav.menuLabel")}
        className="flex flex-col items-center justify-center gap-[5px] h-9 w-9 rounded-lg border border-white/[0.12] bg-white/[0.04]"
      >
        <span className="block w-4 h-0.5 bg-white/70 rounded-full" />
        <span className="block w-4 h-0.5 bg-white/70 rounded-full" />
        <span className="block w-4 h-0.5 bg-white/70 rounded-full" />
      </button>
      <Link href="/dashboard" className="flex items-center gap-2">
        <Image src="/logo-mark.png" alt="DuupFlow" width={64} height={64} className="h-7 w-7 object-contain" />
        <span className="text-lg font-extrabold tracking-tight">
          <span style={{ color: "#818CF8" }}>Duup</span><span className="text-white/55">Flow</span>
        </span>
      </Link>
    </div>

    {/* Overlay */}
    {mobileOpen && (
      <div className="md:hidden fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
    )}

    {/* ===== Mobile slide-in drawer ===== */}
    <aside
      className={[
        "md:hidden fixed top-0 left-0 bottom-0 z-[100] w-[80%] max-w-[300px] flex flex-col overflow-y-auto transition-transform duration-300 ease-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
      style={{ background: "rgba(8,12,30,0.98)", borderRight: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-mark.png" alt="DuupFlow" width={64} height={64} className="h-8 w-8 object-contain" />
          <span className="text-xl font-extrabold tracking-tight">
            <span style={{ color: "#818CF8" }}>Duup</span><span className="text-white/55">Flow</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label={t("nav.closeLabel")}
          className="text-white/50 hover:text-white transition"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="mx-4 mb-3 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />

      <nav className="flex-1 px-3 pb-4 space-y-0.5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {gi > 0 && <div className="mx-3 my-2 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />}
            {group.map((item) => (
              <NavItem key={item.href} {...item} collapsed={false} />
            ))}
          </div>
        ))}
      </nav>

      <div className="px-3 pb-6 shrink-0">
        <div className="mx-2 mb-3 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
        <BottomLink
          href="/dashboard/abonnement"
          label={t("dashboard.sidebar.abonnement")}
          collapsed={false}
          icon={<svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>}
        />
        <BottomLink
          href="/dashboard/developers"
          label="API"
          badge={t("dashboard.sidebar.nouveau")}
          collapsed={false}
          icon={<svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>}
        />
        <BottomLink
          href="/dashboard/support"
          label={t("dashboard.sidebar.support")}
          collapsed={false}
          icon={<svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
        />

        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1 transition-colors hover:bg-white/[0.06]"
          style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-white/85" style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}>
            <UserIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80 truncate leading-none mb-0.5">{displayName}</p>
            {displayAgency && <p className="text-[10px] text-white/30 truncate leading-none">{displayAgency}</p>}
          </div>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/25" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/30 hover:text-red-400/70 hover:bg-red-500/[0.05] transition-all w-full mt-1"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          <span>{t("dashboard.sidebar.deconnexion")}</span>
        </button>
      </div>
    </aside>
    </>
  );
}
