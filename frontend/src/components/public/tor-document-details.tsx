import {
  AlertTriangle,
  Award,
  Banknote,
  Briefcase,
  Building2,
  Check,
  ExternalLink,
  ListChecks,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { evaluationMethodOf, groupQualifications, QUALIFICATION_GROUPS } from "@/lib/tor-qualifications";
import type { CheckedField, ExtractionAssessment, TorExtraction } from "@/types/tor";

const BAHT = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

/** Mock records carry no assessment; the backend's thresholds, applied to the model's figure. */
function assessmentOf(extraction: TorExtraction): ExtractionAssessment {
  if (extraction.assessment) return extraction.assessment;
  const score = extraction.confidence;
  return { score, level: score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low", confirmed: [], verify: [] };
}

const LEVEL_STYLE = {
  high: "bg-success-soft text-success",
  medium: "bg-warn-soft text-warn",
  low: "bg-danger-soft text-danger",
} as const;

/** The hand-written detail a showcase record carries instead of an extraction. */
export type WrittenDetail = {
  scope: string;
  qualifications: string[];
  deliverables: string[];
};

function List({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[] | undefined;
  icon: React.ElementType;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
            <Icon size={15} className="mt-0.5 shrink-0 text-accent" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const GROUP_ICON = {
  company: Building2,
  certification: Award,
  experience: Briefcase,
  personnel: Users,
} as const;

const GROUP_LABEL = {
  company: "qualificationCompany",
  certification: "qualificationCertification",
  experience: "qualificationExperience",
  personnel: "qualificationPersonnel",
} as const;

/**
 * Who may bid, read apart by what each line asks of a company: the firm, the
 * certifications it holds as an organisation, its track record, and the people
 * it staffs the project with — usually the longest list, and the one a bidder
 * has to assemble.
 */
function Qualifications({ items }: { items: string[] | undefined }) {
  const t = useTranslations("TorDetailPage");
  if (!items?.length) return null;
  const groups = groupQualifications(items);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-ink">{t("qualifications")}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {QUALIFICATION_GROUPS.filter((group) => groups[group].length > 0).map((group) => {
          const Icon = GROUP_ICON[group];
          return (
            <div key={group} className="rounded-lg border border-border bg-surface-alt p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Icon size={14} className="text-accent" />
                {t(GROUP_LABEL[group])}
                <span className="font-normal text-ink-subtle">({groups[group].length})</span>
              </p>
              <ul className="space-y-1.5">
                {groups[group].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
                    <Check size={14} className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {groups.certification.length > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-ink-subtle">{t("certificationIsCompanyNote")}</p>
      )}
    </div>
  );
}

/**
 * What the announcement document says the work is, one block per question a
 * bidder asks: what, why, who may bid, what to hand over, how it is paid and
 * judged, and the terms that cost money. Blocks the document didn't cover are
 * left out rather than shown empty.
 */
export function TorDocumentDetails({
  extraction,
  written,
}: {
  extraction?: TorExtraction;
  written?: WrittenDetail | null;
}) {
  const t = useTranslations("TorDetailPage");
  const scope = extraction?.scope ?? written?.scope;
  const evaluationMethod = evaluationMethodOf(extraction?.evaluationCriteria);

  const assessment = extraction && assessmentOf(extraction);

  const terms: { label: string; value: string | null | undefined; field?: CheckedField }[] = extraction
    ? [
        {
          label: t("referencePriceLabel"),
          value: extraction.referencePrice && BAHT.format(extraction.referencePrice),
          field: "referencePrice",
        },
        {
          label: t("documentBudgetLabel"),
          value: extraction.budgetAmount && BAHT.format(extraction.budgetAmount),
          field: "budgetAmount",
        },
        { label: t("contractPeriodLabel"), value: extraction.contractPeriod },
        { label: t("bidSecurityLabel"), value: extraction.bidSecurity },
        { label: t("penaltyLabel"), value: extraction.penalty },
        { label: t("warrantyLabel"), value: extraction.warrantyPeriod },
        { label: t("contactLabel"), value: extraction.contact },
      ].filter((term) => !!term.value)
    : [];

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">
        <Sparkles size={18} className="text-ink-subtle" />
        {t("extractionHeading")}
      </h2>
      {extraction && assessment && (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            title={t("confidenceHint")}
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${LEVEL_STYLE[assessment.level]}`}
          >
            {t("confidenceLabel", { score: Math.round(assessment.score * 100) })}
          </span>
          <p className="text-xs text-ink-subtle">{t("extractionDisclaimer", { model: extraction.model })}</p>
        </div>
      )}
      {extraction && assessment?.level === "low" && (
        <div className="mb-5 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
          <p className="flex flex-1 items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {t("lowConfidenceNote")}
          </p>
          {extraction.documentUrl && (
            <a
              href={extraction.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline"
            >
              {t("openSourceDocument")}
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      <div className="space-y-6">
        {scope && (
          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-ink">{t("scopeOfWork")}</h3>
            <p className="text-base leading-relaxed text-ink-muted">{scope}</p>
          </div>
        )}
        <List title={t("objectives")} items={extraction?.objectives} icon={Target} />
        <Qualifications items={extraction?.qualifications ?? written?.qualifications} />
        <List
          title={t("deliverables")}
          items={extraction?.deliverables ?? written?.deliverables}
          icon={ListChecks}
        />
        <List title={t("paymentTerms")} items={extraction?.paymentTerms} icon={Banknote} />
        {extraction?.evaluationCriteria && (
          <div>
            <h3 className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
              {t("evaluationCriteria")}
              {evaluationMethod && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
                    evaluationMethod === "price" ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"
                  }`}
                >
                  {t(evaluationMethod === "price" ? "evaluationPriceOnly" : "evaluationPricePerformance")}
                </span>
              )}
            </h3>
            <p className="text-sm leading-relaxed text-ink-muted">{extraction.evaluationCriteria}</p>
          </div>
        )}

        {terms.length > 0 && (
          <dl className="grid gap-x-6 gap-y-4 border-t border-border pt-5 sm:grid-cols-2">
            {terms.map((term) => (
              <div key={term.label}>
                <dt className="text-xs text-ink-muted">{term.label}</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-medium leading-relaxed text-ink">
                  {term.value}
                  {term.field && assessment?.verify.includes(term.field) && (
                    <span
                      title={t("fieldVerifyHint")}
                      className="flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-2xs font-semibold text-warn"
                    >
                      <AlertTriangle size={11} />
                      {t("fieldVerify")}
                    </span>
                  )}
                  {term.field && assessment?.confirmed.includes(term.field) && (
                    <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-2xs font-semibold text-success">
                      <Check size={11} />
                      {t("fieldConfirmed")}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
