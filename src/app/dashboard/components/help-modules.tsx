"use client";

// Le centre d'aide partagé (helpCenterContent.ts) mis en forme pour le
// chatbot : une page d'aide = un « module », chaque section = un article.
// C'est la même source que le site et que le bouton « Documentation » des
// modules : corriger une page d'aide corrige aussi le chatbot.

import type { ReactNode } from "react";
import { HELP_CATEGORIES, HELP_DOCS } from "@/components/marketing/helpCenterContent";
import type { Block } from "@/components/marketing/apiDocsContent";
import { HelpBlocks } from "./ModuleHelp";

/** `text` : texte brut indexé par la recherche du chatbot (le corps, lui,
 *  est un composant dont le texte n'est pas lisible depuis ses props). */
export type DocEntry = { title: string; body: ReactNode; text?: string };
export type DocModule = { id: string; label: string; icon: ReactNode; docs: DocEntry[] };

const plain = (t: string) => t.replace(/\*\*|`/g, "");
function blocksText(blocks: Block[]): string {
  return blocks.map((b) => {
    switch (b.type) {
      case "p": case "callout": return plain(b.text);
      case "list": case "steps": return b.items.map(plain).join(" ");
      case "table": return [b.head, ...b.rows].flat().map(plain).join(" ");
      case "code": return b.code;
      default: return "";
    }
  }).join(" ");
}

export function buildSharedHelpModules(lang: "fr" | "en"): DocModule[] {
  return HELP_DOCS.map((d) => {
    const cat = HELP_CATEGORIES.find((c) => c.id === d.category);
    const faq = d.faq[lang];
    return {
      id: d.slug,
      label: d.title[lang],
      icon: <span aria-hidden className="text-[13px] leading-none">{cat?.emoji ?? "📄"}</span>,
      docs: [
        ...d.sections[lang].map((s) => ({ title: s.title, text: blocksText(s.blocks), body: <HelpBlocks blocks={s.blocks} /> })),
        ...(faq.length
          ? [{
              title: lang === "fr" ? "Questions fréquentes" : "FAQ",
              text: faq.map((f) => `${f.q} ${plain(f.a)}`).join(" "),
              body: (
                <div className="space-y-3">
                  {faq.map((f, i) => (
                    <div key={i}>
                      <p className="text-[13.5px] font-semibold text-[var(--app-text)]">{f.q}</p>
                      <HelpBlocks blocks={[{ type: "p", text: f.a }]} />
                    </div>
                  ))}
                </div>
              ),
            }]
          : []),
      ],
    };
  });
}
