import SimilarityClient from "./SimilarityClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SimilarityPage() {
  return (
    <main className="relative p-6 md:p-10 space-y-8">
      <div className="fixed top-0 left-56 right-0 h-[500px] pointer-events-none"
           style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(16,185,129,.10), transparent 70%)" }} />
      <h1 className="text-3xl font-extrabold tracking-tight">Comparateur de métadonnées</h1>
      <p className="text-sm text-white/50">Upload deux fichiers pour comparer leurs métadonnées (ffprobe). Les différences sont surlignées en vert.</p>
      <div className="h-px bg-white/[0.06]" />
      <SimilarityClient />
    </main>
  );
}
