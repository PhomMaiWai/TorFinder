import {
  ArrowLeft,
  Building2,
  ExternalLink,
  FileText,
  MessageSquare,
  Scale,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { BiddingBadge } from "@/components/public/bidding-badge";
import { FeedbackForm } from "@/components/public/feedback-form";
import { SaveTorButton } from "@/components/public/save-tor-button";
import { TorDocumentDetails } from "@/components/public/tor-document-details";
import { TorRecordFacts } from "@/components/public/tor-record-facts";
import { TOR_DETAILS } from "@/data/tor-details";
import { fetchBudgetAssessment, fetchFeedback, fetchMatchedCompanies } from "@/lib/tor-api";
import { getTorById, mockNumericId } from "@/lib/tor-source";
import { biddingOf, daysUntilClose, isClosingSoon, stageBadgeCls, torAmount } from "@/lib/tor-ui";

const CARD = "rounded-xl border border-border bg-surface p-6 shadow-sm";
const HEADING = "mb-4 flex items-center gap-2 text-lg font-bold text-ink";

const DATE = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

function thaiDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : DATE.format(date);
}

const AMOUNT_LABEL = {
  budget: "budgetLabel",
  awarded: "awardedLabel",
  reference: "referencePriceLabel",
} as const;

export default async function TorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tor, t, tOptions] = await Promise.all([
    getTorById(id),
    getTranslations("TorDetailPage"),
    getTranslations("CompanyProfileOptions"),
  ]);
  if (!tor) notFound();

  // Supplementary panels exist only for real records; the showcase ones aren't
  // in the corpus they are computed against.
  const [budgetAssessment, rankedCompanies, publishedFeedback] = tor.sourceRef
    ? await Promise.all([
        fetchBudgetAssessment(tor.id),
        fetchMatchedCompanies(tor.id),
        fetchFeedback(tor.id),
      ])
    : [null, [], []];

  // Showcase records carry hand-written scope instead of an extraction.
  const numericId = mockNumericId(id);
  const written = numericId === null ? null : TOR_DETAILS.find((d) => d.id === numericId);

  const bidding = biddingOf(tor);
  const daysLeft = daysUntilClose(tor);
  const urgent = isClosingSoon(tor);
  const amount = torAmount(tor);
  const sourceUrl = tor.sourceUrl ?? written?.sourceUrl;
  const budgetStatus = written?.budgetStatus ?? tor.budgetStatus;
  const hasDocumentDetails = !!tor.extraction || !!written;
  const documents = tor.documents ?? [];
  const publishedAt = thaiDate(tor.createdAt);

  return (
    <div className="flex min-h-screen flex-col bg-surface-alt">
      <SiteNavbar />

      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
          <Link
            href="/public"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={16} />
            {t("backToSearch")}
          </Link>

          <header className={`${CARD} mb-6`}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-2xs font-semibold tracking-wide ${stageBadgeCls(tor.stage)}`}
                  >
                    {tor.stage}
                  </span>
                  <BiddingBadge bidding={bidding} />
                  {budgetStatus && budgetStatus !== "ปกติ" && (
                    <span className="rounded-full bg-warn-soft px-2.5 py-1 text-2xs font-semibold text-warn">
                      {budgetStatus === "สูงกว่าปกติ" ? t("budgetHighBadge") : t("budgetLowBadge")}
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold leading-snug tracking-tight text-ink sm:text-2xl">
                  {tor.title}
                </h1>
                <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-muted">
                  <Building2 size={15} className="mt-0.5 shrink-0 text-ink-subtle" />
                  {tor.agency}
                </p>
              </div>
              <div className="flex shrink-0 gap-2 lg:flex-col">
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark lg:flex-none"
                  >
                    <ExternalLink size={15} />
                    {t("viewOriginalEgp")}
                  </a>
                )}
                <SaveTorButton torId={tor.id} saveLabel={t("saveButton")} savedLabel={t("savedButton")} />
              </div>
            </div>

            {/* The four facts a bidder decides on, before any detail. */}
            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
              <div className="bg-surface p-4">
                <dt className="text-xs text-ink-muted">{t(AMOUNT_LABEL[amount.kind])}</dt>
                <dd className="mt-1 text-lg font-bold text-ink">{amount.value}</dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="text-xs text-ink-muted">{t("closesAtLabel")}</dt>
                <dd className="mt-1 text-lg font-bold text-ink">
                  {thaiDate(bidding.closesAt) ?? t("unknownValue")}
                </dd>
                {bidding.status === "open" && daysLeft !== null && (
                  <dd className={`mt-0.5 text-sm font-semibold ${urgent ? "text-danger" : "text-success"}`}>
                    {t("daysLeftLabel", { days: daysLeft })}
                  </dd>
                )}
              </div>
              <div className="bg-surface p-4">
                <dt className="text-xs text-ink-muted">{t("opensAtLabel")}</dt>
                <dd className="mt-1 text-lg font-bold text-ink">
                  {thaiDate(bidding.opensAt) ?? publishedAt ?? t("unknownValue")}
                </dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="text-xs text-ink-muted">{t("procurementMethodLabel")}</dt>
                <dd className="mt-1 text-sm font-semibold leading-snug text-ink">
                  {tor.procurementMethod ?? t("unknownValue")}
                </dd>
              </div>
            </dl>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
              {hasDocumentDetails ? (
                <TorDocumentDetails extraction={tor.extraction} written={written} />
              ) : (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <FileText size={18} className="text-ink-subtle" />
                    {t("announcementDetail")}
                  </h2>
                  <p className="text-base leading-relaxed text-ink-muted">{tor.summary}</p>
                  {sourceUrl && (
                    <p className="mt-4 border-t border-border pt-4 text-sm text-ink-muted">
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
              )}

              {documents.length > 0 && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <FileText size={18} className="text-ink-subtle" />
                    {t("documentsHeading")}
                  </h2>
                  <ul className="divide-y divide-border">
                    {documents.map((doc) => (
                      <li
                        key={doc.url + doc.label + doc.publishedAt}
                        className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium text-ink">{doc.label}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {thaiDate(doc.publishedAt) ?? t("unknownValue")}
                          </p>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
                        >
                          <ExternalLink size={14} />
                          {t("openDocument")}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {rankedCompanies.length > 0 && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <Users size={18} className="text-ink-subtle" />
                    {t("matchedCompaniesHeading")}
                  </h2>
                  <ul className="divide-y divide-border">
                    {rankedCompanies.map((company) => (
                      <li key={company.companyName} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">{company.companyName}</p>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {company.workTypes.map((type) => tOptions(`workType_${type}`)).join(" · ")}
                            </p>
                          </div>
                          <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                            {t("matchScoreValue", { score: company.score })}
                          </span>
                        </div>
                        {/* Why it ranked here — a score with no reason is just a number. */}
                        {company.reasons.length + company.gaps.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {company.reasons.map((reason) => (
                              <li key={reason} className="text-xs text-ink-muted">
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

              {publishedFeedback.length > 0 && (
                <section className={CARD}>
                  <h2 className={HEADING}>
                    <MessageSquare size={18} className="text-ink-subtle" />
                    {t("feedbackListHeading")}
                  </h2>
                  <ul className="space-y-4">
                    {publishedFeedback.map((entry) => (
                      <li key={entry.id} className="rounded-lg bg-surface-alt p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">{entry.author}</p>
                          <span className="text-xs text-ink-subtle">{thaiDate(entry.createdAt) ?? ""}</span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{entry.text}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Comments are only useful while the draft can still change. */}
              {tor.sourceRef && tor.stage === "เปิดรับฟังความคิดเห็น" && bidding.status !== "closed" && (
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
            </div>

            <aside className="min-w-0 space-y-6 lg:sticky lg:top-20 lg:h-fit">
              <TorRecordFacts tor={tor} />
                {budgetAssessment && budgetAssessment.status !== "ไม่ประเมิน" && (
                  <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                    <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
                      <Scale size={18} className="text-ink-subtle" />
                      {t("budgetAssessmentHeading")}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${
                          budgetAssessment.status === "ปกติ"
                            ? "bg-success-soft text-success"
                            : "bg-warn-soft text-warn"
                        }`}
                      >
                        {budgetAssessment.status}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {budgetAssessment.notes.map((note) => (
                        <li key={note} className="text-sm leading-relaxed text-ink-muted">
                          {note}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-ink-subtle">
                      {t("budgetAssessmentNote")}
                    </p>
                  </section>
                )}

            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
