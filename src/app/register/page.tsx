"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: "∞",
    title: "Copies illimitées",
    desc: "Génère autant de variantes que tu veux depuis un seul fichier source.",
  },
  {
    icon: "🛡️",
    title: "Indétectable par les plateformes",
    desc: "Métadonnées uniques à chaque copie — chaque fichier est reconnu comme nouveau.",
  },
  {
    icon: "⚡",
    title: "Multi-plateformes",
    desc: "Instagram, TikTok, YouTube, Threads et plus — un seul outil pour tout scaler.",
  },
];

export default function RegisterPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex bg-[#0B0F1A]">
      {/* ── LEFT — Form ── */}
      <div className="flex-1 flex flex-col justify-between px-8 py-10 max-w-xl">
        {/* Logo */}
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          <span style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-white/55">Flow</span>
        </Link>

        {/* Form area */}
        <div className="w-full max-w-sm mx-auto">
          {sent ? (
            <div className="text-center space-y-5">
              <div
                className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.20)" }}
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#38BDF8" strokeWidth="1.8">
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
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-1.5">Crée ton compte</h1>
                <p className="text-white/45 text-sm">Commence à scaler ton contenu dès maintenant.</p>
              </div>

              {/* Google */}
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:text-white transition border border-white/[0.12] hover:border-white/25 hover:bg-white/[0.04] mb-5"
              >
                <GoogleIcon />
                Continuer avec Google
              </button>

              {/* OR divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/[0.08]" />
                <span className="text-xs text-white/25 uppercase tracking-wider">ou</span>
                <div className="flex-1 h-px bg-white/[0.08]" />
              </div>

              {/* Email form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Adresse email</label>
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
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
                  />
                </div>

                {error && (
                  <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)", color: "#FCA5A5" }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  {loading ? "Envoi…" : "Commencer maintenant →"}
                </button>

                <p className="text-xs text-white/25 text-center">
                  En créant un compte, tu acceptes nos{" "}
                  <Link href="/legal/terms" className="text-white/40 hover:text-white/60 transition">CGU</Link>
                  {" & "}
                  <Link href="/legal/privacy" className="text-white/40 hover:text-white/60 transition">Politique de confidentialité</Link>
                </p>
              </form>

              <p className="text-center text-sm text-white/40 mt-6">
                Déjà un compte ?{" "}
                <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition font-medium">
                  Se connecter
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-4 text-xs text-white/20">
          <Link href="/legal" className="hover:text-white/40 transition">Mentions légales</Link>
          <span>·</span>
          <Link href="/legal/privacy" className="hover:text-white/40 transition">Confidentialité</Link>
        </div>
      </div>

      {/* ── RIGHT — Feature panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f0c3a 0%, #0d1535 50%, #0a1428 100%)",
        }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        {/* Glow */}
        <div
          className="absolute top-0 right-0 w-[600px] h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top right, rgba(99,102,241,0.20) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[300px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at bottom left, rgba(56,189,248,0.12) 0%, transparent 70%)" }}
        />

        {/* Content */}
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-[1.1] mb-4">
            Scale ton contenu.<br />Sans jamais être détecté.
          </h2>
          <p className="text-white/50 text-base max-w-sm">
            Rejoins 500+ agences et créateurs qui réutilisent leurs meilleurs contenus à l&apos;infini.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-4 rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}
              >
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-0.5">{f.title}</p>
                <p className="text-xs text-white/45 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex -space-x-2">
            {["#6366F1", "#8B5CF6", "#EC4899", "#38BDF8"].map((c, i) => (
              <div
                key={i}
                className="h-8 w-8 rounded-full border-2 border-[#0f0c3a] flex items-center justify-center text-xs font-bold text-white"
                style={{ background: c }}
              >
                {["A", "M", "S", "L"][i]}
              </div>
            ))}
          </div>
          <p className="text-xs text-white/45">
            <span className="text-white font-semibold">500+</span> agences marketing &amp; créateurs
          </p>
        </div>
      </div>
    </div>
  );
}
