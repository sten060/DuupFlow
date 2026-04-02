"use client";

import Link from "next/link";
import Header from "@/components/Header";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

const testimonials = [
  { quote: "DuupFlow a divisé par 10 notre temps de production. On scale nos campagnes sans effort.", author: "Agence PixelForce", role: "Growth Marketing" },
  { quote: "On ne peut plus s'en passer. L'outil est devenu indispensable pour notre workflow quotidien.", author: "Studio Kreatif", role: "Création de contenu" },
  { quote: "Le meilleur investissement qu'on ait fait cette année. ROI immédiat.", author: "MediaVibe Agency", role: "Social Media Management" },
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

      {/* Hero — split layout, wall from very top */}
      <div className="relative min-h-screen">
        {/* Right wall — starts from top of page, behind header */}
        <div
          className="absolute top-0 right-0 bottom-0 w-1/2 hidden md:block"
          style={{ background: "rgba(6,10,28,0.98)" }}
        />

        <div className="relative grid md:grid-cols-2 min-h-screen">
          {/* Left — headline */}
          <div className="px-8 sm:px-16 flex flex-col justify-center">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Découvrez les avantages{" "}
              <span className={G}>DuupFlow</span>{" "}
              pour votre agence
            </h1>
            <p className="mt-4 text-white/50 max-w-md">
              Plus de rapidité, plus de qualité, plus de performances.
              Voici pourquoi les meilleures agences nous font confiance.
            </p>
          </div>

          {/* Right — testimonials */}
          <div className="flex flex-col justify-center gap-5 px-8 sm:px-12 py-32 relative z-10">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-2">Ces agences nous font confiance</p>

            {testimonials.map((t, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 border border-white/[0.06] transition-all hover:border-white/[0.12] hover:translate-y-[-2px]"
                style={{ background: "rgba(255,255,255,0.025)" }}
              >
                <p className="text-sm text-white/80 leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${["#6366F1","#C026D3","#38BDF8"][i]}, ${["#38BDF8","#6366F1","#10B981"][i]})` }}
                  >
                    {t.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/70">{t.author}</p>
                    <p className="text-[10px] text-white/30">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}

            <p className="text-center text-xs text-white/20 mt-2">
              Utilisé par <span className="text-white/40 font-medium">500+ agences</span> marketing & créateurs
            </p>
          </div>
        </div>
      </div>

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
