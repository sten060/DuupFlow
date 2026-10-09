import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspacesClient from "./WorkspacesClient";
import { getServerT } from "@/lib/i18n/server";
import { workspacesPayload } from "@/lib/workspaces";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// Gestion des créateurs (workspaces) — Pro & Agence. Toutes les données passent
// par /api/workspaces (même source que le sélecteur de la sidebar) : la page
// et le sélecteur restent synchrones sans double logique d'accès.
export default async function WorkspacesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Données préparées ici, pendant le rendu serveur : la page arrive remplie,
  // sans second aller-retour après l'affichage.
  const t = await getServerT();
  const initial = await workspacesPayload(user.id, t("dashboard.workspaces.defaultName"), cookies().get("duup_ws")?.value ?? null);

  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8 2xl:px-12">
      <WorkspacesClient initial={initial} />
    </main>
  );
}
