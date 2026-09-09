import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  Check,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Gauge,
  Hash,
  ListChecks,
  MessageSquare,
  Package,
  Scale,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { SaveTorButton } from "@/components/public/save-tor-button";
import { FEEDBACK_ENTRIES, MATCHED_COMPANIES, TOR_DETAILS } from "@/data/tor-details";
import { FeedbackForm } from "@/components/public/feedback-form";
import { fetchBudgetAssessment, fetchFeedback, fetchMatchedCompanies } from "@/lib/tor-api";
import { getTorById, mockNumericId } from "@/lib/tor-source";
import { isKnown, stageBadgeCls } from "@/lib/tor-ui";

const CARD = "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm";

const THB = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});
const HEADING = "mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900";

function thaiDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

export default async function TorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tor, t] = await Promise.all([getTorById(id), getTranslations("TorDetailPage")]);
  if (!tor) notFound();

  // Only real records carry a budget verdict; the showcase ones aren't in the
  // corpus it compares against.
  const [budgetAssessment, rankedCompanies, publishedFeedback] = tor.sourceRef
    ? await Promise.all([
        fetchBudgetAssessment(tor.id),
        fetchMatchedCompanies(tor.id),
        fetchFeedback(tor.id),
      ])
    : [null, [], []];
  const extraction = tor.extraction;

  // Showcase records carry hand-written scope/qualification detail; imported
  // announcements don't, so those sections fall back to what e-GP returned.
  const numericId = mockNumericId(id);
  const detail = numericId === null ? null : TOR_DETAILS.find((d) => d.id === numericId);
  const feedback = numericId === null ? [] : FEEDBACK_ENTRIES.filter((f) => f.torId === numericId);
  const matchedCompanies = numericId === null ? [] : (MATCHED_COMPANIES[numericId] ?? []);

  const sourceUrl = tor.sourceUrl ?? detail?.sourceUrl;
  const hasDeadline = isKnown(tor.deadline);
  const budgetStatus = detail?.budgetStatus ?? tor.budgetStatus;

  const procurementFacts = [
    { label: t("projectNumberLabel"), value: tor.projectNumber },
    { label: t("procurementMethodLabel"), value: tor.procurementMethod },
    { label: t("procurementTypeLabel"), value: tor.procurementType },
    { label: t("goodsCategoryLabel"), value: tor.goodsCategory },
    { label: t("contractStatusLabel"), value: tor.contractStatus },
    { label: t("contractPeriodLabel"), value: detail?.contractPeriod },
  ].filter((fact): fact is { label: string; value: string } => isKnown(fact.value));

  const publishedAt = detail?.publishedAt ?? thaiDate(tor.createdAt) ?? t("unknownValue");
  const documents = tor.documents ?? [];

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
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${stageBadgeCls(tor.stage)}`}
              >
                {tor.stage}
              </span>
              {tor.sourceRef && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                  {t("importedFromEgp")}
                </span>
              )}
              {tor.isNew && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                  {t("newBadge")}
                </span>
              )}
              {budgetStatus && budgetStatus !== "ปกติ" && (
                <span className="rounded-full bg-warn-soft px-2.5 py-1 text-[11px] font-semibold text-warn">
                  {budgetStatus === "สูงกว่าปกติ" ? t("budgetHighBadge") : t("budgetLowBadge")}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold leading-snug tracking-tight text-zinc-950 sm:text-[28px]">
                  {tor.title}
                </h1>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[15px] text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={16} className="text-zinc-400" />
                    {tor.agency}
                  </span>
                  {tor.projectNumber && (
                    <span className="flex items-center gap-1.5">
                      <Hash size={15} className="text-zinc-400" />
                      {tor.projectNumber}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar size={15} className="text-zinc-400" />
                    {t("publishedInfo", { date: publishedAt })}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <SaveTorButton
                  torId={tor.id}
                  saveLabel={t("saveButton")}
                  savedLabel={t("savedButton")}
                />
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark"
                  >
                    <ExternalLink size={15} />
                    {t("viewOriginalEgp")}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <section className={CARD}>
                <h2 className={HEADING}>
                  <FileText size={18} className="text-zinc-400" />
                  {t("announcementDetail")}
                </h2>
                <p className="text-[15px] leading-relaxed text-zinc-600">{tor.summary}</p>

                {!detail && sourceUrl && (
                  <p className="mt-4 border-t border-zinc-100 pt-4 text-sm text-zinc-500">
                    {t("fullDocumentNote")}{" "}
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent hover:text-accent-dark"
                    >
                      {t("openDocument")}
                    </a>
                  </p>
                )}
              </section>

              {procurementFacts.length > 0 && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <ClipboardList size={18} className="text-zinc-400" />
                    {t("procurementDetailsHeading")}
                  </h2>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {procurementFacts.map((fact) => (
                      <div key={fact.label}>
                        <dt className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Package size={13} className="text-zinc-400" />
                          {fact.label}
                        </dt>
                        <dd className="mt-0.5 text-sm font-medium text-zinc-900">{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {budgetAssessment && budgetAssessment.status !== "ไม่ประเมิน" && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <Scale size={18} className="text-zinc-400" />
                    {t("budgetAssessmentHeading")}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                        budgetAssessment.status === "ปกติ"
                          ? "bg-success-soft text-success"
                          : "bg-warn-soft text-warn"
                      }`}
                    >
                      {budgetAssessment.status}
                    </span>
                    {budgetAssessment.median !== null && (
                      <span className="text-sm text-zinc-500">
                        {t("budgetMedianLabel", {
                          median: THB.format(budgetAssessment.median),
                          count: budgetAssessment.peerCount,
                        })}
                      </span>
                    )}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {budgetAssessment.notes.map((note) => (
                      <li key={note} className="text-sm leading-relaxed text-zinc-600">
                        {note}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-400">
                    {t("budgetAssessmentNote")}
                  </p>
                </section>
              )}

              {extraction && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <Sparkles size={18} className="text-zinc-400" />
                    {t("extractionHeading")}
                  </h2>
                  <p className="mb-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-500">
                    {t("extractionDisclaimer", { model: extraction.model })}
                  </p>

                  {extraction.scope && (
                    <div className="mb-4">
                      <h3 className="mb-1 text-sm font-semibold text-zinc-900">{t("scopeOfWork")}</h3>
                      <p className="text-[15px] leading-relaxed text-zinc-600">{extraction.scope}</p>
                    </div>
                  )}

                  {extraction.qualifications.length > 0 && (
                    <div className="mb-4">
                      <h3 className="mb-1.5 text-sm font-semibold text-zinc-900">
                        {t("qualifications")}
                      </h3>
                      <ul className="space-y-1.5">
                        {extraction.qualifications.map((q) => (
                          <li key={q} className="flex items-start gap-2 text-sm text-zinc-600">
                            <Check size={15} className="mt-0.5 shrink-0 text-accent" />
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {extraction.deliverables.length > 0 && (
                    <div className="mb-4">
                      <h3 className="mb-1.5 text-sm font-semibold text-zinc-900">
                        {t("deliverables")}
                      </h3>
                      <ul className="space-y-1.5">
                        {extraction.deliverables.map((d) => (
                          <li key={d} className="flex items-start gap-2 text-sm text-zinc-600">
                            <ListChecks size={15} className="mt-0.5 shrink-0 text-zinc-400" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <dl className="grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-3">
                    {extraction.budgetAmount !== null && (
                      <div>
                        <dt className="text-xs text-zinc-500">{t("documentBudgetLabel")}</dt>
                        <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                          {THB.format(extraction.budgetAmount)}
                        </dd>
                      </div>
                    )}
                    {extraction.contractPeriod && (
                      <div>
                        <dt className="text-xs text-zinc-500">{t("contractPeriodLabel")}</dt>
                        <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                          {extraction.contractPeriod}
                        </dd>
                      </div>
                    )}
                    {extraction.deadline && (
                      <div>
                        <dt className="text-xs text-zinc-500">{t("deadlineLabel")}</dt>
                        <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                          {thaiDate(extraction.deadline)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
              )}

              {detail && (
                <>
                  <section className={CARD}>
                    <h2 className={HEADING}>
                      <FileText size={18} className="text-zinc-400" />
                      {t("scopeOfWork")}
                    </h2>
                    <p className="text-[15px] leading-relaxed text-zinc-600">{detail.scope}</p>
                  </section>

                  <section className={CARD}>
                    <h2 className={HEADING}>
                      <Shield size={18} className="text-zinc-400" />
                      {t("qualifications")}
                    </h2>
                    <ul className="space-y-3">
                      {detail.qualifications.map((q) => (
                        <li
                          key={q}
                          className="flex items-start gap-2.5 text-[15px] leading-relaxed text-zinc-600"
                        >
                          <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                          {q}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className={CARD}>
                    <h2 className={HEADING}>
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
                  </section>

                  <section className={CARD}>
                    <h2 className={HEADING}>
                      <Scale size={18} className="text-zinc-400" />
                      {t("priceBenchmarkTitle")}
                    </h2>
                    <p className="text-[15px] leading-relaxed text-zinc-600">
                      {detail.priceBenchmark}
                    </p>
                    <p className="mt-3 text-xs text-zinc-400">{t("aiAnalyzedBy")}</p>
                  </section>
                </>
              )}

              {detail?.awardedVendor && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <Trophy size={18} className="text-zinc-400" />
                    {t("awardedVendorTitle")}
                  </h2>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[15px] font-semibold text-zinc-900">
                      {detail.awardedVendor.name}
                    </p>
                    <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                      <Gauge size={15} className="text-zinc-400" />
                      {t("vendorMatchScore", { score: detail.awardedVendor.matchScore })}
                    </span>
                  </div>

                  {detail.awardedVendor.status === "warning" && (
                    <div className="mt-4 rounded-lg bg-danger-soft p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-danger">
                        <AlertTriangle size={15} />
                        {t("vendorRiskWarning")}
                      </p>
                      <ul className="mt-2.5 space-y-1.5">
                        {detail.awardedVendor.mismatchReasons.map((reason) => (
                          <li key={reason} className="text-sm leading-relaxed text-zinc-600">
                            • {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {rankedCompanies.length > 0 && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <Users size={18} className="text-zinc-400" />
                    {t("matchedCompaniesHeading")}
                  </h2>
                  <ul className="divide-y divide-zinc-100">
                    {rankedCompanies.map((company) => (
                      <li key={company.companyName} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-900">
                              {company.companyName}
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {company.specialty} · {t("companySizeLabel", { size: company.size })}
                            </p>
                          </div>
                          <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                            {t("matchScoreValue", { score: company.score })}
                          </span>
                        </div>
                        {/* Why it ranked here — a score with no reason is just a number. */}
                        {[...company.reasons, ...company.gaps].length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {company.reasons.map((reason) => (
                              <li key={reason} className="text-xs text-zinc-500">
                                · {reason}
                              </li>
                            ))}
                            {company.gaps.map((gap) => (
                              <li key={gap} className="text-xs text-warn">
                                · {gap}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {matchedCompanies.length > 0 && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <Users size={18} className="text-zinc-400" />
                    {t("matchedCompaniesHeading")}
                  </h2>
                  <ul className="divide-y divide-zinc-100">
                    {matchedCompanies.map((company) => (
                      <li
                        key={company.name}
                        className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900">{company.name}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {company.specialty} · {t("companySizeLabel", { size: company.size })}
                          </p>
                        </div>
                        <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                          {t("matchScoreValue", { score: company.score })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {publishedFeedback.length > 0 && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <MessageSquare size={18} className="text-zinc-400" />
                    {t("feedbackListHeading")}
                  </h2>
                  <ul className="space-y-4">
                    {publishedFeedback.map((entry) => (
                      <li key={entry.id} className="rounded-lg bg-zinc-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-900">{entry.author}</p>
                          <span className="text-xs text-zinc-400">
                            {thaiDate(entry.createdAt) ?? ""}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{entry.text}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Comments are only useful while the terms can still change. */}
              {tor.sourceRef && tor.stage === "เปิดรับฟังความคิดเห็น" && (
                <FeedbackForm
                  torId={tor.id}
                  labels={{
                    heading: t("shareFeedback"),
                    authorPlaceholder: t("feedbackAuthorPlaceholder"),
                    textPlaceholder: t("feedbackTextareaPlaceholder"),
                    submit: t("submitFeedbackButton"),
                    moderationNote: t("feedbackModerationNote"),
                    submitted: t("feedbackSubmitted"),
                  }}
                />
              )}

              {feedback.length > 0 && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <MessageSquare size={18} className="text-zinc-400" />
                    {t("feedbackListHeading")}
                  </h2>
                  <ul className="space-y-4">
                    {feedback.map((entry) => (
                      <li key={entry.id} className="rounded-lg bg-zinc-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-900">{entry.author}</p>
                          <span className="text-xs text-zinc-400">{entry.submittedAt}</span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{entry.text}</p>
                        <span className="mt-2 inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-zinc-500 ring-1 ring-zinc-200">
                          {entry.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {documents.length > 0 && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <FileText size={18} className="text-zinc-400" />
                    {t("documentsHeading")}
                  </h2>
                  <ul className="divide-y divide-zinc-100">
                    {documents.map((doc) => (
                      <li
                        key={doc.url + doc.label}
                        className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900">{doc.label}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {thaiDate(doc.publishedAt) ?? t("unknownValue")}
                          </p>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent-soft"
                        >
                          <ExternalLink size={14} />
                          {t("viewDocumentPdf")}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {tor.tags.length > 0 && (
                <section className={CARD}>
                  <h2 className="mb-3 text-lg font-bold text-zinc-900">{t("relatedTechnologies")}</h2>
                  <div className="flex flex-wrap gap-2">
                    {tor.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <InfoRow
                  icon={Banknote}
                  label={t("budgetLabel")}
                  value={tor.budget}
                  muted={!isKnown(tor.budget)}
                />
                <InfoRow
                  icon={Clock}
                  label={t("deadlineLabel")}
                  value={hasDeadline ? tor.deadline : t("unknownValue")}
                  hint={hasDeadline && tor.daysLeft > 0 ? t("daysLeftLabel", { days: tor.daysLeft }) : undefined}
                  muted={!hasDeadline}
                />
                <InfoRow icon={Calendar} label={t("publishedAtLabel")} value={publishedAt} />
                {detail && (
                  <>
                    <InfoRow
                      icon={ClipboardList}
                      label={t("contractPeriodLabel")}
                      value={detail.contractPeriod}
                    />
                    <InfoRow
                      icon={Users}
                      label={t("matchedCompaniesLabel")}
                      value={t("companiesCount", { count: detail.matchedCompaniesCount })}
                    />
                    {detail.feedbackDeadline && (
                      <InfoRow
                        icon={MessageSquare}
                        label={t("shareFeedback")}
                        value={t("feedbackOpenUntil", { date: detail.feedbackDeadline })}
                        hint={t("feedbackWindowInfo", {
                          date: detail.feedbackDeadline,
                          count: detail.feedbackCount,
                        })}
                      />
                    )}
                  </>
                )}
              </div>

              {sourceUrl && (
                <p className="px-1 text-xs leading-relaxed text-zinc-400">
                  {t("publishedInfo", { date: publishedAt })}
                </p>
              )}
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  hint,
  muted = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-zinc-100 py-3 first:pt-0 last:border-0 last:pb-0">
      <Icon size={16} className="mt-0.5 shrink-0 text-zinc-400" />
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`mt-0.5 text-sm font-semibold ${muted ? "text-zinc-400" : "text-zinc-900"}`}>
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
      </div>
    </div>
  );
}
