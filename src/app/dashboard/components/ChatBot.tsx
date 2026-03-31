"use client";

import { useState } from "react";

type Message = { from: "bot" | "user"; text: string; options?: Option[] };
type Option = { label: string; action: string };

const TELEGRAM_URL = "https://t.me/duupflow";

// FAQ decision tree — entonnoir conversationnel
const TREE: Record<string, { text: string; options: Option[] }> = {
  start: {
    text: "Salut ! Comment je peux t'aider ?",
    options: [
      { label: "Problème avec une duplication", action: "dup_problem" },
      { label: "Question sur mon abonnement", action: "abo" },
      { label: "Comment utiliser DuupFlow ?", action: "how_to" },
      { label: "Autre question", action: "other" },
    ],
  },
  dup_problem: {
    text: "Quel type de problème rencontres-tu ?",
    options: [
      { label: "La duplication échoue / erreur", action: "dup_error" },
      { label: "La qualité visuelle est différente", action: "dup_quality" },
      { label: "C'est trop lent", action: "dup_slow" },
      { label: "Autre", action: "contact" },
    ],
  },
  dup_error: {
    text: "Essaie ces étapes :\n\n1. Vérifie que ta vidéo fait moins de 50 secondes\n2. Vérifie que le format est MP4, MOV, MKV ou AVI\n3. Relance la duplication\n\nSi le problème persiste, contacte le support.",
    options: [
      { label: "C'est résolu, merci !", action: "resolved" },
      { label: "Ça ne marche toujours pas", action: "contact" },
    ],
  },
  dup_quality: {
    text: "Les packs 'Métadonnées', 'Audio', 'Mouvement' et 'Technique' ne modifient pas le visuel. Seul le pack 'Visuels' applique des changements visibles (très légers).\n\nSi tu vois une teinte jaune sur une vidéo iPhone HDR, c'est normal — le système convertit automatiquement le HDR en SDR.",
    options: [
      { label: "C'est résolu, merci !", action: "resolved" },
      { label: "J'ai un autre souci", action: "contact" },
    ],
  },
  dup_slow: {
    text: "La vitesse dépend de la durée de la vidéo et du nombre de copies. Conseils :\n\n• Réduis la durée (max 50s)\n• Lance moins de copies à la fois\n• Les packs 'Mouvement' et 'Visuels' sont plus lents que 'Métadonnées' seul",
    options: [
      { label: "OK, compris !", action: "resolved" },
      { label: "C'est toujours trop lent", action: "contact" },
    ],
  },
  abo: {
    text: "Que veux-tu savoir sur ton abonnement ?",
    options: [
      { label: "Comment changer de plan ?", action: "abo_change" },
      { label: "J'ai atteint ma limite", action: "abo_limit" },
      { label: "Problème de paiement", action: "contact" },
    ],
  },
  abo_change: {
    text: "Va dans le menu 'Abonnement' dans la sidebar. Tu peux y voir ton plan actuel et le modifier.",
    options: [
      { label: "Merci !", action: "resolved" },
      { label: "J'ai besoin d'aide", action: "contact" },
    ],
  },
  abo_limit: {
    text: "Chaque plan a un nombre de duplications par mois. Si tu as atteint ta limite, tu peux passer au plan supérieur depuis l'onglet 'Abonnement'.",
    options: [
      { label: "OK, je vais voir !", action: "resolved" },
      { label: "J'ai besoin d'aide", action: "contact" },
    ],
  },
  how_to: {
    text: "DuupFlow est simple :\n\n1. Va dans 'Images' ou 'Vidéos'\n2. Upload ton fichier\n3. Choisis tes packs/filtres\n4. Clique sur 'Dupliquer'\n5. Télécharge les copies\n\nChaque copie est unique (métadonnées, pixels, hash différents).",
    options: [
      { label: "Merci, c'est clair !", action: "resolved" },
      { label: "J'ai une autre question", action: "start" },
    ],
  },
  other: {
    text: "Je ne peux pas répondre à toutes les questions. Contacte notre support directement !",
    options: [
      { label: "Contacter le support", action: "contact" },
      { label: "Retour au début", action: "start" },
    ],
  },
  contact: {
    text: "Notre équipe est disponible sur Telegram pour t'aider rapidement.",
    options: [
      { label: "Ouvrir Telegram", action: "open_telegram" },
      { label: "Retour au début", action: "start" },
    ],
  },
  resolved: {
    text: "Super ! N'hésite pas si tu as d'autres questions.",
    options: [
      { label: "J'ai une autre question", action: "start" },
    ],
  },
};

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { from: "bot", text: TREE.start.text, options: TREE.start.options },
  ]);

  function handleOption(opt: Option) {
    // Add user's choice
    setMessages((prev) => [...prev, { from: "user", text: opt.label }]);

    if (opt.action === "open_telegram") {
      window.open(TELEGRAM_URL, "_blank");
      return;
    }

    const node = TREE[opt.action];
    if (node) {
      setTimeout(() => {
        setMessages((prev) => [...prev, { from: "bot", text: node.text, options: node.options }]);
      }, 300);
    }
  }

  function handleReset() {
    setMessages([{ from: "bot", text: TREE.start.text, options: TREE.start.options }]);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg hover:bg-indigo-400 transition-all"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 w-80 max-h-[28rem] rounded-2xl border border-white/[0.08] flex flex-col overflow-hidden"
          style={{ background: "rgba(10,14,30,0.95)", backdropFilter: "blur(20px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white/80">Assistance DuupFlow</span>
            <button onClick={handleReset} className="text-xs text-white/40 hover:text-white/70 transition">
              Recommencer
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i}>
                <div
                  className={[
                    "text-sm rounded-xl px-3 py-2 max-w-[85%] whitespace-pre-line",
                    msg.from === "bot"
                      ? "bg-white/[0.06] text-white/80"
                      : "bg-indigo-500/20 text-white/90 ml-auto",
                  ].join(" ")}
                >
                  {msg.text}
                </div>
                {msg.options && i === messages.length - 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.options.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => handleOption(opt)}
                        className="text-xs rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-all"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
