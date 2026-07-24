"use client";

// Annonce one-shot du module « Scraper ».
// Affiché UNE SEULE FOIS par navigateur (garde localStorage), pour tous les
// utilisateurs. Le bouton principal emmène directement sur le module.

import { useState } from "react";
import { useRouter } from "next/navigation";

export const SCRAPER_SEEN_KEY = "duup_scraper_announce_seen";
export const SCRAPER_DEST = "/dashboard/import";

const ACCENT = "#8B5CF6"; // violet — couleur du module Scraper

export default function ScraperAnnouncementModal({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  function seen() {
    try { localStorage.setItem(SCRAPER_SEEN_KEY, "1"); } catch { /* mode privé */ }
  }
  function later() { seen(); onDone(); }
  function discover() {
    if (leaving) return;
    setLeaving(true);
    seen();
    router.push(SCRAPER_DEST);
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(6,9,24,0.88)", backdropFilter: "blur(10px)" }}
      onClick={later}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10,12,32,0.98)",
          border: "1px solid rgba(139,92,246,0.32)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(139,92,246,0.14)",
        }}
      >
        {/* Bandeau visuel */}
        <div
          className="px-8 pt-8 pb-6"
          style={{ background: "linear-gradient(160deg, rgba(139,92,246,0.16), transparent 70%)" }}
        >
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full mb-5"
            style={{
              background: "rgba(139,92,246,0.14)",
              color: "#C4B5FD",
              border: "1px solid rgba(139,92,246,0.32)",
            }}
          >
            ⬇ Nouveau · Scraper
          </span>

          <h2 className="text-[28px] leading-[1.12] font-semibold tracking-tight text-white">
            Tes meilleures vidéos,
            <br />
            <span className="bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-transparent">
              récupérées en un clic.
            </span>
          </h2>
        </div>

        <div className="px-8 pb-8">
          <p className="text-[15px] leading-relaxed text-white/70 mb-6">
            Colle le lien de ton compte <span className="text-white/90 font-medium">Instagram</span> ou{" "}
            <span className="text-white/90 font-medium">TikTok</span>. On analyse tout, on repère les
            vidéos qui ont le plus cartonné, et tu les récupères — prêtes à republier.
          </p>

          <ul className="space-y-3 mb-7">
            {[
              ["📊", "On classe automatiquement tes contenus", "les plus performants remontent en premier"],
              ["⬇️", "Récupère les meilleurs en un clic", "Instagram et TikTok, sans copier-coller"],
              ["♻️", "Envoi direct vers la suite", "duplication vidéo ou Google Drive, en un bouton"],
            ].map(([icon, title, sub], i) => (
              <li key={i} className="flex items-start gap-3.5">
                <span
                  className="h-9 w-9 shrink-0 rounded-lg grid place-items-center text-base"
                  style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.28)" }}
                >
                  {icon}
                </span>
                <span className="pt-0.5">
                  <span className="block text-sm font-medium text-white/90 leading-snug">{title}</span>
                  <span className="block text-[13px] text-white/50 leading-snug">{sub}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={later}
              className="rounded-xl px-4 py-3 text-sm font-medium text-white/50 hover:text-white/85 hover:bg-white/[0.05] transition"
            >
              Plus tard
            </button>
            <button
              type="button"
              onClick={discover}
              disabled={leaving}
              className="flex-1 rounded-xl py-3 text-sm font-semibold text-white text-center transition hover:opacity-90 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #6366F1)` }}
            >
              Essayer le Scraper →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
