/**
 * TikTok guide — public to all authenticated users (no plan gate).
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TikTokGuideClient from "./TikTokGuideClient";

export const dynamic = "force-dynamic";

export default async function TikTokGuidePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <TikTokGuideClient />;
}
