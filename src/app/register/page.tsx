// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientBrowser } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClientBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // Succès -> renvoie vers la page login
    router.push("/login");
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Créer un compte</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            required
            className="w-full border rounded px-3 py-2 text-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@email.com"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Mot de passe</label>
          <input
            type="password"
            required
            className="w-full border rounded px-3 py-2 text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
          />
        </div>

        {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded"
        >
          {loading ? "Création…" : "Créer mon compte"}
        </button>
      </form>
    </div>
  );
}