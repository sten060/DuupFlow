import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12 space-y-10">
      <header className="space-y-2">
        <h1 className="h1">Bienvenue</h1>
        <p className="muted">Choisis un module pour dupliquer ou comparer tes contenus.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* --- Images (rose) --- */}
        <Link
          href="/dashboard/images"
          className="relative card border-gradient-pink glow-pink hover:scale-[1.015] transition group overflow-hidden"
        >
          {/* halo décoratif */}
          <div className="pointer-events-none absolute -inset-20 opacity-30 blur-3xl transition group-hover:opacity-50"
               style={{ background: "radial-gradient(600px 200px at 80% -20%, rgba(255,63,209,.45), transparent 60%)" }} />
          <h2 className="h2 mb-2">Duplication Images</h2>
          <p className="muted">Variations fondamentales & visuelles, export en lot.</p>
          <div className="mt-5">
            <span className="btn bg-gradient-to-r from-[#FF3FD1] to-[#FF85E0] text-white">Ouvrir</span>
          </div>
        </Link>

        {/* --- Vidéos (bleu) --- */}
        <Link
          href="/dashboard/videos"
          className="relative card border-gradient-blue glow-blue hover:scale-[1.015] transition group overflow-hidden"
        >
          <div className="pointer-events-none absolute -inset-24 opacity-30 blur-3xl transition group-hover:opacity-50"
               style={{ background: "radial-gradient(600px 200px at 80% -20%, rgba(91,91,234,.45), transparent 60%)" }} />
          <h2 className="h2 mb-2">Duplication Vidéos</h2>
          <p className="muted">Ré-encodage léger, FPS/GOP/bitrate, variations vidéo.</p>
          <div className="mt-5">
            <span className="btn bg-gradient-to-r from-[#5B5BEA] to-[#9AA0FF] text-white">Ouvrir</span>
          </div>
        </Link>

        {/* --- Détecteur (vert) --- */}
        <Link
          href="/dashboard/similarity"
          className="relative card border-gradient-green glow-green hover:scale-[1.015] transition group overflow-hidden"
        >
          <div className="pointer-events-none absolute -inset-24 opacity-30 blur-3xl transition group-hover:opacity-50"
               style={{ background: "radial-gradient(600px 200px at 80% -20%, rgba(34,197,94,.45), transparent 60%)" }} />
          <h2 className="h2 mb-2">Détecteur de similarité</h2>
          <p className="muted">Mesure la proximité visuelle + métadonnées.</p>
          <div className="mt-5">
            <span className="btn bg-gradient-to-r from-[#22C55E] to-[#34D399] text-white">Ouvrir</span>
          </div>
        </Link>
      </section>
    </main>
  );
}