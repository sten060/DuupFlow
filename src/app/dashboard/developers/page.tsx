import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveEffectivePlan } from "@/lib/api-auth";
import { listApiKeys } from "@/lib/api-keys";
import DevelopersClient from "./DevelopersClient";
import ComingSoon from "./ComingSoon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The API is built + tested but not opened to users yet:
//   • regular users        → "coming soon" wall
//   • admin (ADMIN_USER_ID) → the real screen (manage keys, test, docs)
// To launch for everyone, just always render <DevelopersClient/>.
export default async function DevelopersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = !!process.env.ADMIN_USER_ID && user.id === process.env.ADMIN_USER_ID;

  let content: React.ReactNode;
  if (isAdmin) {
    const plan = await resolveEffectivePlan(user.id);
    const isPro = plan === "pro";
    const keys = isPro ? await listApiKeys(user.id) : [];
    content = <DevelopersClient isPro={isPro} initialKeys={keys} />;
  } else {
    content = <ComingSoon />;
  }

  return (
    <main className="relative p-6 space-y-8">
      <div
        className="fixed top-0 left-56 right-0 h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(800px 400px at 50% -100px, rgba(99,102,241,.10), transparent 70%)" }}
      />
      {content}
    </main>
  );
}
