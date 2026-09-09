import { useTranslations } from "next-intl";

function getSteps(t: (key: string) => string) {
  return [
    {
      number: "01",
      title: t("step1Title"),
      description: t("step1Description"),
    },
    {
      number: "02",
      title: t("step2Title"),
      description: t("step2Description"),
    },
    {
      number: "03",
      title: t("step3Title"),
      description: t("step3Description"),
    },
  ];
}

export function StepsSection() {
  const t = useTranslations("LandingSteps");
  const STEPS = getSteps(t);

  return (
    <section id="how-it-works" className="bg-surface-alt py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {t("heading")}
          </h2>
          <p className="mt-3 text-base text-ink-muted">
            {t("subheading")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="rounded-xl border border-border bg-white p-6"
            >
              <p className="mb-4 text-5xl font-black tracking-tighter text-border">
                {step.number}
              </p>
              <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
