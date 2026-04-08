"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";

export default function WelcomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [visible, setVisible] = useState(false);
  const [destination, setDestination] = useState("/checkout");

  useEffect(() => {
    const name = sessionStorage.getItem("welcome_first_name") ?? "toi";
    const isGuest = sessionStorage.getItem("welcome_is_guest") === "1";
    setFirstName(name);
    // Guests → dashboard (host has paid), regular users → paywall
    const dest = isGuest ? "/dashboard" : "/checkout";
    setDestination(dest);
    sessionStorage.removeItem("welcome_first_name");
    sessionStorage.removeItem("welcome_is_guest");

    // Fade in
    const t1 = setTimeout(() => setVisible(true), 100);
    // Auto-redirect
    const t2 = setTimeout(() => router.push(dest), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{
        background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)",
      }}
    >
      {/* Grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div
        className="relative transition-all duration-700"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)" }}
      >
        {/* Glow dot */}
        <div
          className="mx-auto mb-8 h-16 w-16 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.35)",
            boxShadow: "0 0 40px rgba(99,102,241,0.3), 0 0 80px rgba(99,102,241,0.12)",
          }}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <p className="text-sm font-medium text-white/40 tracking-[0.15em] uppercase mb-4">
          {t("onboarding.welcomeBadge")}
        </p>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
          {t("onboarding.welcomeTitle")}{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
            {firstName}
          </span>{" "}
          👋
        </h1>

        <p className="text-base text-white/50 max-w-sm mx-auto mb-10">
          {t("onboarding.welcomeSubtitle")}
        </p>

        <button
          onClick={() => router.push(destination)}
          className="inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          {destination === "/checkout" ? t("onboarding.chooseOffer") : t("onboarding.goToDashboard")}
        </button>

        <p className="mt-4 text-xs text-white/25">{t("onboarding.autoRedirect")}</p>
      </div>
    </div>
  );
}
