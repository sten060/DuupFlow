// src/app/dashboard/images/page.tsx
import Link from "next/link";
import path from "path";
import { listOutImages, clearOut } from "../actions";
import Toasts from "../Toasts";
import ImageFormClient from "./ImageFormClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ImagesPage({
  searchParams,
}: { searchParams?: { ok?: string; err?: string } }) {
  const files = await listOutImages();
  const ok = Boolean(searchParams?.ok);
  const err = searchParams?.err ? decodeURIComponent(searchParams.err) : undefined;
  

  return (
    <main className="p-6 space-y-8">
      <Toasts ok={ok} err={err} />

      <h1 className="text-3xl font-extrabold tracking-tight">Duplication Images</h1>

      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-fuchsia-950/30 p-6 shadow-2xl shadow-fuchsia-900/20">
        <ImageFormClient />

        <form action={clearOut} className="mt-4">
  {/* Champ caché */}
  <input type="hidden" name="scope" value="images" />
  
  <button
    type="submit"
    className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
  >
    Vider les images
  </button>
</form>
      </section>

      <a
        href="/api/out/zip?scope=images"
        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
      >
        Télécharger ZIP (images)
      </a>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold mb-3">Images générées</h2>
        {files.length === 0 ? (
          <p className="text-sm text-white/50">Aucune image pour l’instant.</p>
        ) : (
          <ul className="list-disc pl-6 space-y-1">
            {files.map((n) => (
              <li key={n}>
                <Link href={n} className="underline" prefetch={false}>
                  {decodeURIComponent(path.basename(n))}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}