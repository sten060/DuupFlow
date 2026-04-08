"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n/context";

type Message = { from: "bot" | "user"; text: string; options?: Option[] };
type Option = { label: string; action: string };

const TELEGRAM_URL = "https://t.me/DuupFlow_Support";

function buildTree(t: (k: string) => string): Record<string, { text: string; options: Option[] }> {
  return {
    start: {
      text: t("chatbot.start"),
      options: [
        { label: t("chatbot.opt.dupProblem"), action: "dup_problem" },
        { label: t("chatbot.opt.subscription"), action: "abo" },
        { label: t("chatbot.opt.howToUse"), action: "how_to" },
        { label: t("chatbot.opt.aiDetection"), action: "ai_detection" },
        { label: t("chatbot.opt.newFeatures"), action: "new_features" },
        { label: t("chatbot.opt.otherQuestion"), action: "other" },
      ],
    },
    dup_problem: {
      text: t("chatbot.dupProblem"),
      options: [
        { label: t("chatbot.opt.dupFails"), action: "dup_error" },
        { label: t("chatbot.opt.qualityDifferent"), action: "dup_quality" },
        { label: t("chatbot.opt.tooSlow"), action: "dup_slow" },
        { label: t("chatbot.opt.other"), action: "contact" },
      ],
    },
    dup_error: {
      text: t("chatbot.dupError"),
      options: [
        { label: t("chatbot.opt.resolved"), action: "resolved" },
        { label: t("chatbot.opt.stillNotWorking"), action: "contact" },
      ],
    },
    dup_quality: {
      text: t("chatbot.dupQuality"),
      options: [
        { label: t("chatbot.opt.resolved"), action: "resolved" },
        { label: t("chatbot.opt.otherIssue"), action: "contact" },
      ],
    },
    dup_slow: {
      text: t("chatbot.dupSlow"),
      options: [
        { label: t("chatbot.opt.okUnderstood"), action: "resolved" },
        { label: t("chatbot.opt.stillSlow"), action: "contact" },
      ],
    },
    abo: {
      text: t("chatbot.abo"),
      options: [
        { label: t("chatbot.opt.changePlan"), action: "abo_change" },
        { label: t("chatbot.opt.reachedLimit"), action: "abo_limit" },
        { label: t("chatbot.opt.paymentIssue"), action: "contact" },
      ],
    },
    abo_change: {
      text: t("chatbot.aboChange"),
      options: [
        { label: t("chatbot.opt.thanks"), action: "resolved" },
        { label: t("chatbot.opt.needHelp"), action: "contact" },
      ],
    },
    abo_limit: {
      text: t("chatbot.aboLimit"),
      options: [
        { label: t("chatbot.opt.okCheck"), action: "resolved" },
        { label: t("chatbot.opt.needHelp"), action: "contact" },
      ],
    },
    how_to: {
      text: t("chatbot.howTo"),
      options: [
        { label: t("chatbot.opt.clear"), action: "resolved" },
        { label: t("chatbot.opt.anotherQuestion"), action: "start" },
      ],
    },
    other: {
      text: t("chatbot.other"),
      options: [
        { label: t("chatbot.opt.contactSupport"), action: "contact" },
        { label: t("chatbot.opt.backToStart"), action: "start" },
      ],
    },
    contact: {
      text: t("chatbot.contact"),
      options: [
        { label: t("chatbot.opt.openTelegram"), action: "open_telegram" },
        { label: t("chatbot.opt.backToStart"), action: "start" },
      ],
    },
    ai_detection: {
      text: t("chatbot.aiDetection"),
      options: [
        { label: t("chatbot.opt.aiWhat"), action: "ai_what" },
        { label: t("chatbot.opt.aiVisual"), action: "ai_visual" },
        { label: t("chatbot.opt.aiPlatforms"), action: "ai_platforms" },
        { label: t("chatbot.opt.otherQuestion"), action: "contact" },
      ],
    },
    ai_what: {
      text: t("chatbot.aiWhat"),
      options: [
        { label: t("chatbot.opt.understood"), action: "resolved" },
        { label: t("chatbot.opt.aiVisualQ"), action: "ai_visual" },
      ],
    },
    ai_visual: {
      text: t("chatbot.aiVisual"),
      options: [
        { label: t("chatbot.opt.okUnderstood"), action: "resolved" },
        { label: t("chatbot.opt.otherQuestion"), action: "start" },
      ],
    },
    ai_platforms: {
      text: t("chatbot.aiPlatforms"),
      options: [
        { label: t("chatbot.opt.perfect"), action: "resolved" },
        { label: t("chatbot.opt.contactSupport"), action: "contact" },
      ],
    },
    new_features: {
      text: t("chatbot.newFeatures"),
      options: [
        { label: t("chatbot.opt.algoPriority"), action: "feat_iphone" },
        { label: t("chatbot.opt.pixelMagic"), action: "feat_pixel" },
        { label: t("chatbot.opt.metaTech"), action: "feat_meta_tech" },
        { label: t("chatbot.opt.comparator"), action: "feat_comparator" },
        { label: t("chatbot.opt.back"), action: "start" },
      ],
    },
    feat_iphone: {
      text: t("chatbot.featIphone"),
      options: [
        { label: t("chatbot.opt.great"), action: "resolved" },
        { label: t("chatbot.opt.otherFeature"), action: "new_features" },
      ],
    },
    feat_pixel: {
      text: t("chatbot.featPixel"),
      options: [
        { label: t("chatbot.opt.gotIt"), action: "resolved" },
        { label: t("chatbot.opt.otherFeature"), action: "new_features" },
      ],
    },
    feat_meta_tech: {
      text: t("chatbot.featMetaTech"),
      options: [
        { label: t("chatbot.opt.ok"), action: "resolved" },
        { label: t("chatbot.opt.otherFeature"), action: "new_features" },
      ],
    },
    feat_comparator: {
      text: t("chatbot.featComparator"),
      options: [
        { label: t("chatbot.opt.cool"), action: "resolved" },
        { label: t("chatbot.opt.otherFeature"), action: "new_features" },
      ],
    },
    resolved: {
      text: t("chatbot.resolved"),
      options: [
        { label: t("chatbot.opt.anotherQuestion"), action: "start" },
      ],
    },
  };
}

export default function ChatBot() {
  const { t } = useTranslation();
  const tree = buildTree(t);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { from: "bot", text: tree.start.text, options: tree.start.options },
  ]);

  const handleOption = useCallback((opt: Option) => {
    setMessages((prev) => [...prev, { from: "user", text: opt.label }]);

    if (opt.action === "open_telegram") {
      window.open(TELEGRAM_URL, "_blank");
      return;
    }

    const node = tree[opt.action];
    if (node) {
      setTimeout(() => {
        setMessages((prev) => [...prev, { from: "bot", text: node.text, options: node.options }]);
      }, 300);
    }
  }, [tree]);

  const handleReset = useCallback(() => {
    setMessages([{ from: "bot", text: tree.start.text, options: tree.start.options }]);
  }, [tree]);

  const panelSize = expanded ? "w-[32rem] h-[85vh]" : "w-80 max-h-[28rem]";

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-indigo-500/80 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center shadow-lg hover:bg-indigo-400/80 transition-all"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        )}
      </button>

      {open && (
        <div className={`fixed bottom-20 right-5 z-50 ${panelSize} rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.1] flex flex-col overflow-hidden shadow-2xl transition-all`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white/80">{t("chatbot.header")}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setExpanded(!expanded)} className="text-xs text-white/40 hover:text-white/70 transition" title={expanded ? t("chatbot.reduce") : t("chatbot.expand")}>
                {expanded ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                )}
              </button>
              <button onClick={handleReset} className="text-xs text-white/40 hover:text-white/70 transition">{t("chatbot.restart")}</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i}>
                <div className={["text-sm leading-relaxed rounded-xl px-4 py-3 max-w-[85%] whitespace-pre-line", msg.from === "bot" ? "bg-white/[0.06] text-white/80" : "bg-indigo-500/20 text-white/90 ml-auto"].join(" ")}>{msg.text}</div>
                {msg.options && i === messages.length - 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.options.map((opt) => (
                      <button key={opt.label} onClick={() => handleOption(opt)} className="text-xs rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-all">{opt.label}</button>
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
