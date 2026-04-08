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
    <main className="relative p-6 space-y-8">
      {/* Fond rose flouté */}
      <div className="fixed top-0 left-56 right-0 h-[500px] pointer-events-none"
           style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(192,38,211,.10), transparent 70%)" }} />
      <Toasts ok={ok} err={err} />

      <ImageFormClient initialImages={initialImages} />
    </main>
  );
}
