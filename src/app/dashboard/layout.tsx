import "@/app/globals.css";
import Sidebar from "./sidebar";
import GlobalVideoProgress from "./videos/GlobalVideoProgress";
import ChatBot from "./components/ChatBot";
import NotificationBell from "./components/NotificationBell";
import PaymentOverdueModal from "./PaymentOverdueModal";
import ClaritySessionTags, {
  type ClarityPlan,
  type ClaritySegment,
} from "./ClaritySessionTags";
import { OnboardingProvider } from "./onboarding/OnboardingProvider";
import AppOverview from "./onboarding/AppOverview";
import ModuleCoach from "./onboarding/ModuleCoach";
import TikTokReminder from "./TikTokReminder";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncStripeStateIfStale } from "@/lib/billing-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Fetch overdue status so we can mount the blocking modal globally —
  // it stays visible on every dashboard page until Stripe confirms payment.
  let overdue: { since: string | null; pausedPlan: string | null } | null = null;

  // Clarity session tags — set only when we have a usable user id + plan.
  // Computed server-side to avoid an extra client round-trip.
  let clarityTags:
    | { userId: string; plan: ClarityPlan; segment: ClaritySegment }
    | null = null;

  // Self-paced onboarding — the overview card (dashboard home) + a short
  // per-module coach on first open. Enabled for non-guest users; gated
  // per-area by profiles.onboarding_progress (mig 033). Mounted in the layout
  // so it persists across navigations.
  let onboarding: { enabled: boolean; progress: Record<string, boolean> } | null = null;

  // TikTok launch reminder — fires once, 12h after the pop-up was seen. Read
  // resiliently below (migration 034 may not be applied yet).
  let tiktok: { seenAt: string | null; reminderSent: boolean } | null = null;

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
        .select(
          "plan, has_paid, payment_overdue, payment_overdue_since, paused_plan, is_guest",
        )
        .eq("id", user.id)
        .single();
      if (profile?.payment_overdue) {
        overdue = {
          since: (profile.payment_overdue_since as string | null) ?? null,
          pausedPlan: (profile.paused_plan as string | null) ?? null,
        };
      }

      // Onboarding state — separate query so a missing column (e.g. before
      // mig 033 is applied) can't break overdue / Clarity above. Default to
      // grandfathered (= nothing shows) on any miss.
      try {
        const { data: onb } = await admin
          .from("profiles")
          .select("onboarding_progress")
          .eq("id", user.id)
          .single();
        onboarding = {
          enabled: profile != null && profile.is_guest !== true,
          progress:
            (onb?.onboarding_progress as Record<string, boolean> | null) ?? {
              grandfathered: true,
            },
        };
      } catch {
        onboarding = null;
      }

      // TikTok 12h reminder state — separate query so a missing column (mig 034
      // not applied) can't break the layout; just yields no reminder.
      try {
        const { data: tk } = await admin
          .from("profiles")
          .select("tiktok_announce_seen_at, tiktok_reminder_sent_at")
          .eq("id", user.id)
          .single();
        if (tk) {
          tiktok = {
            seenAt: (tk as { tiktok_announce_seen_at: string | null }).tiktok_announce_seen_at ?? null,
            reminderSent:
              (tk as { tiktok_reminder_sent_at: string | null }).tiktok_reminder_sent_at != null,
          };
        }
      } catch {
        tiktok = null;
      }

      // Compute Clarity segment.
      // Same definition as analytics views (mig. 025):
      //   payant  = has_paid AND NOT payment_overdue AND plan IN (solo,pro)
      //   active  = at least 1 row in usage_events with source='live'
      //   fantome = none of the above
      const rawPlan = (profile?.plan as string | null) ?? "free";
      const plan: ClarityPlan =
        rawPlan === "solo" || rawPlan === "pro" ? rawPlan : "free";

      const isPaid =
        profile?.has_paid === true &&
        profile?.payment_overdue !== true &&
        (rawPlan === "solo" || rawPlan === "pro");

      let segment: ClaritySegment = "fantome";
      if (isPaid) {
        segment = "payant";
      } else {
        // EXISTS-style check — limit(1) means at most one row scanned thanks
        // to the partial index on usage_events(user_id, created_at) WHERE
        // source='live'. Cheap (<1 ms typical).
        const { data: liveRows } = await admin
          .from("usage_events")
          .select("id")
          .eq("user_id", user.id)
          .eq("source", "live")
          .limit(1);
        segment = (liveRows?.length ?? 0) > 0 ? "active" : "fantome";
      }

      clarityTags = { userId: user.id, plan, segment };
    }
  } catch {
    // Silently ignore — the modal just won't show. Never block the layout.
  }

  return (
    <OnboardingProvider
      enabled={onboarding?.enabled ?? false}
      initialProgress={onboarding?.progress ?? { grandfathered: true }}
    >
    <div
      className="flex h-screen overflow-hidden text-white"
      style={{ background: "#050816" }}
    >
      {/* Sidebar — owns its own collapse state, brand & width animation */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto relative">
        {children}
      </div>

      {/* Persistent job progress overlay — survives page navigation */}
      <GlobalVideoProgress />
      <ChatBot />
      <NotificationBell />
      {tiktok && <TikTokReminder seenAt={tiktok.seenAt} reminderSent={tiktok.reminderSent} />}

      {/* Blocking modal shown while payment_overdue=true. Re-mounts on every
          page navigation so the user can't ignore it for long. */}
      {overdue && (
        <PaymentOverdueModal
          since={overdue.since}
          pausedPlan={overdue.pausedPlan}
        />
      )}

      {/* Microsoft Clarity — tag session with plan/segment/user_id (no PII). */}
      {clarityTags && (
        <ClaritySessionTags
          userId={clarityTags.userId}
          plan={clarityTags.plan}
          segment={clarityTags.segment}
        />
      )}

      {/* Self-paced onboarding — overview card (dashboard home) + per-module
          coach on first open. Mounted here so both persist across navigations. */}
      <AppOverview />
      <ModuleCoach />
    </div>
    </OnboardingProvider>
  );
}
