import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminAffiliatesNav from "../AdminAffiliatesNav";

export const dynamic = "force-dynamic";

export default async function AffiliatesAccounting() {
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
    { data: allPayments },
    { data: allPayouts },
  ] = await Promise.all([
    admin.from("affiliates").select("id, code, name, email").order("created_at", { ascending: false }),
    admin.from("affiliate_payments").select("affiliate_code, amount_cents, commission_cents, paid_at").order("paid_at", { ascending: false }),
    admin.from("affiliate_payouts").select("id, affiliate_code, amount_cents, note, paid_at").order("paid_at", { ascending: false }),
  ]);

  const rows = affiliates ?? [];
  const paymentRows = allPayments ?? [];
  const payoutRows = allPayouts ?? [];

  const totalMonthCommissionCents = paymentRows
    .filter((p) => p.paid_at >= monthStart)
    .reduce((s, p) => s + p.commission_cents, 0);
  const totalCommissionCents = paymentRows.reduce((s, p) => s + p.commission_cents, 0);
  const totalPayedOut = payoutRows.reduce((s, p) => s + p.amount_cents, 0);
  const totalBalanceDue = totalCommissionCents - totalPayedOut;

  const stats = rows.map((a) => {
    const myPayments = paymentRows.filter((p) => p.affiliate_code === a.code);
    const myPayouts = payoutRows.filter((p) => p.affiliate_code === a.code);
    const totalEarned = myPayments.reduce((s, p) => s + p.commission_cents, 0);
    const monthEarned = myPayments.filter((p) => p.paid_at >= monthStart).reduce((s, p) => s + p.commission_cents, 0);
    const totalPaid = myPayouts.reduce((s, p) => s + p.amount_cents, 0);
    const balance = totalEarned - totalPaid;
    const lastPayout = myPayouts[0] ?? null;
    return { ...a, totalEarned, monthEarned, totalPaid, balance, lastPayout };
  });

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)" }}>
      <AdminAffiliatesNav />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <h2 className="text-lg font-semibold text-white">Comptabilité globale</h2>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(16,185,129,0.15)" }}>
          {[
            { label: "Commission ce mois", value: `${(totalMonthCommissionCents / 100).toFixed(2)}€`, color: "#818CF8" },
            { label: "Total commission Stripe", value: `${(totalCommissionCents / 100).toFixed(2)}€`, color: "#38BDF8" },
            { label: "Total versé aux partenaires", value: `${(totalPayedOut / 100).toFixed(2)}€`, color: "#10B981" },
            { label: "Solde total à verser", value: `${(totalBalanceDue / 100).toFixed(2)}€`, color: totalBalanceDue > 0 ? "#F59E0B" : "#10B981" },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-5 py-4" style={{ background: "rgba(8,12,35,0.90)" }}>
              <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Per-partner table */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-6 py-4" style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Détail par partenaire</p>
          </div>
          <div style={{ background: "rgba(8,12,35,0.80)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {["Partenaire", "Commission ce mois", "Total gagné", "Total versé", "Solde à verser", "Dernier versement"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left font-semibold text-white/30 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((a, i) => (
                  <tr
                    key={a.id}
                    style={{
                      borderBottom: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                      background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    }}
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-white">{a.name}</p>
                      <p className="text-white/30 font-mono mt-0.5">{a.code}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold tabular-nums" style={{ color: "#818CF8" }}>
                      {(a.monthEarned / 100).toFixed(2)}€
                    </td>
                    <td className="px-5 py-3 font-semibold tabular-nums" style={{ color: "#38BDF8" }}>
                      {(a.totalEarned / 100).toFixed(2)}€
                    </td>
                    <td className="px-5 py-3 font-semibold tabular-nums" style={{ color: "#10B981" }}>
                      {(a.totalPaid / 100).toFixed(2)}€
                    </td>
                    <td className="px-5 py-3 font-bold tabular-nums" style={{ color: a.balance > 0 ? "#F59E0B" : "#10B981" }}>
                      {(a.balance / 100).toFixed(2)}€
                    </td>
                    <td className="px-5 py-3 text-white/40">
                      {a.lastPayout
                        ? new Date(a.lastPayout.paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
