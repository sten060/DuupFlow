export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold text-white/90 mb-2">Support</h1>
      <p className="text-sm text-white/50 mb-8">
        Besoin d'aide ? Contacte-nous via l'un des canaux ci-dessous.
      </p>

      <div className="space-y-4">
        {/* Telegram */}
        <a
          href="https://t.me/duupflow"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-[#229ED9]/10 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#229ED9]" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-medium text-white/85 text-sm">Telegram</div>
            <div className="text-xs text-white/45 mt-0.5">Réponse rapide en direct — canal recommandé</div>
          </div>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        </a>

        {/* Email */}
        <a
          href="mailto:support@duupflow.com"
          className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-medium text-white/85 text-sm">Email</div>
            <div className="text-xs text-white/45 mt-0.5">support@duupflow.com — réponse sous 24h</div>
          </div>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        </a>
      </div>

      <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h2 className="text-sm font-medium text-white/80 mb-3">Questions fréquentes</h2>
        <div className="space-y-3 text-sm">
          <details className="group">
            <summary className="cursor-pointer text-white/60 hover:text-white/80 transition">
              Ma duplication échoue, que faire ?
            </summary>
            <p className="mt-2 text-white/45 text-xs leading-relaxed pl-1">
              Vérifie que ta vidéo fait moins de 50 secondes et est au format MP4, MOV, MKV ou AVI. Si le problème persiste, contacte-nous sur Telegram.
            </p>
          </details>
          <details className="group">
            <summary className="cursor-pointer text-white/60 hover:text-white/80 transition">
              Comment fonctionne la Priorité d'algorithme ?
            </summary>
            <p className="mt-2 text-white/45 text-xs leading-relaxed pl-1">
              Elle injecte des métadonnées réalistes d'iPhone (appareil, caméra, iOS, GPS, focale) dans tes fichiers pour que les plateformes pensent que le contenu vient d'un appareil réel.
            </p>
          </details>
          <details className="group">
            <summary className="cursor-pointer text-white/60 hover:text-white/80 transition">
              Quels packs ne modifient pas le visuel ?
            </summary>
            <p className="mt-2 text-white/45 text-xs leading-relaxed pl-1">
              Les packs Métadonnées, Audio, Mouvement et Technique ne touchent pas le visuel. Seul le pack Visuels applique des changements visibles (très subtils).
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
