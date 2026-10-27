import { useTranslations } from "next-intl";

import { Reveal } from "@/components/ui/reveal";

function getSteps(t: (key: string) => string) {
  return [
    { number: "01", title: t("step1Title"), description: t("step1Description") },
    { number: "02", title: t("step2Title"), description: t("step2Description") },
    { number: "03", title: t("step3Title"), description: t("step3Description") },
  ];
}

export function StepsSection() {
  const t = useTranslations("LandingSteps");
  const STEPS = getSteps(t);

  return (
    <section id="how-it-works" className="aurora border-t border-border/60 bg-surface-alt/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("heading")}</h2>
          <p className="mt-3 text-base text-ink-muted">{t("subheading")}</p>
        </Reveal>

        <div className="relative grid gap-6 sm:grid-cols-3">
          {/* Connector behind the number badges */}
          <div
            aria-hidden
            className="absolute left-[16.7%] right-[16.7%] top-6 hidden border-t-2 border-dashed border-accent/30 sm:block"
          />
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={i * 120}>
              <div className="glass group relative h-full rounded-2xl p-7 pt-10 text-center transition-all duration-300 hover:-translate-y-1">
                <span className="absolute left-1/2 top-0 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-accent-dark text-sm font-bold text-white shadow-glow ring-4 ring-surface-alt transition-transform duration-300 group-hover:scale-110">
                  {step.number}
                </span>
                <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
