"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

type Mode = "login" | "signup";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "Compte créé ! Vérifie ton email pour confirmer ton inscription." });
      }
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
            {mode === "login" ? "Content de te revoir 👋" : "Crée ton espace DuupFlow"}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7 space-y-5"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 20px 60px rgba(0,0,0,.4)",
          }}
        >
          {/* Mode tabs */}
          <div className="flex rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setMessage(null); }}
                className="flex-1 py-2 text-sm font-medium transition-all"
                style={
                  mode === m
                    ? { background: "rgba(99,102,241,0.25)", color: "#fff", boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.3)" }
                    : { color: "rgba(255,255,255,0.4)" }
                }
              >
                {m === "login" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Adresse email</label>
              <input
                type="email"
                required
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

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
              />
            </div>

            {/* Message */}
            {message && (
              <div
                className="rounded-lg px-3.5 py-2.5 text-xs"
                style={
                  message.type === "error"
                    ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }
                    : { background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.25)", color: "#7DD3FC" }
                }
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #6366F1, #38BDF8)", boxShadow: "0 0 20px rgba(99,102,241,0.3)" }}
            >
              {loading
                ? "Chargement…"
                : mode === "login"
                ? "Se connecter →"
                : "Créer mon compte →"}
            </button>
          </form>
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
