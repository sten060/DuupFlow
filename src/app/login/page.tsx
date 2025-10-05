"use client";

import { useState } from "react";
import Link from "next/link";
import { loginAction } from "./actions"; // ton action côté serveur

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // On crée un FormData depuis le formulaire
    const fd = new FormData(e.currentTarget);
    fd.set("email", email);
    fd.set("password", pwd); // <-- doit correspondre au champ que ton action attend

    // On appelle l’action serveur avec (undefined, formData)
    await loginAction(undefined as any, fd);

    // Si ton action fait un redirect, Next.js s’en occupera tout seul
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-white">Connexion</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
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

          <div>
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

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md"
          >
            Se connecter
          </button>
        </form>

        <p className="text-sm text-gray-400">
          Pas encore de compte ? <Link href="/signup">Inscription</Link>
        </p>
      </div>
    </main>
  );
}