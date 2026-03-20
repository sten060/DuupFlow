"use client";

import Link from "next/link";
import { useState } from "react";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

/* ─── Testimonials ─── */
const TESTIMONIALS = [
  {
    text: "DuupFlow nous a fait gagner des heures. On réutilise nos meilleurs contenus sans jamais être pénalisés par les algorithmes.",
    name: "S.M.",
    role: "Fondateur d'agence marketing",
    initials: "SM",
    color: "#6366F1",
  },
  {
    text: "DuupFlow fait ça en quelques secondes et les résultats sont incomparables. Mon reach a explosé depuis que je l'utilise.",
    name: "J.R.",
    role: "Créatrice de contenu",
    initials: "JR",
    color: "#8B5CF6",
  },
  {
    text: "Je vérifie chaque copie avant de publier grâce au Comparateur. Mon taux d'engagement a doublé en un mois.",
    name: "A.K.",
    role: "Growth Marketer",
    initials: "AK",
    color: "#38BDF8",
  },
  {
    text: "50 copies d'un même Reel, chacune unique. TikTok ne l'a jamais détecté. C'est exactement ce qu'il nous fallait.",
    name: "L.B.",
    role: "Responsable Marketing Digital",
    initials: "LB",
    color: "#EC4899",
  },
  {
    text: "Notre portée organique a explosé. On publie le même contenu sur 6 plateformes sans aucune pénalité algorithmique.",
    name: "P.D.",
    role: "Directeur Créatif",
    initials: "PD",
    color: "#10B981",
  },
  {
    text: "Notre CAC a baissé de 30% depuis qu'on scale avec DuupFlow. La duplication automatique des meilleurs contenus, c'est du génie.",
    name: "T.M.",
    role: "Performance Manager",
    initials: "TM",
    color: "#F59E0B",
  },
  {
    text: "Avant DuupFlow, chaque post demandait une nouvelle création. Maintenant on réutilise nos top performers à l'infini.",
    name: "N.V.",
    role: "Content Strategist",
    initials: "NV",
    color: "#6366F1",
  },
  {
    text: "Le module Détection IA est parfait. Je publie des contenus générés par IA sans aucun marqueur détectable.",
    name: "R.C.",
    role: "Designer Freelance",
    initials: "RC",
    color: "#8B5CF6",
  },
  {
    text: "DuupFlow gère 3 clients en simultané. On génère 100+ copies par semaine sans effort supplémentaire.",
    name: "F.L.",
    role: "Fondateur d'agence",
    initials: "FL",
    color: "#38BDF8",
  },
  {
    text: "Ce qui me plaît avec DuupFlow, c'est la simplicité. Upload, dupliquer, télécharger. 30 secondes chrono.",
    name: "C.B.",
    role: "Créatrice UGC",
    initials: "CB",
    color: "#EC4899",
  },
  {
    text: "Mon taux d'impression sur TikTok a triplé en 2 semaines après avoir commencé à utiliser DuupFlow.",
    name: "K.D.",
    role: "TikToker",
    initials: "KD",
    color: "#10B981",
  },
  {
    text: "DuupFlow est devenu notre outil #1. Pas une seule pénalité depuis 4 mois d'utilisation intensive.",
    name: "O.M.",
    role: "Social Media Manager",
    initials: "OM",
    color: "#F59E0B",
  },
];

/* ─── Pricing FAQ ─── */
const PRICING_FAQS = [
  {
    q: "Puis-je annuler mon abonnement à tout moment ?",
    a: "Oui, absolument. Tu peux annuler ton abonnement à tout moment depuis ton espace compte, sans préavis ni frais supplémentaires. L'accès reste actif jusqu'à la fin de la période déjà payée.",
  },
  {
    q: "Le plan Pro inclut-il tous les modules DuupFlow ?",
    a: "Oui. Le plan Pro donne accès à l'intégralité des modules : Duplication Images, Duplication Vidéos, Comparateur de similarité et Détection IA. Tous les formats sont supportés et les copies sont illimitées.",
  },
  {
    q: "Combien de fichiers puis-je traiter par mois avec le plan Pro ?",
    a: "Il n'y a aucune limite sur le nombre de fichiers ou de copies générées. Tu peux importer autant de contenus que tu veux et créer autant de variantes que nécessaire, sans restriction mensuelle.",
  },
  {
    q: "Y a-t-il une période d'essai gratuite ?",
    a: "Nous proposons une garantie satisfait ou remboursé de 7 jours. Si DuupFlow ne correspond pas à tes attentes dans les 7 premiers jours, contacte-nous et nous te remboursons intégralement.",
  },
  {
    q: "Comment fonctionne la facturation ?",
    a: "La facturation est mensuelle et automatique. Tu reçois une facture par email à chaque renouvellement. Nous acceptons les cartes Visa, Mastercard et American Express via notre partenaire Stripe.",
  },
  {
    q: "Quelle est la différence entre le plan Pro et le plan Entreprise ?",
    a: "Le plan Pro est conçu pour les créateurs et petites agences — accès complet, copies illimitées, support prioritaire. Le plan Entreprise ajoute l'accès API, un account manager dédié, un SLA personnalisé et un onboarding sur mesure pour les équipes de grande taille.",
  },
];

function TestimonialCard({ t }: { t: typeof TESTIMONIALS[0] }) {
  return (
    <div
      className="shrink-0 w-[260px] rounded-2xl border border-white/[0.10] px-5 py-4 flex flex-col justify-between"
      style={{ background: "rgba(8,12,35,0.75)" }}
    >
      <p className="text-xs text-white/65 leading-relaxed mb-3 line-clamp-2">
        &ldquo;{t.text}&rdquo;
      </p>
      <div className="flex items-center gap-2.5">
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{ background: t.color }}
        >
          {t.initials}
        </div>
        <div>
          <p className="text-xs font-semibold text-white leading-none mb-0.5">{t.name}</p>
          <p className="text-[10px] text-white/40">{t.role}</p>
        </div>
      </div>
    </div>
  );
}

function TestimonialsCarousel() {
  return (
    <div className="relative overflow-hidden">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track { animation: marquee 80s linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
      `}</style>

      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-40 z-10"
        style={{ background: "linear-gradient(90deg, rgba(6,12,30,1) 0%, rgba(6,12,30,0.9) 60%, transparent 100%)" }} />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-40 z-10"
        style={{ background: "linear-gradient(270deg, rgba(6,12,30,1) 0%, rgba(6,12,30,0.9) 60%, transparent 100%)" }} />

      <div className="marquee-track flex gap-4" style={{ width: "max-content" }}>
        {/* Render twice for seamless loop */}
        {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
          <TestimonialCard key={i} t={t} />
        ))}
      </div>
    </div>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <div
      className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
      style={{ background: `${color}20`, border: `1px solid ${color}40` }}
    >
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="3">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  );
}

function PricingCards() {
  const soloFeatures = [
    "300 duplications images / mois",
    "200 duplications vidéos / mois",
    "100 modifications signature IA / mois",
    "Formats JPG, PNG, WEBP, MP4, MOV, MKV",
    "Métadonnées EXIF/XMP uniques à chaque copie",
    "Export ZIP en un clic",
    "Support par email",
  ];

  const proFeatures = [
    "Spoofing images illimité",
    "Duplications vidéos illimitées",
    "Signature IA — modifications illimitées",
    "3 membres invités dans ton workspace",
    "Tous formats & presets avancés",
    "Export ZIP en un clic",
    "Support prioritaire 7j/7",
  ];

  const enterpriseFeatures = [
    "Tout le plan Pro, sans limitation",
    "Accès API complet",
    "Account manager dédié",
    "SLA personnalisé garanti",
    "Onboarding et formation équipe",
    "Facturation sur mesure",
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6 justify-center max-w-4xl mx-auto">

      {/* Plan Solo */}
      <div
        className="relative flex-1 rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,14,40,0.90)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.28) 0%, transparent 75%)",
          }}
        />
        <div className="relative z-10 p-8 flex flex-col flex-1">
          <div className="mb-6">
            <span className="text-base font-semibold text-white">Plan Solo</span>
            <div className="flex items-baseline gap-1.5 mb-1 mt-4">
              <span className="text-5xl font-bold text-white">39€</span>
              <span className="text-white/45 text-sm">/ mois</span>
            </div>
            <p className="text-white/45 text-sm">Pour les créateurs indépendants</p>
          </div>
          <div className="h-px bg-white/[0.08] mb-6" />
          <ul className="space-y-3.5 flex-1 mb-8">
            {soloFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                <CheckIcon color="#A78BFA" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/register?plan=solo"
            className="w-full flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#7C3AED,#6366F1)" }}
          >
            Commencer →
          </Link>
        </div>
      </div>

      {/* Plan Pro */}
      <div
        className="relative flex-1 rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,14,40,0.90)",
          border: "1.5px solid rgba(99,102,241,0.40)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.40) 0%, transparent 75%)",
          }}
        />
        <div className="relative z-10 p-8 flex flex-col flex-1">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-base font-semibold text-white">Plan Pro</span>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 uppercase tracking-wide">
                Le plus populaire
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-5xl font-bold text-white">99€</span>
              <span className="text-white/45 text-sm">/ mois</span>
            </div>
            <p className="text-white/45 text-sm">Pour les créateurs et agences</p>
          </div>
          <div className="h-px bg-white/[0.08] mb-6" />
          <ul className="space-y-3.5 flex-1 mb-8">
            {proFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                <CheckIcon color="#818CF8" />
                {f}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <Link
              href="/register?plan=pro"
              className="w-full flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              Commencer →
            </Link>
            <Link
              href="/demo"
              className="w-full flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold text-white/70 hover:text-white transition border border-white/15 hover:border-white/30 hover:bg-white/[0.04]"
            >
              Voir la démo
            </Link>
          </div>
        </div>
      </div>

      {/* Plan Entreprise */}
      <div
        className="relative flex-1 rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,14,40,0.90)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(56,189,248,0.22) 0%, transparent 75%)",
          }}
        />
        <div className="relative z-10 p-8 flex flex-col flex-1">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-base font-semibold text-white">Plan Entreprise</span>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-5xl font-bold text-white">Sur devis</span>
            </div>
            <p className="text-white/45 text-sm">Solutions personnalisées pour les équipes</p>
          </div>
          <div className="h-px bg-white/[0.08] mb-6" />
          <ul className="space-y-3.5 flex-1 mb-8">
            {enterpriseFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                <CheckIcon color="#38BDF8" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href="mailto:contact@duupflow.com"
            className="w-full flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold text-white/80 hover:text-white transition border border-white/20 hover:border-white/35 hover:bg-white/[0.04]"
          >
            Nous contacter →
          </a>
        </div>
      </div>
    </div>
  );
}

function PricingFAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="relative overflow-hidden">
      {/* Dark blue background */}
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(180deg, #040c28 0%, #06112f 50%, #040c28 100%)" }} />
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[400px] rounded-full pointer-events-none -z-10"
        style={{ background: "rgba(99,102,241,0.10)", filter: "blur(90px)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[350px] rounded-full pointer-events-none -z-10"
        style={{ background: "rgba(56,189,248,0.07)", filter: "blur(90px)" }} />

      <div className="px-6 pb-36">
        <div className="max-w-5xl mx-auto pt-20">
          <div className="grid md:grid-cols-[2fr_3fr] gap-16">
            <div className="md:sticky md:top-28 self-start">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">FAQ</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight leading-[1.1]">Questions fréquentes</h2>
              <p className="text-white/60 text-sm mt-4 leading-relaxed">
                Tu as d&apos;autres questions ? Contacte-nous par email.
              </p>
            </div>
            <div className="divide-y divide-white/[0.08]">
              {PRICING_FAQS.map((faq, i) => (
                <div key={i}>
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left text-sm font-medium text-white/90 hover:text-white transition"
                  >
                    <span>{faq.q}</span>
                    <span
                      className="shrink-0 h-6 w-6 rounded-full border border-white/15 flex items-center justify-center text-white/50 transition-transform"
                      style={{ transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>
                  {open === i && (
                    <div className="pb-5 text-sm text-white/70 leading-relaxed">{faq.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TarifsPage() {
  return (
    <div>
      {/* ── HERO ── */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-16">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-1.5 text-sm text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Tarif unique — tout inclus
        </div>
        <h1 className="text-5xl md:text-[3.5rem] font-bold tracking-tight text-white mb-4 leading-[1.08]">
          Nos Tarifs
        </h1>
        <p className="text-white/65 text-lg max-w-lg mb-3">
          Un seul plan pour tout scaler. Pas de limite, pas de surprise.
        </p>
        <p className="text-sm text-white/45 mb-2">
          Conçu pour les{" "}
          <span className={G + " font-semibold"}>créateurs</span>
          {" "}et les{" "}
          <span className={G + " font-semibold"}>agences marketing</span>
        </p>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="pb-16 overflow-hidden">
        <TestimonialsCarousel />
      </section>

      {/* ── PRICING CARDS ── */}
      <section className="px-6 pb-24">
        <PricingCards />
      </section>

      {/* ── FAQ ── */}
      <PricingFAQ />

      {/* ── FOOTER ── */}
      <footer className="px-6 pb-10 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto pt-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm font-bold tracking-tight">
            <span style={{ color: "#818CF8" }}>Duup</span>
            <span className="text-white/50">Flow</span>
          </div>
          <p className="text-xs text-white/25">© 2025 DuupFlow — Tous droits réservés.</p>
          <div className="flex gap-5 text-xs text-white/30">
            <Link href="/legal" className="hover:text-white/60 transition">Mentions légales</Link>
            <Link href="/legal/terms" className="hover:text-white/60 transition">CGU</Link>
            <Link href="/legal/privacy" className="hover:text-white/60 transition">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
