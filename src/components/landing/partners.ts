// Partenaires officiels de DuupFlow : une entrée par partenaire.
// Affichés dans la section « Ils nous font confiance » de la landing
// (PartnersSection.tsx) et sur la page /partners. Ajouter un partenaire =
// ajouter une entrée ici (+ ses logos dans /public/partner-logos ; pas /public/partners, que le middleware traite comme une page).

type Bilingual = { fr: string; en: string };

export type Partner = {
  key: string;
  name: string;
  /** Logo (fond clair). */
  logo: string;
  /** Pictogramme seul, affiché en filigrane sur la carte de la landing. */
  mark: string;
  /** Phrase courte (carte de la page /partners). */
  blurb: Bilingual;
  /** Texte long (carte de la landing). */
  pitch: Bilingual;
  cta: Bilingual;
  /** Page dédiée chez nous (ex. /partners/dropp). */
  href: string;
  /** Site du partenaire (lien de la carte de la landing). */
  url: string;
  /** Points forts affichés sous la carte de la landing (4 idéalement). */
  highlights: { icon: HighlightIcon; title: Bilingual; desc: Bilingual }[];
};

export type HighlightIcon = "link" | "wallet" | "bot" | "users";

export const PARTNERS: Partner[] = [
  {
    key: "dropp",
    name: "Dropp",
    logo: "/partner-logos/dropp.svg",
    mark: "/partner-logos/dropp-mark.svg",
    blurb: {
      en: "Sell directly on Telegram, without your fans ever leaving the chat.",
      fr: "Encaisse tes ventes directement sur Telegram, sans faire quitter la conversation au fan.",
    },
    pitch: {
      en: "Sell directly on Telegram, without your fans ever leaving the chat. Paid content, paid chats and multi-creator management in one place.",
      fr: "Encaisse tes ventes directement sur Telegram, sans faire quitter la conversation au fan. Contenus payants, chats payants et gestion multi-créatrices au même endroit.",
    },
    cta: { en: "Discover Dropp", fr: "Découvrir Dropp" },
    href: "/partners/dropp",
    url: "https://dropp.fans",
    // Repris des arguments de dropp.fans (fonctionnalités + FAQ tarifs).
    highlights: [
      {
        icon: "link",
        title: { en: "Payment links in 30 seconds", fr: "Liens de paiement en 30 s" },
        desc: {
          en: "Set a price, share the link on Telegram or any messaging app. Paid instantly.",
          fr: "Fixe ton prix, partage le lien sur Telegram ou n'importe quelle messagerie. Paiement instantané.",
        },
      },
      {
        icon: "wallet",
        title: { en: "Zero upfront cost", fr: "Zéro coût de départ" },
        desc: {
          en: "No subscription, no setup fee. A small commission on successful sales only.",
          fr: "Ni abonnement ni frais d'installation. Une petite commission sur les ventes réussies uniquement.",
        },
      },
      {
        icon: "bot",
        title: { en: "CRM & AI chatbot", fr: "CRM & chatbot IA" },
        desc: {
          en: "A full CRM with an AI chatbot, scripts and all your fan data.",
          fr: "Un CRM complet avec chatbot IA, scripts et toutes les données de tes fans.",
        },
      },
      {
        icon: "users",
        title: { en: "Multi-creator management", fr: "Gestion multi-créatrices" },
        desc: {
          en: "Every creator and her revenue analytics in a single dashboard.",
          fr: "Toutes tes créatrices et l'analytique de leurs revenus dans un seul tableau de bord.",
        },
      },
    ],
  },
];

export const PARTNER_BADGE: Bilingual = { en: "Official partner", fr: "Partenaire officiel" };
