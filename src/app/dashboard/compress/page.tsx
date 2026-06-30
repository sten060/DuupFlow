import Toasts from "../Toasts";
import CompressClient from "./CompressClient";
import { listCompressed } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompressPage({ searchParams }: { searchParams?: { ok?: string; err?: string } }) {
  const initialFiles = await listCompressed();
  const ok = Boolean(searchParams?.ok);
  const err = searchParams?.err ? decodeURIComponent(searchParams.err) : undefined;

  return (
    <main className="relative p-6 space-y-8">
      {/* Fond émeraude flouté — accent distinct du module Images (rose) */}
      <div
        className="fixed top-0 left-56 right-0 h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(16,185,129,.10), transparent 70%)" }}
      />
      <Toasts ok={ok} err={err} />

      <CompressClient initialFiles={initialFiles} />
    </main>
  );
}
