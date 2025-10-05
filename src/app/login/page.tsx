import { signIn } from "../(auth)/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams?: { err?: string; ok?: string } }) {
  const err = searchParams?.err ? decodeURIComponent(searchParams.err) : undefined;
  const ok = searchParams?.ok ? "Compte créé. Connecte-toi." : undefined;

  return (
    <main className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Se connecter</h1>
      {ok && <p className="text-green-400 text-sm">{ok}</p>}
      {err && <p className="text-red-400 text-sm">{err}</p>}

      <form action={signIn} className="space-y-4">
        <input name="email" type="email" required placeholder="Email"
               className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2" />
        <input name="password" type="password" required placeholder="Mot de passe"
               className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2" />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-white">
          Se connecter
        </button>
      </form>

      <p className="text-sm text-white/70">
        Pas de compte ? <Link className="underline" href="/register">Créer un compte</Link>
      </p>
    </main>
  );
}