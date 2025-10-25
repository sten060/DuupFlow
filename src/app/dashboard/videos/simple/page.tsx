// src/app/(dashboard)/videos/simple/page.tsx
import Link from "next/link";
import { listOutVideosSimple, clearVideosSimple, duplicateVideos } from "../actions";
import VideoFormClient from "./VideoFormSimpleClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VideosSimplePage({
  searchParams,
}: {
  searchParams?: { ok?: string; err?: string };
}) {
  const files = await listOutVideosSimple();

  return (
    <main className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Duplication Vidéos — Simple</h1>
        <Link href="/dashboard/videos" className="text-sm underline">Retour</Link>
      </div>

      {/* Formulaire SIMPLE */}
      <VideoFormClient />

      <div className="flex items-center gap-3">
        <form action={clearVideosSimple} method="post">
          <button className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">Vider les vidéos (simple)</button>
        </form>
        <a href="/api/out/zip?scope=videos&channel=simple" className="btn">Télécharger</a>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="font-semibold mb-2">Vidéos générées (simple)</h2>
        {files.length === 0 ? (
          <p className="text-white/60 text-sm">Aucune vidéo pour l’instant.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1">
            {files.map((u) => {
              const n = decodeURIComponent(u.split("/").pop()!);
              return (
                <li key={u}>
                  <a className="underline" href={u}>{n}</a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}