import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function HeroSection() {
  const t = useTranslations("LandingHero");

  return (
    <section className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-4 py-1.5 text-sm font-medium text-ink-muted">
          <Zap size={14} className="text-accent" />
          {t("badge")}
        </div>

        <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight text-ink sm:text-6xl lg:text-7xl">
          {t("titleLine1")}
          <br />
          <span className="text-accent">{t("titleLine2")}</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
          {t("description")}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-11 items-center gap-2 rounded-lg bg-accent px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark"
          >
            {t("ctaPrimary")}
            <ArrowRight size={16} />
          </Link>
          <Link
            href="#preview"
            className="flex h-11 items-center rounded-lg border border-border px-6 text-sm font-semibold text-ink transition-colors hover:bg-surface-alt"
          >
            {t("ctaSecondary")}
          </Link>
        </div>

        {/* <p className="mt-5 text-sm text-ink-subtle">
          ✓ No credit card required &nbsp;·&nbsp; ✓ Start using immediately
        </p> */}
      </div>
    </section>
  );
}
