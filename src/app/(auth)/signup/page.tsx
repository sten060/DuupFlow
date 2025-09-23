'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) return setError(error.message);

    // si “Confirm email” est activé dans Supabase, l’utilisateur doit valider l’email
    // on l’emmène au login
    router.push('/login');
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white grid place-items-center p-6">
      <div className="w-full max-w-sm bg-black/40 border border-white/10 rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-4">Créer un compte</h1>

        <form onSubmit={onSubmit} className="grid gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            className="px-3 py-2 rounded bg-black/60 border border-white/10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            placeholder="Mot de passe (min. 6 caractères)"
            className="px-3 py-2 rounded bg-black/60 border border-white/10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 font-semibold disabled:opacity-60"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-sm text-gray-400 mt-4">
          Déjà inscrit ? <a href="/login" className="text-indigo-400 underline">Se connecter</a>
        </p>
      </div>
    </main>
  );
}
