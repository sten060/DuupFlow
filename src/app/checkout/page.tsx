export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-[#0B0F1A] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold">Paiement — 99€/mois</h1>
        <p className="mt-2 text-gray-300">Tu vas être redirigé vers une page de paiement sécurisée.</p>
        <a
          href="#"
          className="mt-6 inline-block px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold"
        >
          Continuer vers Stripe (à brancher)
        </a>
        <p className="mt-4 text-sm text-gray-400">Déjà client ? <a href="/dashboard" className="underline">Accéder au produit</a></p>
      </div>
    </main>
  );
}