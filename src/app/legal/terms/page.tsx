"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

const LAST_UPDATED = "19 mars 2026";

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.08] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span style={{ color: "#818CF8" }}>Duup</span>
            <span className="text-white/55">Flow</span>
          </Link>
          <Link href="/legal/privacy" className="text-sm text-white/40 hover:text-white/70 transition">
            {t("legal.privacyLink")}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium mb-4"
            style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)", color: "#818CF8" }}>
            {t("legal.lastUpdated")} {LAST_UPDATED}
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">{t("legal.termsPageTitle")}</h1>
          <p className="text-white/50 text-base max-w-2xl">
            {t("legal.termsPageSubtitle")}
          </p>
        </div>

        <div className="space-y-10 text-white/70 leading-relaxed">

          {/* 1 */}
          <Section title="1. Présentation du service">
            <p>
              DuupFlow est une plateforme SaaS permettant aux créateurs de contenu et agences de marketing de dupliquer et varier leurs fichiers médias (vidéos, images) afin de les distribuer sur plusieurs plateformes. Le service est accessible à l&apos;adresse{" "}
              <a href="https://duupflow.com" className="text-indigo-400 hover:text-indigo-300">duupflow.com</a>.
            </p>
            <p>
              Le service est édité et exploité par <strong className="text-white">DuupFlow</strong>.
              Contact : <a href="mailto:hello@duupflow.com" className="text-indigo-400 hover:text-indigo-300">hello@duupflow.com</a>
            </p>
          </Section>

          {/* 2 */}
          <Section title="2. Acceptation des conditions">
            <p>
              L&apos;utilisation du service implique l&apos;acceptation pleine et entière des présentes CGU. Si vous n&apos;acceptez pas ces conditions, vous devez cesser d&apos;utiliser DuupFlow.
            </p>
            <p>
              Ces CGU s&apos;appliquent à tout utilisateur du service, qu&apos;il soit titulaire d&apos;un compte (utilisateur principal) ou membre invité (utilisateur invité). Vous déclarez avoir au moins 16 ans et être légalement autorisé à conclure un contrat.
            </p>
          </Section>

          {/* 3 */}
          <Section title="3. Création de compte">
            <p>
              Pour accéder au service, vous devez créer un compte en fournissant une adresse e-mail valide ou en vous connectant via Google. Vous êtes responsable de la confidentialité de votre accès (lien magique, session Google).
            </p>
            <p>
              Vous vous engagez à fournir des informations exactes et à les mettre à jour en cas de changement. DuupFlow se réserve le droit de suspendre ou supprimer tout compte dont les informations seraient inexactes ou frauduleuses.
            </p>
            <p>
              La connexion via Google est soumise aux{" "}
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
                Conditions d&apos;utilisation de Google
              </a>
              . DuupFlow ne partage pas vos données Google avec des tiers à des fins publicitaires.
            </p>
          </Section>

          {/* 4 */}
          <Section title="4. Description des formules et abonnement">
            <p>DuupFlow propose les formules suivantes :</p>
            <ul className="list-disc list-inside space-y-2 ml-2 text-white/60">
              <li><strong className="text-white/80">Compte gratuit :</strong> accès limité aux fonctionnalités du service, sans engagement.</li>
              <li><strong className="text-white/80">Abonnement payant :</strong> accès complet au service, facturé mensuellement via Stripe.</li>
            </ul>
            <p>
              Les tarifs en vigueur sont affichés sur la page{" "}
              <Link href="/tarifs" className="text-indigo-400 hover:text-indigo-300">/tarifs</Link>.
              Toute modification tarifaire vous sera notifiée au moins 30 jours à l&apos;avance.
            </p>
          </Section>

          {/* 5 */}
          <Section title="5. Paiement et facturation">
            <p>
              Les paiements sont traités par <strong className="text-white">Stripe</strong>, un prestataire tiers certifié PCI-DSS. DuupFlow ne stocke aucune donnée de carte bancaire.
            </p>
            <p>
              L&apos;abonnement est renouvelé automatiquement à chaque période (mensuelle ou annuelle) jusqu&apos;à résiliation. En cas d&apos;échec de paiement, l&apos;accès aux fonctionnalités premium peut être suspendu.
            </p>
            <p>
              Conformément à l&apos;article L.221-28 du Code de la consommation, le droit de rétractation de 14 jours ne s&apos;applique pas aux services numériques dont l&apos;exécution a commencé avec votre accord exprès avant l&apos;expiration du délai. En souscrivant et en commençant à utiliser le service, vous reconnaissez expressément renoncer à votre droit de rétractation.
            </p>
          </Section>

          {/* 6 */}
          <Section title="6. Résiliation">
            <p>
              Vous pouvez résilier votre abonnement à tout moment depuis votre espace de gestion. La résiliation prend effet à la fin de la période de facturation en cours — vous conservez l&apos;accès jusqu&apos;à cette date.
            </p>
            <p>
              DuupFlow se réserve le droit de suspendre ou résilier votre compte sans préavis en cas de violation des présentes CGU, d&apos;utilisation abusive du service, ou de comportement frauduleux.
            </p>
          </Section>

          {/* 7 */}
          <Section title="7. Utilisation acceptable">
            <p>Vous vous engagez à utiliser DuupFlow uniquement à des fins légitimes et légales. Il est strictement interdit de :</p>
            <ul className="list-disc list-inside space-y-2 ml-2 text-white/60">
              <li>Uploader, traiter ou distribuer des contenus illicites, violents, haineux, pornographiques impliquant des mineurs, ou portant atteinte à des droits de tiers.</li>
              <li>Utiliser le service pour enfreindre des droits de propriété intellectuelle (droits d&apos;auteur, marques, brevets).</li>
              <li>Tenter de contourner les mesures de sécurité ou de reverse-engineer le service.</li>
              <li>Utiliser des bots, scripts ou outils automatisés non autorisés pour accéder au service.</li>
              <li>Revendre, sous-licencier ou exploiter commercialement le service sans autorisation écrite.</li>
            </ul>
            <p>
              DuupFlow se réserve le droit de supprimer tout contenu en violation de ces règles et de signaler les infractions aux autorités compétentes.
            </p>
          </Section>

          {/* 8 */}
          <Section title="8. Propriété intellectuelle">
            <p>
              <strong className="text-white">Contenu de l&apos;utilisateur :</strong> Vous conservez l&apos;intégralité des droits sur les fichiers que vous uploadez. En utilisant DuupFlow, vous accordez à la Société une licence limitée, non exclusive et non cessible pour traiter ces fichiers dans le seul but de fournir le service.
            </p>
            <p>
              <strong className="text-white">Contenu de la plateforme :</strong> L&apos;ensemble des éléments constituant DuupFlow (interface, code, textes, marques, logos) est la propriété exclusive de la Société et est protégé par le droit de la propriété intellectuelle. Toute reproduction non autorisée est interdite.
            </p>
            <p>
              Vous déclarez détenir les droits nécessaires sur tout contenu uploadé et garantissez DuupFlow contre toute réclamation de tiers.
            </p>
          </Section>

          {/* 9 */}
          <Section title="9. Fonctionnalité équipe (utilisateurs invités)">
            <p>
              Les abonnés peuvent inviter jusqu&apos;à 3 utilisateurs invités dans leur espace de travail. Les utilisateurs invités accèdent aux fonctionnalités du service sous la responsabilité de l&apos;utilisateur principal (hôte), qui est seul responsable de l&apos;utilisation faite par ses invités.
            </p>
            <p>
              L&apos;hôte peut révoquer l&apos;accès d&apos;un invité à tout moment. En cas de résiliation du compte hôte, les accès invités sont automatiquement désactivés.
            </p>
          </Section>

          {/* 10 */}
          <Section title="10. Disponibilité et maintenance">
            <p>
              DuupFlow s&apos;efforce d&apos;assurer la disponibilité du service 24h/24, 7j/7. Toutefois, des interruptions peuvent survenir pour maintenance, mise à jour ou en cas de force majeure.
            </p>
            <p>
              Nous nous réservons le droit de modifier, suspendre ou interrompre tout ou partie du service à tout moment, avec ou sans préavis. DuupFlow ne pourra être tenu responsable des interruptions de service indépendantes de sa volonté.
            </p>
          </Section>

          {/* 11 */}
          <Section title="11. Limitation de responsabilité">
            <p>
              Dans les limites autorisées par la loi applicable, DuupFlow ne pourra être tenu responsable :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 text-white/60">
              <li>Des dommages indirects, consécutifs, spéciaux ou punitifs résultant de l&apos;utilisation ou de l&apos;impossibilité d&apos;utiliser le service.</li>
              <li>Des pertes de données résultant de votre utilisation du service.</li>
              <li>Des actes ou omissions de tiers, notamment des prestataires de paiement ou d&apos;hébergement.</li>
              <li>De la suppression par des plateformes tierces (Instagram, TikTok, YouTube, etc.) de contenus distribués via DuupFlow.</li>
            </ul>
            <p>
              La responsabilité totale de DuupFlow envers vous ne saurait excéder le montant des sommes versées au cours des 12 derniers mois précédant le fait générateur.
            </p>
          </Section>

          {/* 12 */}
          <Section title="12. Protection des données personnelles">
            <p>
              Le traitement de vos données personnelles est régi par notre{" "}
              <Link href="/legal/privacy" className="text-indigo-400 hover:text-indigo-300">
                {t("legal.privacyTitle")}
              </Link>
              , qui fait partie intégrante des présentes CGU.
            </p>
          </Section>

          {/* 13 */}
          <Section title="13. Modifications des CGU">
            <p>
              DuupFlow se réserve le droit de modifier les présentes CGU à tout moment. Les modifications substantielles vous seront notifiées par e-mail ou via l&apos;application au moins 15 jours avant leur entrée en vigueur.
            </p>
            <p>
              Votre utilisation continue du service après notification vaut acceptation des nouvelles conditions. Si vous refusez les modifications, vous pouvez résilier votre compte avant leur entrée en vigueur.
            </p>
          </Section>

          {/* 14 */}
          <Section title="14. Droit applicable et juridiction">
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux français compétents auront juridiction exclusive.
            </p>
            <p>
              Conformément aux articles L.612-1 et suivants du Code de la consommation, vous pouvez recourir gratuitement à un médiateur de la consommation en cas de litige non résolu.
            </p>
          </Section>

          {/* 15 */}
          <Section title="15. Contact">
            <p>
              Pour toute question relative aux présentes CGU :<br />
              <a href="mailto:hello@duupflow.com" className="text-indigo-400 hover:text-indigo-300">hello@duupflow.com</a>
            </p>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-white/[0.08] flex flex-wrap gap-4 text-sm text-white/40">
          <Link href="/" className="hover:text-white/70 transition">{t("legal.backToHome")}</Link>
          <Link href="/legal/privacy" className="hover:text-white/70 transition">{t("legal.privacyTitle")}</Link>
          <Link href="/legal" className="hover:text-white/70 transition">{t("legal.title")}</Link>
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
