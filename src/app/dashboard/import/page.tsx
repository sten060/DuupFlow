// /dashboard/import — Importateur de compte : le user colle le lien de SON
// compte (IG/TikTok), on scrape ses meilleures vidéos, il coche celles à
// télécharger (voie 2). Page shell serveur ; toute la logique est dans le client.

import ImportClient from "./ImportClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ImportPage() {
  return (
    <main className="relative p-6 space-y-8">
      {/* Fond violet flouté — accent propre au module Import */}
      <div
        className="fixed top-0 left-56 right-0 h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(139,92,246,.12), transparent 70%)" }}
      />
      <ImportClient />
    </main>
  );
}
