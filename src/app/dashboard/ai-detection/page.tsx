/**
 * Server entry — AI Detection module.
 *
 * Ouvert à tous les plans : le plan gratuit explore le module (dépôt des
 * fichiers, options), mais le traitement lui répond qu'il faut un plan
 * (maskAiMetadata + bouton gardé côté client — src/lib/free-plan.ts).
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AiDetectionClient from "./AiDetectionClient";

export const dynamic = "force-dynamic";

export default async function AiDetectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <AiDetectionClient />;
}
