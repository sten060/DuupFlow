"use client";

import { useTranslation } from "@/lib/i18n/context";

// "Coming soon" wall shown on the API tab until the public API launches.
// Fully bilingual via i18n. The API itself is built + gated (admin bypass in
// page.tsx) — this just hides it from users for now.
export default function ComingSoon() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 max-w-xl mx-auto">
      <div
        className="h-16 w-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.25)" }}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>

      <span
        className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-4"
        style={{ background: "rgba(56,189,248,0.10)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.25)" }}
      >
        {t("developers.comingSoonBadge")}
      </span>

      <h1 className="text-3xl font-extrabold tracking-tight">{t("developers.comingSoonTitle")}</h1>
      <p className="text-sm text-white/55 mt-3 leading-relaxed">{t("developers.comingSoonBody")}</p>
      <p className="text-xs text-white/35 mt-4">{t("developers.comingSoonNote")}</p>
    </div>
  );
}
