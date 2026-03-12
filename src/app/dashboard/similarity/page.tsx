// src/app/dashboard/similarity/page.tsx
import { compareSimilarity } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { score?: string; err?: string; details?: string };

type BreakdownItem = { label: string; value: number; weight: number };
type ComparisonDetails = {
  fileA: { name: string; size: number; kind: string; meta: Record<string, any> };
  fileB: { name: string; size: number; kind: string; meta: Record<string, any> };
  breakdown: BreakdownItem[];
  score: number;
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(2)} Mo`;
}

function scoreColor(v: number): string {
  if (v >= 80) return "text-red-300";
  if (v >= 55) return "text-yellow-300";
  return "text-emerald-300";
}

function MetaTable({ meta }: { meta: Record<string, any> }) {
  const entries = Object.entries(meta).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!entries.length) return <p className="text-white/35 text-xs italic">Aucune métadonnée</p>;
  return (
    <table className="w-full text-xs">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-white/5 last:border-0">
            <td className="py-1 pr-2 text-white/45 font-medium capitalize">{k.replace(/_/g, " ")}</td>
            <td className="py-1 text-white/80 break-all">{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function SimilarityPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const score = params?.score ? Number(params.score) : undefined;
  const err = params?.err ? decodeURIComponent(params.err) : undefined;

  let details: ComparisonDetails | null = null;
  if (params?.details) {
    try {
      details = JSON.parse(Buffer.from(params.details, "base64url").toString());
    } catch {}
  }

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
                  <span className={`font-bold text-2xl ${scoreColor(score)}`}>{score}%</span>
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

      {/* DESCRIPTIVE CARD */}
      {details && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
          <h2 className="text-lg font-bold tracking-tight text-white/90">Rapport de comparaison</h2>

          {/* Two-column file info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([["A", details.fileA], ["B", details.fileB]] as const).map(([letter, file]) => (
              <div
                key={letter}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">Fichier {letter}</p>
                <p className="text-sm font-semibold text-white truncate" title={file.name}>{file.name}</p>
                <div className="flex gap-4 text-xs text-white/55">
                  <span>{fmtBytes(file.size)}</span>
                  <span className="capitalize">{file.kind}</span>
                </div>
                <MetaTable meta={file.meta} />
              </div>
            ))}
          </div>

          {/* Score breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-white/70 mb-3">Détail du score</h3>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.04] text-white/50 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-2">Critère</th>
                    <th className="text-right px-4 py-2">Score</th>
                    <th className="text-right px-4 py-2">Poids</th>
                    <th className="text-right px-4 py-2">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {details.breakdown.map((item, i) => {
                    const contribution = item.value * item.weight;
                    return (
                      <tr key={i} className="border-t border-white/[0.06]">
                        <td className="px-4 py-2.5 text-white/80">{item.label}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${scoreColor(item.value)}`}>
                          {item.value}%
                        </td>
                        <td className="px-4 py-2.5 text-right text-white/45">
                          {Math.round(item.weight * 100)}%
                        </td>
                        <td className="px-4 py-2.5 text-right text-white/60">
                          {contribution.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-white/20 bg-white/[0.03]">
                    <td className="px-4 py-2.5 font-bold text-white/90" colSpan={3}>Score total</td>
                    <td className={`px-4 py-2.5 text-right font-bold text-xl ${scoreColor(details.score)}`}>
                      {details.score}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
