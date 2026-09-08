import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Banknote,
  Bookmark,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ListChecks,
  MessageSquare,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { OPPORTUNITIES } from "@/data/opportunities";
import { TOR_DETAILS } from "@/data/tor-details";

export function generateStaticParams() {
  return OPPORTUNITIES.map((opp) => ({ id: String(opp.id) }));
}

export default async function TorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opportunity = OPPORTUNITIES.find((opp) => opp.id === Number(id));
  const detail = TOR_DETAILS.find((d) => d.id === Number(id));

  if (!opportunity || !detail) notFound();

  const t = await getTranslations("TorDetailPage");
  const isPublished = opportunity.stage === "ประกาศ TOR";
  const isFeedbackOpen = !!detail.feedbackDeadline;
  const isUrgent = opportunity.daysLeft <= 7;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <SiteNavbar />

      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
          <Link
            href="/public"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ArrowLeft size={16} />
            {t("backToSearch")}
          </Link>

          <div className="mb-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                  isPublished ? "bg-accent-soft text-accent" : "bg-amber-50 text-amber-700"
                }`}
              >
                {opportunity.stage}
              </span>
              {isFeedbackOpen && (
                <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                  <span className="size-1.5 animate-pulse rounded-full bg-green-500" />
                  {t("feedbackOpenUntil", { date: detail.feedbackDeadline ?? "" })}
                </span>
              )}
              {isUrgent && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                  <div className="size-1.5 animate-pulse rounded-full bg-red-500" />
                  {t("urgentBadge")}
                </span>
              )}
              {opportunity.isNew && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                  {t("newBadge")}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold leading-snug tracking-tight text-zinc-950 sm:text-[28px]">
                  {opportunity.title}
                </h1>
                <p className="mt-2.5 flex items-center gap-1.5 text-[15px] text-zinc-500">
                  <Building2 size={16} className="text-zinc-400" />
                  {opportunity.agency}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50">
                  <Bookmark size={15} />
                  <span className="hidden sm:inline">{t("saveButton")}</span>
                </button>
                <a
                  href={detail.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark"
                >
                  <ExternalLink size={15} />
                  {t("viewOriginalEgp")}
                </a>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-white">
                  <Sparkles size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-accent-text">
                    {t("aiAnalyzedBy")}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t("aiExtractedFrom")}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-zinc-900">
                  <FileText size={18} className="text-zinc-400" />
                  {t("scopeOfWork")}
                </h2>
                <p className="text-[15px] leading-relaxed text-zinc-600">{detail.scope}</p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900">
                  <Shield size={18} className="text-zinc-400" />
                  {t("qualifications")}
                </h2>
                <ul className="space-y-3">
                  {detail.qualifications.map((q) => (
                    <li key={q} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-zinc-600">
                      <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                      {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900">
                  <ListChecks size={18} className="text-zinc-400" />
                  {t("deliverables")}
                </h2>
                <ol className="space-y-2.5">
                  {detail.deliverables.map((d, i) => (
                    <li key={d} className="flex items-center gap-3 text-[15px] text-zinc-600">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                        {i + 1}
                      </span>
                      {d}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-bold text-zinc-900">{t("relatedTechnologies")}</h2>
                <div className="flex flex-wrap gap-2">
                  {opportunity.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {isFeedbackOpen && (
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-zinc-900">
                    <MessageSquare size={18} className="text-zinc-400" />
                    {t("shareFeedback")}
                  </h2>
                  <p className="mb-4 text-sm text-zinc-500">
                    {t("feedbackWindowInfo", {
                      date: detail.feedbackDeadline ?? "",
                      count: detail.feedbackCount,
                    })}
                  </p>
                  <textarea
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3.5 text-sm text-zinc-800 shadow-sm outline-none placeholder:text-zinc-400 focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
                    rows={4}
                    placeholder={t("feedbackTextareaPlaceholder")}
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-xs text-zinc-500">
                      {t("feedbackModerationNote")}
                    </p>
                    <button className="h-9 shrink-0 rounded-lg bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark">
                      {t("submitFeedbackButton")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              {detail.awardedVendor && (
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-100 bg-zinc-50/50 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                      <Award size={16} className="text-zinc-400" />
                      {t("awardedVendorTitle")}
                    </h3>
                  </div>
                  <div className="p-4">
                    <p className="text-[15px] font-semibold text-zinc-900">
                      {detail.awardedVendor.name}
                    </p>
                    
                    {detail.awardedVendor.status === "warning" && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
                          <div>
                            <p className="text-[13px] font-bold text-red-700">
                              Capability Match: {detail.awardedVendor.matchScore}%
                            </p>
                            <p className="mt-1 text-[12px] font-medium text-red-600">
                              {t("vendorRiskWarning")}
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {detail.awardedVendor.mismatchReasons.map((reason) => (
                                <li key={reason} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-red-600/90">
                                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-red-400" />
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-zinc-100 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
                    <Banknote size={18} />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-zinc-500">{t("budgetLabel")}</p>
                    <p className="text-base font-bold text-zinc-900">{opportunity.budget}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-b border-zinc-100 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
                    <Clock size={18} />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-zinc-500">{t("deadlineLabel")}</p>
                    <p
                      className={`text-base font-bold ${isUrgent ? "text-red-600" : "text-zinc-900"}`}
                    >
                      {opportunity.deadline}
                    </p>
                    <p className={`text-xs ${isUrgent ? "text-red-500" : "text-zinc-500"}`}>
                      {t("daysLeftLabel", { days: opportunity.daysLeft })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-b border-zinc-100 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
                    <Calendar size={18} />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-zinc-500">{t("contractPeriodLabel")}</p>
                    <p className="text-base font-bold text-zinc-900">{detail.contractPeriod}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
                    <Users size={18} />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-zinc-500">{t("matchedCompaniesLabel")}</p>
                    <p className="text-base font-bold text-zinc-900">
                      {t("companiesCount", { count: detail.matchedCompaniesCount })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900">{t("priceBenchmarkTitle")}</h3>
                  {detail.budgetStatus === "สูงกว่าปกติ" && (
                    <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 border border-red-100">
                      <TrendingUp size={12} />
                      {t("budgetHighBadge")}
                    </span>
                  )}
                  {detail.budgetStatus === "ต่ำกว่าปกติ" && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 border border-amber-100">
                      <TrendingDown size={12} />
                      {t("budgetLowBadge")}
                    </span>
                  )}
                  {detail.budgetStatus === "ปกติ" && (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700 border border-green-100">
                      <CheckCircle2 size={12} />
                      {t("budgetNormalBadge")}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-zinc-600">{detail.priceBenchmark}</p>
              </div>

              <p className="px-1 text-xs text-zinc-400">
                {t("publishedInfo", { date: detail.publishedAt })}
              </p>
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
