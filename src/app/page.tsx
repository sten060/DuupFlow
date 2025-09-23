export default function Home() {
  return (
    <main className="bg-[#0B0F1A] text-white">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="font-bold tracking-tight">ContentDuplicator</div>
        <nav className="flex items-center gap-6 text-sm text-gray-300">
          <a href="/product" className="hover:text-white">Produit</a>
          <a href="/pricing" className="hover:text-white hidden">Pricing</a>
          <a href="/legal" className="hover:text-white">Termes légaux</a>
          <a href="/product" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold">
            Commencer
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
          Duplique tes vidéos en <span className="text-indigo-400">versions uniques</span>, prêtes à poster.
        </h1>
        <p className="mt-5 text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
          Évite les flags, gagne du temps et scale sur plusieurs comptes.
          Métadonnées, hash, codec — tout est géré automatiquement.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a href="/product" className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold">
            Voir l’offre
          </a>
          <a href="#features" className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/15">
            En savoir plus
          </a>
        </div>

        {/* Logos plateformes */}
        <div className="mt-12 flex items-center justify-center gap-8 opacity-80">
          {/* Instagram */}
          <svg width="28" height="28" viewBox="0 0 24 24" className="fill-white/80">
            <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3a5 5 0 1 1 0 10a5 5 0 0 1 0-10zm0 2.2A2.8 2.8 0 1 0 12 16.8 2.8 2.8 0 0 0 12 9.2zm5.4-.9a1.1 1.1 0 1 1 0 2.2a1.1 1.1 0 0 1 0-2.2z"/>
          </svg>
          {/* TikTok */}
          <svg width="28" height="28" viewBox="0 0 24 24" className="fill-white/80">
            <path d="M16 3c1 2 2 3 4 3v3c-2 0-3-.5-4-1v6a6 6 0 1 1-6-6c.5 0 1 .1 1 .1v3s-.5-.1-1-.1a3 3 0 1 0 3 3V3h3z"/>
          </svg>
          {/* Reddit */}
          <svg width="28" height="28" viewBox="0 0 24 24" className="fill-white/80">
            <path d="M22 12c0 4.4-4.5 8-10 8S2 16.4 2 12s4.5-8 10-8c1.5 0 2.9.3 4.2.8l1.3-1.8 2 1.5-1.5 2.1A8.5 8.5 0 0 1 22 12zm-14.5 1a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3zm9 0a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3zM12 19c2.1 0 3.9-.8 5.1-2.1l-1.4-1.4c-.8.8-2.2 1.5-3.7 1.5s-2.9-.7-3.7-1.5l-1.4 1.4C8.1 18.2 9.9 19 12 19z"/>
          </svg>
          {/* YouTube Shorts */}
          <svg width="28" height="28" viewBox="0 0 24 24" className="fill-white/80">
            <path d="M10 3.2 16.5 7c1 .6 1 2.1 0 2.7L14 11l2.5 1.3c1 .6 1 2.1 0 2.7L10 18.8c-1 .6-2.3-.1-2.3-1.3V4.5C7.7 3.3 9 2.6 10 3.2z"/>
          </svg>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center">Ce que tu obtiens</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-6">
          {[
            { title: "Copies indétectables", desc: "Métadonnées, hash, codec, timebase — générées pour chaque copie." },
            { title: "Tous formats", desc: "Photos, Reels, TikTok, Shorts… tout est supporté." },
            { title: "Rapide & simple", desc: "Upload, choisis le nombre, télécharge. C’est prêt." },
          ].map((f, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="text-gray-300 mt-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Avis */}
      <section className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-xl">★★★★★</span>
            <span className="text-sm text-gray-300">Note moyenne 4.9/5 — 180+ avis</span>
          </div>
          <p className="mt-3 text-gray-200">
            “On a pu republier nos meilleurs Reels sur 12 comptes sans baisse de reach. Gain de temps énorme.”
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section className="text-center py-16">
        <a href="/product" className="px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold">
          Accéder au produit
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-gray-400 flex items-center justify-between">
          <span>© {new Date().getFullYear()} ContentDuplicator</span>
          <a href="/legal" className="hover:text-white">Termes légaux</a>
        </div>
      </footer>
    </main>
  );
}
