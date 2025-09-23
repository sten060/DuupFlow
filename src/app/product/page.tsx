export default function ProductPage() {
  return (
    <main className="min-h-screen bg-[#0B0F1A] text-white">
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <a href="/" className="font-bold">ContentDuplicator</a>
        <a href="/checkout" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold">
          Acheter →
        </a>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-center">Offre unique</h1>
        <p className="mt-3 text-center text-gray-300">Tout ce qu’il faut pour scaler en sécurité.</p>

        <div className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row gap-8 md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Pack Pro</h2>
              <ul className="mt-4 space-y-2 text-gray-200">
                <li>• Duplications <b>ILLIMITÉES</b></li>
                <li>• Tous formats supportés</li>
                <li>• Presets avancés personnalisés</li>
                <li>• Historique 90 jours</li>
                <li>• Analytics basiques</li>
              </ul>
            </div>
            <div className="text-center md:text-right">
              <div className="text-4xl font-extrabold">99€<span className="text-xl text-gray-300">/mois</span></div>
              <a href="/checkout" className="mt-4 inline-block px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold">
                Acheter →
              </a>
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Annulation à tout moment. TVA selon pays.
        </p>
      </section>
    </main>
  );
}
