import { Bell, Eye, FileSearch, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";

type Feature = {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
};

function getFeatures(t: (key: string) => string): Feature[] {
  return [
    {
      icon: FileSearch,
      title: t("collectTitle"),
      description: t("collectDescription"),
    },
    {
      icon: Sparkles,
      title: t("aiTitle"),
      description: t("aiDescription"),
    },
    {
      icon: Bell,
      title: t("matchTitle"),
      description: t("matchDescription"),
    },
    {
      icon: Eye,
      title: t("transparencyTitle"),
      description: t("transparencyDescription"),
    },
  ];
}

export function FeaturesSection() {
  const t = useTranslations("LandingFeatures");
  const FEATURES = getFeatures(t);

  return (
    <section id="features" className="bg-white py-20 sm:py-24 border-t border-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            {t("heading")}
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-[15px] text-zinc-500 leading-relaxed">
            {t("subheading")}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 transition-all duration-200 hover:border-zinc-300 hover:shadow-sm"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <feature.icon size={24} />
              </div>
              <h3 className="text-[17px] font-bold text-zinc-900">{feature.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-zinc-500">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
