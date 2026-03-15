// src/app/(dashboard)/videos/simple/page.tsx
import Link from "next/link";
import { listOutVideosSimple } from "../actions";
import VideoFormClient from "./VideoFormSimpleClient";
import VideoFilesClient from "../VideoFilesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VideosSimplePage() {
  const files = await listOutVideosSimple();

  return (
    <main className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Duplication Vidéos — Simple</h1>
        <Link href="/dashboard/videos" className="text-sm underline">Retour</Link>
      </div>

      <VideoFormClient />

      <VideoFilesClient initialFiles={files} channel="simple" />
    </main>
  );
}