import { ArrowRight, Search, Zap } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { HeroFlow } from "@/components/landing/hero-flow";
import { HeroMockup } from "@/components/landing/hero-mockup";

/** Staggered load-in without JS: each line starts a beat after the last. */
const enter = (ms: number) => ({ animationDelay: `${ms}ms` });

export function HeroSection({ signedInHome }: { signedInHome: string | null }) {
  const t = useTranslations("LandingHero");

  return (
    <section className="aurora overflow-hidden bg-surface pb-20 pt-20 sm:pb-28 sm:pt-28">
      {/* Fine grid that fades out toward the edges */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]"
      />

      <HeroFlow />

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <div
          className="animate-fade-up glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-ink-muted"
          style={enter(0)}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/60" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          <Zap size={14} className="text-accent" />
          {t("badge")}
        </div>

        <h1
          className="animate-fade-up mt-7 text-5xl font-bold leading-[1.08] tracking-tight text-ink sm:text-6xl lg:text-7xl"
          style={enter(100)}
        >
          {t("titleLine1")}
          <br />
          <span className="bg-gradient-to-r from-accent via-rose-500 to-rose-400 bg-clip-text text-transparent">
            {t("titleLine2")}
          </span>
        </h1>

        <p
          className="animate-fade-up mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-muted"
          style={enter(220)}
        >
          {t("description")}
        </p>

        <div className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-3" style={enter(340)}>
          {/* New visitors sign up; signed-in ones go straight back to their work. */}
          <Link
            href={signedInHome ?? "/signup/organization"}
            className="group relative flex h-12 items-center gap-2 overflow-hidden rounded-xl bg-accent px-7 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-dark"
          >
            <span
              aria-hidden
              className="animate-shimmer absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/25"
            />
            <span className="relative">{signedInHome ? t("ctaDashboard") : t("ctaPrimary")}</span>
            <ArrowRight size={16} className="relative transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
          {/* Try it before committing: the public search needs no account. */}
          <Link
            href="/public"
            className="glass group flex h-12 items-center gap-2 rounded-xl px-7 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface/90"
          >
            <Search size={16} className="text-ink-muted transition-colors group-hover:text-accent" />
            {t("ctaSecondary")}
          </Link>
        </div>

        {!signedInHome && <p className="mt-4 text-xs text-ink-subtle">{t("ctaNote")}</p>}

        <div className="animate-fade-up" style={enter(480)}>
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
