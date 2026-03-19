"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
      style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {children}
    </div>
  );
}

export default function SettingsClient({
  initialFirstName,
  initialAgencyName,
  isGuest,
  invitations,
  userEmail,
}: {
  initialFirstName: string;
  initialAgencyName: string;
  isGuest: boolean;
  invitations: Invitation[];
  userEmail: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  // Profile state
  const [firstName, setFirstName] = useState(initialFirstName);
  const [agencyName, setAgencyName] = useState(initialAgencyName);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Support state
  const [supportMessage, setSupportMessage] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportMsg, setSupportMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Team state
  const [guestEmail, setGuestEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [localInvitations, setLocalInvitations] = useState<Invitation[]>(invitations);

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
      ? { type: "err", text: "Erreur lors de la sauvegarde." }
      : { type: "ok", text: "Profil mis à jour." }
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
      setLocalInvitations((prev) => [...prev, {
        id: "pending-" + Date.now(),
        guest_email: guestEmail.trim(),
        status: "pending",
      }]);
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
    if (res.ok) {
      setLocalInvitations((prev) => prev.filter((inv) => inv.id !== id));
    }
  }

  async function sendSupport(e: React.FormEvent) {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setSupportLoading(true);
    setSupportMsg(null);

    const res = await fetch("/api/support/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: supportMessage.trim() }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setSupportMsg({ type: "ok", text: "Message envoyé ! Nous vous répondrons rapidement." });
      setSupportMessage("");
    } else {
      setSupportMsg({ type: "err", text: data.error ?? "Erreur lors de l'envoi." });
    }
    setSupportLoading(false);
  }

  const activeInvitations = localInvitations.filter((i) => i.status !== "removed");
  const canInvite = !isGuest && activeInvitations.length < 3;

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-white/25 tracking-[0.14em] uppercase mb-1.5">
          Dashboard
        </p>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Paramètres</h1>
      </div>

      <div className="space-y-6">

        {/* Profile */}
        <div>
          <SectionTitle>Profil</SectionTitle>
          <Card>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Prénom</label>
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
                    {isGuest ? "Agence (lecture seule)" : "Agence / Entreprise"}
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
                <p
                  className={`text-xs px-3 py-2 rounded-lg ${profileMsg.type === "ok" ? "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20" : "text-red-400 bg-red-500/[0.08] border border-red-500/20"}`}
                >
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
                  {profileLoading ? "Sauvegarde…" : "Sauvegarder"}
                </button>
              </div>
            </form>
          </Card>
        </div>

        {/* Team (hosts only) */}
        {!isGuest && (
          <div>
            <SectionTitle>
              Équipe{" "}
              <span className="normal-case text-white/20 font-normal tracking-normal ml-1">
                — {activeInvitations.length}/3 membres
              </span>
            </SectionTitle>
            <Card>
              {/* Existing invitations */}
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
                            background: inv.status === "accepted"
                              ? "rgba(16,185,129,0.15)"
                              : "rgba(99,102,241,0.12)",
                            border: inv.status === "accepted"
                              ? "1px solid rgba(16,185,129,0.25)"
                              : "1px solid rgba(99,102,241,0.20)",
                            color: inv.status === "accepted" ? "#10B981" : "#818CF8",
                          }}
                        >
                          {(inv.guest_name ?? inv.guest_email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white/75">
                            {inv.guest_name ? `${inv.guest_name}` : inv.guest_email}
                          </p>
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
                          {inv.status === "accepted" ? "Invité" : "En attente"}
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

              {/* Invite form */}
              {canInvite ? (
                <form onSubmit={sendInvite} className="flex gap-3">
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="Email de la personne à inviter"
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-indigo-500/40 transition"
                    style={INPUT_STYLE}
                  />
                  <button
                    type="submit"
                    disabled={inviteLoading || !guestEmail.trim()}
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40 shrink-0"
                    style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                  >
                    {inviteLoading ? "…" : "Inviter"}
                  </button>
                </form>
              ) : (
                <p className="text-xs text-white/30 text-center py-2">
                  Limite de 3 membres atteinte.
                </p>
              )}

              {inviteMsg && (
                <p
                  className={`mt-3 text-xs px-3 py-2 rounded-lg ${inviteMsg.type === "ok" ? "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20" : "text-red-400 bg-red-500/[0.08] border border-red-500/20"}`}
                >
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

        {/* Guest notice */}
        {isGuest && (
          <div>
            <SectionTitle>Workspace</SectionTitle>
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
                  <p className="text-sm font-medium text-white/75 mb-1">Tu es membre invité·e</p>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Tu accèdes à ce workspace en tant que membre invité·e. La gestion de l&apos;équipe
                    est réservée au propriétaire du compte.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
        {/* Support */}
        <div>
          <SectionTitle>Contacter le support</SectionTitle>
          <Card>
            <form onSubmit={sendSupport} className="space-y-4">
              <p className="text-xs text-white/40">
                Envoi depuis <span className="text-white/60">{userEmail}</span>
              </p>
              <div>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Décrivez votre problème ou votre question…"
                  required
                  rows={5}
                  className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/40 transition resize-none"
                  style={INPUT_STYLE}
                />
              </div>

              {supportMsg && (
                <p className={`text-xs px-3 py-2 rounded-lg ${supportMsg.type === "ok" ? "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20" : "text-red-400 bg-red-500/[0.08] border border-red-500/20"}`}>
                  {supportMsg.text}
                </p>
              )}

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/25">
                  Nous répondons sous 24–48h à <span className="text-white/40">hello@duupflow.com</span>
                </p>
                <button
                  type="submit"
                  disabled={supportLoading || !supportMessage.trim()}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40 shrink-0"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  {supportLoading ? "Envoi…" : "Envoyer"}
                </button>
              </div>
            </form>
          </Card>
        </div>

      </div>
    </div>
  );
}
