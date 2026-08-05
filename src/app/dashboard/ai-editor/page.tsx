import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveEffectivePlan } from "@/lib/api-auth";
import AiEditorClient from "./AiEditorClient";
import AiEditorProGate from "./AiEditorProGate";
import AiEditorComingSoon from "./AiEditorComingSoon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Éditeur IA. Tant que la feature n'est pas ouverte au public, on affiche un écran
// « bientôt disponible » pour TOUT LE MONDE. Pour prévisualiser (toi, en local ou sur
// Railway), pose AI_EDITOR_LIVE=1 → le gate Pro reprend la main (non-Pro = upgrade,
// Pro = éditeur). Le connecteur MCP reste Pro-only côté serveur.
export default async function AiEditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (process.env.AI_EDITOR_LIVE !== "1") return <AiEditorComingSoon />;

  const plan = await resolveEffectivePlan(user.id);
  if (plan !== "pro") return <AiEditorProGate />;

  return <AiEditorClient />;
}
