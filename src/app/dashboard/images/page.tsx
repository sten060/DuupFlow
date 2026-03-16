import Toasts from "../Toasts";
import ImageFormClient from "./ImageFormClient";
import { listOutImages } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ImagesPage({ searchParams }: { searchParams?: { ok?: string; err?: string } }) {
  const initialImages = await listOutImages();
  const ok = Boolean(searchParams?.ok);
  const err = searchParams?.err ? decodeURIComponent(searchParams.err) : undefined;

  return (
    <main className="p-6 space-y-8">
      <Toasts ok={ok} err={err} />

      <h1 className="text-3xl font-extrabold tracking-tight">Duplication Images</h1>

      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-fuchsia-950/30 p-6 shadow-2xl shadow-fuchsia-900/20">
        <ImageFormClient initialImages={initialImages} />
      </section>

      <a
        href="/api/out/zip?scope=images"
        className="inline-block px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
      >
        Télécharger ZIP (images)
      </a>
    </main>
  );
}
