"use client";

import Link from "next/link";
import Header from "@/components/Header";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

const testimonials = [
  { quote: "DuupFlow a divisé par 10 notre temps de production. On scale nos campagnes sans effort.", author: "Agence PixelForce", role: "Growth Marketing" },
  { quote: "Avant DuupFlow, on passait 3 heures par semaine à préparer nos contenus pour le multi-posting. Aujourd'hui c'est fait en 5 minutes. On a triplé notre volume de publication sans recruter.", author: "Studio Kreatif", role: "Création de contenu" },
  { quote: "Le meilleur investissement qu'on ait fait cette année. ROI immédiat.", author: "MediaVibe Agency", role: "Social Media Management" },
];

const sections = [
  {
    title: "Dupliquez en masse, sans attendre",
    text: "Vos campagnes ne peuvent pas attendre. Avec DuupFlow, dupliquez des dizaines de vidéos et d'images en quelques secondes — pas en quelques heures. Chaque copie est générée en parallèle avec des paramètres uniques. Votre équipe passe moins de temps sur la production technique et plus de temps sur la stratégie.",
    mockupLabel: "Duplication en cours...",
    mockupDetails: ["video_campagne_01.mp4", "video_campagne_02.mp4", "video_campagne_03.mp4", "32 fichiers — 4.2s"],
  },
  {
    title: "Qualité originale, zéro compromis",
    text: "Chaque duplication conserve la résolution exacte de votre fichier source. Une vidéo 1080p reste en 1080p. Une vidéo 4K reste en 4K. Aucun downscale automatique, aucune recompression destructrice. Vos clients reçoivent un contenu de qualité professionnelle, identique à l'original pixel par pixel.",
    mockupLabel: "Analyse qualité",
    mockupDetails: ["Original: 3840x2160 · HEVC", "Copie: 3840x2160 · H.264", "Résolution: préservée", "Qualité visuelle: identique"],
  },
  {
    title: "Modifiez l'invisible, gardez le visible",
    text: "Les plateformes analysent bien plus que les pixels visibles. Elles inspectent les métadonnées, le hash, la structure technique, l'empreinte numérique. DuupFlow modifie précisément ces couches invisibles — sans changer un seul pixel de votre contenu. Pour les algorithmes, chaque copie est un fichier totalement nouveau. Pour vos clients, c'est exactement le même contenu.",
    mockupLabel: "Empreinte modifiée",
    mockupDetails: ["Hash SHA-256: modifié", "Métadonnées: régénérées", "Structure technique: unique", "Visuel: inchangé"],
  },
  {
    title: "Placez votre contenu du côté de l'algorithme",
    text: "En un seul clic, DuupFlow injecte des métadonnées Apple authentiques dans vos fichiers — modèle iPhone, version iOS, objectif caméra, coordonnées GPS. Les algorithmes des plateformes traitent votre contenu comme s'il provenait d'un appareil réel. Vous pouvez aussi cibler une localisation précise pour viser un marché spécifique. Résultat : plus de portée, plus d'engagement, plus de performance.",
    mockupLabel: "Injection métadonnées",
    mockupDetails: ["Device: iPhone 16 Pro Max", "Lens: 6.86mm f/1.78", "GPS: 48.8566° N, 2.3522° E", "Software: iOS 18.3"],
  },
  {
    title: "Contenus IA ? Plus personne ne le saura",
    text: "Votre contenu généré par Midjourney, DALL-E ou Stable Diffusion est détecté sur les réseaux ? DuupFlow analyse exactement ce que les algorithmes recherchent pour identifier du contenu IA — signatures EXIF, manifestes C2PA, marqueurs JUMBF — et les efface intégralement. À la place, une identité humaine réaliste est injectée : appareil photo, photographe, logiciel, date. Pour les plateformes, votre contenu est humain.",
    mockupLabel: "Nettoyage signature IA",
    mockupDetails: ["C2PA: supprimé ✓", "JUMBF: supprimé ✓", "EXIF IA: remplacé ✓", "Identité: humaine ✓"],
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

      {/* Frosted glass right half — h-screen only, not fixed */}
      <div className="relative min-h-screen overflow-hidden">
        <div
          className="absolute top-0 right-0 w-1/2 h-full hidden md:block"
          style={{ backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", background: "rgba(6,10,28,0.25)" }}
        />

        <div className="relative z-10 min-h-screen grid md:grid-cols-2">
          {/* Left — headline, vertically centered */}
          <div className="px-8 sm:px-16 flex flex-col justify-center pt-24">
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

          {/* Right — testimonials with arc */}
          <div className="flex items-center justify-center py-24 px-6 relative overflow-visible">
            {/* Dashed arc connecting all 3 cards — open arc, not full circle */}
            <svg
              className="absolute pointer-events-none"
              width="600" height="600"
              viewBox="0 0 600 600"
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            >
              <path
                d="M 100 500 Q 100 100 300 80 Q 500 60 520 480"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1.5"
                strokeDasharray="6 6"
              />
            </svg>

            {/* Card 1 — top left, partially cut off, blurred */}
            <div
              className="absolute -left-16 top-[15%] w-[240px] rounded-xl p-4 opacity-35 blur-[1px]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[11px] text-white/60 leading-relaxed">{testimonials[0].quote}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-400 to-sky-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-white/50">{testimonials[0].author}</p>
                  <p className="text-[8px] text-white/25">{testimonials[0].role}</p>
                </div>
              </div>
            </div>

            {/* Card 3 — top right, partially cut off, blurred */}
            <div
              className="absolute -right-12 top-[10%] w-[240px] rounded-xl p-4 opacity-35 blur-[1px]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[11px] text-white/60 leading-relaxed">{testimonials[2].quote}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-400 to-sky-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-white/50">{testimonials[2].author}</p>
                  <p className="text-[8px] text-white/25">{testimonials[2].role}</p>
                </div>
              </div>
            </div>

            {/* Main card — center */}
            <div
              className="relative z-20 w-full max-w-[340px] rounded-2xl p-6"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              }}
            >
              <p className="text-[15px] text-white/90 leading-relaxed">
                &ldquo;{testimonials[1].quote}&rdquo;
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #C026D3, #6366F1)" }}
                >
                  S
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">{testimonials[1].author}</p>
                  <p className="text-xs text-white/40">{testimonials[1].role}</p>
                </div>
              </div>
            </div>

            {/* Logo circles on the arc */}
            <div className="absolute bottom-[18%] left-[15%] h-11 w-11 rounded-full border border-white/[0.08] bg-white/[0.03] flex items-center justify-center">
              <span className="text-[9px] font-bold text-white/25 tracking-tight">PF</span>
            </div>
            <div className="absolute bottom-[22%] right-[12%] h-11 w-11 rounded-full border border-white/[0.08] bg-white/[0.03] flex items-center justify-center">
              <span className="text-[9px] font-bold text-white/25 tracking-tight">MV</span>
            </div>
            {/* Center bottom logo */}
            <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 h-12 w-12 rounded-full border border-white/[0.10] bg-white/[0.05] flex items-center justify-center">
              <span className="text-[10px] font-black text-white/30">DF</span>
            </div>

            {/* Bottom text */}
            <p className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-white/20">
              Utilisé par <span className="text-white/40 font-medium">500+ agences</span> marketing & créateurs
            </p>
          </div>
        </div>
      </div>

      {/* Advantage sections */}
      {sections.map((s, i) => {
        const reversed = i % 2 !== 0;
        return (
          <section key={i} className="py-20 px-6">
            <div className={`max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center`}>
              <div className={reversed ? "md:order-2" : ""}>
                <MockupBox label={s.mockupLabel} details={s.mockupDetails} />
              </div>
              <div className={reversed ? "md:order-1" : ""}>
                <h2 className="text-2xl sm:text-3xl font-bold mb-5">
                  <span className={G}>{s.title}</span>
                </h2>
                <p className="text-white/50 leading-relaxed text-[15px]">{s.text}</p>
              </div>
            </div>
          </section>
        );
      })}

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-2xl sm:text-4xl font-bold mb-4">
          Prêt à transformer votre <span className={G}>workflow</span> ?
        </h2>
        <p className="text-white/40 mb-8 max-w-lg mx-auto">
          Rejoignez les agences qui produisent plus, plus vite, sans compromis sur la qualité.
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
