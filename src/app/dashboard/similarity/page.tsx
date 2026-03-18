// src/app/dashboard/similarity/page.tsx
import SimilarityClient from "./SimilarityClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { score?: string; err?: string };

export default async function SimilarityPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const score = params?.score ? Number(params.score) : undefined;
  const err = params?.err ? decodeURIComponent(params.err) : undefined;

  return (
    <main className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Détecteur de contenu similaire</h1>

      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/40 to-emerald-900/10 p-6 shadow-2xl shadow-emerald-950/20">
        <p className="mb-4 text-sm text-white/70">
          Comparez deux images (ou deux vidéos). Le score indique à quel point les contenus se ressemblent.
        </p>
        <SimilarityClient initialScore={score} initialErr={err} />
      </section>
    </main>
  );
}
