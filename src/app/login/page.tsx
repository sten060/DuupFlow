"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }

    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#0D0B2E" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(700px 500px at 10% 0%, rgba(99,102,241,.14), transparent), radial-gradient(600px 400px at 90% 100%, rgba(56,189,248,.10), transparent)",
        }}
      />

      <div className="relative w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-extrabold tracking-tight" style={{ color: "#818CF8" }}>Duup</span>
            <span className="text-2xl font-extrabold tracking-tight text-white/55">Flow</span>
          </Link>
          <p className="text-white/40 text-sm mt-1">
            Connexion sans mot de passe
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 20px 60px rgba(0,0,0,.4)",
          }}
        >
          {sent ? (
            /* ── État : lien envoyé ── */
            <div className="text-center space-y-4 py-2">
              <div
                className="mx-auto h-14 w-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)" }}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#38BDF8" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-base">Vérifie ta boîte mail</p>
                <p className="text-white/45 text-sm mt-1">
                  Un lien de connexion a été envoyé à{" "}
                  <span className="text-white/70 font-medium">{email}</span>
                </p>
              </div>
              <p className="text-white/25 text-xs">
                Le lien expire dans 1 heure. Vérifie aussi tes spams.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-sm text-white/40 hover:text-white/70 transition"
              >
                Utiliser une autre adresse
              </button>
            </div>
          ) : (
            /* ── Formulaire ── */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-white/70 text-sm mb-4 leading-relaxed">
                  Entre ton adresse email — on t'envoie un lien magique pour te connecter instantanément, sans mot de passe.
                </p>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@exemple.com"
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
                />
              </div>

              {error && (
                <div
                  className="rounded-lg px-3.5 py-2.5 text-xs"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#FCA5A5",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #6366F1, #38BDF8)",
                  boxShadow: "0 0 20px rgba(99,102,241,0.3)",
                }}
              >
                {loading ? "Envoi en cours…" : "Envoyer le lien magique ✦"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/25">
          En continuant, tu acceptes nos{" "}
          <Link href="/legal/terms" className="text-white/45 hover:text-white/70 transition">CGU</Link>
          {" & "}
          <Link href="/legal/privacy" className="text-white/45 hover:text-white/70 transition">Politique de confidentialité</Link>
        </p>
      </div>
    </div>
  );
}
