"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";

function WelcomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, locale } = useTranslation();
  // Retour depuis l'annulation du paywall Stripe : on ne relance pas Stripe.
  const cancelled = params.get("paywall") === "cancelled";
  // Seed with the sessionStorage cache so we never flash "toi" — the DB
  // fetch below overrides it once authoritative data arrives.
  const [firstName, setFirstName] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("welcome_first_name") ?? "";
  });
  const [visible, setVisible] = useState(false);
  const [destination, setDestination] = useState("/dashboard");

  useEffect(() => {
    // Source of truth: the profile row written by /api/onboarding/complete.
    // sessionStorage is only a cache (cleared on hard refresh / new tab),
    // so always re-fetch to be safe.
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();
      if (profile?.first_name) setFirstName(profile.first_name);
    })();

    // Paid-plan signups (?plan=solo|pro captured at /register) must hit the
    // Stripe paywall before entering the app. Free signups — and guests
    // joining a team — go straight to the dashboard.
    const isGuest = sessionStorage.getItem("welcome_is_guest") === "1";
    // Au retour d'annulation, le plan stocké a déjà été consommé au 1er passage :
    // on le récupère depuis l'URL (?plan=) transmis par le cancel_url Stripe.
    const plan = localStorage.getItem("duupflow_selected_plan") ?? params.get("plan");
    const dest =
      !isGuest && (plan === "solo" || plan === "pro")
        ? `/checkout?plan=${plan}`
        : "/dashboard";
    localStorage.removeItem("duupflow_selected_plan");
    setDestination(dest);
    sessionStorage.removeItem("welcome_first_name");
    sessionStorage.removeItem("welcome_is_guest");

    // Fade in
    const t1 = setTimeout(() => setVisible(true), 100);
    // Auto-redirect — sauf si on revient d'une annulation de paiement
    // (sinon on relancerait Stripe immédiatement = boucle).
    const t2 = cancelled ? undefined : setTimeout(() => router.push(dest), 3200);
    return () => { clearTimeout(t1); if (t2) clearTimeout(t2); };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{
        background: "linear-gradient(150deg, #4f7bff 0%, #6a68ff 48%, #8a5cff 100%)",
      }}
    >
      {/* Grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
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
            background: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.40)",
            boxShadow: "0 0 40px rgba(255,255,255,0.25), 0 0 80px rgba(255,255,255,0.12)",
          }}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <p className="text-sm font-medium text-white/70 tracking-[0.15em] uppercase mb-4">
          {t("onboarding.welcomeBadge")}
        </p>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
          {t("onboarding.welcomeTitle")}
          {firstName && (
            <>
              {" "}
              <span className="bg-gradient-to-r from-white to-[#d9e6ff] bg-clip-text text-transparent">
                {firstName}
              </span>
            </>
          )}
          {" "}👋
        </h1>

        <p className="text-base text-white/80 max-w-sm mx-auto mb-10">
          {cancelled
            ? (locale === "en"
                ? "Payment cancelled — you can resume whenever you're ready."
                : "Paiement annulé — tu peux reprendre quand tu veux.")
            : t("onboarding.welcomeSubtitle")}
        </p>

        <button
          onClick={() => router.push(destination)}
          className="inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-semibold text-[#4f7bff] transition hover:opacity-90"
          style={{ background: "#ffffff" }}
        >
          {destination.startsWith("/checkout")
            ? (cancelled ? (locale === "en" ? "Resume payment" : "Reprendre le paiement") : t("onboarding.chooseOffer"))
            : t("onboarding.goToDashboard")}
        </button>

        {!cancelled && <p className="mt-4 text-xs text-white/60">{t("onboarding.autoRedirect")}</p>}
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomeInner />
    </Suspense>
  );
}
