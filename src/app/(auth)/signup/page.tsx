// src/app/(auth)/signup/page.tsx
"use client";

import { useState } from "react";
import { signUp } from "../actions";

export default function SignupPage() {
  const [err, setErr] = useState<string | null>(null);

  return (
    <main className="max-w-sm mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Créer un compte</h1>

      <form
        action={async (formData) => {
          setErr(null);
          const res = await signUp(formData);
          if (res?.ok === false) setErr(res.message);
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-md bg-zinc-800 text-white px-3 py-2 border border-zinc-700"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Mot de passe</label>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-md bg-zinc-800 text-white px-3 py-2 border border-zinc-700"
          />
        </div>

        {err && <p className="text-red-400 text-sm">{err}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-indigo-600 px-4 py-2 font-semibold"
        >
          S’inscrire
        </button>
      </form>

      <p className="text-sm opacity-80">
        Déjà un compte ? <a className="underline" href="/login">Se connecter</a>
      </p>
    </main>
  );
}
