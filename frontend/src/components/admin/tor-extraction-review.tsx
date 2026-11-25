import { CheckCircle2, ExternalLink, Sparkles } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { OffsiteLink } from "@/components/ui/offsite-link";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/datetime";
import type { TorExtraction } from "@/types/tor";

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10";
const textareaCls = `${inputCls} h-auto resize-y py-3 leading-relaxed`;

/**
 * The admin's review of what the AI read off the TOR's document, inside the
 * edit form. Every field is prefilled with the stored reading; saving sends
 * them all and the backend writes only what changed (TorService.updateExtraction),
 * marking the reading reviewed so the AI job won't read over it.
 */
export async function TorExtractionReview({
  extraction,
}: {
  extraction?: TorExtraction;
}) {
  const [t, td, locale] = await Promise.all([
    getTranslations("AdminTor"),
    getTranslations("TorDetailPage"),
    getLocale() as Promise<Locale>,
  ]);

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <header className="mb-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Sparkles size={17} className="text-accent" />
          {t("extractionSection")}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t("extractionSectionHint")}
        </p>
      </header>

      {!extraction ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-ink-muted">
          {t("noExtraction")}
        </p>
      ) : (
        <div className="space-y-5">
          <input type="hidden" name="ex_present" value="1" />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-surface-alt px-4 py-3 text-xs text-ink-muted">
            <span>
              {t("extractionMeta", {
                model: extraction.model,
                date: formatDateTime(extraction.extractedAt, locale),
                score: Math.round(
                  (extraction.assessment?.score ?? extraction.confidence) * 100,
                ),
              })}
            </span>
            {extraction.reviewed ? (
              <span className="flex items-center gap-1 font-semibold text-success">
                <CheckCircle2 size={13} />
                {t("extractionReviewedBy", {
                  who: extraction.reviewed.by,
                  date: formatDateTime(extraction.reviewed.at, locale),
                })}
              </span>
            ) : (
              <span className="font-semibold text-warn">
                {t("extractionNotReviewed")}
              </span>
            )}
            {extraction.documentUrl && (
              <OffsiteLink
                href={extraction.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                {td("openSourceDocument")}
                <ExternalLink size={12} />
              </OffsiteLink>
            )}
          </div>

          <Field label={td("scopeOfWork")}>
            <textarea
              name="ex_scope"
              rows={4}
              defaultValue={extraction.scope ?? ""}
              className={textareaCls}
            />
          </Field>

          <div className="grid gap-5 lg:grid-cols-2">
            <ListField
              label={td("objectives")}
              name="objectives"
              items={extraction.objectives}
              hint={t("onePerLine")}
            />
            <ListField
              label={td("qualifications")}
              name="qualifications"
              items={extraction.qualifications}
              hint={t("onePerLine")}
            />
            <ListField
              label={td("deliverables")}
              name="deliverables"
              items={extraction.deliverables}
              hint={t("onePerLine")}
            />
            <ListField
              label={td("paymentTerms")}
              name="paymentTerms"
              items={extraction.paymentTerms}
              hint={t("onePerLine")}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
            <Field label={td("documentBudgetLabel")}>
              <input
                name="ex_budgetAmount"
                inputMode="decimal"
                defaultValue={extraction.budgetAmount ?? ""}
                placeholder={t("bahtPlaceholder")}
                className={inputCls}
              />
            </Field>
            <Field label={td("referencePriceLabel")}>
              <input
                name="ex_referencePrice"
                inputMode="decimal"
                defaultValue={extraction.referencePrice ?? ""}
                placeholder={t("bahtPlaceholder")}
                className={inputCls}
              />
            </Field>
            <Field label={td("contractPeriodLabel")}>
              <input
                name="ex_contractPeriod"
                defaultValue={extraction.contractPeriod ?? ""}
                className={inputCls}
              />
            </Field>
            <Field label={t("documentDeadlineLabel")}>
              <input
                name="ex_deadline"
                type="date"
                defaultValue={extraction.deadline ?? ""}
                className={inputCls}
              />
            </Field>
            <Field label={t("deadlineTimeLabel")}>
              <input
                name="ex_deadlineTime"
                defaultValue={extraction.deadlineTime ?? ""}
                placeholder="09:00–12:00"
                pattern="\d{2}:\d{2}([–\-]\d{2}:\d{2})?"
                className={inputCls}
              />
            </Field>
            <Field label={t("feedbackDeadlineLabel")}>
              <input
                name="ex_feedbackDeadline"
                type="date"
                defaultValue={extraction.feedbackDeadline ?? ""}
                className={inputCls}
              />
            </Field>
            <Field label={td("warrantyLabel")}>
              <input
                name="ex_warrantyPeriod"
                defaultValue={extraction.warrantyPeriod ?? ""}
                className={inputCls}
              />
            </Field>
            <Field label={td("contactLabel")}>
              <input
                name="ex_contact"
                defaultValue={extraction.contact ?? ""}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Field label={td("evaluationCriteria")}>
              <textarea
                name="ex_evaluationCriteria"
                rows={3}
                defaultValue={extraction.evaluationCriteria ?? ""}
                className={textareaCls}
              />
            </Field>
            <Field label={td("bidSecurityLabel")}>
              <textarea
                name="ex_bidSecurity"
                rows={3}
                defaultValue={extraction.bidSecurity ?? ""}
                className={textareaCls}
              />
            </Field>
            <Field label={td("penaltyLabel")}>
              <textarea
                name="ex_penalty"
                rows={3}
                defaultValue={extraction.penalty ?? ""}
                className={textareaCls}
              />
            </Field>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border px-4 py-3 text-sm text-ink">
            <input
              type="checkbox"
              name="ex_reviewed"
              defaultChecked={!!extraction.reviewed}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span>
              {t("markReviewed")}
              <span className="mt-0.5 block text-xs text-ink-muted">
                {t("markReviewedHint")}
              </span>
            </span>
          </label>
        </div>
      )}
    </section>
  );
}

function ListField({
  label,
  name,
  items,
  hint,
}: {
  label: string;
  name: string;
  items?: string[];
  hint: string;
}) {
  const rows = Math.min(10, Math.max(4, (items?.length ?? 0) + 1));
  return (
    <Field label={label} hint={hint}>
      <textarea
        name={`ex_${name}`}
        rows={rows}
        defaultValue={(items ?? []).join("\n")}
        className={textareaCls}
      />
    </Field>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
        {label}
        {hint && (
          <span className="text-xs font-normal text-ink-subtle">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}
