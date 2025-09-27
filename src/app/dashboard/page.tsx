// src/app/dashboard/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardHome() {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden p-6">
      <header className="mx-auto max-w-6xl">
        <p className="text-sm text-indigo-300/80">TABLEAU DE BORD</p>
        <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">
          Bienvenue
        </h1>
        <p className="mt-2 text-white/70 max-w-xl">
          Choisissez un module pour dupliquer vos contenus avec des variations contrôlées.
        </p>
      </header>

      <section className="mx-auto mt-8 grid max-w-6xl gap-6 md:grid-cols-2">
        {/* Carte Vidéos */}
        <Link href="/dashboard/videos" prefetch={false} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:border-indigo-400/40 hover:bg-indigo-500/10">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-indigo-500/20 p-3 ring-1 ring-inset ring-indigo-400/30">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-indigo-300" aria-hidden="true">
                <path fill="currentColor" d="M15 8.5v7l5-3.5-5-3.5ZM4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Duplication Vidéos</h2>
              <p className="mt-1 text-sm text-white/70">
                Import, choix des filtres (saturation, contraste, gamma, etc.), variations aléatoires encadrées et export propre.
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-indigo-300">
            <span className="font-medium">Accéder</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="currentColor" d="M13.5 5.5 20 12l-6.5 6.5-1.4-1.4L16.2 13H4v-2h12.2l-4.1-4.1 1.4-1.4Z"/></svg>
          </div>
        </Link>

        {/* Carte Images */}
        <Link href="/dashboard/images" prefetch={false} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:border-fuchsia-400/40 hover:bg-fuchsia-500/10">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-fuchsia-500/20 p-3 ring-1 ring-inset ring-fuchsia-400/30">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-fuchsia-300" aria-hidden="true">
                <path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v14l4-4h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Duplication Images</h2>
              <p className="mt-1 text-sm text-white/70">
                Légères variations (dimensions, EXIF, bruit, compression) pour générer des copies uniques indétectables.
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-fuchsia-300">
            <span className="font-medium">Accéder</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="currentColor" d="M13.5 5.5 20 12l-6.5 6.5-1.4-1.4L16.2 13H4v-2h12.2l-4.1-4.1 1.4-1.4Z"/></svg>
          </div>
        </Link>
      </section>

      <p className="mx-auto mt-10 max-w-6xl text-center text-xs text-white/40">
        Astuce : vous pouvez télécharger toutes vos générations en ZIP depuis chaque section.
      </p>
    </main>
  );
}