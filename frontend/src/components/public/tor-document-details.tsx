import { AlertTriangle, Banknote, Check, ListChecks, Sparkles, Target } from "lucide-react";
import { useTranslations } from "next-intl";

import type { TorExtraction } from "@/types/tor";

const BAHT = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

/** Below this the model itself says the document barely supported its answer. */
const LOW_CONFIDENCE = 0.5;

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

  const terms = extraction
    ? [
        { label: t("referencePriceLabel"), value: extraction.referencePrice && BAHT.format(extraction.referencePrice) },
        { label: t("documentBudgetLabel"), value: extraction.budgetAmount && BAHT.format(extraction.budgetAmount) },
        { label: t("contractPeriodLabel"), value: extraction.contractPeriod },
        { label: t("bidSecurityLabel"), value: extraction.bidSecurity },
        { label: t("penaltyLabel"), value: extraction.penalty },
        { label: t("warrantyLabel"), value: extraction.warrantyPeriod },
        { label: t("contactLabel"), value: extraction.contact },
      ].filter((term): term is { label: string; value: string } => !!term.value)
    : [];

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">
        <Sparkles size={18} className="text-ink-subtle" />
        {t("extractionHeading")}
      </h2>
      {extraction && (
        <p className="mb-5 text-xs text-ink-subtle">
          {t("extractionDisclaimer", { model: extraction.model })}
        </p>
      )}
      {extraction && extraction.confidence < LOW_CONFIDENCE && (
        <p className="mb-5 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t("lowConfidenceNote")}
        </p>
      )}

      <div className="space-y-6">
        {scope && (
          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-ink">{t("scopeOfWork")}</h3>
            <p className="text-base leading-relaxed text-ink-muted">{scope}</p>
          </div>
        )}
        <List title={t("objectives")} items={extraction?.objectives} icon={Target} />
        <List
          title={t("qualifications")}
          items={extraction?.qualifications ?? written?.qualifications}
          icon={Check}
        />
        <List
          title={t("deliverables")}
          items={extraction?.deliverables ?? written?.deliverables}
          icon={ListChecks}
        />
        <List title={t("paymentTerms")} items={extraction?.paymentTerms} icon={Banknote} />
        {extraction?.evaluationCriteria && (
          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-ink">{t("evaluationCriteria")}</h3>
            <p className="text-sm leading-relaxed text-ink-muted">{extraction.evaluationCriteria}</p>
          </div>
        )}

        {terms.length > 0 && (
          <dl className="grid gap-x-6 gap-y-4 border-t border-border pt-5 sm:grid-cols-2">
            {terms.map((term) => (
              <div key={term.label}>
                <dt className="text-xs text-ink-muted">{term.label}</dt>
                <dd className="mt-0.5 text-sm font-medium leading-relaxed text-ink">{term.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
