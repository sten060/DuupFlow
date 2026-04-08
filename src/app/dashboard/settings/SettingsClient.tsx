"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";

type Invitation = {
  id: string;
  guest_email: string;
  status: string;
  guest_name?: string;
};

const INPUT_STYLE = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-white/30 mb-4">
      {children}
    </h2>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "rgba(10,14,40,0.55)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {children}
    </div>
  );
}

// FAQ_ITEMS moved inside FAQSection to use t()

function FAQSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  const FAQ_ITEMS = [
    { q: t("dashboard.settings.faq1Q"), a: t("dashboard.settings.faq1A") },
    { q: t("dashboard.settings.faq2Q"), a: t("dashboard.settings.faq2A") },
    { q: t("dashboard.settings.faq3Q"), a: t("dashboard.settings.faq3A") },
    { q: t("dashboard.settings.faq4Q"), a: t("dashboard.settings.faq4A") },
    { q: t("dashboard.settings.faq5Q"), a: t("dashboard.settings.faq5A") },
  ];
  return (
    <div>
      <SectionTitle>{t("dashboard.settings.faqTitle")}</SectionTitle>
      <Card>
        <div className="space-y-1">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 py-3 text-left transition"
              >
                <span className="text-sm font-medium text-white/75">{item.q}</span>
                <svg
                  viewBox="0 0 16 16"
                  className={`h-3.5 w-3.5 shrink-0 text-white/30 transition-transform ${open === i ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                >
                  <path d="M3 6l5 5 5-5" />
                </svg>
              </button>
              {open === i && (
                <p className="pb-3 text-sm text-white/45 leading-relaxed">
                  {item.a}
                </p>
              )}
              {i < FAQ_ITEMS.length - 1 && (
                <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */

export default function SettingsClient({
  initialFirstName,
  initialAgencyName,
  isGuest,
  plan,
  invitations,
  userEmail: _userEmail,
}: {
  initialFirstName: string;
  initialAgencyName: string;
  isGuest: boolean;
  plan: "solo" | "pro" | null;
  invitations: Invitation[];
  userEmail?: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState(initialFirstName);
  const [agencyName, setAgencyName] = useState(initialAgencyName);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [guestEmail, setGuestEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [localInvitations, setLocalInvitations] = useState<Invitation[]>(invitations);

  const [supportContact, setSupportContact] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportMsg, setSupportMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) return;
    setProfileLoading(true);
    setProfileMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfileLoading(false); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName.trim(), agency_name: agencyName.trim() })
      .eq("id", user.id);
    setProfileMsg(error
      ? { type: "err", text: t("dashboard.settings.profileError") }
      : { type: "ok", text: t("dashboard.settings.profileUpdated") }
    );
    setProfileLoading(false);
    router.refresh();
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!guestEmail.trim()) return;
    setInviteLoading(true);
    setInviteMsg(null);
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestEmail: guestEmail.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteMsg({ type: "ok", text: `Invitation envoyée à ${guestEmail.trim()}.` });
      setLocalInvitations((prev) => [...prev, { id: "pending-" + Date.now(), guest_email: guestEmail.trim(), status: "pending" }]);
      setGuestEmail("");
    } else {
      setInviteMsg({ type: "err", text: data.error ?? "Erreur." });
    }
    setInviteLoading(false);
  }

  async function removeInvitation(id: string) {
    const res = await fetch("/api/team/remove", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId: id }),
    });
    if (res.ok) setLocalInvitations((prev) => prev.filter((inv) => inv.id !== id));
  }

  async function sendSupport(e: React.FormEvent) {
    e.preventDefault();
    if (!supportContact.trim() || !supportSubject.trim() || !supportMessage.trim()) return;
    setSupportLoading(true);
    setSupportMsg(null);
    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: supportContact.trim(),
          subject: supportSubject.trim(),
          message: supportMessage.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSupportMsg({ type: "ok", text: t("dashboard.settings.supportSent") });
        setSupportContact("");
        setSupportSubject("");
        setSupportMessage("");
      } else {
        setSupportMsg({ type: "err", text: data.error ?? "Erreur lors de l'envoi." });
      }
    } catch {
      setSupportMsg({ type: "err", text: "Erreur réseau." });
    }
    setSupportLoading(false);
  }

  const activeInvitations = localInvitations.filter((i) => i.status !== "removed");
  const canInvite = !isGuest && plan === "pro" && activeInvitations.length < 3;
  const planLabel = plan === "solo" ? "Solo" : plan === "pro" ? "Pro" : null;
  const planColor = plan === "solo" ? "#A78BFA" : "#818CF8";
  const planBg = plan === "solo" ? "rgba(167,139,250,0.12)" : "rgba(99,102,241,0.12)";
  const planBorder = plan === "solo" ? "rgba(167,139,250,0.25)" : "rgba(99,102,241,0.25)";

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-white/25 tracking-[0.14em] uppercase mb-1.5">Dashboard</p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-white tracking-tight">{t("dashboard.settings.title")}</h1>
          {planLabel && (
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: planBg, border: `1px solid ${planBorder}`, color: planColor }}
            >
              Plan {planLabel}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6">

        {/* Profile + FAQ side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Profile */}
          <div>
            <SectionTitle>{t("dashboard.settings.profileSection")}</SectionTitle>
            <Card>
              <form onSubmit={saveProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">{t("dashboard.settings.firstNameLabel")}</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/40 transition"
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">
                      {isGuest ? t("dashboard.settings.agencyLabelGuest") : t("dashboard.settings.agencyLabel")}
                    </label>
                    <input
                      type="text"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      disabled={isGuest}
                      className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/40 transition disabled:opacity-40"
                      style={INPUT_STYLE}
                    />
                  </div>
                </div>
                {profileMsg && (
                  <p className={`text-xs px-3 py-2 rounded-lg ${profileMsg.type === "ok" ? "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20" : "text-red-400 bg-red-500/[0.08] border border-red-500/20"}`}>
                    {profileMsg.text}
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                  >
                    {profileLoading ? t("dashboard.settings.saving") : t("dashboard.settings.save")}
                  </button>
                </div>
              </form>
            </Card>
          </div>

          {/* FAQ */}
          <FAQSection />
        </div>

        {/* Team (Pro hosts only) */}
        {!isGuest && plan === "pro" && (
          <div>
            <SectionTitle>
              {t("dashboard.settings.teamSection")}{" "}
              <span className="normal-case text-white/20 font-normal tracking-normal ml-1">
                — {activeInvitations.length}/3 {t("dashboard.settings.teamMembers")}
              </span>
            </SectionTitle>
            <Card>
              {activeInvitations.length > 0 && (
                <div className="space-y-2 mb-5">
                  {activeInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-xl px-4 py-3"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{
                            background: inv.status === "accepted" ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.12)",
                            border: inv.status === "accepted" ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(99,102,241,0.20)",
                            color: inv.status === "accepted" ? "#10B981" : "#818CF8",
                          }}
                        >
                          {(inv.guest_name ?? inv.guest_email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white/75">{inv.guest_name ?? inv.guest_email}</p>
                          <p className="text-[10px] text-white/30">{inv.guest_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                          style={inv.status === "accepted"
                            ? { background: "rgba(16,185,129,0.10)", color: "#10B981", border: "1px solid rgba(16,185,129,0.20)" }
                            : { background: "rgba(245,158,11,0.10)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.20)" }
                          }
                        >
                          {inv.status === "accepted" ? t("dashboard.settings.invited") : t("dashboard.settings.pending")}
                        </span>
                        <button
                          onClick={() => removeInvitation(inv.id)}
                          className="text-white/20 hover:text-red-400/70 transition p-1"
                          title="Retirer"
                        >
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10H3z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {canInvite ? (
                <form onSubmit={sendInvite} className="flex gap-3">
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder={t("dashboard.settings.invitePlaceholder")}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-indigo-500/40 transition"
                    style={INPUT_STYLE}
                  />
                  <button
                    type="submit"
                    disabled={inviteLoading || !guestEmail.trim()}
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40 shrink-0"
                    style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                  >
                    {inviteLoading ? t("dashboard.settings.inviting") : t("dashboard.settings.inviteButton")}
                  </button>
                </form>
              ) : (
                <p className="text-xs text-white/30 text-center py-2">{t("dashboard.settings.teamLimitReached")}</p>
              )}
              {inviteMsg && (
                <p className={`mt-3 text-xs px-3 py-2 rounded-lg ${inviteMsg.type === "ok" ? "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20" : "text-red-400 bg-red-500/[0.08] border border-red-500/20"}`}>
                  {inviteMsg.text}
                </p>
              )}
              <p className="mt-4 text-[11px] text-white/25 leading-relaxed">
                La personne invitée recevra un lien magique par email pour rejoindre ton workspace.
                Elle pourra utiliser tous les modules sous son propre prénom.
              </p>
            </Card>
          </div>
        )}

        {/* Solo — no members notice */}
        {!isGuest && plan === "solo" && (
          <div>
            <SectionTitle>{t("dashboard.settings.teamSection")}</SectionTitle>
            <Card>
              <div className="flex items-start gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.20)" }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#A78BFA" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white/75 mb-1">{t("dashboard.settings.soloNoInvite")}</p>
                  <p className="text-xs text-white/40 leading-relaxed">
                    {t("dashboard.settings.soloNoInviteDesc")}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Guest notice */}
        {isGuest && (
          <div>
            <SectionTitle>{t("dashboard.settings.workspace")}</SectionTitle>
            <Card>
              <div className="flex items-start gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.20)" }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white/75 mb-1">{t("dashboard.settings.guestNotice")}</p>
                  <p className="text-xs text-white/40 leading-relaxed">
                    {t("dashboard.settings.guestNoticeDesc")}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Support */}
        <div>
          <SectionTitle>{t("dashboard.settings.supportSection")}</SectionTitle>
          <Card>
            <p className="text-xs text-white/40 mb-5 leading-relaxed">
              {t("dashboard.settings.supportIntro")}
            </p>
            <form onSubmit={sendSupport} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">{t("dashboard.settings.supportContactLabel")}</label>
                  <input
                    type="text"
                    value={supportContact}
                    onChange={(e) => setSupportContact(e.target.value)}
                    placeholder={t("dashboard.settings.supportContactPlaceholder")}
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/40 transition"
                    style={INPUT_STYLE}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">{t("dashboard.settings.supportSubjectLabel")}</label>
                  <input
                    type="text"
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    placeholder={t("dashboard.settings.supportSubjectPlaceholder")}
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/40 transition"
                    style={INPUT_STYLE}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">{t("dashboard.settings.supportMessageLabel")}</label>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder={t("dashboard.settings.supportMessagePlaceholder")}
                  rows={4}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/40 transition resize-none"
                  style={INPUT_STYLE}
                />
              </div>
              {supportMsg && (
                <p className={`text-xs px-3 py-2 rounded-lg ${supportMsg.type === "ok" ? "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20" : "text-red-400 bg-red-500/[0.08] border border-red-500/20"}`}>
                  {supportMsg.text}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={supportLoading || !supportContact.trim() || !supportSubject.trim() || !supportMessage.trim()}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  {supportLoading ? t("dashboard.settings.supportSending") : t("dashboard.settings.supportSend")}
                </button>
              </div>
            </form>
          </Card>
        </div>

      </div>
    </div>
  );
}
