// src/app/dashboard/similarity/page.tsx
import Link from "next/link";
import { compareSimilarity } from "./actions";

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
    <main className="p-6 space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Détecteur de contenu similaire</h1>

      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/40 to-emerald-900/10 p-6 shadow-2xl shadow-emerald-950/20">
        <p className="mb-4 text-sm text-white/70">
          Comparez deux images (ou deux vidéos). Le score indique à quel point les contenus se ressemblent.
        </p>

        {/* FORM */}
        <form action={compareSimilarity} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-white/15 bg-white/5 p-4">
            <label className="block text-sm font-medium mb-2 text-white/85">Fichier A</label>
            <input
              type="file"
              name="fileA"
              className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90"
              required
            />
          </div>

          <div className="rounded-xl border border-white/15 bg-white/5 p-4">
            <label className="block text-sm font-medium mb-2 text-white/85">Fichier B</label>
            <input
              type="file"
              name="fileB"
              className="block w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white/90"
              required
            />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between">
            <div>
              {typeof score === "number" && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm">
                  <span className="font-semibold text-emerald-300">Similarité : </span>
                  <span className="font-bold text-emerald-200">{score}%</span>
                </div>
              )}
              {err && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {err}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 transition"
            >
              Comparer
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}