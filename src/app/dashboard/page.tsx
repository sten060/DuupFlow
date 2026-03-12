// /src/app/dashboard/page.tsx
import Link from "next/link";

export default function DashboardPage() {
  const modules = [
    {
      title: "Duplication Images",
      desc: "Variations fondamentales & visuelles, export en lot.",
      color: "from-pink-500 to-fuchsia-500",
      href: "/dashboard/images",
    },
    {
      title: "Duplication Vidéos",
      desc: "Ré-encodage léger, FPS/GOP/bitrate, variations vidéo.",
      color: "from-indigo-500 to-blue-500",
      href: "/dashboard/videos",
    },
    {
      title: "Détecteur de similarité",
      desc: "Mesure la proximité visuelle + métadonnées.",
      color: "from-green-500 to-emerald-500",
      href: "/dashboard/similarity",
    },
    {
      title: "Variation IA (BETA)",
      desc: "Crée des variations automatiques grâce à l’intelligence artificielle.",
      color: "from-fuchsia-500 to-indigo-500",
      href: "/dashboard/generate",
    },
    {
      title: "Détection IA — Métadonnées",
      desc: "Masque ou injecte une signature IA dans les métadonnées de n’importe quel contenu.",
      color: "from-amber-500 to-orange-500",
      href: "/dashboard/ai-detection",
    },
  ];

  return (
    <div className="pt-4">
      {/* En-tête */}
      <div className="mb-10">
        <h1 className="text-5xl md:text-6xl font-bold mb-3 tracking-tight bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-pink-400 text-transparent bg-clip-text">
          DuupFlow
        </h1>
        <p className="text-white/50 text-sm">
          Choisis un module pour travailler tes contenus.
        </p>
      </div>

      {/* Grille de modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {modules.map((m) => (
          <div
            key={m.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md hover:bg-white/[0.05] transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] text-emerald-400 font-medium">
                Module actif
              </span>
              <div
                className={`h-2 w-2 rounded-full bg-gradient-to-r ${m.color} shadow-[0_0_10px_currentColor]`}
              />
            </div>
            <h2 className="text-lg font-semibold mb-1">{m.title}</h2>
            <p className="text-sm text-white/60 mb-6">{m.desc}</p>
            <Link
              href={m.href}
              className={`px-4 py-2 text-sm font-medium rounded-md text-white bg-gradient-to-r ${m.color} hover:opacity-90 transition`}
            >
              Ouvrir
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}