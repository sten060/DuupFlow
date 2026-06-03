import "@/app/globals.css";
import Sidebar from "./sidebar";
import GlobalVideoProgress from "./videos/GlobalVideoProgress";
import ChatBot from "./components/ChatBot";
import DashboardLangSwitch from "./components/DashboardLangSwitch";
import PaymentOverdueModal from "./PaymentOverdueModal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncStripeStateIfStale } from "@/lib/billing-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Fetch overdue status so we can mount the blocking modal globally —
  // it stays visible on every dashboard page until Stripe confirms payment.
  let overdue: { since: string | null; pausedPlan: string | null } | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Self-heal: blocking call (kept fast by 6h cache in syncStripeStateIfStale)
      // so the modal shows on this very page-load if the user is overdue but
      // the webhook never fired (e.g. they were past_due before deploy).
      await syncStripeStateIfStale(user.id);

      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("payment_overdue, payment_overdue_since, paused_plan")
        .eq("id", user.id)
        .single();
      if (profile?.payment_overdue) {
        overdue = {
          since: (profile.payment_overdue_since as string | null) ?? null,
          pausedPlan: (profile.paused_plan as string | null) ?? null,
        };
      }
    }
  } catch {
    // Silently ignore — the modal just won't show. Never block the layout.
  }

  return (
    <div
      className="flex h-screen overflow-hidden text-white"
      style={{ background: "#050816" }}
    >
      {/* Sidebar */}
      <div
        className="w-56 shrink-0 flex flex-col overflow-y-auto relative z-10"
        style={{
          background: "rgba(8,12,30,0.95)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Brand + Lang */}
        <div className="px-5 pt-6 pb-5 shrink-0 flex items-center justify-between">
          <div>
            <span className="text-lg font-extrabold tracking-tight" style={{ color: "#818CF8" }}>Duup</span>
            <span className="text-lg font-extrabold tracking-tight text-white/45">Flow</span>
          </div>
          <DashboardLangSwitch />
        </div>
        <div
          className="mx-4 mb-3 shrink-0"
          style={{ height: "1px", background: "rgba(255,255,255,0.07)" }}
        />
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto relative">
        {children}
      </div>

      {/* Persistent job progress overlay — survives page navigation */}
      <GlobalVideoProgress />
      <ChatBot />

      {/* Blocking modal shown while payment_overdue=true. Re-mounts on every
          page navigation so the user can't ignore it for long. */}
      {overdue && (
        <PaymentOverdueModal
          since={overdue.since}
          pausedPlan={overdue.pausedPlan}
        />
      )}
    </div>
  );
}
