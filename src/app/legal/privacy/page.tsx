import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — DuupFlow",
  description: "Comment DuupFlow collecte, utilise et protège vos données personnelles.",
};

const LAST_UPDATED = "19 mars 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.08] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span style={{ color: "#818CF8" }}>Duup</span>
            <span className="text-white/55">Flow</span>
          </Link>
          <Link href="/legal/terms" className="text-sm text-white/40 hover:text-white/70 transition">
            CGU →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium mb-4"
            style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)", color: "#818CF8" }}>
            Dernière mise à jour : {LAST_UPDATED}
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Politique de confidentialité</h1>
          <p className="text-white/50 text-base max-w-2xl">
            Nous prenons la protection de vos données personnelles très au sérieux. Ce document vous explique quelles données nous collectons, pourquoi, et comment vous pouvez exercer vos droits.
          </p>
        </div>

        <div className="space-y-10 text-white/70 leading-relaxed">

          {/* 1 */}
          <Section title="1. Identité du responsable de traitement">
            <p>
              Le service DuupFlow est édité et exploité par <strong className="text-white">DuupFlow</strong> (ci-après «&nbsp;nous&nbsp;», «&nbsp;notre&nbsp;» ou «&nbsp;la Société&nbsp;»).
            </p>
            <p>
              Pour toute question relative à vos données personnelles, vous pouvez nous contacter à l&apos;adresse : <a href="mailto:hello@duupflow.com" className="text-indigo-400 hover:text-indigo-300">hello@duupflow.com</a>
            </p>
          </Section>

          {/* 2 */}
          <Section title="2. Données collectées et finalités">
            <p>Nous collectons uniquement les données nécessaires au bon fonctionnement du service :</p>
            <Table
              headers={["Donnée", "Source", "Finalité", "Base légale"]}
              rows={[
                ["Adresse e-mail", "Inscription / Google OAuth", "Création de compte, authentification, communications transactionnelles", "Exécution du contrat"],
                ["Prénom", "Formulaire d'onboarding", "Personnalisation de l'interface et des communications", "Exécution du contrat"],
                ["Nom de l'agence", "Formulaire d'onboarding", "Identification de l'espace de travail", "Exécution du contrat"],
                ["Données de paiement", "Stripe (tiers)", "Traitement des abonnements — nous n'accédons pas aux numéros de carte", "Exécution du contrat"],
                ["Fichiers uploadés (vidéos, images)", "Dashboard utilisateur", "Génération des copies dupliquées", "Exécution du contrat"],
                ["Journaux de connexion (IP, User-Agent, horodatage)", "Supabase / serveur", "Sécurité, prévention de la fraude", "Intérêt légitime"],
                ["Données de navigation (cookies analytiques)", "Navigation sur le site", "Amélioration du service", "Consentement"],
              ]}
            />
          </Section>

          {/* 3 */}
          <Section title="3. Utilisation de Google Sign-In">
            <p>
              DuupFlow propose la connexion via Google (Google OAuth 2.0). Lorsque vous choisissez cette option, nous accédons uniquement aux informations suivantes depuis votre compte Google :
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-white/60">
              <li>Votre adresse e-mail</li>
              <li>Votre nom affiché (prénom / nom public)</li>
              <li>Votre photo de profil (si disponible)</li>
            </ul>
            <p className="mt-3">
              Nous <strong className="text-white">n&apos;accédons pas</strong> à vos contacts Google, à vos e-mails, à votre agenda, ni à aucune autre donnée de votre compte Google. Nous ne revendons ni ne partageons vos informations Google avec des tiers à des fins publicitaires.
            </p>
            <p>
              Vous pouvez révoquer l&apos;accès accordé à DuupFlow à tout moment depuis votre compte Google :{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
                myaccount.google.com/permissions
              </a>
            </p>
            <p>
              Notre utilisation des données Google est conforme à la{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
                Politique d&apos;utilisation des données des services API Google
              </a>
              , y compris les exigences relatives à l&apos;utilisation limitée.
            </p>
          </Section>

          {/* 4 */}
          <Section title="4. Sous-traitants et transferts de données">
            <p>Pour fournir le service, nous travaillons avec les sous-traitants suivants :</p>
            <Table
              headers={["Sous-traitant", "Rôle", "Pays", "Garanties"]}
              rows={[
                ["Supabase", "Base de données, authentification, stockage", "UE (AWS Frankfurt)", "Conformité RGPD, DPA disponible"],
                ["Brevo (Sendinblue)", "Envoi d'e-mails transactionnels et marketing", "France / UE", "Conformité RGPD, DPA disponible"],
                ["Stripe", "Traitement des paiements", "États-Unis", "Clauses contractuelles types (SCCs)"],
                ["Replicate", "Traitement IA des médias", "États-Unis", "Clauses contractuelles types (SCCs)"],
                ["Railway", "Hébergement de l'application", "États-Unis", "Clauses contractuelles types (SCCs)"],
              ]}
            />
            <p>
              Aucune donnée n&apos;est vendue à des tiers. Les transferts hors UE sont encadrés par des garanties appropriées (Clauses Contractuelles Types approuvées par la Commission européenne).
            </p>
          </Section>

          {/* 5 */}
          <Section title="5. Durée de conservation">
            <ul className="list-disc list-inside space-y-2 ml-2 text-white/60">
              <li><strong className="text-white/80">Données de compte :</strong> conservées pendant toute la durée de l&apos;abonnement, puis supprimées dans un délai de 30 jours après résiliation du compte.</li>
              <li><strong className="text-white/80">Fichiers médias uploadés :</strong> conservés le temps du traitement, puis supprimés automatiquement selon la politique de nettoyage du service.</li>
              <li><strong className="text-white/80">Données de facturation :</strong> conservées 10 ans conformément aux obligations légales françaises (Code de commerce).</li>
              <li><strong className="text-white/80">Journaux de connexion :</strong> conservés 12 mois maximum.</li>
            </ul>
          </Section>

          {/* 6 */}
          <Section title="6. Vos droits (RGPD)">
            <p>Conformément au Règlement Général sur la Protection des Données (UE) 2016/679, vous disposez des droits suivants :</p>
            <ul className="list-disc list-inside space-y-2 ml-2 text-white/60">
              <li><strong className="text-white/80">Droit d&apos;accès</strong> — obtenir une copie de vos données personnelles.</li>
              <li><strong className="text-white/80">Droit de rectification</strong> — corriger des données inexactes.</li>
              <li><strong className="text-white/80">Droit à l&apos;effacement</strong> («&nbsp;droit à l&apos;oubli&nbsp;») — demander la suppression de vos données.</li>
              <li><strong className="text-white/80">Droit à la portabilité</strong> — recevoir vos données dans un format structuré.</li>
              <li><strong className="text-white/80">Droit d&apos;opposition</strong> — vous opposer à certains traitements fondés sur l&apos;intérêt légitime.</li>
              <li><strong className="text-white/80">Droit à la limitation du traitement</strong> — suspendre l&apos;utilisation de vos données dans certains cas.</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez-nous à{" "}
              <a href="mailto:hello@duupflow.com" className="text-indigo-400 hover:text-indigo-300">hello@duupflow.com</a>.
              Nous répondrons dans un délai de 30 jours. Vous disposez également du droit d&apos;introduire une réclamation auprès de la{" "}
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">CNIL</a>.
            </p>
          </Section>

          {/* 7 */}
          <Section title="7. Cookies et traceurs">
            <p>Nous utilisons les cookies suivants :</p>
            <Table
              headers={["Cookie", "Type", "Durée", "Finalité"]}
              rows={[
                ["sb-* (Supabase Auth)", "Fonctionnel", "Session / 1 an", "Maintien de la session d'authentification — obligatoire"],
                ["invite_token", "Fonctionnel", "30 minutes", "Transmission du token d'invitation pendant l'onboarding"],
                ["Cookies analytiques", "Analytique", "Selon outil", "Amélioration du service — soumis à consentement"],
              ]}
            />
            <p>
              Les cookies fonctionnels sont strictement nécessaires au fonctionnement du service et ne nécessitent pas votre consentement. Les cookies analytiques sont déposés uniquement après acceptation.
            </p>
          </Section>

          {/* 8 */}
          <Section title="8. Sécurité">
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, toute divulgation, altération ou destruction, notamment :
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-white/60">
              <li>Chiffrement des communications via HTTPS/TLS</li>
              <li>Authentification par lien magique (magic link) sans mot de passe stocké</li>
              <li>Accès à la base de données restreint par Row Level Security (RLS)</li>
              <li>Données de paiement gérées exclusivement par Stripe (certifié PCI-DSS)</li>
            </ul>
          </Section>

          {/* 9 */}
          <Section title="9. Mineurs">
            <p>
              DuupFlow est destiné à un public adulte professionnel. Nous ne collectons pas sciemment de données personnelles concernant des personnes de moins de 16 ans. Si vous pensez qu&apos;un mineur nous a fourni des données, contactez-nous immédiatement.
            </p>
          </Section>

          {/* 10 */}
          <Section title="10. Modifications de la politique">
            <p>
              Nous nous réservons le droit de modifier la présente politique à tout moment. En cas de modification substantielle, nous vous informerons par e-mail ou via une notification dans l&apos;application au moins 15 jours avant l&apos;entrée en vigueur des changements. La date de dernière mise à jour est indiquée en haut de cette page.
            </p>
          </Section>

          {/* 11 */}
          <Section title="11. Contact">
            <p>
              Pour toute question relative à la présente politique ou à vos données personnelles :<br />
              <a href="mailto:hello@duupflow.com" className="text-indigo-400 hover:text-indigo-300">hello@duupflow.com</a>
            </p>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-white/[0.08] flex flex-wrap gap-4 text-sm text-white/40">
          <Link href="/" className="hover:text-white/70 transition">← Retour à l&apos;accueil</Link>
          <Link href="/legal/terms" className="hover:text-white/70 transition">Conditions Générales d&apos;Utilisation</Link>
          <Link href="/legal" className="hover:text-white/70 transition">Mentions légales</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3 pb-2 border-b border-white/[0.06]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl mt-3" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.04)" }}>
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2.5 text-white/60 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 text-white/50 ${j === 0 ? "text-white/70 font-medium" : ""}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
