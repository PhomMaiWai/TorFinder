import { Bell, Eye, FileSearch, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";

import { Reveal } from "@/components/ui/reveal";

type Feature = {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  /** Bento width on lg screens (of 6 columns). */
  span: string;
};

function getFeatures(t: (key: string) => string): Feature[] {
  return [
    { icon: FileSearch, title: t("collectTitle"), description: t("collectDescription"), span: "lg:col-span-4" },
    { icon: Sparkles, title: t("aiTitle"), description: t("aiDescription"), span: "lg:col-span-2" },
    { icon: Bell, title: t("matchTitle"), description: t("matchDescription"), span: "lg:col-span-2" },
    { icon: Eye, title: t("transparencyTitle"), description: t("transparencyDescription"), span: "lg:col-span-4" },
  ];
}

export function FeaturesSection() {
  const t = useTranslations("LandingFeatures");
  const FEATURES = getFeatures(t);

  return (
    <section id="features" className="aurora bg-surface py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("heading")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">{t("subheading")}</p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 90} className={feature.span}>
              <div className="glass group relative h-full overflow-hidden rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_16px_40px_-12px_rgb(225_29_72/25%)]">
                <div
                  aria-hidden
                  className="absolute -right-10 -top-10 size-40 rounded-full bg-accent/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                />
                <div className="relative mb-6 flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent ring-1 ring-accent/15 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  <feature.icon size={24} />
                </div>
                <h3 className="relative text-lg font-bold text-ink">{feature.title}</h3>
                <p className="relative mt-2.5 max-w-lg text-sm leading-relaxed text-ink-muted">{feature.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
