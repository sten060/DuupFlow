"use client";

import { isValidElement, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { buildAllDocs } from "./docs-content";
import { buildHelpArticles, buildEditorArticles } from "./help-articles";

/* ══════════════════════════════════════════════════════════════════════════
 * WIDGET D'AIDE
 *
 * Remplace l'ancien arbre de dialogue (« Salut ! Comment je peux t'aider ? »
 * suivi de six choix, puis six autres…). Le problème n'était pas le contenu
 * mais la FORME : pour trouver une info, il fallait deviner la branche, et le
 * contenu vivait dans des chaînes de traduction impossibles à tenir à jour.
 *
 * Ici, trois surfaces seulement :
 *   · Accueil  — deux portes d'entrée : nous écrire, ou lire la doc.
 *   · Message  — les canaux de contact (un agent IA prendra cette place).
 *   · Articles — LA DOCUMENTATION DÉJÀ ÉCRITE du produit, réutilisée telle
 *                quelle (buildAllDocs). Une seule source à maintenir : ce qui
 *                est mis à jour dans la doc l'est ici aussi, automatiquement.
 * ══════════════════════════════════════════════════════════════════════════ */

const TELEGRAM_URL = "https://t.me/DuupFlow_Support";
const SUPPORT_EMAIL = "hello@duupflow.com";

type Tab = "home" | "message" | "articles";
type Ouvert = { module: number; doc: number } | null;

/**
 * Extrait le texte d'un article pour la recherche.
 *
 * Les corps d'articles sont du JSX (titres, listes, encadrés) : chercher dans
 * les seuls TITRES ne servait à rien — taper « watermark » ne renvoyait rien
 * alors que le sujet est traité dans plusieurs articles. On parcourt donc
 * l'arbre pour ramasser les chaînes qu'il contient.
 */
/** Minuscules + accents retirés : « detection » doit trouver « détection ». */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const echappe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Le mot commence-t-il un mot du texte ? (« image » trouve « images ») */
const debuteUnMot = (texte: string, mot: string) =>
  new RegExp(`(^|[^a-z0-9])${echappe(mot)}`).test(texte);

/**
 * Poids d'un mot dans un article.
 *
 * C'est LA correction du moteur de recherche : avant, un mot trouvé dans le
 * corps comptait autant qu'un mot du titre. Taper « images » remontait donc
 * cinq articles de modules différents — tous ceux qui prononcent le mot une
 * fois quelque part — au même rang que l'article qui porte ce nom.
 * Un titre pèse maintenant dix fois un corps, et la catégorie compte aussi.
 */
function poids(e: { titreN: string; catN: string; corpsN: string }, mot: string): number {
  if (debuteUnMot(e.titreN, mot)) return 10;
  if (e.titreN.includes(mot)) return 6;
  if (debuteUnMot(e.catN, mot)) return 5;
  if (debuteUnMot(e.corpsN, mot)) return 1;
  if (e.corpsN.includes(mot)) return 0.4;
  return 0;
}

function texteDe(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texteDe).join(" ");
  if (isValidElement(node)) return texteDe((node.props as { children?: ReactNode }).children);
  return "";
}

/* ─────────────────────────── briques d'interface ─────────────────────────── */

function BotAvatar({ small }: { small?: boolean }) {
  const box = small ? "h-7 w-7" : "h-10 w-10";
  const icon = small ? "h-4 w-4" : "h-[22px] w-[22px]";
  return (
    <span
      aria-hidden
      className={`${box} shrink-0 rounded-[12px] flex items-center justify-center text-white`}
      style={{
        background: "linear-gradient(180deg,#8f90fb,#5b5bd6)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.35) inset, 0 2px 6px rgba(79,70,229,0.3)",
      }}
    >
      <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="8" width="16" height="12" rx="3.5" />
        <path d="M12 8V4.5" /><circle cx="12" cy="3.4" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="9.2" cy="14" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="14.8" cy="14" r="1.15" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

const Chevron = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

/** Ligne cliquable d'une carte — le motif de base de tout le widget. */
function Row({ icon, label, sub, onClick, href }: { icon?: React.ReactNode; label: string; sub?: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      {icon && <span className="shrink-0 text-indigo-500">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium leading-snug text-[var(--app-text)] line-clamp-2">{label}</span>
        {sub && <span className="block truncate text-[12px] text-[var(--app-text-faint)]">{sub}</span>}
      </span>
      <Chevron className="text-[var(--app-text-faint)] transition-transform group-hover:translate-x-0.5" />
    </>
  );
  const cls = "group flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-[var(--app-surface-2)]";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{inner}</button>
  );
}

/** Conteneur à bord arrondi qui regroupe des lignes, façon liste iOS. */
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] divide-y divide-[var(--app-border)] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">{children}</div>
);

const SectionLabel = ({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-faint)]">
    {icon && <span className="shrink-0 opacity-80">{icon}</span>}
    {children}
  </div>
);

/* ─────────────────────────────── le widget ──────────────────────────────── */

export default function ChatBot() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [ouvert, setOuvert] = useState<Ouvert>(null);
  const [recherche, setRecherche] = useState("");

  // La documentation du produit EST la base d'articles. Aucune duplication de
  // contenu : ce qui est corrigé dans la doc apparaît ici sans rien recoder.
  // Les articles de dépannage passent devant : ce sont les questions qu'on
  // reçoit en support, pas la doc d'un module.
  const modules = useMemo(() => [buildHelpArticles(t), buildEditorArticles(t), ...buildAllDocs(t)], [t]);

  // Trois articles mis en avant sur l'accueil — les questions les plus posées.
  const raccourcis = useMemo(() => {
    const cherche = (id: string, motif: RegExp) => {
      const m = modules.findIndex((x) => x.id === id);
      if (m < 0) return null;
      const d = modules[m].docs.findIndex((x) => motif.test(x.title));
      return d < 0 ? null : { module: m, doc: d, title: modules[m].docs[d].title };
    };
    return [
      cherche("help", /./),
      cherche("help-editor", /marche|works/i),
      cherche("videos", /conseil|tips/i),
    ].filter(Boolean) as { module: number; doc: number; title: string }[];
  }, [modules]);

  // Index titre + contenu, construit une seule fois par langue.
  const index = useMemo(
    () =>
      modules.flatMap((m, mi) =>
        m.docs.map((d, di) => ({
          module: mi,
          doc: di,
          title: d.title,
          cat: m.label,
          titreN: norm(d.title),
          catN: norm(m.label),
          corpsN: norm(texteDe(d.body)),
        })),
      ),
    [modules],
  );

  const resultats = useMemo(() => {
    const q = norm(recherche.trim());
    if (!q) return null;
    // Tous les mots doivent être présents quelque part — « pack mouvement » ne
    // remonte pas tout ce qui parle de packs — puis on classe par pertinence.
    const mots = q.split(/\s+/).filter(Boolean);
    const notes: { e: (typeof index)[number]; note: number }[] = [];
    for (const e of index) {
      let total = 0;
      let manque = false;
      for (const mot of mots) {
        const p = poids(e, mot);
        if (!p) { manque = true; break; }
        total += p;
      }
      if (!manque) notes.push({ e, note: total });
    }
    if (!notes.length) return [];
    notes.sort((a, b) => b.note - a.note);
    // Une correspondance de titre écrase les simples mentions dans un corps :
    // on ne garde que ce qui joue dans la même cour que le meilleur résultat.
    const seuil = notes[0].note * 0.5;
    return notes.filter((n) => n.note >= seuil).slice(0, 8).map((n) => n.e);
  }, [recherche, index]);

  // Largeur inchangée ; hauteur poussée à 42rem. Le calc borne le panneau au
  // plafond de l'écran : il part de bottom-36 (9rem) et garde 2rem en haut —
  // sans lui, un petit écran le ferait déborder par le haut.
  const panneau = "w-96 h-[min(42rem,calc(100vh-11rem))]";

  const allerA = (tabCible: Tab) => { setOuvert(null); setTab(tabCible); };

  return (
    <>
      {/* Bouton flottant : dégradé + reflet discret, sans cerne extérieur. */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={t("chatbot.header")}
        className="group fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full text-white flex items-center justify-center overflow-hidden transition-transform duration-150 hover:scale-105 active:scale-95"
        style={{
          background: "linear-gradient(180deg,#7b7cf5 0%,#6366f1 50%,#5048d9 100%)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.3) inset, 0 -2px 3px rgba(35,25,110,0.28) inset, 0 6px 16px rgba(79,70,229,0.28), 0 2px 5px rgba(20,20,60,0.18)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-[4px] top-[3px] h-[38%] rounded-t-full"
          style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,255,255,0))" }}
        />
        <span className="relative">
          {open ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          )}
        </span>
      </button>

      {/* bottom-36 : la cloche de notifications occupe bottom-20. */}
      {open && (
        <div className={`fixed bottom-36 right-5 z-50 ${panneau} rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] flex flex-col overflow-hidden shadow-2xl`}>
          {/* ── Barre du haut : accueil, onglets, réduire ── */}
          <div className="flex items-center gap-2 border-b border-[var(--app-border)] px-2.5 py-2">
            <button
              type="button"
              onClick={() => allerA("home")}
              title={t("chatbot.tabHome")}
              aria-label={t("chatbot.tabHome")}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${tab === "home" ? "text-[var(--app-text)]" : "text-[var(--app-text-faint)] hover:text-[var(--app-text)]"}`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill={tab === "home" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
              </svg>
            </button>

            <div className="flex flex-1 items-center gap-1 rounded-full bg-[var(--app-surface-2)] p-1">
              {([["message", t("chatbot.tabMessage")], ["articles", t("chatbot.tabArticles")]] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => allerA(id as Tab)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${
                    tab === id ? "bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm" : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              title={t("chatbot.close")}
              aria-label={t("chatbot.close")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-faint)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* ─────────────── Article ouvert : il prend toute la place ─────────────── */}
            {ouvert ? (
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => setOuvert(null)}
                  className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--app-text-faint)] transition hover:text-[var(--app-text)]"
                >
                  <Chevron className="rotate-180" />
                  {t("chatbot.back")}
                </button>
                <h3 className="text-[15px] font-semibold text-[var(--app-text)]">{modules[ouvert.module].docs[ouvert.doc].title}</h3>
                <div className="mt-3 text-[13.5px] leading-relaxed text-[var(--app-text-muted)]">
                  {modules[ouvert.module].docs[ouvert.doc].body}
                </div>
              </div>
            ) : tab === "home" ? (
              /* ─────────────────────────── Accueil ─────────────────────────── */
              <div className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                  <BotAvatar />
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold leading-snug text-[var(--app-text)]">{t("chatbot.homeTitle")}</div>
                    <div className="text-[12.5px] leading-snug text-[var(--app-text-faint)]">{t("chatbot.homeSubtitle")}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <SectionLabel>{t("chatbot.getHelp")}</SectionLabel>
                  <Card>
                    <Row
                      label={t("chatbot.sendMessage")}
                      onClick={() => allerA("message")}
                      icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
                    />
                  </Card>
                  <Card>
                    <Row
                      label={t("chatbot.readArticles")}
                      onClick={() => allerA("articles")}
                      icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2z" /><path d="M22 4h-7a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z" /></svg>}
                    />
                    {raccourcis.map((r) => (
                      <Row key={`${r.module}-${r.doc}`} label={r.title} onClick={() => { setTab("articles"); setOuvert({ module: r.module, doc: r.doc }); }} />
                    ))}
                  </Card>
                </div>
              </div>
            ) : tab === "message" ? (
              /* ─────────────────────────── Message ─────────────────────────── */
              <div className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                  <BotAvatar />
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold leading-snug text-[var(--app-text)]">{t("chatbot.messageTitle")}</div>
                    <div className="text-[12.5px] leading-snug text-[var(--app-text-faint)]">{t("chatbot.messageSubtitle")}</div>
                  </div>
                </div>

                <Card>
                  <Row
                    label={t("chatbot.telegram")}
                    sub={t("chatbot.telegramDesc")}
                    href={TELEGRAM_URL}
                    icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor"><path d="M21.9 4.3 18.6 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1L18.1 6c.4-.4-.1-.6-.6-.2L7.1 12.4l-5-1.6c-1.1-.3-1.1-1 .2-1.5l19.5-7.5c.9-.3 1.7.2 1.1 2.5z" /></svg>}
                  />
                  <Row
                    label={t("chatbot.email")}
                    sub={SUPPORT_EMAIL}
                    href={`mailto:${SUPPORT_EMAIL}`}
                    icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="m3 7 9 6 9-6" /></svg>}
                  />
                </Card>

                <p className="px-1 text-[12px] leading-relaxed text-[var(--app-text-faint)]">{t("chatbot.messageSoon")}</p>
              </div>
            ) : (
              /* ─────────────────────────── Articles ─────────────────────────── */
              <div className="space-y-5 p-4">
                <div className="relative">
                  <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-faint)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder={t("chatbot.searchPlaceholder")}
                    className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] py-2.5 pl-9 pr-3 text-[13px] text-[var(--app-text)] outline-none transition focus:border-indigo-400/50"
                  />
                </div>

                {resultats ? (
                  resultats.length ? (
                    <Card>
                      {resultats.map((r) => (
                        <Row key={`${r.module}-${r.doc}`} label={r.title} sub={r.cat} onClick={() => setOuvert({ module: r.module, doc: r.doc })} />
                      ))}
                    </Card>
                  ) : (
                    <p className="px-1 py-6 text-center text-[13px] text-[var(--app-text-faint)]">{t("chatbot.noResult")}</p>
                  )
                ) : (
                  modules.map((m, mi) => (
                    <div key={m.id} className="space-y-2">
                      <SectionLabel icon={m.icon}>{m.label}</SectionLabel>
                      <Card>
                        {m.docs.map((d, di) => (
                          <Row key={d.title} label={d.title} onClick={() => setOuvert({ module: mi, doc: di })} />
                        ))}
                      </Card>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
