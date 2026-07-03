import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveEffectivePlan } from "@/lib/api-auth";
import { listApiKeys } from "@/lib/api-keys";
import DevelopersClient from "./DevelopersClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The API is now open: EVERY authenticated user reaches this page. Pro users get
// the full key-management UI; non-Pro users see the in-page "Pro required" gate
// (rendered by DevelopersClient) with a CTA to upgrade — no keys are loaded for
// them. Access to the API itself is still enforced server-side per request.
export default async function DevelopersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await resolveEffectivePlan(user.id);
  const isPro = plan === "pro";
  // Only Pro users have keys — never fetch/expose them to non-Pro accounts.
  const initialKeys = isPro ? await listApiKeys(user.id) : [];

  return (
    <main className="relative p-6 space-y-8">
      <div
        className="fixed top-0 left-56 right-0 h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(99,102,241,.10), transparent 70%)" }}
      />
      <DevelopersClient isPro={isPro} initialKeys={initialKeys} />
    </main>
  );
}
