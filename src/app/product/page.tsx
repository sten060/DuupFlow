"use client";
// src/app/product/page.tsx

import "@/app/globals.css";
import Link from "next/link";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import { useTranslation } from "@/lib/i18n/context";

function Plan({
  title,
  price,
  tagline,
  features,
  cta,
}: {
  title: string;
  price: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string };
}) {
  const { t } = useTranslation();
  return (
    <div className="card-soft relative">
      <div className="text-white/70 text-sm mb-2">{tagline}</div>
      <h3 className="text-2xl font-semibold">{title}</h3>
      <div className="mt-2 text-3xl font-semibold">{price}<span className="text-base font-normal">{t("common.perMonth")}</span></div>

      <ul className="mt-4 space-y-2 text-white/85">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="neon-icon-pink mt-1">
              <svg width="18" height="18" viewBox="0 0 20 20"><path fill="currentColor" d="m8 13l-3-3l1.4-1.4L8 10.2l4.6-4.6L14 7z"/></svg>
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={cta.href}
        className="mt-6 inline-flex btn-primary-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500"
      >
        {cta.label}
      </Link>
    </div>
  );
}

function ModuleCard({ title, color, lines }: { title: string; color: "pink"|"blue"|"green"|"mix"; lines: string[] }) {
  const gradient =
    color === "pink" ? "from-fuchsia-500 to-pink-500" :
    color === "blue" ? "from-indigo-400 to-blue-500" :
    color === "green" ? "from-emerald-400 to-teal-400" :
    "from-fuchsia-500 via-purple-500 to-indigo-500";

  return (
    <article className="card-soft">
      <h3 className={`text-2xl md:text-3xl mb-3 bg-gradient-to-r ${gradient} bg-clip-text text-transparent text-shadow`}>
        {title}
      </h3>
      <ul className="space-y-2 text-white/80">
        {lines.map((l, i) => <li key={i}>• {l}</li>)}
      </ul>
    </article>
  );
}

export default function ProductPage() {
  const { t } = useTranslation();

  return (
    <main className="text-white">
      {/* Plans */}
      <section className="container-zeno pt-14">
        <h1 className="h1 text-center mb-2">{t("product.twoPlansTitle")}</h1>
        <p className="lead text-center mb-8">{t("product.twoPlansSubtitle")}</p>

        <div className="grid md:grid-cols-2 gap-6">
          <Plan
            title="Starter"
            price="100€"
            tagline={t("product.starterTagline")}
            features={[
              t("product.starterFeature1"),
              t("product.starterFeature2"),
              t("product.starterFeature3"),
              t("product.starterFeature4"),
              t("product.starterFeature5"),
            ]}
            cta={{ label: t("product.chooseStarter"), href: "/register" }}
          />
          <Plan
            title="Pro"
            price="189€"
            tagline={t("tarifs.mostPopular")}
            features={[
              t("product.proFeature1"),
              t("product.proFeature2"),
              t("product.proFeature3"),
              t("product.proFeature4"),
              t("product.proFeature5"),
            ]}
            cta={{ label: t("product.choosePro"), href: "/register" }}
          />
        </div>

        {/* garanties / rassurance */}
        <div className="grid sm:grid-cols-4 gap-4 mt-6">
          {[
            [t("product.guarantee1")],
            [t("product.guarantee2")],
            [t("product.guarantee3")],
            [t("product.guarantee4")],
          ].map(([txt], i) => (
            <div key={i} className="card-soft flex items-center gap-2 py-3">
              <span className="neon-icon-pink">
                <svg width="18" height="18" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="currentColor" /></svg>
              </span>
              <span className="text-white/80 text-sm">{txt}</span>
            </div>
          ))}
        </div>

        <p className="text-white/70 text-center mt-6">
          {t("product.afterPurchase")}
        </p>
      </section>

      <hr className="divider" />

      {/* Modules inclus */}
      <section className="container-zeno">
        <h2 className="h2 text-center mb-6">{t("product.modulesTitle")}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ModuleCard
            title={t("demo.module1Title")}
            color="pink"
            lines={[
              t("product.imageModule1"),
              t("product.imageModule2"),
              t("product.imageModule3"),
            ]}
          />
          <ModuleCard
            title={t("demo.module2Title")}
            color="blue"
            lines={[
              t("product.videoModule1"),
              t("product.videoModule2"),
              t("product.videoModule3"),
            ]}
          />
          <ModuleCard
            title={t("demo.module3Title")}
            color="green"
            lines={[
              t("product.comparatorModule1"),
              t("product.comparatorModule2"),
              t("product.comparatorModule3"),
            ]}
          />
          <ModuleCard
            title={t("product.aiGenerationTitle")}
            color="mix"
            lines={[
              t("product.aiModule1"),
              t("product.aiModule2"),
              t("product.aiModule3"),
            ]}
          />
        </div>

        <p className="text-white/70 mt-8">
          {t("product.modulesDescription")}
        </p>
      </section>

      <hr className="divider" />

      {/* Avis + FAQ */}
      <section className="container-zeno">
        <Testimonials />
      </section>

      <hr className="divider" />

      <section className="container-zeno pb-16">
        <h2 className="h2 mb-6 text-center">{t("faq.badge")}</h2>
        <FAQ
          items={[
            { q: t("product.faq1Q"), a: t("product.faq1A") },
            { q: t("product.faq2Q"), a: t("product.faq2A") },
            { q: t("product.faq3Q"), a: t("product.faq3A") },
            { q: t("product.faq4Q"), a: t("product.faq4A") },
          ]}
        />
      </section>
    </main>
  );
}