import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function CtaSection() {
  const t = useTranslations("LandingCta");

  return (
    <section className="bg-zinc-900 py-20 sm:py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {t("heading")}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink-subtle">
          {t("description")}
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-7 text-sm font-bold text-ink transition-colors hover:bg-surface-alt"
        >
          {t("cta")}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
