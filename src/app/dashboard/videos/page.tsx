import Link from "next/link";
import Toasts from "../Toasts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VideosHub({
  searchParams,
}: { searchParams?: { ok?: string; err?: string } }) {
  const ok = Boolean(searchParams?.ok);
  const err = searchParams?.err ? decodeURIComponent(searchParams.err) : undefined;

  return (
    <main className="p-6 space-y-8">
      <Toasts ok={ok} err={err} />

      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight">ZENO — Duplication Vidéos</h1>
        <p className="text-white/70">Choisis ton mode de travail. Simple pour aller vite. Avancé pour tout régler aux petits oignons.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {/* SIMPLE — conserve le thème indigo d'origine */}
        <Link
          href="/dashboard/videos/simple"
          className="group rounded-2xl border border-white/10 p-6 shadow-2xl shadow-indigo-950/25
                     bg-[radial-gradient(900px_400px_at_0%_-10%,_rgba(130,100,255,.18),_transparent_60%),_linear-gradient(135deg,_rgba(15,20,60,.85),_rgba(35,20,80,.45))]
                     hover:shadow-[0_0_60px_rgba(130,100,255,.25)] transition"
        >
          <h2 className="text-xl font-semibold mb-2">Mode Simple</h2>
          <p className="text-sm text-white/75">
            Packs légers + filtres clés (flip, rotation, dimension, bordure, miroir). Tout est cumulable.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-indigo-200 group-hover:gap-3 transition">
            <span>Commencer</span>
            <span>→</span>
          </div>
        </Link>

        {/* AVANCÉ — bleu clair néon */}
        <Link
          href="/dashboard/videos/advanced"
          className="group rounded-2xl border border-white/10 p-6 shadow-2xl
                     bg-[radial-gradient(900px_400px_at_0%_-10%,_rgba(90,170,255,.20),_transparent_60%),_linear-gradient(135deg,_rgba(10,25,60,.85),_rgba(20,45,100,.50))]
                     hover:shadow-[0_0_60px_rgba(90,170,255,.30)] transition"
        >
          <h2 className="text-xl font-semibold mb-2">Mode Avancé</h2>
          <p className="text-sm text-white/80">
            Contrôles précis (Min/Max ou W×H), templates, rendu cohérent avec tirage aléatoire par copie.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-sky-200 group-hover:gap-3 transition">
            <span>Configurer</span>
            <span>→</span>
          </div>
        </Link>
      </section>
    </main>
  );
}