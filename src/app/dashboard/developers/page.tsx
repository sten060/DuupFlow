import ComingSoon from "./ComingSoon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The API is fully built + tested but not opened yet — EVERYONE (admins
// included) sees the "coming soon" wall. To launch, swap <ComingSoon /> for the
// gated <DevelopersClient /> (kept in this folder). The API endpoints keep
// working for anyone who already holds a key.
export default function DevelopersPage() {
  return (
    <main className="relative p-6 space-y-8">
      <div
        className="fixed top-0 left-56 right-0 h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(99,102,241,.10), transparent 70%)" }}
      />
      <ComingSoon />
    </main>
  );
}
