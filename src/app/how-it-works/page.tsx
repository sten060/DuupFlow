"use client";

import Link from "next/link";

const STEPS = [
  {
    num: "01",
    title: "Importe ton contenu",
    desc: "Glisse-dépose ton image ou ta vidéo dans DuupFlow. JPG, PNG, WEBP, MP4, MOV, MKV — tous les formats sont acceptés, même en lot.",
  },
  {
    num: "02",
    title: "Duplique en illimité",
    desc: "Choisis le nombre de copies et les options (visuel, semi-visuel, métadonnées). DuupFlow modifie chaque fichier pour qu'il soit unique aux yeux des algorithmes de détection.",
  },
  {
    num: "03",
    title: "Télécharge et publie",
    desc: "Exporte tes contenus en ZIP ou un par un. Chaque fichier est prêt à être publié sur Instagram, TikTok, YouTube, Twitter/X ou n'importe quelle plateforme.",
  },
];

export default function CommentCaMarche() {
  return (
    <div className="min-h-screen px-6 py-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">
          Comment ça marche
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-5 tracking-tight">
          DuupFlow s&apos;intègre dans ton workflow{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
            en 3 étapes.
          </span>
        </h1>
        <p className="text-white/45 text-lg mb-20 max-w-xl">
          Simple, rapide, sans courbe d&apos;apprentissage. Tu es opérationnel en moins de 2 minutes.
        </p>

        {/* Steps */}
        <div className="relative">
          <div className="hidden md:block absolute top-[22px] left-[22px] right-[22px] h-px bg-white/[0.08]" />
          <div className="grid md:grid-cols-3 gap-12">
            {STEPS.map((s) => (
              <div key={s.num} className="relative">
                <div
                  className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold text-white mb-6 relative z-10"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  {s.num}
                </div>
                <h3 className="font-semibold text-white text-lg mb-3">{s.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Detail cards */}
        <div className="mt-24 grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-6">
            <div className="text-2xl mb-4">🖼️</div>
            <h3 className="font-semibold text-white mb-2">Formats supportés</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Images : JPG, PNG, WEBP, HEIC<br />
              Vidéos : MP4, MOV, MKV, AVI, WebM
            </p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-6">
            <div className="text-2xl mb-4">⚡</div>
            <h3 className="font-semibold text-white mb-2">Traitement rapide</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Génère des dizaines de copies en quelques secondes. Traitement local pour les images, cloud pour les vidéos.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
            <div className="text-2xl mb-4">📦</div>
            <h3 className="font-semibold text-white mb-2">Export flexible</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Télécharge fichier par fichier ou tout d&apos;un coup en ZIP. Compatible avec tous les outils de scheduling.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            Essayer DuupFlow gratuitement →
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 font-semibold text-white/70 hover:text-white text-sm transition border border-white/15 hover:border-white/30 hover:bg-white/[0.04]"
          >
            Voir la démo
          </Link>
        </div>
      </div>
    </div>
  );
}
