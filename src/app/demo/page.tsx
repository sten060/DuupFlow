"use client";

import Link from "next/link";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    color: "#C026D3",
    bg: "rgba(192,38,211,0.10)",
    border: "rgba(192,38,211,0.22)",
    title: "Duplication Images",
    desc: "Génère des copies infinies d'une image, chacune avec des métadonnées EXIF/XMP uniques — invisible pour les algorithmes.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="5" width="14" height="14" rx="2" />
        <path d="M16 9l5-3v12l-5-3V9z" />
      </svg>
    ),
    color: "#6366F1",
    bg: "rgba(99,102,241,0.10)",
    border: "rgba(99,102,241,0.22)",
    title: "Duplication Vidéos",
    desc: "Ré-encode chaque copie avec des paramètres uniques (FPS, GOP, bitrate). Indétectable sur Instagram, TikTok, YouTube.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    color: "#10B981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.22)",
    title: "Comparateur",
    desc: "Score de similarité en temps réel — valide que tes copies sont bien uniques avant de publier.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.22)",
    title: "Détection IA",
    desc: "Remplace les métadonnées IA par une identité humaine réaliste. Aucune modification visuelle.",
  },
];

const STEPS = [
  { num: "01", title: "Importe ton fichier", desc: "Glisse-dépose n'importe quelle image ou vidéo." },
  { num: "02", title: "Choisis le nombre de copies", desc: "De 1 à l'infini — aucune limite technique." },
  { num: "03", title: "Lance la duplication", desc: "DuupFlow génère chaque copie en quelques secondes." },
  { num: "04", title: "Télécharge et publie", desc: "Export ZIP en un clic. Prêt à diffuser sur toutes les plateformes." },
];

export default function DemoPage() {
  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)" }}
    >
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/[0.07]">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          <span style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-white/55">Flow</span>
        </Link>
        <Link
          href="/register"
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          Commencer maintenant →
        </Link>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-1.5 text-sm text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Démo DuupFlow — Découvre comment ça marche
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4 leading-[1.08]">
            Vois DuupFlow en <span className={G}>action</span>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            En 2 minutes, comprends comment dupliquer ton contenu en illimité sans jamais être détecté par les algorithmes.
          </p>
        </div>

        {/* Demo Videos Grid */}
        <div className="mb-20 space-y-5">

          {/* Row 1 — Vidéos + Images côte à côte */}
          <div className="grid md:grid-cols-2 gap-0 rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.20)", boxShadow: "0 0 60px rgba(99,102,241,0.08), 0 24px 60px rgba(0,0,0,0.4)" }}>

            {/* Panel gauche — Duplication Vidéos */}
            <div className="flex flex-col" style={{ background: "rgba(8,12,35,0.85)" }}>
              {/* Top bar */}
              <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-white/[0.06]">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.30)" }}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="5" width="14" height="14" rx="2" />
                    <path d="M16 9l5-3v12l-5-3V9z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white">Duplication Vidéos</span>
              </div>

              {/* Video placeholder */}
              <div className="relative mx-5 my-4 rounded-2xl overflow-hidden flex items-center justify-center" style={{ aspectRatio: "16/9", background: "rgba(4,8,25,0.70)", border: "1px dashed rgba(99,102,241,0.25)" }}>
                <video
                  src="/videos/demo-videos.mp4"
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                  autoPlay
                  muted
                  loop
                  playsInline
                  onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
                />
                <div className="relative flex flex-col items-center gap-3 text-center px-4">
                  <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.28)" }}>
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-indigo-400 ml-0.5" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <p className="text-white/35 text-xs">Vidéo à insérer</p>
                </div>
              </div>

              {/* Bottom text */}
              <div className="px-6 pb-6 space-y-2">
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-xs text-white/50">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-indigo-400/70 shrink-0" />
                    <span><span className="text-white/70 font-medium">Duplication simple</span> — métadonnées uniques, ré-encodage de base pour chaque copie.</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-white/50">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-indigo-400/70 shrink-0" />
                    <span><span className="text-white/70 font-medium">Duplication avancée</span> — variation FPS, GOP, bitrate et micro-décalage temporel pour une empreinte totalement différente.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Séparateur vertical */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px pointer-events-none" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Panel droit — Duplication Images */}
            <div className="flex flex-col border-t md:border-t-0 md:border-l border-white/[0.06]" style={{ background: "rgba(8,12,35,0.85)" }}>
              {/* Top bar */}
              <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-white/[0.06]">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(192,38,211,0.12)", border: "1px solid rgba(192,38,211,0.28)" }}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#C026D3" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white">Duplication Images</span>
              </div>

              {/* Video placeholder */}
              <div className="relative mx-5 my-4 rounded-2xl overflow-hidden flex items-center justify-center" style={{ aspectRatio: "16/9", background: "rgba(4,8,25,0.70)", border: "1px dashed rgba(192,38,211,0.22)" }}>
                <video
                  src="/videos/demo-images.mp4"
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                  autoPlay
                  muted
                  loop
                  playsInline
                  onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
                />
                <div className="relative flex flex-col items-center gap-3 text-center px-4">
                  <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: "rgba(192,38,211,0.10)", border: "1px solid rgba(192,38,211,0.25)" }}>
                    <svg viewBox="0 0 24 24" className="h-6 w-6 ml-0.5" fill="none" stroke="#C026D3" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <p className="text-white/35 text-xs">Vidéo à insérer</p>
                </div>
              </div>

              {/* Bottom text */}
              <div className="px-6 pb-6 space-y-2">
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-xs text-white/50">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-fuchsia-400/70 shrink-0" />
                    <span><span className="text-white/70 font-medium">Métadonnées EXIF/XMP</span> — chaque copie reçoit des métadonnées uniques invisibles à l&apos;œil nu.</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-white/50">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-fuchsia-400/70 shrink-0" />
                    <span><span className="text-white/70 font-medium">Micro-variations visuelles</span> — légères retouches imperceptibles qui suffisent à tromper les détecteurs.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Row 2 — Comparateur, centré */}
          <div className="md:w-1/2 mx-auto rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(16,185,129,0.20)", boxShadow: "0 0 50px rgba(16,185,129,0.06), 0 16px 40px rgba(0,0,0,0.4)", background: "rgba(8,12,35,0.85)" }}>
            {/* Top bar */}
            <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-white/[0.06]">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)" }}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">Comparateur de similitude</span>
            </div>

            {/* Video placeholder */}
            <div className="relative mx-5 my-4 rounded-2xl overflow-hidden flex items-center justify-center" style={{ aspectRatio: "16/9", background: "rgba(4,8,25,0.70)", border: "1px dashed rgba(16,185,129,0.20)" }}>
              <video
                src="/videos/demo-comparateur.mp4"
                className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                autoPlay
                muted
                loop
                playsInline
                onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
              />
              <div className="relative flex flex-col items-center gap-3 text-center px-4">
                <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </div>
                <p className="text-white/35 text-xs">Vidéo à insérer</p>
              </div>
            </div>

            {/* Bottom text */}
            <div className="px-6 pb-6">
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-xs text-white/50">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400/70 shrink-0" />
                  <span><span className="text-white/70 font-medium">Score de similarité en temps réel</span> — compare deux fichiers et affiche un pourcentage de ressemblance détecté par les algorithmes.</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-white/50">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400/70 shrink-0" />
                  <span><span className="text-white/70 font-medium">Validation avant publication</span> — assure-toi que tes copies passent sous le seuil de détection avant de les diffuser.</span>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* How it works */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">Comment ça marche</p>
            <h2 className="text-3xl font-semibold text-white tracking-tight">
              Simple comme <span className={G}>1, 2, 3, 4</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s) => (
              <div
                key={s.num}
                className="rounded-2xl p-5"
                style={{
                  background: "rgba(10,14,40,0.60)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span
                  className="text-3xl font-bold block mb-3"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                >
                  {s.num}
                </span>
                <h3 className="text-sm font-semibold text-white mb-1.5">{s.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Modules */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">Les modules</p>
            <h2 className="text-3xl font-semibold text-white tracking-tight">
              4 modules, <span className={G}>un seul objectif</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-5 flex gap-4 items-start"
                style={{
                  background: "rgba(10,14,40,0.60)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: f.bg, border: `1px solid ${f.border}`, color: f.color }}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div
          className="rounded-2xl p-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center mb-20"
          style={{ background: "rgba(10,14,40,0.60)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {[
            { val: "∞", label: "Copies illimitées" },
            { val: "< 3s", label: "Par duplication" },
            { val: "10+", label: "Formats supportés" },
            { val: "500+", label: "Agences utilisatrices" },
          ].map((s) => (
            <div key={s.label}>
              <div className={`text-3xl font-bold mb-1 ${G}`}>{s.val}</div>
              <div className="text-xs text-white/40 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          className="relative rounded-3xl overflow-hidden p-12 text-center"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(56,189,248,0.08) 100%)" }}
        >
          <div className="pointer-events-none absolute inset-0 border border-white/[0.10] rounded-3xl" />
          <div className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <h2 className="text-3xl font-semibold text-white mb-3 tracking-tight relative">
            Prêt à commencer ?
          </h2>
          <p className="text-white/60 mb-8 max-w-sm mx-auto relative text-sm">
            Accède à tous les modules DuupFlow et commence à dupliquer en illimité.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              Commencer maintenant →
            </Link>
            <Link
              href="/tarifs"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-8 py-3.5 font-medium text-sm text-white/80 hover:bg-white/[0.08] transition"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-8 border-t border-white/[0.06] text-center">
        <p className="text-xs text-white/25">© 2025 DuupFlow — Tous droits réservés.</p>
      </footer>
    </div>
  );
}
