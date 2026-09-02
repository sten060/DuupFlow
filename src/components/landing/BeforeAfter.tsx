"use client";

import { useParams } from "next/navigation";
import { BLUE, CTA_GRAD, Brand, Label, SECTION_LEAD, SECTION_TITLE, SECTION_TITLE_STYLE } from "@/components/landing/shell";

/* ─────────────────────────────────────────────────────────────
 * BEFORE / AFTER — source de vérité unique des chiffres comparés.
 * Éditer ici, jamais dans le JSX plus bas.
 *   before  = montage manuel      |  after = avec DuupFlow
 *   gain    = badge court affiché sur la colonne DuupFlow (optionnel)
 * ───────────────────────────────────────────────────────────── */
export const BEFORE_AFTER = {
  rows: [
    {
      key: "edit",
      fr: { label: "Monter une vidéo", before: "45 min", beforeNote: "coupes, sous-titres, export", after: "3 min", afterNote: "une version montée par l'IA", gain: "15× plus rapide" },
      en: { label: "Edit one video", before: "45 min", beforeNote: "cuts, captions, export", after: "3 min", afterNote: "one version edited by the AI", gain: "15× faster" },
    },
    {
      key: "variants",
      fr: { label: "10 variantes", before: "4 h", beforeNote: "10 exports refaits à la main", after: "2 min", afterNote: "10 fichiers uniques d'un coup", gain: "120× plus rapide" },
      en: { label: "10 variants", before: "4 h", beforeNote: "10 exports redone by hand", after: "2 min", afterNote: "10 unique files at once", gain: "120× faster" },
    },
    {
      key: "cost",
      fr: { label: "Coût par vidéo", before: "100 €", beforeNote: "monteur freelance", after: "Inclus", afterNote: "dans ton abonnement", gain: "0 € de plus" },
      en: { label: "Cost per video", before: "€100", beforeNote: "freelance editor", after: "Included", afterNote: "in your plan", gain: "no extra cost" },
    },
  ],
} as const;

function useLocale(): "fr" | "en" {
  const params = useParams();
  const l = Array.isArray(params?.locale) ? params?.locale[0] : params?.locale;
  return l === "en" ? "en" : "fr";
}

/* Une ligne comparée : ✕ neutre à gauche, ✓ de marque à droite. */
function CompareRow({ label, value, note, gain, accent }: { label: string; value: string; note: string; gain?: string; accent?: boolean }) {
  return (
    <li className="flex items-start gap-3.5">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${accent ? "text-white" : "bg-black/[0.05] text-[#9aa0ad]"}`}
        style={accent ? { background: CTA_GRAD } : undefined}
      >
        {accent ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className={`text-[17px] leading-snug ${accent ? "text-[#1a1a1a]" : "text-[#605f5f]"}`}>{label}</span>
          <span
            className="text-[22px] font-semibold tracking-[-0.02em]"
            style={accent
              ? { backgroundImage: CTA_GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }
              : { color: "#9aa0ad" }}
          >
            {value}
          </span>
          {accent && gain && (
            <span className="inline-flex items-center rounded-full bg-[#4686FE]/10 px-2 py-0.5 text-[11px] font-semibold" style={{ color: BLUE }}>
              {gain}
            </span>
          )}
        </span>
        <span className={`mt-1 block text-[14px] leading-relaxed ${accent ? "text-[#605f5f]" : "text-[#a3a8b4]"}`}>{note}</span>
      </span>
    </li>
  );
}

export default function BeforeAfter() {
  const loc = useLocale();
  return (
    <section id="before-after" className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Label icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7h13M8 12h13M3 7h.01M3 12h.01M3 17h.01M8 17h13" /></svg>}>
            {loc === "en" ? "Before / after" : "Avant / après"}
          </Label>
          <h2 className={`mx-auto mt-7 max-w-2xl ${SECTION_TITLE}`} style={SECTION_TITLE_STYLE}>
            {loc === "en" ? "Before vs after DuupFlow" : "Avant vs après DuupFlow"}
          </h2>
          <p className={`mx-auto mt-4 max-w-xl ${SECTION_LEAD}`}>
            {loc === "en" ? "The same content, minus the hours." : "Le même contenu, sans les heures passées dessus."}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Colonne neutre — montage manuel */}
          <div className="rounded-[28px] bg-white p-7 ring-1 ring-black/[0.06] shadow-[0_14px_40px_rgba(20,40,90,0.06)] sm:p-9">
            <div className="relative">
              <p className="text-[17px] font-semibold text-[#8a8a8a]">
                {loc === "en" ? "Manual editing" : "Montage manuel"}
              </p>
              <ul className="mt-8 space-y-6">
                {BEFORE_AFTER.rows.map((r) => {
                  const c = r[loc];
                  return <CompareRow key={r.key} label={c.label} value={c.before} note={c.beforeNote} />;
                })}
              </ul>
            </div>
          </div>

          {/* Colonne accent — DuupFlow */}
          <div className="rounded-[28px] bg-white p-7 ring-2 ring-[#4f7bff]/35 shadow-[0_18px_50px_rgba(90,90,240,0.16)] sm:p-9">
            <div className="relative">
              <p className="flex items-baseline gap-2 text-[17px] font-semibold text-[#8a8a8a]">
                {loc === "en" ? "With" : "Avec"}
                <Brand className="text-[17px] font-semibold tracking-[-0.02em] text-[#1a1a1a]" />
              </p>
              <ul className="mt-8 space-y-6">
                {BEFORE_AFTER.rows.map((r) => {
                  const c = r[loc];
                  return <CompareRow key={r.key} label={c.label} value={c.after} note={c.afterNote} gain={c.gain} accent />;
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
