"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/context";
import { flushAcquisition } from "@/lib/acquisition";
import AuthBrandPanel from "@/components/AuthBrandPanel";
import { Brand } from "@/components/landing/shell";

// Multi-step wizard for first-time signup — mirrors the register screen layout
// (form on the left, brand panel on the right).
//
//   Step 0 — Identity   : firstName + agencyName (skipped to firstName-only for guests)
//   Step 1 — Platforms  : multi-select target social platforms
//   Step 2 — Source     : single-select acquisition channel
//
// Guests skip steps 1 & 2.

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
  { id: "snapchat",  key: "onboarding.platformSnapchat" },
  { id: "other",     key: "onboarding.platformOther" },
];

const SOURCES: { id: Source; key: string }[] = [
  { id: "youtube",      key: "onboarding.sourceYoutube" },
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
  const { t, locale } = useTranslation();

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
    // Recover the chosen plan carried through the auth link (?plan=solo|pro).
    // Critical when a magic link is opened in another browser: localStorage was
    // empty there, so without this the paywall was silently skipped.
    const p = searchParams.get("plan");
    if (p === "solo" || p === "pro") {
      localStorage.setItem("duupflow_selected_plan", p);
    } else if (!isGuest) {
      // No paid plan chosen — the free tier is no longer offered to new signups.
      // Send them to pricing to pick a plan before any account is created.
      const stored = localStorage.getItem("duupflow_selected_plan");
      if (stored !== "solo" && stored !== "pro") {
        router.replace(`/${locale}/pricing#plans`);
      }
    }
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
      // The paid plan picked on the pricing page (?plan=solo|pro). Persisted
      // server-side so the checkout paywall survives logout: a user who quits
      // before paying stays gated and resumes at checkout on next login.
      const selectedPlan = localStorage.getItem("duupflow_selected_plan") ?? undefined;
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          agencyName: agencyName.trim(),
          affiliateCode,
          platforms,
          source,
          selectedPlan,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // No paid plan → the server refuses to create a free account. Route the
        // user to pricing to choose a plan instead of showing an error.
        if (data.code === "plan_required") {
          router.replace(`/${locale}/pricing#plans`);
          return;
        }
        setError(data.error ?? t("onboarding.profileError"));
        setLoading(false);
        return;
      }
    }

    sessionStorage.setItem("welcome_first_name", firstName.trim());
    sessionStorage.setItem("welcome_is_guest", isGuest ? "1" : "0");

    // First-touch acquisition flush — fire-and-forget. Errors are swallowed
    // inside flushAcquisition so they can never block the redirect.
    void flushAcquisition(supabase, user.id);

    router.push("/onboarding/welcome");
  }

  const isLast = step === TOTAL_STEPS - 1;
  const stepLabels = [
    t("onboarding.stepIdentity"),
    t("onboarding.stepPlatforms"),
    t("onboarding.stepSource"),
  ];

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
    <div className="lunera min-h-screen flex bg-white text-[#1a1a1a]">
      {/* ── LEFT — Onboarding form ── */}
      <div className="flex-1 flex flex-col justify-between px-8 py-10 max-w-xl">
        {/* Logo — mark + wordmark */}
        <div className="flex items-center gap-2.5">
          <Image src="/logo-mark.png" alt="DuupFlow" width={64} height={64} priority className="h-8 w-8 object-contain" />
          <Brand className="text-xl font-bold tracking-tight text-[#1a1a1a]" />
        </div>

        {/* Form area */}
        <div className="w-full max-w-md mx-auto">
          {/* Step badge + indicator */}
          {!isGuest && (
            <div className="flex items-center gap-2 mb-5">
              <span
                className="text-[10px] font-semibold tracking-[0.14em] uppercase px-2.5 py-1 rounded-md"
                style={{
                  background: "rgba(99,102,241,0.10)",
                  color: "#4f7bff",
                  border: "1px solid rgba(99,102,241,0.25)",
                }}
              >
                {stepLabels[step]}
              </span>
              <span className="text-[10px] text-[#8a8a8a]">
                {t("onboarding.stepIndicator")
                  .replace("{n}", String(step + 1))
                  .replace("{total}", String(TOTAL_STEPS))}
              </span>
            </div>
          )}

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#1a1a1a] mb-1.5 tracking-tight">{leftTitle}</h1>
            <p className="text-[#8a8a8a] text-sm leading-relaxed">{leftSubtitle}</p>
          </div>

          {/* Step 0 — identity */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#605f5f] mb-1.5 uppercase tracking-wide">
                  {t("onboarding.firstNameLabel")}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && validateAndNext()}
                  placeholder={t("onboarding.firstNamePlaceholder")}
                  className="w-full rounded-xl px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#9aa2b2] outline-none transition focus:ring-1 focus:ring-[#4f7bff]/40"
                  style={{ background: "#f6f7f9", border: "1px solid rgba(0,0,0,0.10)" }}
                  autoFocus
                />
              </div>

              {!isGuest && (
                <div>
                  <label className="block text-xs font-medium text-[#605f5f] mb-1.5 uppercase tracking-wide">
                    {t("onboarding.agencyLabel")}
                  </label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && validateAndNext()}
                    placeholder={t("onboarding.agencyPlaceholder")}
                    className="w-full rounded-xl px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#9aa2b2] outline-none transition focus:ring-1 focus:ring-[#4f7bff]/40"
                    style={{ background: "#f6f7f9", border: "1px solid rgba(0,0,0,0.10)" }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 1 — platforms */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-2.5 auto-rows-min">
              {PLATFORMS.map((p) => {
                const active = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-left transition-all"
                    style={{
                      background: active ? "rgba(99,102,241,0.10)" : "#f6f7f9",
                      border: `1px solid ${active ? "rgba(99,102,241,0.55)" : "rgba(0,0,0,0.08)"}`,
                      color: active ? "#1a1a1a" : "#605f5f",
                      boxShadow: active ? "0 0 0 3px rgba(99,102,241,0.10)" : "none",
                    }}
                  >
                    <span className="flex items-center justify-between">
                      <span>{t(p.key)}</span>
                      {active && (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#4f7bff]" fill="none" stroke="currentColor" strokeWidth="2.5">
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
            <div className="grid grid-cols-2 gap-2 auto-rows-min">
              {SOURCES.map((s) => {
                const active = source === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSource(s.id)}
                    className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-left transition-all flex items-center justify-between"
                    style={{
                      background: active ? "rgba(99,102,241,0.10)" : "#f6f7f9",
                      border: `1px solid ${active ? "rgba(99,102,241,0.55)" : "rgba(0,0,0,0.08)"}`,
                      color: active ? "#1a1a1a" : "#605f5f",
                      boxShadow: active ? "0 0 0 3px rgba(99,102,241,0.10)" : "none",
                    }}
                  >
                    <span>{t(s.key)}</span>
                    <span
                      className="h-4 w-4 rounded-full flex items-center justify-center transition shrink-0"
                      style={{
                        border: `1.5px solid ${active ? "#6366F1" : "rgba(0,0,0,0.18)"}`,
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
            <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            {!isGuest && step > 0 && (
              <button
                type="button"
                onClick={() => { setError(""); setStep((s) => s - 1); }}
                disabled={loading}
                className="rounded-xl px-5 py-3 text-sm font-semibold transition disabled:opacity-50"
                style={{
                  background: "#f6f7f9",
                  border: "1px solid rgba(0,0,0,0.08)",
                  color: "#605f5f",
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
              style={{ background: "linear-gradient(135deg,#4f7bff,#7c5cff)" }}
            >
              {loading
                ? t("onboarding.creating")
                : isLast
                  ? t("onboarding.finish")
                  : t("onboarding.continue")}
            </button>
          </div>
        </div>

        {/* Footer — step dots progress (regular users only) */}
        <div className="flex items-center gap-1.5 h-4">
          {!isGuest && Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === step ? "20px" : "6px",
                height: "6px",
                background:
                  i === step
                    ? "linear-gradient(90deg,#4f7bff,#7c5cff)"
                    : i < step
                      ? "rgba(99,102,241,0.5)"
                      : "rgba(0,0,0,0.12)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT — Brand panel (shared with register) ── */}
      <AuthBrandPanel />
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
