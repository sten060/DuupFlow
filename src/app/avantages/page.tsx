"use client";

import Link from "next/link";
import Header from "@/components/Header";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

const testimonials = [
  { quote: "DuupFlow a divisé par 10 notre temps de production.", author: "Agence PixelForce" },
  { quote: "On ne peut plus s'en passer. L'outil est devenu indispensable.", author: "Studio Kreatif" },
  { quote: "Le meilleur investissement qu'on ait fait cette année.", author: "MediaVibe Agency" },
];

interface Section {
  title: string;
  text: string;
  mockupLabel: string;
  mockupDetails: string[];
}

const sections: Section[] = [
  {
    title: "Duplication ultra-rapide",
    text: "Fini les heures d'attente. DuupFlow duplique des dizaines de contenus en quelques secondes. Votre workflow passe à la vitesse supérieure.",
    mockupLabel: "Duplication en cours...",
    mockupDetails: ["video_campagne_01.mp4", "video_campagne_02.mp4", "video_campagne_03.mp4", "32 fichiers — 4.2s"],
  },
  {
    title: "Qualité parfaite, zéro compromis",
    text: "Chaque duplication conserve la qualité exacte de l'original. 1080p reste 1080p, 4K reste 4K. Aucune perte, aucune compression supplémentaire.",
    mockupLabel: "Analyse qualité",
    mockupDetails: ["Original: 1920x1080 · H.264", "Copie: 1920x1080 · H.264", "Delta pixels: 0.00%", "Qualité: identique"],
  },
  {
    title: "Duplication invisible",
    text: "Modifiez l'empreinte numérique de vos fichiers sans toucher au visuel. Métadonnées, hash, paramètres techniques — tout change, sauf ce que vos clients voient.",
    mockupLabel: "Empreinte modifiée",
    mockupDetails: ["Hash SHA-256: ████████ → ████████", "Metadata: régénérées", "Visuel: inchangé", "Détection: 0 match"],
  },
  {
    title: "Priorité algorithme",
    text: "Un clic suffit pour injecter des métadonnées iPhone authentiques dans vos duplications. Les algorithmes pensent que le contenu vient d'un appareil réel. Votre contenu a plus de chances de performer.",
    mockupLabel: "Injection métadonnées",
    mockupDetails: ["Device: iPhone 15 Pro Max", "Lens: 6.765mm f/1.78", "GPS: 48.8566° N, 2.3522° E", "Status: injecté"],
  },
  {
    title: "Signature IA effacée",
    text: "Votre contenu est détecté comme généré par l'IA ? C'était avant DuupFlow. Notre module efface les signatures IA (EXIF, C2PA, JUMBF) et les remplace par une identité humaine réaliste. Les algorithmes ne font plus la différence.",
    mockupLabel: "Nettoyage IA",
    mockupDetails: ["C2PA: supprimé", "JUMBF: supprimé", "EXIF IA: remplacé", "Résultat: contenu humain"],
  },
];

function MockupBox({ label, details }: { label: string; details: string[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] p-6 sm:p-8" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
          <span className="ml-2 text-xs text-white/30 font-mono">{label}</span>
        </div>
        <div className="space-y-2">
          {details.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" />
              <span className="text-sm text-white/50 font-mono">{d}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full w-full" style={{ background: "linear-gradient(90deg,#6366F1,#38BDF8)" }} />
        </div>
      </div>
    </div>
  );
}

export default function AvantagesPage() {
  return (
    <div className="min-h-screen text-white tech-grid">
      <Header />

      {/* Hero */}
      <section className="pt-40 pb-20 px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left — headline */}
          <div>
            <Link href="/" className="text-sm text-white/40 hover:text-white/70 transition mb-8 inline-block">
              &larr; Retour à l&apos;accueil
            </Link>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Découvrez les avantages{" "}
              <span className={G}>DuupFlow</span>{" "}
              pour votre agence
            </h1>
            <p className="mt-4 text-white/50 max-w-md">
              Plus de rapidité, plus de qualité, plus de performances. Voici pourquoi les meilleures agences nous font confiance.
            </p>
          </div>

          {/* Right — testimonials panel */}
          <div
            className="rounded-2xl border border-indigo-500/20 p-6 sm:p-8 space-y-5"
            style={{ background: "rgba(10,14,40,0.8)" }}
          >
            <h3 className="text-xs uppercase tracking-widest text-indigo-300/70 mb-2">Ces agences nous font confiance</h3>
            {testimonials.map((t, i) => (
              <div key={i} className="border-l-2 border-indigo-500/30 pl-4">
                <p className="text-sm text-white/70 italic">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-xs text-white/40 mt-1">— {t.author}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alternating sections */}
      {sections.map((s, i) => {
        const reversed = i % 2 !== 0;
        return (
          <section key={i} className="py-16 px-6">
            <div className={`max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center ${reversed ? "md:direction-rtl" : ""}`}>
              {/* Mockup */}
              <div className={reversed ? "md:order-2" : ""}>
                <MockupBox label={s.mockupLabel} details={s.mockupDetails} />
              </div>
              {/* Text */}
              <div className={reversed ? "md:order-1" : ""}>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                  <span className={G}>{s.title}</span>
                </h2>
                <p className="text-white/50 leading-relaxed">{s.text}</p>
              </div>
            </div>
          </section>
        );
      })}

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-2xl sm:text-4xl font-bold mb-4">
          Prêt à transformer votre <span className={G}>workflow</span> ?
        </h2>
        <p className="text-white/40 mb-8 max-w-md mx-auto">
          Rejoignez les agences qui produisent plus, plus vite, sans compromis.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          Commencer gratuitement &rarr;
        </Link>
      </section>
    </div>
  );
}
