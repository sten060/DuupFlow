import SimilarityClient from "./SimilarityClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SimilarityPage() {
  return (
    <main className="relative p-6 md:p-10 space-y-8">
      <div className="fixed top-0 left-56 right-0 h-[500px] pointer-events-none"
           style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(16,185,129,.10), transparent 70%)" }} />
      <SimilarityClient />
    </main>
  );
}
