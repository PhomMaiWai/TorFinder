import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Reveal } from "@/components/ui/reveal";

/** Always dark, in both themes: a fixed zinc-950 stage for the rose glow. */
export function CtaSection() {
  const t = useTranslations("LandingCta");

  return (
    <section className="relative isolate overflow-hidden bg-zinc-950 px-6 py-20 sm:py-28">
      <div aria-hidden className="animate-blob absolute -left-24 top-0 -z-10 size-[28rem] rounded-full bg-accent/35 blur-[100px]" />
      <div
        aria-hidden
        className="animate-blob absolute -right-24 bottom-0 -z-10 size-[26rem] rounded-full bg-rose-400/25 blur-[100px] [animation-delay:-9s]"
      />

      <Reveal className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-14 text-center shadow-[0_1px_0_rgb(255_255_255/10%)_inset] backdrop-blur-xl sm:px-14">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("heading")}</h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-300">{t("description")}</p>
          <Link
            href="/signup/organization"
            className="group mt-9 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-8 text-sm font-bold text-zinc-900 shadow-[0_8px_30px_-6px_rgb(255_255_255/35%)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50"
          >
            {t("cta")}
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
