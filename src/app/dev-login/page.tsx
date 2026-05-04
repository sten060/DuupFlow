"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DevLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("duupflow_dev_email");
    if (saved) setEmail(saved);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash: json.token_hash,
        type: "magiclink",
      });
      if (verifyErr) throw verifyErr;

      localStorage.setItem("duupflow_dev_email", email);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F1A] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6"
      >
        <div>
          <h1 className="text-xl font-bold text-white">Dev login</h1>
          <p className="mt-1 text-xs text-white/50">
            Local dev only. Bypasses email — signs you in instantly.
          </p>
        </div>

        <label className="block">
          <span className="block text-sm text-white/70 mb-1">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
