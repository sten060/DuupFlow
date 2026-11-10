"use client";

import Link from "@/components/LocaleLink";
import { useTranslation } from "@/lib/i18n/context";
import LanguageSwitch from "@/components/LanguageSwitch";

const LAST_UPDATED = { fr: "19 mars 2026", en: "March 19, 2026" } as const;

export default function TermsPage() {
  const { t, locale } = useTranslation();

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.08] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span style={{ color: "#818CF8" }}>Duup</span>
            <span className="text-white/55">Flow</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy" className="text-sm text-white/40 hover:text-white/70 transition">
            {t("legal.privacyLink")}
          </Link>
            <LanguageSwitch variant="dark" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium mb-4"
            style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)", color: "#818CF8" }}>
            {t("legal.lastUpdated")} {LAST_UPDATED[locale]}
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">{t("legal.termsPageTitle")}</h1>
          <p className="text-white/50 text-base max-w-2xl">
            {t("legal.termsPageSubtitle")}
          </p>
        </div>

        {locale === "fr" ? <TermsFr /> : <TermsEn />}

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

/* Version française (texte de référence). */
function TermsFr() {
  const { t } = useTranslation();
  return (
    <div className="space-y-10 text-white/70 leading-relaxed">

      {/* 1 */}
      <Section title="1. Présentation du service">
        <p>
          DuupFlow est une plateforme SaaS permettant aux créateurs de contenu et agences de marketing de dupliquer et varier leurs fichiers médias (vidéos, images) afin de les distribuer sur plusieurs plateformes. Le service est accessible à l&apos;adresse{" "}
          <a href="https://www.duupflow.com" className="text-indigo-400 hover:text-indigo-300">www.duupflow.com</a>.
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
          <Link href="/pricing" className="text-indigo-400 hover:text-indigo-300">/tarifs</Link>.
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
  );
}

/* English version — translation of the French terms above. */
function TermsEn() {
  const { t } = useTranslation();
  return (
    <div className="space-y-10 text-white/70 leading-relaxed">

      <Section title="1. About the service">
        <p>
          DuupFlow is a SaaS platform that lets content creators and marketing agencies duplicate and vary their media files (videos, images) in order to distribute them across several platforms. The service is available at{" "}
          <a href="https://www.duupflow.com" className="text-indigo-400 hover:text-indigo-300">www.duupflow.com</a>.
        </p>
        <p>
          The service is published and operated by <strong className="text-white">DuupFlow</strong>.
          Contact: <a href="mailto:hello@duupflow.com" className="text-indigo-400 hover:text-indigo-300">hello@duupflow.com</a>
        </p>
      </Section>

      <Section title="2. Acceptance of the terms">
        <p>
          Using the service means you fully accept these Terms of Service. If you do not accept them, you must stop using DuupFlow.
        </p>
        <p>
          These terms apply to every user of the service, whether account holder (main user) or invited team member (guest user). You confirm that you are at least 16 years old and legally able to enter into a contract.
        </p>
      </Section>

      <Section title="3. Creating an account">
        <p>
          To access the service, you must create an account with a valid email address or sign in with Google. You are responsible for keeping your access confidential (magic link, Google session).
        </p>
        <p>
          You agree to provide accurate information and to keep it up to date. DuupFlow may suspend or delete any account whose information is inaccurate or fraudulent.
        </p>
        <p>
          Signing in with Google is subject to the{" "}
          <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
            Google Terms of Service
          </a>
          . DuupFlow does not share your Google data with third parties for advertising purposes.
        </p>
      </Section>

      <Section title="4. Plans and subscription">
        <p>DuupFlow offers the following plans:</p>
        <ul className="list-disc list-inside space-y-2 ml-2 text-white/60">
          <li><strong className="text-white/80">Free account:</strong> limited access to the service&apos;s features, with no commitment.</li>
          <li><strong className="text-white/80">Paid subscription:</strong> full access to the service, billed through Stripe.</li>
        </ul>
        <p>
          Current prices are shown on the{" "}
          <Link href="/pricing" className="text-indigo-400 hover:text-indigo-300">pricing page</Link>.
          Any price change will be notified to you at least 30 days in advance.
        </p>
      </Section>

      <Section title="5. Payment and billing">
        <p>
          Payments are processed by <strong className="text-white">Stripe</strong>, a PCI-DSS certified third-party provider. DuupFlow does not store any card data.
        </p>
        <p>
          Your subscription renews automatically at the end of each period (monthly or yearly) until you cancel it. If a payment fails, access to premium features may be suspended.
        </p>
        <p>
          Under article L.221-28 of the French Consumer Code, the 14-day right of withdrawal does not apply to digital services whose performance has begun with your express consent before the end of that period. By subscribing and starting to use the service, you expressly waive your right of withdrawal.
        </p>
      </Section>

      <Section title="6. Cancellation">
        <p>
          You can cancel your subscription at any time from your account. Cancellation takes effect at the end of the current billing period — you keep access until then.
        </p>
        <p>
          DuupFlow may suspend or terminate your account without notice in case of breach of these terms, abusive use of the service or fraudulent behaviour.
        </p>
      </Section>

      <Section title="7. Acceptable use">
        <p>You agree to use DuupFlow only for legitimate and lawful purposes. It is strictly forbidden to:</p>
        <ul className="list-disc list-inside space-y-2 ml-2 text-white/60">
          <li>Upload, process or distribute illegal, violent or hateful content, sexual content involving minors, or content that infringes the rights of others.</li>
          <li>Use the service to infringe intellectual property rights (copyright, trademarks, patents).</li>
          <li>Attempt to bypass security measures or reverse-engineer the service.</li>
          <li>Use unauthorised bots, scripts or automated tools to access the service.</li>
          <li>Resell, sublicense or commercially exploit the service without written permission.</li>
        </ul>
        <p>
          DuupFlow may remove any content that breaks these rules and report violations to the competent authorities.
        </p>
      </Section>

      <Section title="8. Intellectual property">
        <p>
          <strong className="text-white">Your content:</strong> You keep all rights to the files you upload. By using DuupFlow, you grant the Company a limited, non-exclusive and non-transferable licence to process these files for the sole purpose of providing the service.
        </p>
        <p>
          <strong className="text-white">Platform content:</strong> All elements that make up DuupFlow (interface, code, text, trademarks, logos) are the exclusive property of the Company and are protected by intellectual property law. Any unauthorised reproduction is prohibited.
        </p>
        <p>
          You confirm that you hold the necessary rights to any content you upload and you hold DuupFlow harmless against any third-party claim.
        </p>
      </Section>

      <Section title="9. Team feature (guest users)">
        <p>
          Subscribers can invite up to 3 guest users to their workspace. Guest users access the service under the responsibility of the main user (host), who is solely responsible for how their guests use it.
        </p>
        <p>
          The host can revoke a guest&apos;s access at any time. If the host account is closed, guest access is automatically disabled.
        </p>
      </Section>

      <Section title="10. Availability and maintenance">
        <p>
          DuupFlow strives to keep the service available 24/7. However, interruptions may occur for maintenance, updates or in cases of force majeure.
        </p>
        <p>
          We may modify, suspend or discontinue all or part of the service at any time, with or without notice. DuupFlow cannot be held liable for service interruptions beyond its control.
        </p>
      </Section>

      <Section title="11. Limitation of liability">
        <p>
          To the extent permitted by applicable law, DuupFlow shall not be liable for:
        </p>
        <ul className="list-disc list-inside space-y-2 ml-2 text-white/60">
          <li>Indirect, consequential, special or punitive damages arising from the use of, or inability to use, the service.</li>
          <li>Data loss resulting from your use of the service.</li>
          <li>Acts or omissions of third parties, including payment or hosting providers.</li>
          <li>The removal by third-party platforms (Instagram, TikTok, YouTube, etc.) of content distributed using DuupFlow.</li>
        </ul>
        <p>
          DuupFlow&apos;s total liability to you shall not exceed the amounts you paid during the 12 months preceding the event giving rise to the claim.
        </p>
      </Section>

      <Section title="12. Personal data">
        <p>
          The processing of your personal data is governed by our{" "}
          <Link href="/legal/privacy" className="text-indigo-400 hover:text-indigo-300">
            {t("legal.privacyTitle")}
          </Link>
          , which forms an integral part of these terms.
        </p>
      </Section>

      <Section title="13. Changes to these terms">
        <p>
          DuupFlow may modify these terms at any time. Material changes will be notified to you by email or in the app at least 15 days before they take effect.
        </p>
        <p>
          Continuing to use the service after notification means you accept the new terms. If you refuse the changes, you can close your account before they take effect.
        </p>
      </Section>

      <Section title="14. Governing law and jurisdiction">
        <p>
          These terms are governed by French law. In case of dispute, and after an attempt at amicable resolution, the competent French courts shall have exclusive jurisdiction.
        </p>
        <p>
          Under articles L.612-1 et seq. of the French Consumer Code, you may use a consumer mediator free of charge for any unresolved dispute.
        </p>
        <p>
          This English version is a translation provided for convenience. In case of discrepancy, the French version prevails.
        </p>
      </Section>

      <Section title="15. Contact">
        <p>
          For any question about these terms:<br />
          <a href="mailto:hello@duupflow.com" className="text-indigo-400 hover:text-indigo-300">hello@duupflow.com</a>
        </p>
      </Section>
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
