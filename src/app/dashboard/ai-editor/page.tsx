import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AiEditorClient from "./AiEditorClient";
import { WorkspaceKeyed } from "../components/WorkspaceSwitcher";
import AiEditorComingSoon from "./AiEditorComingSoon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Éditeur IA — 3 niveaux d'accès :
//  1. LISTE BLANCHE (AI_EDITOR_ALLOWLIST = emails séparés par virgule) → accès TOTAL au
//     module, même avant le lancement public, quel que soit le plan. C'est le moyen de
//     T'ouvrir l'accès (et à tes testeurs) SANS l'ouvrir aux autres users.
//  2. Feature ouverte au public (AI_EDITOR_LIVE=1) → ouverte à tous. Le plan gratuit
//     explore le module mais ne crée aucune variante (src/lib/free-plan.ts).
//  3. Sinon (défaut) → écran « bientôt disponible » pour tout le monde.
export default async function AiEditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = (user.email || "").trim().toLowerCase();
  const allowlist = (process.env.AI_EDITOR_ALLOWLIST || "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const previewer = !!email && allowlist.includes(email);
  if (previewer) return <WorkspaceKeyed><AiEditorClient /></WorkspaceKeyed>; // accès privé (toi + testeurs), hors gates

  if (process.env.AI_EDITOR_LIVE !== "1") return <AiEditorComingSoon />;

  // Ouvert à tous : les plans payants créent des variantes (bornées par le quota
  // « vidéos » : Starter 100/mois, Solo 300/mois, Pro illimité) ; le plan gratuit
  // explore le module, et chaque création de variante lui répond qu'il faut un
  // plan (routes generate/edit, outils MCP create_variant/update_variant).
  return <WorkspaceKeyed><AiEditorClient /></WorkspaceKeyed>;
}
