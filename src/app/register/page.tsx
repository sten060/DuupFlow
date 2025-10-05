import { signUp } from "../(auth)/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function RegisterPage({ searchParams }: { searchParams?: { err?: string } }) {
  const err = searchParams?.err ? decodeURIComponent(searchParams.err) : undefined;

  return (
    <main className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Créer un compte</h1>
      {err && <p className="text-red-400 text-sm">{err}</p>}

      <form action={signUp} className="space-y-4">
        <input name="email" type="email" required placeholder="Email"
               className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2" />
        <input name="password" type="password" required placeholder="Mot de passe"
               className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2" />
        <button type="submit" className="rounded-lg bg-fuchsia-600 px-4 py-2 text-white">
          S’inscrire
        </button>
      </form>

      <p className="text-sm text-white/70">
        Déjà un compte ? <Link className="underline" href="/login">Se connecter</Link>
      </p>
    </main>
  );
}