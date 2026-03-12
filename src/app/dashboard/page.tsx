// /src/app/dashboard/page.tsx
import Link from "next/link";

const modules = [
  {
    title: "Duplication Images",
    desc: "Variations fondamentales & visuelles, export en lot.",
    href: "/dashboard/images",
  },
  {
    title: "Duplication Vidéos",
    desc: "Ré-encodage léger, FPS/GOP/bitrate, variations vidéo.",
    href: "/dashboard/videos",
  },
  {
    title: "Détecteur de similarité",
    desc: "Mesure la proximité visuelle + métadonnées.",
    href: "/dashboard/similarity",
  },
  {
    title: "Variation IA",
    desc: "Crée des variations automatiques grâce à l'intelligence artificielle.",
    href: "/dashboard/generate",
    badge: "BETA",
  },
  {
    title: "Détection IA — Métadonnées",
    desc: "Masque la signature IA dans les métadonnées de n'importe quel contenu.",
    href: "/dashboard/ai-detection",
  },
];

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-5xl md:text-6xl font-bold mb-3 tracking-tight"
          style={{ background: "linear-gradient(90deg,#818CF8,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          DuupFlow
        </h1>
        <p className="text-white/45 text-sm">Choisis un module pour travailler tes contenus.</p>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => (
          <div
            key={m.href}
            className="group rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Top row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: "#38BDF8", boxShadow: "0 0 6px rgba(56,189,248,0.8)" }}
                />
                <span className="text-[11px] font-semibold text-white tracking-wide uppercase">
                  Module actif
                </span>
              </div>
              {m.badge && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(56,189,248,0.12)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.25)" }}
                >
                  {m.badge}
                </span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1">
              <h2 className="text-base font-semibold text-white mb-1">{m.title}</h2>
              <p className="text-sm text-white/50 leading-snug">{m.desc}</p>
            </div>

            {/* CTA */}
            <Link
              href={m.href}
              className="inline-flex items-center gap-1.5 self-start rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white transition-all"
              style={{
                background: "rgba(56,189,248,0.15)",
                border: "1px solid rgba(56,189,248,0.30)",
                boxShadow: "0 0 10px rgba(56,189,248,0.12)",
              }}
            >
              Ouvrir
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
