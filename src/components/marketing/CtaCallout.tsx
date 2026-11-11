// Encadré d'appel à l'action DuupFlow, inséré dans les articles de blog et les
// pages « alternative » (thème clair Lunera). Bien visible : fond teinté au
// dégradé de marque, logo, accroche en gras, bouton vers l'inscription.

import Link from "@/components/LocaleLink";

const CTA_GRAD = "linear-gradient(135deg,#4f7bff 0%,#7c5cff 100%)";

export default function CtaCallout({
  title,
  text,
  button,
  href = "/register",
  className = "",
}: {
  /** Accroche en gras (peut être vide). */
  title?: string;
  text?: string;
  button: string;
  href?: string;
  className?: string;
}) {
  return (
    <aside
      className={`not-prose relative overflow-hidden rounded-3xl p-6 ring-1 ring-[#4f7bff]/20 shadow-[0_18px_44px_rgba(79,123,255,0.14)] sm:p-8 ${className}`}
      style={{ background: "linear-gradient(135deg, rgba(79,123,255,0.09) 0%, rgba(124,92,255,0.12) 100%), #ffffff" }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl" style={{ background: CTA_GRAD }} />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex gap-4">
          <img src="/logo-mark.png" alt="" className="mt-0.5 h-9 w-9 shrink-0 object-contain" />
          <p className="text-[15px] leading-relaxed text-[#3f4453] md:text-base">
            {title && <strong className="font-bold text-[#1a1a1a]">{title}</strong>}
            {title && text ? " " : null}
            {text}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full px-6 py-3 text-[15px] font-semibold text-white shadow-[0_12px_30px_rgba(90,90,240,0.35)] transition hover:opacity-90 sm:self-center"
          style={{ background: CTA_GRAD }}
        >
          {button}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </aside>
  );
}
