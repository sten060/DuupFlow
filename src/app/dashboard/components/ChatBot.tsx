"use client";

import { useState } from "react";

type Message = { from: "bot" | "user"; text: string; options?: Option[] };
type Option = { label: string; action: string };

const TELEGRAM_URL = "https://t.me/DuupFlow_Support";

// FAQ decision tree — entonnoir conversationnel
const TREE: Record<string, { text: string; options: Option[] }> = {
  start: {
    text: "Salut ! \u{1F44B} Comment je peux t'aider ?",
    options: [
      { label: "Problème avec une duplication", action: "dup_problem" },
      { label: "Question sur mon abonnement", action: "abo" },
      { label: "Comment utiliser DuupFlow ?", action: "how_to" },
      { label: "Module Détection IA", action: "ai_detection" },
      { label: "Nouvelles fonctionnalités", action: "new_features" },
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
  ai_detection: {
    text: "Que veux-tu savoir sur la Détection IA ?",
    options: [
      { label: "À quoi sert ce module ?", action: "ai_what" },
      { label: "Est-ce que ça modifie le visuel ?", action: "ai_visual" },
      { label: "Ça fonctionne avec quelles plateformes ?", action: "ai_platforms" },
      { label: "Autre question", action: "contact" },
    ],
  },
  ai_what: {
    text: "Le module Détection IA efface toutes les métadonnées IA de tes fichiers (EXIF, XMP, IPTC, C2PA) et les remplace par une identité humaine réaliste.\n\nRésultat : ton contenu généré par IA passe pour un contenu créé par un humain avec un appareil photo réel.",
    options: [
      { label: "Compris, merci !", action: "resolved" },
      { label: "Ça modifie le visuel ?", action: "ai_visual" },
    ],
  },
  ai_visual: {
    text: "Non, aucune modification visuelle. Seules les métadonnées sont modifiées. Les pixels de ton image/vidéo restent identiques.\n\nPour contourner la détection visuelle des plateformes, combine ce module avec la Duplication Images (filtres visuels).",
    options: [
      { label: "OK, compris !", action: "resolved" },
      { label: "Autre question", action: "start" },
    ],
  },
  ai_platforms: {
    text: "Ce module supprime les signatures IA détectées par Meta, Instagram, Threads, et toute plateforme utilisant C2PA/JUMBF.\n\nPour une protection maximale, combine avec la Duplication (métadonnées + visuels).",
    options: [
      { label: "Parfait, merci !", action: "resolved" },
      { label: "Contacter le support", action: "contact" },
    ],
  },
  new_features: {
    text: "Voici les dernières nouveautés de DuupFlow :",
    options: [
      { label: "Priorité d'algorithme", action: "feat_iphone" },
      { label: "Pixel magique", action: "feat_pixel" },
      { label: "Métadonnées technique", action: "feat_meta_tech" },
      { label: "Comparateur de métadonnées", action: "feat_comparator" },
      { label: "Retour", action: "start" },
    ],
  },
  feat_iphone: {
    text: "⚡ Priorité d'algorithme simule une vidéo/photo provenant d'un vrai iPhone.\n\nElle injecte des métadonnées Apple authentiques : appareil, version iOS, caméra, GPS, signature. Le fichier vidéo sort en format .mov (comme un vrai iPhone).\n\nLes plateformes pensent que le contenu vient d'un appareil réel.",
    options: [
      { label: "Super, merci !", action: "resolved" },
      { label: "Autre nouveauté", action: "new_features" },
    ],
  },
  feat_pixel: {
    text: "✨ Pixel magique ajoute du bruit imperceptible à chaque pixel de chaque frame.\n\nVisuellement identique, mais le hash du fichier est complètement différent. Les algorithmes de détection de doublons voient un fichier unique.",
    options: [
      { label: "Compris !", action: "resolved" },
      { label: "Autre nouveauté", action: "new_features" },
    ],
  },
  feat_meta_tech: {
    text: "🔧 Métadonnées technique modifie le bitrate vidéo, le GOP, le FPS et le profil H.264.\n\nCes paramètres techniques rendent chaque copie unique au niveau du codec sans modification visuelle perceptible.",
    options: [
      { label: "OK !", action: "resolved" },
      { label: "Autre nouveauté", action: "new_features" },
    ],
  },
  feat_comparator: {
    text: "🔍 Le Comparateur de métadonnées analyse deux fichiers et affiche côte à côte toutes leurs métadonnées.\n\nTu peux vérifier que tes duplications sont bien différentes de l'original. Les différences sont surlignées en vert avec un score de similarité.",
    options: [
      { label: "Cool !", action: "resolved" },
      { label: "Autre nouveauté", action: "new_features" },
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
  const [expanded, setExpanded] = useState(false);
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

  const panelSize = expanded ? "w-[32rem] h-[85vh]" : "w-80 max-h-[28rem]";

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-indigo-500/80 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center shadow-lg hover:bg-indigo-400/80 transition-all"
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
          className={`fixed bottom-20 right-5 z-50 ${panelSize} rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.1] flex flex-col overflow-hidden shadow-2xl transition-all`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white/80">Assistance DuupFlow</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-white/40 hover:text-white/70 transition"
                title={expanded ? "Réduire" : "Agrandir"}
              >
                {expanded ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                )}
              </button>
              <button onClick={handleReset} className="text-xs text-white/40 hover:text-white/70 transition">
                Recommencer
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i}>
                <div
                  className={[
                    "text-sm leading-relaxed rounded-xl px-4 py-3 max-w-[85%] whitespace-pre-line",
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
