export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#0B0F1A] text-white overflow-hidden">
      {/* --- Fond futuriste (halos + bruit très léger) --- */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* halos indigo/fuchsia */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] rounded-full blur-3xl"
             style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.25), transparent)" }} />
        <div className="absolute top-1/3 right-[10%] w-[700px] h-[500px] rounded-full blur-3xl"
             style={{ background: "radial-gradient(closest-side, rgba(236,72,153,0.18), transparent)" }} />
        {/* micro-noise */}
        <div className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
             style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22240%22 viewBox=%220 0 240 240%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22240%22 height=%22240%22 filter=%22url(%23n)%22 opacity=%220.5%22/></svg>')" }} />
      </div>

      {/* --- Header (sticky + glass) --- */}
      <header className="sticky top-0 z-20">
        <div className="max-w-6xl mx-auto mt-3 px-6 py-3 flex items-center justify-between rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 shadow-[0_6px_30px_-12px_rgba(0,0,0,0.5)]">
          <div className="font-bold tracking-tight">ContentDuplicator</div>
          <nav className="flex items-center gap-6 text-sm text-gray-300">
            <a href="/product" className="hover:text-white transition">Produit</a>
            <a href="/pricing" className="hover:text-white hidden transition">Pricing</a>
            <a href="/legal" className="hover:text-white transition">Termes légaux</a>
            <a
              href="/product"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-sm font-semibold shadow-[0_10px_30px_rgba(99,102,241,0.35)] transition"
            >
              Commencer
            </a>
          </nav>
        </div>
      </header>

      {/* --- Hero --- */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
          Duplique tes vidéos en{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-blue-300 to-fuchsia-400">
            versions uniques
          </span>
          , prêtes à poster.
        </h1>
        <p className="mt-5 text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
          Évite les flags, gagne du temps et scale sur plusieurs comptes.
          Métadonnées, hash, codec — tout est géré automatiquement.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="/product"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 font-semibold shadow-[0_12px_40px_rgba(236,72,153,0.28)] transition"
          >
            Voir l’offre
          </a>
          <a
            href="#features"
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 backdrop-blur-md transition"
          >
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

      {/* --- Features (cartes glass + bordure dégradée) --- */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center">Ce que tu obtiens</h2>

        <div className="mt-10 grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Copies indétectables",
              desc: "Métadonnées, hash, codec, timebase — générées pour chaque copie.",
              color: "from-emerald-400 to-teal-500",
              icon: ShieldIcon()
            },
            {
              title: "Tous formats",
              desc: "Photos, Reels, TikTok, Shorts… tout est supporté.",
              color: "from-indigo-400 to-fuchsia-500",
              icon: GridIcon()
            },
            {
              title: "Rapide & simple",
              desc: "Upload, choisis le nombre, télécharge. C’est prêt.",
              color: "from-amber-400 to-orange-500",
              icon: ZapIcon()
            },
          ].map((f, i) => (
            <div
              key={i}
              className="relative rounded-xl p-6 backdrop-blur-md bg-white/5 border border-white/10 transition hover:bg-white/10"
            >
              {/* border glow */}
              <div className={`pointer-events-none absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition
                               bg-gradient-to-r ${f.color}`} style={{maskImage:"linear-gradient(#000,#000)", WebkitMaskImage:"linear-gradient(#000,#000)"}} />
              <div className="relative z-10">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-gray-300 mt-2">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- Avis (étoiles + citation) --- */}
      <section className="max-w-4xl mx-auto px-6 pb-10">
        <div className="rounded-xl p-6 backdrop-blur-md bg-white/5 border border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex text-yellow-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className="h-5 w-5 fill-yellow-400" viewBox="0 0 20 20">
                  <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.2 3.68c.14.42.52.7.95.7h3.86c.97 0 1.37 1.24.59 1.81l-3.13 2.27c-.36.26-.5.73-.36 1.12l1.2 3.68c.3.92-.75 1.69-1.54 1.12l-3.13-2.27a1.1 1.1 0 0 0-1.18 0l-3.13 2.27c-.78.57-1.84-.2-1.54-1.12l1.2-3.68c.14-.39 0-.86-.36-1.12L2.45 9.11c-.78-.57-.38-1.81.59-1.81H6.9c.43 0 .81-.28.95-.7l1.2-3.68Z" />
                </svg>
              ))}
            </div>
            <span className="text-sm text-gray-300">Note moyenne 4.9/5 — 180+ avis</span>
          </div>
          <p className="mt-3 text-gray-200">
            “On a pu republier nos meilleurs Reels sur 12 comptes sans baisse de reach. Gain de temps énorme.”
          </p>
        </div>
      </section>

      {/* --- CTA final --- */}
      <section className="text-center py-16">
        <a
          href="/product"
          className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 font-semibold shadow-[0_12px_40px_rgba(236,72,153,0.28)] transition"
        >
          Accéder au produit
        </a>
      </section>

      {/* --- Footer --- */}
      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-gray-400 flex items-center justify-between">
          <span>© {new Date().getFullYear()} ContentDuplicator</span>
          <a href="/legal" className="hover:text-white">Termes légaux</a>
        </div>
      </footer>
    </main>
  );
}

/* --------- mini-icônes inline (pas d'import) --------- */
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/90" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l7 4v5c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/90" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}
function ZapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/90" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h7l-1 8 11-14h-7l0-6z" />
    </svg>
  );
}