"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/context";

// Multi-step wizard for first-time signup.
//
//   Step 0 — Identity   : firstName + agencyName (skipped to firstName-only for guests)
//   Step 1 — Platforms  : multi-select target social platforms
//   Step 2 — Source     : single-select acquisition channel
//
// Guests skip steps 1 & 2.
//
// Layout: two-column card on desktop (question/intro on the left, inputs on
// the right) so each step fits a single 800 px viewport without scrolling.
// Stacks to one column on mobile.

type Platform =
  | "instagram" | "threads" | "reddit" | "tiktok" | "x"
  | "youtube"   | "facebook" | "linkedin" | "snapchat" | "other";

type Source =
  | "youtube" | "telegram" | "friend" | "already_knew"
  | "tiktok"  | "google"   | "other";

const PLATFORMS: { id: Platform; key: string }[] = [
  { id: "instagram", key: "onboarding.platformInstagram" },
  { id: "tiktok",    key: "onboarding.platformTiktok" },
  { id: "youtube",   key: "onboarding.platformYoutube" },
  { id: "threads",   key: "onboarding.platformThreads" },
  { id: "x",         key: "onboarding.platformX" },
  { id: "facebook",  key: "onboarding.platformFacebook" },
  { id: "reddit",    key: "onboarding.platformReddit" },
  { id: "linkedin",  key: "onboarding.platformLinkedin" },
  { id: "snapchat",  key: "onboarding.platformSnapchat" },
  { id: "other",     key: "onboarding.platformOther" },
];

const SOURCES: { id: Source; key: string }[] = [
  { id: "youtube",      key: "onboarding.sourceYoutube" },
  { id: "tiktok",       key: "onboarding.sourceTiktok" },
  { id: "telegram",     key: "onboarding.sourceTelegram" },
  { id: "friend",       key: "onboarding.sourceFriend" },
  { id: "google",       key: "onboarding.sourceGoogle" },
  { id: "already_knew", key: "onboarding.sourceAlready" },
  { id: "other",        key: "onboarding.sourceOther" },
];

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGuest = searchParams.get("type") === "guest";
  const { t } = useTranslation();

  const TOTAL_STEPS = isGuest ? 1 : 3;

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
    });
  }, []);

  function togglePlatform(id: Platform) {
    setPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function validateAndNext() {
    setError("");
    if (step === 0) {
      if (!firstName.trim()) {
        setError(t("onboarding.firstNameRequired"));
        return;
      }
      if (!isGuest && !agencyName.trim()) {
        setError(t("onboarding.agencyRequired"));
        return;
      }
    } else if (step === 1) {
      if (platforms.length === 0) {
        setError(t("onboarding.platformsRequired"));
        return;
      }
    } else if (step === 2) {
      if (!source) {
        setError(t("onboarding.sourceRequired"));
        return;
      }
    }

    if (isGuest && step === 0) { void submit(); return; }
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
    else void submit();
  }

  async function submit() {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    if (isGuest) {
      const res = await fetch("/api/onboarding/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), userId: user.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("onboarding.profileError"));
        setLoading(false);
        return;
      }
    } else {
      const affiliateCode = localStorage.getItem("duupflow_ref") ?? undefined;
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          agencyName: agencyName.trim(),
          affiliateCode,
          platforms,
          source,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t("onboarding.profileError"));
        setLoading(false);
        return;
      }
    }

    sessionStorage.setItem("welcome_first_name", firstName.trim());
    sessionStorage.setItem("welcome_is_guest", isGuest ? "1" : "0");
    router.push("/onboarding/welcome");
  }

  const isLast = step === TOTAL_STEPS - 1;
  const stepLabels = [
    t("onboarding.stepIdentity"),
    t("onboarding.stepPlatforms"),
    t("onboarding.stepSource"),
  ];

  // ─── Left column content (label, title, subtitle) per step ───
  const leftTitle =
    step === 0
      ? (isGuest ? t("onboarding.joinWorkspace") : t("onboarding.createSpace"))
      : step === 1
        ? t("onboarding.platformsTitle")
        : t("onboarding.sourceTitle");

  const leftSubtitle =
    step === 0
      ? (isGuest ? t("onboarding.joinWorkspaceSubtitle") : t("onboarding.createSpaceSubtitle"))
      : step === 1
        ? t("onboarding.platformsSubtitle")
        : t("onboarding.sourceSubtitle");

  return (
    <div
      className="fixed inset-0 w-full flex items-center justify-center px-4 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)",
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="w-full max-w-4xl relative flex flex-col items-center max-h-full">
        {/* Logo */}
        <div className="text-center mb-4 shrink-0">
          <span className="text-2xl font-extrabold tracking-tight" style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-2xl font-extrabold tracking-tight text-white/50">Flow</span>
        </div>

        {/* Card */}
        <div
          className="w-full rounded-2xl border overflow-hidden"
          style={{
            background: "rgba(10,14,40,0.80)",
            borderColor: "rgba(255,255,255,0.08)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          {/* Progress bar (regular users only) — across both columns */}
          {!isGuest && (
            <div className="h-1 w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
                  background: "linear-gradient(90deg,#6366F1,#38BDF8)",
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr]">
            {/* ─── Left column : question + description ─── */}
            <div
              className="p-6 md:p-8 flex flex-col justify-between"
              style={{
                background: "rgba(255,255,255,0.015)",
                borderRight: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div>
                {!isGuest && (
                  <div className="flex items-center gap-2 mb-5">
                    <span
                      className="text-[10px] font-semibold tracking-[0.14em] uppercase px-2.5 py-1 rounded-md"
                      style={{
                        background: "rgba(99,102,241,0.12)",
                        color: "#A5B4FC",
                        border: "1px solid rgba(99,102,241,0.25)",
                      }}
                    >
                      {stepLabels[step]}
                    </span>
                    <span className="text-[10px] text-white/35">
                      {t("onboarding.stepIndicator")
                        .replace("{n}", String(step + 1))
                        .replace("{total}", String(TOTAL_STEPS))}
                    </span>
                  </div>
                )}

                <h1 className="text-2xl md:text-3xl font-semibold text-white mb-3 tracking-tight leading-tight">
                  {leftTitle}
                </h1>
                <p className="text-sm text-white/50 leading-relaxed">
                  {leftSubtitle}
                </p>
              </div>

              {/* Step dots — visible only on desktop, bottom-left as a soft signal */}
              {!isGuest && (
                <div className="hidden md:flex items-center gap-1.5 mt-10">
                  {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <span
                      key={i}
                      className="rounded-full transition-all"
                      style={{
                        width: i === step ? "20px" : "6px",
                        height: "6px",
                        background:
                          i === step
                            ? "linear-gradient(90deg,#6366F1,#38BDF8)"
                            : i < step
                              ? "rgba(99,102,241,0.5)"
                              : "rgba(255,255,255,0.15)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ─── Right column : inputs/options ─── */}
            <div className="p-6 md:p-8 flex flex-col">
              {/* Step 0 — identity */}
              {step === 0 && (
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                      {t("onboarding.firstNameLabel")}
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && validateAndNext()}
                      placeholder={t("onboarding.firstNamePlaceholder")}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:ring-1 focus:ring-indigo-500/50"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.10)",
                      }}
                      autoFocus
                    />
                  </div>

                  {!isGuest && (
                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                        {t("onboarding.agencyLabel")}
                      </label>
                      <input
                        type="text"
                        value={agencyName}
                        onChange={(e) => setAgencyName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && validateAndNext()}
                        placeholder={t("onboarding.agencyPlaceholder")}
                        className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:ring-1 focus:ring-indigo-500/50"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.10)",
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Step 1 — platforms */}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-2.5 flex-1 auto-rows-min">
                  {PLATFORMS.map((p) => {
                    const active = platforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-left transition-all"
                        style={{
                          background: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${active ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#FFFFFF" : "rgba(255,255,255,0.65)",
                          boxShadow: active ? "0 0 0 3px rgba(99,102,241,0.10)" : "none",
                        }}
                      >
                        <span className="flex items-center justify-between">
                          <span>{t(p.key)}</span>
                          {active && (
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 2 — source */}
              {step === 2 && (
                <div className="grid grid-cols-2 gap-2 flex-1 auto-rows-min">
                  {SOURCES.map((s) => {
                    const active = source === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSource(s.id)}
                        className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-left transition-all flex items-center justify-between"
                        style={{
                          background: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${active ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#FFFFFF" : "rgba(255,255,255,0.65)",
                          boxShadow: active ? "0 0 0 3px rgba(99,102,241,0.10)" : "none",
                        }}
                      >
                        <span>{t(s.key)}</span>
                        <span
                          className="h-4 w-4 rounded-full flex items-center justify-center transition shrink-0"
                          style={{
                            border: `1.5px solid ${active ? "#6366F1" : "rgba(255,255,255,0.18)"}`,
                            background: active ? "#6366F1" : "transparent",
                          }}
                        >
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="mt-4 text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="mt-5 flex gap-3">
                {!isGuest && step > 0 && (
                  <button
                    type="button"
                    onClick={() => { setError(""); setStep((s) => s - 1); }}
                    disabled={loading}
                    className="rounded-xl px-5 py-3 text-sm font-semibold transition disabled:opacity-50"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.65)",
                    }}
                  >
                    {t("onboarding.back")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={validateAndNext}
                  disabled={loading}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  {loading
                    ? t("onboarding.creating")
                    : isLast
                      ? t("onboarding.finish")
                      : t("onboarding.continue")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}
