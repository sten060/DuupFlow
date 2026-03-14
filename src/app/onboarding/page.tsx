"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGuest = searchParams.get("type") === "guest";

  const [firstName, setFirstName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    // Verify user is authenticated
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) { setError("Le prénom est requis."); return; }
    if (!isGuest && !agencyName.trim()) { setError("Le nom d'agence est requis."); return; }

    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    // If guest, fetch the invite token from a server action and get host info
    if (isGuest) {
      const res = await fetch("/api/onboarding/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), userId: user.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la création du profil.");
        setLoading(false);
        return;
      }
    } else {
      // Regular user: create profile directly
      const { error: upsertErr } = await supabase.from("profiles").upsert({
        id: user.id,
        first_name: firstName.trim(),
        agency_name: agencyName.trim(),
        is_guest: false,
      });
      if (upsertErr) {
        setError("Erreur lors de la création du profil.");
        setLoading(false);
        return;
      }
    }

    // Store firstName in sessionStorage for the welcome page
    sessionStorage.setItem("welcome_first_name", firstName.trim());
    router.push("/onboarding/welcome");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)",
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-10">
          <span className="text-2xl font-extrabold tracking-tight" style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-2xl font-extrabold tracking-tight text-white/50">Flow</span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-8"
          style={{
            background: "rgba(10,14,40,0.80)",
            borderColor: "rgba(255,255,255,0.08)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          <div className="mb-7">
            <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">
              {isGuest ? "Rejoindre le workspace" : "Créer ton espace"}
            </h1>
            <p className="text-sm text-white/45">
              {isGuest
                ? "Tu as été invité·e à rejoindre un workspace DuupFlow."
                : "Quelques infos pour personnaliser ton expérience."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                Prénom
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex : Alexandre"
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
                  Nom d&apos;agence ou d&apos;entreprise
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Ex : Studio Créatif"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:ring-1 focus:ring-indigo-500/50"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 mt-2"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              {loading ? "Création en cours…" : "Continuer →"}
            </button>
          </form>
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
