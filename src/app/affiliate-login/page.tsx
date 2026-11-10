"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

export default function AffiliateLoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/affiliate/dashboard`,
      },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-4 py-10 bg-[#0B0F1A]">
      {/* Subtle texture */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.10) 0%, transparent 80%)",
        }}
      />

      {/* Logo */}
      <Link href="/" className="text-xl font-extrabold tracking-tight">
        <span style={{ color: "#818CF8" }}>Duup</span>
        <span className="text-white/55">Flow</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-sm">
        {sent ? (
          <div className="text-center space-y-5">
            <div
              className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.20)" }}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#10B981" strokeWidth="1.8">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Vérifie ta boîte mail</h2>
              <p className="text-white/45 text-sm">
                Un lien de connexion a été envoyé à{" "}
                <span className="text-white/70 font-medium">{email}</span>
              </p>
            </div>
            <p className="text-white/25 text-xs">Expire dans 1 heure · Vérifie tes spams</p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-sm text-white/40 hover:text-white/70 transition"
            >
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <div
                className="mx-auto mb-4 h-12 w-12 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#10B981" strokeWidth="1.8">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-1.5">Espace partenaire</h1>
              <p className="text-white/45 text-sm">Connecte-toi pour accéder à ton tableau de bord</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Adresse email partenaire
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@exemple.com"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
                />
              </div>

              {error && (
                <div
                  className="rounded-lg px-4 py-2.5 text-xs"
                  style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)", color: "#FCA5A5" }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#059669,#10B981)" }}
              >
                {loading ? "Envoi…" : "Envoyer le lien de connexion →"}
              </button>
            </form>

            <p className="text-center text-xs text-white/20 mt-6">
              Cet espace est réservé aux partenaires DuupFlow.
              <br />
              Pour toute question : <span className="text-white/35">hello@duupflow.com</span>
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-4 text-xs text-white/25">
        <Link href="/fr/legal" className="hover:text-white/45 transition">Mentions légales</Link>
        <span>·</span>
        <Link href="/fr/legal/privacy" className="hover:text-white/45 transition">Confidentialité</Link>
      </div>
    </div>
  );
}
