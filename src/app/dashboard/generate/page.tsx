import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionRSC } from "@/lib/supabase/server-rsc"; // si tu as ce helper
import GenerateFormClient from "./GenerateFormClient";
import { generateAction } from "./actions";

export const metadata: Metadata = {
  title: "Génération IA — ContentDuplicator",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GeneratePage() {
  const session = await getSessionRSC?.();
  if (!session) redirect("/login");

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="h1">Générer des variantes (décor/tenue/accessoires)</h1>
        <p className="muted">
          Importez la photo de votre modèle, précisez le décor / tenue / accessoires,
          choisissez le nombre d’images, puis cliquez sur <em>Générer</em>.
        </p>
      </header>

      {/* on passe l’action serveur au composant client */}
      <GenerateFormClient />
    </main>
  );
}