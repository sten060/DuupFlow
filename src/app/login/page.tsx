// src/app/login/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  // champs contrôlés (pour garder ton UI telle quelle)
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");

  // branche la Server Action (écrit les cookies côté serveur)
  const [state, formAction] = useActionState(loginAction, undefined);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-white">Connexion</h1>

        {/* IMPORTANT: on n’utilise plus onSubmit, mais action={formAction} */}
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-300">Email</label>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2"
              placeholder="ton@email.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">Mot de passe</label>
            <input
              type="password"
              name="password"
              required
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2"
              placeholder="••••••••"
            />
          </div>

          {/* Erreur renvoyée par la Server Action */}
          {state?.error && (
            <p className="text-sm text-red-400">{state.error}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2"
          >
            Se connecter
          </button>
        </form>

        <p className="text-sm text-gray-400">
          Pas de compte ?{" "}
          <Link href="/register" className="text-indigo-300 underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}