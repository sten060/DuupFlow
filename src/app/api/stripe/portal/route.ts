import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const t = await getServerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const flow = body?.flow as "cancel" | "payment" | undefined;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: t("errors.billing.noStripeSubscription") },
      { status: 404 }
    );
  }

  const { origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    customer: profile.stripe_customer_id,
    return_url: `${baseUrl}/dashboard/settings`,
  };

  // Deep-link into a specific flow when requested
  if (flow === "cancel" && profile.stripe_subscription_id) {
    params.flow_data = {
      type: "subscription_cancel",
      subscription_cancel: { subscription: profile.stripe_subscription_id },
    };
  } else if (flow === "payment") {
    params.flow_data = { type: "payment_method_update" };
  }

  const portalSession = await getStripe().billingPortal.sessions.create(params);

  return NextResponse.json({ url: portalSession.url });
}
