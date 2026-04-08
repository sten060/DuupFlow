// src/app/(dashboard)/videos/advanced/page.tsx
import { listOutVideosAdvanced } from "../actions";
import VideoFormAdvancedClient from "./VideoFormAdvancedClient";
import VideoFilesClient from "../VideoFilesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VideosAdvancedPage() {
  const files = await listOutVideosAdvanced();

  return (
    <main className="relative p-6 space-y-8">
      {/* Fond bleu clair flouté */}
      <div className="fixed top-0 left-56 right-0 h-[500px] pointer-events-none"
           style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(56,189,248,.10), transparent 70%)" }} />
      <VideoFormAdvancedClient />

      <VideoFilesClient initialFiles={files} channel="advanced" />
    </main>
  );
}
