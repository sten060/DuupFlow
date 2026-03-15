// src/app/(dashboard)/videos/advanced/page.tsx
import Link from "next/link";
import { listOutVideosAdvanced } from "../actions";
import VideoFormAdvancedClient from "./VideoFormAdvancedClient";
import VideoFilesClient from "../VideoFilesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VideosAdvancedPage() {
  const files = await listOutVideosAdvanced();

  return (
    <main className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Duplication Vidéos — Avancé</h1>
        <Link href="/dashboard/videos" className="text-sm underline">← Retour</Link>
      </div>

      <section className="rounded-2xl border border-white/10 p-6 shadow-[0_0_60px_rgba(90,170,255,.25)]
                          bg-[radial-gradient(1200px_600px_at_10%_-10%,_rgba(90,170,255,.18),_transparent_60%),_linear-gradient(135deg,_rgba(10,25,60,.85),_rgba(20,45,100,.55))]">
        <VideoFormAdvancedClient />
      </section>

      <VideoFilesClient initialFiles={files} channel="advanced" />
    </main>
  );
}