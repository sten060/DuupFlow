"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const FEATURES = [
  "Duplication images illimitée (EXIF/XMP)",
  "Duplication vidéos indétectable",
  "Comparateur de similarité visuelle",
  "Variation IA & Détection IA",
  "Jusqu'à 3 collaborateurs invités",
  "Export en lot & téléchargement ZIP",
];

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleCheckout() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Erreur lors de la création de la session.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Erreur réseau. Réessaie.");
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
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

      <div className="w-full max-w-lg relative">
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
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.30)",
                color: "#818CF8",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Accès complet à tous les modules
            </span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
              DuupFlow Pro
            </h1>
            <p className="text-white/50 text-sm mb-5">
              Un abonnement. Tous les modules. Toute ton équipe.
            </p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-extrabold text-white">99€</span>
              <span className="text-white/40 text-lg">/mois</span>
            </div>
            <p className="text-xs text-white/30 mt-1">Sans engagement · Résiliable à tout moment</p>
          </div>

          {/* Features */}
          <ul className="space-y-2.5 mb-8">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-white/70">
                <svg
                  viewBox="0 0 16 16"
                  className="h-4 w-4 shrink-0 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 8l4 4 6-7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

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
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {loading ? "Redirection en cours…" : "Souscrire maintenant — 99€/mois →"}
          </button>

          <p className="text-center text-xs text-white/25 mt-4">
            Paiement sécurisé par Stripe · SSL 256-bit
          </p>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          {userEmail ? (
            <>
              Connecté en tant que <span className="text-white/40">{userEmail}</span>
              {" · "}
              <button
                onClick={handleSignOut}
                className="text-indigo-400/60 hover:text-indigo-400 underline cursor-pointer"
              >
                Changer de compte
              </button>
            </>
          ) : (
            <>
              Tu as déjà un compte actif ?{" "}
              <Link href="/login" className="text-indigo-400/60 hover:text-indigo-400 underline">
                Se connecter
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
