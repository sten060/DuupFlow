// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password: pwd,
    });

    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // si "email confirmation" est activée dans Supabase, l'utilisateur devra confirmer.
    // sinon, il est déjà connecté et on peut pousser vers le dashboard :
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-white">Créer un compte</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-white outline-none"
              placeholder="ton@email.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-300">Mot de passe</label>
            <input
              type="password"
              required
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-white outline-none"
              placeholder="••••••••"
            />
          </div>

          {err && <p className="text-sm text-red-400">{err}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2 font-semibold text-white"
          >
            {loading ? "Création…" : "Créer mon compte"}
          </button>
        </form>

        <p className="text-sm text-gray-400">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-indigo-300 underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}