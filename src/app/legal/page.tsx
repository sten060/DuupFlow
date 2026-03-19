import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — DuupFlow",
  description: "Mentions légales, CGU et politique de confidentialité de DuupFlow.",
};

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.08] px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span style={{ color: "#818CF8" }}>Duup</span>
            <span className="text-white/55">Flow</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-white mb-3">Mentions légales</h1>
        <p className="text-white/50 text-base mb-12">
          Informations légales relatives au service DuupFlow.
        </p>

        {/* Legal docs links */}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          <Link href="/legal/terms"
            className="group rounded-2xl p-6 transition hover:border-indigo-500/40"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-white mb-1 group-hover:text-indigo-300 transition">
              Conditions Générales d&apos;Utilisation
            </h2>
            <p className="text-sm text-white/40">Règles d&apos;utilisation du service, abonnement, responsabilités.</p>
          </Link>

          <Link href="/legal/privacy"
            className="group rounded-2xl p-6 transition hover:border-indigo-500/40"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-white mb-1 group-hover:text-indigo-300 transition">
              Politique de confidentialité
            </h2>
            <p className="text-sm text-white/40">Données collectées, droits RGPD, sous-traitants, cookies.</p>
          </Link>
        </div>

        {/* Publisher info */}
        <div className="rounded-2xl p-6 space-y-4 text-sm text-white/60"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-base font-semibold text-white">Informations sur l&apos;éditeur</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-white/40 text-xs mb-1 uppercase tracking-wider">Éditeur</p>
              <p>DuupFlow</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1 uppercase tracking-wider">Site web</p>
              <p>duupflow.com</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1 uppercase tracking-wider">Contact</p>
              <a href="mailto:hello@duupflow.com" className="text-indigo-400 hover:text-indigo-300">hello@duupflow.com</a>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1 uppercase tracking-wider">Hébergement</p>
              <p>Railway Corp., San Francisco, CA, USA</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-sm text-white/40">
          <Link href="/" className="hover:text-white/70 transition">← Retour à l&apos;accueil</Link>
        </div>
      </main>
    </div>
  );
}
