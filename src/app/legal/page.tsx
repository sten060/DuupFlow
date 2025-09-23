export default function LegalPage() {
  return (
    <main className="min-h-screen bg-[#0B0F1A] text-white px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold">Termes légaux</h1>
        <p className="mt-3 text-gray-300 text-sm">
          Ce contenu est fourni à titre d’exemple. Remplace par tes conditions générales, mentions légales et politique de confidentialité.
        </p>

        <section className="mt-8 space-y-4 text-gray-200">
          <h2 className="text-xl font-semibold">1. Objet</h2>
          <p>Décris le service, les limites de responsabilité, etc.</p>

          <h2 className="text-xl font-semibold">2. Données personnelles</h2>
          <p>Explique la collecte et l’utilisation des données, lien vers la politique de confidentialité.</p>

          <h2 className="text-xl font-semibold">3. Abonnement</h2>
          <p>Modalités de facturation, rétractation, résiliation.</p>
        </section>

        <div className="mt-10">
          <a href="/" className="text-indigo-400 hover:text-indigo-300 underline">Retour à l’accueil</a>
        </div>
      </div>
    </main>
  );
}
