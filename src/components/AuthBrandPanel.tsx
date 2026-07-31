"use client";

// Shared right-hand branding panel used by the register + onboarding screens
// so both stay visually identical. Slightly rounded/bordered "floating" card
// (hidden below lg).

import { useTranslation } from "@/lib/i18n/context";

export default function AuthBrandPanel() {
  const { t } = useTranslation();

  const FEATURES = [
    { icon: "∞", title: t("register.feature1Title"), desc: t("register.feature1Desc") },
    { icon: "\u{1F6E1}️", title: t("register.feature2Title"), desc: t("register.feature2Desc") },
    { icon: "⚡", title: t("register.feature3Title"), desc: t("register.feature3Desc") },
  ];

  return (
    <div
      className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden lg:m-4 rounded-3xl border border-white/[0.14]"
      style={{
        background: "linear-gradient(150deg, #4f7bff 0%, #6a68ff 48%, #8a5cff 100%)",
      }}
    >
      {/* Grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      {/* Glow */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at top right, rgba(255,255,255,0.20) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-0 left-0 w-[400px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at bottom left, rgba(147,201,255,0.22) 0%, transparent 70%)" }}
      />

      {/* Content */}
      <div className="relative z-10">
        <h2 className="text-4xl font-bold text-white leading-[1.1] mb-4">
          {t("register.panelTitle")}<br />{t("register.panelTitleLine2")}
        </h2>
        <p className="text-white/50 text-base max-w-sm">
          {t("register.panelSubtitle")}
        </p>
      </div>

      <div className="relative z-10 space-y-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="flex items-start gap-4 rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.28)" }}
            >
              {f.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">{f.title}</p>
              <p className="text-xs text-white/45 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Social proof */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex -space-x-2">
          {["#6366F1", "#8B5CF6", "#EC4899", "#38BDF8"].map((c, i) => (
            <div
              key={i}
              className="h-8 w-8 rounded-full border-2 border-[#5f6bff] flex items-center justify-center text-xs font-bold text-white"
              style={{ background: c }}
            >
              {["A", "M", "S", "L"][i]}
            </div>
          ))}
        </div>
        <p className="text-xs text-white/45">
          {t("register.socialProof")}
        </p>
      </div>
    </div>
  );
}
