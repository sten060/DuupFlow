"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";
import { useTranslation } from "@/lib/i18n/context";

type Plan = "solo" | "pro";

// SOLO_FEATURES and PRO_FEATURES moved inside component to use t()

function PlanCard({
  name,
  price,
  badge,
  features,
  selected,
  onSelect,
  accentColor,
  accentBg,
  gradientFrom,
  gradientTo,
}: {
  name: string;
  price: string;
  badge?: string;
  features: string[];
  selected: boolean;
  onSelect: () => void;
  accentColor: string;
  accentBg: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex-1 rounded-2xl p-6 text-left transition-all duration-150 focus:outline-none"
      style={{
        background: "rgba(10,14,40,0.80)",
        border: selected
          ? `1.5px solid ${accentColor}`
          : "1.5px solid rgba(255,255,255,0.10)",
        boxShadow: selected ? `0 0 24px ${accentBg}` : "none",
      }}
    >
      {badge && (
        <span
          className="absolute top-4 right-4 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
          style={{
            background: `${accentBg}`,
            border: `1px solid ${accentColor}40`,
            color: accentColor,
          }}
        >
          {badge}
        </span>
      )}

      {/* Selected indicator */}
      <div
        className="absolute top-4 left-4 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all"
        style={{
          borderColor: selected ? accentColor : "rgba(255,255,255,0.25)",
          background: selected ? accentColor : "transparent",
        }}
      >
        {selected && (
          <svg className="h-2 w-2 text-white" viewBox="0 0 8 8" fill="currentColor">
            <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" />
          </svg>
        )}
      </div>

      <div className="mt-6 mb-3">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase mb-1" style={{ color: accentColor }}>
          Plan {name}
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-extrabold text-white">{price}</span>
          <span className="text-white/40 text-sm">{t("common.perMonth")}</span>
        </div>
      </div>

      <div className="h-px bg-white/[0.07] mb-4" />

      <ul className="space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-xs text-white/65">
            <svg
              className="h-3.5 w-3.5 shrink-0 mt-0.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ color: accentColor }}
            >
              <path d="M3 8l4 4 6-7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultPlan = (searchParams.get("plan") as Plan) === "solo" ? "solo" : "pro";
  const { t } = useTranslation();

  const SOLO_FEATURES = [
    t("tarifs.soloFeature1"),
    t("tarifs.soloFeature2"),
    t("tarifs.soloFeature3"),
    t("tarifs.soloFeature4"),
    t("tarifs.soloFeature5"),
    t("tarifs.soloFeature6"),
    t("tarifs.soloFeature7"),
  ];

  const PRO_FEATURES = [
    t("tarifs.proFeature1"),
    t("tarifs.proFeature2"),
    t("tarifs.proFeature3"),
    t("tarifs.proFeature4"),
    t("tarifs.proFeature5"),
    t("tarifs.proFeature6"),
    t("tarifs.proFeature7"),
  ];

  const [selectedPlan, setSelectedPlan] = useState<Plan>(defaultPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoState, setPromoState] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [promoMessage, setPromoMessage] = useState("");

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem("duupflow_ref", ref.toUpperCase());
      // Pré-remplir et valider le code si passé dans l'URL
      setPromoInput(ref.toUpperCase());
      validatePromoCode(ref.toUpperCase());
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function validatePromoCode(code: string) {
    if (!code.trim()) { setPromoState("idle"); setPromoMessage(""); return; }
    setPromoState("validating");
    try {
      const res = await fetch(`/api/promo/validate?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      const data = await res.json();
      if (data.valid) {
        setPromoState("valid");
        setPromoMessage(data.message ?? t("checkout.promoValid"));
        localStorage.setItem("duupflow_ref", code.trim().toUpperCase());
      } else {
        setPromoState("invalid");
        setPromoMessage(t("checkout.promoInvalid"));
      }
    } catch {
      setPromoState("idle");
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleCheckout() {
    setLoading(true);
    setError("");
    try {
      const affiliateCode = localStorage.getItem("duupflow_ref") ?? undefined;
      const validPromo = promoState === "valid" ? promoInput.trim().toUpperCase() : undefined;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          affiliate_code: affiliateCode,
          ...(validPromo ? { promo_code: validPromo } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? t("checkout.sessionError"));
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t("checkout.networkError"));
      setLoading(false);
    }
  }

  const basePrice = selectedPlan === "solo" ? "39€" : "99€";
  const discountedPrice = selectedPlan === "solo" ? "29€" : "89€";
  const price = promoState === "valid" ? discountedPrice : basePrice;

  return (
    <div className="w-full max-w-2xl relative">
      {/* Logo */}
      <div className="text-center mb-10">
        <Link href="/">
          <span className="text-2xl font-extrabold tracking-tight" style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-2xl font-extrabold tracking-tight text-white/50">Flow</span>
        </Link>
      </div>

      <div
        className="rounded-2xl border p-8"
        style={{
          background: "rgba(10,14,40,0.90)",
          borderColor: "rgba(255,255,255,0.08)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div className="text-center mb-7">
          <div className="flex justify-center mb-5">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.30)",
                color: "#818CF8",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
              {t("checkout.badge")}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {t("checkout.title")}
          </h1>
          <p className="text-white/45 text-sm mt-1">{t("checkout.subtitle")}</p>
        </div>

        {/* Plan cards */}
        <div className="flex flex-col sm:flex-row gap-4 mb-7">
          <PlanCard
            name="Solo"
            price="39€"
            features={SOLO_FEATURES}
            selected={selectedPlan === "solo"}
            onSelect={() => setSelectedPlan("solo")}
            accentColor="#A78BFA"
            accentBg="rgba(167,139,250,0.12)"
            gradientFrom="#7C3AED"
            gradientTo="#6366F1"
          />
          <PlanCard
            name="Pro"
            price="99€"
            badge={t("checkout.popular")}
            features={PRO_FEATURES}
            selected={selectedPlan === "pro"}
            onSelect={() => setSelectedPlan("pro")}
            accentColor="#38BDF8"
            accentBg="rgba(56,189,248,0.12)"
            gradientFrom="#6366F1"
            gradientTo="#38BDF8"
          />
        </div>

        {/* Champ code promo */}
        <div className="mb-5">
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => {
                setPromoInput(e.target.value.toUpperCase());
                setPromoState("idle");
                setPromoMessage("");
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validatePromoCode(promoInput); } }}
              placeholder={t("checkout.promoPlaceholder")}
              className="flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 transition"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: promoState === "valid"
                  ? "1px solid rgba(52,211,153,0.5)"
                  : promoState === "invalid"
                  ? "1px solid rgba(239,68,68,0.4)"
                  : "1px solid rgba(255,255,255,0.10)",
              }}
            />
            <button
              type="button"
              onClick={() => validatePromoCode(promoInput)}
              disabled={promoState === "validating" || !promoInput.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-40"
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#818CF8",
              }}
            >
              {promoState === "validating" ? "..." : t("checkout.promoApply")}
            </button>
          </div>
          {promoMessage && (
            <p className={`text-xs mt-1.5 ${promoState === "valid" ? "text-emerald-400" : "text-red-400"}`}>
              {promoState === "valid" && "✓ "}{promoMessage}
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{
            background:
              selectedPlan === "solo"
                ? "linear-gradient(135deg,#7C3AED,#6366F1)"
                : "linear-gradient(135deg,#6366F1,#38BDF8)",
          }}
        >
          {loading
            ? t("checkout.redirecting")
            : promoState === "valid"
            ? t("checkout.subscribePromo", { basePrice, discountedPrice })
            : t("checkout.subscribe", { plan: selectedPlan === "solo" ? t("checkout.planSolo") : t("checkout.planPro"), price })}
        </button>

        <p className="text-center text-xs text-white/25 mt-4">
          {t("checkout.securePayment")}
        </p>
      </div>

      <p className="text-center text-xs text-white/20 mt-6">
        {userEmail ? (
          <>
            {t("checkout.connectedAs")} <span className="text-white/40">{userEmail}</span>
            {" · "}
            <button
              onClick={handleSignOut}
              className="text-indigo-400/60 hover:text-indigo-400 underline cursor-pointer"
            >
              {t("checkout.changeAccount")}
            </button>
          </>
        ) : (
          <>
            {t("checkout.hasActiveAccount")}{" "}
            <Link href="/login" className="text-indigo-400/60 hover:text-indigo-400 underline">
              {t("checkout.login")}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-10"
      style={{
        background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)",
      }}
    >
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <Suspense fallback={null}>
        <CheckoutContent />
      </Suspense>
    </main>
  );
}
