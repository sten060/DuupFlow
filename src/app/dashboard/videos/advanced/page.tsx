// src/app/(dashboard)/videos/advanced/page.tsx
import Link from "next/link";
import path from "path";
import { listOutVideosAdvanced, clearVideosAdvanced, duplicateVideos } from "../actions";
import Toasts from "../../Toasts";
import VideoFormAdvancedClient from "./VideoFormAdvancedClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VideosAdvancedPage({
  searchParams,
}: { searchParams?: { ok?: string; err?: string } }) {
  const files = await listOutVideosAdvanced();  // ← scoped
  const ok = Boolean(searchParams?.ok);
  const err = searchParams?.err ? decodeURIComponent(searchParams.err) : undefined;

  return (
    <main className="p-6 space-y-8">
      <Toasts ok={ok} err={err} />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Duplication Vidéos — Avancé</h1>
        <Link href="/dashboard/videos" className="text-sm underline">← Retour</Link>
      </div>

      <section className="rounded-2xl border border-white/10 p-6 shadow-[0_0_60px_rgba(90,170,255,.25)]
                          bg-[radial-gradient(1200px_600px_at_10%_-10%,_rgba(90,170,255,.18),_transparent_60%),_linear-gradient(135deg,_rgba(10,25,60,.85),_rgba(20,45,100,.55))]">
        <VideoFormAdvancedClient />
        <form action={clearVideosAdvanced} className="mt-6" method="post">
          <button
            type="submit"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Vider les vidéos (avancé)
          </button>
        </form>
      </section>

      <a href="/api/out/zip?scope=videos&channel=advanced" className="btn">Télécharger</a>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold mb-3">Vidéos générées (avancé)</h2>
        {files.length === 0 ? (
          <p className="text-sm text-white/50">Aucune vidéo pour l’instant.</p>
        ) : (
          <ul className="list-disc pl-6 space-y-1">
            {files.map((n) => (
              <li key={n}>
                <Link href={n} className="underline" prefetch={false}>
                  {decodeURIComponent(path.basename(n).split("?")[0])}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}