import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminAffiliatesNav from "../AdminAffiliatesNav";
import PartnerRow from "./PartnerRow";
import { type PaymentDetail } from "../PaymentsDetailModal";

export const dynamic = "force-dynamic";

export default async function AffiliatesPartners() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId) redirect("/dashboard");

  const admin = createAdminClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: affiliates },
    { data: referrals },
    { data: allPayments },
    { data: allClicks },
    { data: allPayouts },
  ] = await Promise.all([
    admin.from("affiliates").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, affiliate_code, has_paid, plan, created_at, first_name, agency_name").not("affiliate_code", "is", null),
    admin.from("affiliate_payments").select("affiliate_code, user_id, amount_cents, commission_cents, commission_pct, plan, billing_reason, paid_at").order("paid_at", { ascending: false }),
    admin.from("affiliate_clicks").select("affiliate_code"),
    admin.from("affiliate_payouts").select("id, affiliate_code, amount_cents, note, paid_at").order("paid_at", { ascending: false }),
  ]);

  const rows = (affiliates ?? []) as any[];
  const allReferrals = referrals ?? [];
  const paymentRows = allPayments ?? [];
  const clickRows = allClicks ?? [];
  const payoutRows = allPayouts ?? [];

  // Build profile name map
  const profileMap = new Map<string, string>();
  for (const p of allReferrals) {
    profileMap.set(p.id, [p.first_name, p.agency_name].filter(Boolean).join(" — ") || "Client");
  }

  const stats = rows.map((a) => {
    const myPayments = paymentRows.filter((p) => p.affiliate_code === a.code);
    const myPayouts = payoutRows.filter((p) => p.affiliate_code === a.code);
    const myReferrals = allReferrals.filter((p) => p.affiliate_code === a.code);
    const clicks = clickRows.filter((c) => c.affiliate_code === a.code).length;

    const freeSignups = myReferrals.filter((r) => !r.has_paid).length;
    const convertis = myReferrals.filter((r) => r.has_paid).length;

    const totalRevenueCents = myPayments.reduce((s, p) => s + p.amount_cents, 0);
    const totalCommissionCents = myPayments.reduce((s, p) => s + p.commission_cents, 0);
    const monthCommissionCents = myPayments.filter((p) => p.paid_at >= monthStart).reduce((s, p) => s + p.commission_cents, 0);

    const totalPaidOut = myPayouts.reduce((s, p) => s + p.amount_cents, 0);
    const balanceCents = totalCommissionCents - totalPaidOut;

    const lastPayout = myPayouts[0] ?? null;

    const payoutDetails = myPayouts.map((p) => ({
      id: p.id,
      amount_cents: p.amount_cents,
      note: p.note,
      paid_at: p.paid_at,
    }));

    const paymentDetails: PaymentDetail[] = myPayments.map((p) => ({
      paid_at: p.paid_at,
      amount_cents: p.amount_cents,
      commission_cents: p.commission_cents,
      plan: p.plan ?? "solo",
      billing_reason: p.billing_reason ?? "",
      client_name: p.user_id ? (profileMap.get(p.user_id) ?? "Client") : "Client",
    }));

    return {
      affiliate: {
        id: a.id,
        code: a.code,
        name: a.name,
        email: a.email ?? null,
        commission_pct: a.commission_pct,
        discount_pct: a.discount_pct ?? null,
        stripe_promotion_code_id: a.stripe_promotion_code_id ?? null,
        user_id: a.user_id ?? null,
        payment_info: a.payment_info ?? null,
      },
      clicks,
      freeSignups,
      convertis,
      totalRevenueCents,
      totalCommissionCents,
      monthCommissionCents,
      balanceCents,
      lastPayoutDate: lastPayout?.paid_at ?? null,
      payoutDetails,
      paymentDetails,
    };
  });

  // Sort: urgent first, then by balance desc
  stats.sort((a, b) => {
    const aUrgent = a.balanceCents > 500 && (!a.lastPayoutDate || new Date(a.lastPayoutDate) < new Date(Date.now() - 35 * 86400000));
    const bUrgent = b.balanceCents > 500 && (!b.lastPayoutDate || new Date(b.lastPayoutDate) < new Date(Date.now() - 35 * 86400000));
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    return b.balanceCents - a.balanceCents;
  });

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)" }}>
      <AdminAffiliatesNav />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Partenaires <span className="text-white/30 text-sm font-normal">({stats.length})</span></h2>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Column headers */}
          <div
            className="flex items-center gap-3 px-5 py-2.5"
            style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="w-8 shrink-0" />
            <div className="w-36 shrink-0">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Partenaire</p>
            </div>
            <div className="w-20 shrink-0">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Statut</p>
            </div>
            <div className="flex-1 flex items-center gap-5">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider hidden sm:block w-10">Clics</p>
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider hidden sm:block w-14">Inscrits</p>
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider hidden md:block w-20">Payants</p>
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider hidden md:block w-20">MRR 30j</p>
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider hidden lg:block w-20">CA total</p>
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Solde</p>
            </div>
          </div>

          {/* Rows */}
          <div style={{ background: "rgba(10,14,40,0.55)" }}>
            {stats.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-10">Aucun partenaire enregistré.</p>
            ) : (
              stats.map((s) => (
                <PartnerRow key={s.affiliate.id} {...s} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
