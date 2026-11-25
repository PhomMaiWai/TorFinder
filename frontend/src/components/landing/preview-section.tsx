"use client";

import { ArrowRight, Building2, Clock, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";

import type { PreviewTor } from "@/lib/landing-data";
import { valueLabel } from "@/lib/value-labels";

/** Cards shown at once; the search narrows a larger pool of open announcements (getLandingData). */
const SHOWN = 4;

/**
 * Real announcements still open for bids or comment, newest first, searchable
 * in place; the full search is one click away with the same words.
 */
export function PreviewSection({ tors }: { tors: PreviewTor[] }) {
  const t = useTranslations("LandingPreview");
  const tv = useTranslations("Values");
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return tors
      .filter((tor) => {
        const text = `${tor.title} ${tor.agency} ${tor.tags.join(" ")}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .slice(0, SHOWN);
  }, [search, tors]);

  const searchAllHref = search.trim() ? `/public?q=${encodeURIComponent(search.trim())}` : "/public";

  return (
    <section id="preview" className="aurora bg-surface-alt/60 py-24 sm:py-32">
      <div className="mx-auto max-w-[1000px] px-6">
        <div className="mb-10 text-center sm:mb-14">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {t("heading")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted">
            {t("description")}
          </p>
        </div>

        {/* Mini Public Search Interface */}
        <div className="glass rounded-2xl p-2 transition-shadow focus-within:shadow-[0_0_0_3px_rgb(225_29_72/18%)] sm:p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <Search size={20} className="shrink-0 text-ink-subtle" />
            <input
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-subtle"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
            />
            <Link
              href={searchAllHref}
              className="hidden h-10 shrink-0 items-center justify-center rounded-lg bg-ink px-5 text-sm font-semibold text-surface transition-colors hover:bg-ink/90 sm:flex"
            >
              {t("searchAll")}
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((tor) => {
            const isFeedbackStage = tor.stage === "เปิดรับฟังความคิดเห็น";
            const isUrgent = tor.daysLeft <= 7;

            return (
              <article
                key={tor.id}
                className="glass group flex flex-col justify-between rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_16px_40px_-12px_rgb(225_29_72/22%)]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-2xs font-semibold tracking-wide ${
                        isFeedbackStage
                          ? "bg-amber-50 text-amber-700"
                          : "bg-accent-soft text-accent"
                      }`}
                    >
                      {valueLabel(tv, "stage", tor.stage)}
                    </span>
                    {isUrgent && (
                      <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-2xs font-semibold text-red-600">
                        <div className="size-1.5 animate-pulse rounded-full bg-red-500" />
                        {t("closingSoon")}
                      </span>
                    )}
                  </div>

                  <Link href={`/tor/${tor.id}`} className="mt-3 block group-hover:cursor-pointer">
                    <h3 className="text-lg font-semibold leading-tight text-ink transition-colors group-hover:text-accent">
                      {tor.title}
                    </h3>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
                      <span className="flex items-center gap-1.5">
                        <Building2 size={15} className="text-ink-subtle" />
                        {tor.agency}
                      </span>
                      <span className="font-medium text-ink-muted">{tor.budget}</span>
                      <span
                        className={`flex items-center gap-1.5 ${
                          isUrgent ? "font-medium text-red-600" : ""
                        }`}
                      >
                        <Clock size={15} className={isUrgent ? "text-red-500" : "text-ink-subtle"} />
                        {t("daysLeft", { count: tor.daysLeft })}
                      </span>
                    </div>

                    <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                      {tor.summary}
                    </p>
                  </Link>
                </div>

                <div className="mt-5 flex justify-end border-t border-border pt-5">
                  <Link
                    href={`/tor/${tor.id}`}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-surface transition-colors hover:bg-ink/90"
                  >
                    {t("viewDetails")}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
            <p className="text-base font-medium text-ink-muted">{t("noResults")}</p>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/public"
            className="glass inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-base font-medium text-ink-muted transition-all hover:-translate-y-0.5 hover:text-ink"
          >
            {t("viewPublicPortal")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
