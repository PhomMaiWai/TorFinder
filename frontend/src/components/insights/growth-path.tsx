"use client";

import { ArrowRight, Building2, Footprints, Info, Repeat, Sprout, Target, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentType, ReactNode } from "react";

import { useBahtCompact } from "@/components/dashboard/charts";
import type { GrowthAgency, GrowthJob, GrowthPath } from "@/types/insights";

/** One company holding more than this share of an agency's jobs this size: say so. */
const INCUMBENT_SHARE = 0.5;

const percent = (value: number) => `${Math.round(value * 100)}%`;

function useYearLabel() {
  const locale = useLocale();
  // Thai readers count years in the Buddhist era; the API speaks Christian era.
  return (year: number) => String(locale === "th" ? year + 543 : year);
}

function Step({
  icon: Icon,
  step,
  title,
  body,
  children,
}: {
  icon: ComponentType<{ size?: number }>;
  step: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <li className="glass animate-fade-up flex flex-col rounded-2xl p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon size={17} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">{step}</span>
      </div>
      <p className="mt-3 text-lg font-bold leading-snug text-ink">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{body}</p>
      {children}
    </li>
  );
}

function AgencyCard({ row }: { row: GrowthAgency }) {
  const t = useTranslations("GrowthPath");
  const baht = useBahtCompact();
  const yearLabel = useYearLabel();
  const incumbent = row.topWinner && row.topWinner.share > INCUMBENT_SHARE ? row.topWinner : null;

  return (
    <li className="rounded-xl border border-border/60 bg-surface/60 p-4">
      <p className="font-semibold text-ink">{row.agency}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-ink-subtle">{t("colJobs")}</dt>
          <dd className="font-semibold text-ink">{t("jobsValue", { count: row.rightSized, median: baht(row.medianSize) })}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">{t("colRivals")}</dt>
          <dd className="font-semibold text-ink">
            {row.withWinner === 0 ? t("rivalsUnknown") : t("rivalsValue", { count: row.rivals, named: row.withWinner })}
          </dd>
        </div>
        <div>
          <dt className="text-ink-subtle">{t("colYears")}</dt>
          <dd className="font-semibold text-ink">{row.years.map(yearLabel).join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">{t("colRehires")}</dt>
          <dd className="font-semibold text-ink">{row.rehires > 0 ? t("rehiresValue", { count: row.rehires }) : t("rehiresNone")}</dd>
        </div>
      </dl>
      {incumbent && (
        <p className="mt-2.5 rounded-lg bg-warn-soft px-2.5 py-1.5 text-xs text-warn">
          {t("incumbent", { vendor: incumbent.vendor, share: percent(incumbent.share) })}
        </p>
      )}
    </li>
  );
}

function JobList({ jobs, empty }: { jobs: GrowthJob[]; empty: string }) {
  const t = useTranslations("GrowthPath");
  const baht = useBahtCompact();
  if (jobs.length === 0) return <p className="py-6 text-center text-sm text-ink-muted">{empty}</p>;

  return (
    <ul className="divide-y divide-border/50">
      {jobs.map((job) => (
        <li key={job.id}>
          <Link
            href={`/tor/${job.id}?in=app`}
            className="group flex items-start gap-3 rounded-lg px-1 py-3 transition-colors hover:bg-surface-alt/60"
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium text-ink group-hover:text-accent-text">{job.title}</p>
              <p className="mt-0.5 truncate text-xs text-ink-muted">{job.agency}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-surface-alt px-2 py-0.5 font-semibold text-ink">{baht(job.budgetAmount)}</span>
                <span className="rounded-full bg-surface-alt px-2 py-0.5 text-ink-muted">{t("matchValue", { match: job.match })}</span>
                {job.status === "open" && (
                  <span className="rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">{t("statusOpen")}</span>
                )}
                {job.atRecommendedAgency && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent-text">
                    {t("recommendedAgency")}
                  </span>
                )}
              </div>
            </div>
            <ArrowRight size={15} className="mt-1 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Panel({
  id,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  id: string;
  icon: ComponentType<{ size?: number }>;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="glass animate-fade-up rounded-2xl p-5 sm:p-6">
      <header className="mb-3 flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon size={17} />
        </span>
        <div>
          <h2 id={id} className="text-sm font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export function GrowthPathView({ data }: { data: GrowthPath | null }) {
  const t = useTranslations("GrowthPath");
  const baht = useBahtCompact();

  const header = (
    <section className="glass-strong animate-fade-up rounded-3xl p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">{t("eyebrow")}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t("title")}</h1>
      <p className="mt-2 max-w-3xl text-sm text-ink-muted">{t("subtitle")}</p>
    </section>
  );

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
        {header}
        <div className="glass mx-auto mt-6 max-w-lg rounded-3xl px-6 py-14 text-center">
          <Sprout size={28} className="mx-auto mb-3 text-ink-subtle" />
          <p className="text-base font-semibold text-ink">{t("noProfileTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("noProfileBody")}</p>
          <Link
            href="/profile"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            {t("noProfileCta")} <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  const cap = baht(data.cap);
  const nextCap = baht(data.nextCap);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
      {header}

      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        <Step icon={Target} step={t("step1")} title={t("step1Title", { cap })} body={t(`capSource_${data.capSource}`, { cap })}>
          {data.capSource !== "pastContract" && (
            <Link href="/profile" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-text hover:underline">
              {t("addPastContract")} <ArrowRight size={13} />
            </Link>
          )}
        </Step>
        <Step icon={TrendingUp} step={t("step2")} title={t("step2Title", { cap, nextCap })} body={t("step2Body")} />
        <Step icon={Repeat} step={t("step3")} title={t("step3Title")} body={t("step3Body")} />
      </ol>

      <div className="mt-6">
        <Panel
          id="growth-agencies"
          icon={Building2}
          title={t("agenciesTitle", { cap })}
          subtitle={t("agenciesSubtitle", { projects: data.basis.projects })}
        >
          {data.agencies.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">{t("agenciesEmpty", { cap })}</p>
          ) : (
            <ol className="grid gap-3 lg:grid-cols-2">
              {data.agencies.map((row) => (
                <AgencyCard key={row.agency} row={row} />
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel id="growth-now" icon={Footprints} title={t("nowTitle", { cap })} subtitle={t("nowSubtitle")}>
          <JobList jobs={data.jobs.now} empty={t("jobsEmpty")} />
        </Panel>
        <Panel id="growth-next" icon={Users} title={t("nextTitle", { cap, nextCap })} subtitle={t("nextSubtitle")}>
          <JobList jobs={data.jobs.next} empty={t("jobsEmpty")} />
        </Panel>
      </div>

      <aside className="mt-6 rounded-2xl border border-border/60 bg-surface/60 p-5 text-xs leading-relaxed text-ink-muted">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
          <Info size={14} /> {t("limitsTitle")}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("limitWinners")}</li>
          <li>{t("limitSize")}</li>
          <li>{t("limitRules")}</li>
        </ul>
      </aside>
    </div>
  );
}
