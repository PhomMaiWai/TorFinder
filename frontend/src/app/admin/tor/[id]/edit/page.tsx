import { Flag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { TorCorrectionInfo } from "@/components/admin/tor-correction-info";
import { TorEditForm } from "@/components/admin/tor-edit-form";
import { AdminPageShell } from "@/components/layout/admin-page";
import { BMA_AGENCIES } from "@/data/opportunities";
import { fetchReport } from "@/lib/admin-api";
import { fetchTor } from "@/lib/tor-api";
import { valueLabel } from "@/lib/value-labels";
import { TOR_CLASSIFICATIONS, TOR_STAGES } from "@/types/tor";

import { updateTorEntry } from "./actions";

const inputCls =
  "h-11 w-full rounded-lg border border-border px-4 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10";

export default async function AdminEditTorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `report`: opened through "Fix this TOR" on that report (#227). */
  searchParams: Promise<{ report?: string }>;
}) {
  const [{ id }, { report: reportId }] = await Promise.all([params, searchParams]);
  const [tor, found, reasons, t, tv] = await Promise.all([
    fetchTor(id),
    reportId ? fetchReport(reportId) : Promise.resolve(null),
    getTranslations("ReportProblem"),
    getTranslations("AdminTor"),
    getTranslations("Values"),
  ]);
  if (!tor) notFound();
  // Only an open report about this TOR is worth fixing from; anything else is a stale link.
  const report = found && found.torId === id && found.status === "open" ? found : null;

  const updateWithId = updateTorEntry.bind(null, id);
  // An imported record's agency is often outside the BMA list; without its own
  // option the select would fall back to the first agency and a save would
  // silently change it.
  const bma: readonly string[] = BMA_AGENCIES;
  const agencies = bma.includes(tor.agency) ? bma : [tor.agency, ...bma];
  // Same for a stage the list doesn't know.
  const stages: readonly string[] = TOR_STAGES.includes(tor.stage) ? TOR_STAGES : [tor.stage, ...TOR_STAGES];

  return (
    <AdminPageShell title={t("editTitle")} description={tor.title}>
      <div className="max-w-2xl space-y-4">
        {report && (
          <section className="rounded-xl border border-warn/30 bg-warn-soft p-5" aria-label={t("reportRegion")}>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Flag size={15} className="text-warn" />
              {t("fixingReport", { reason: reasons(`reason_${report.reason}`) })}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{report.message}</p>
            <p className="mt-2 text-xs text-ink-muted">
              {t("reportedBy", {
                who: report.reporter
                  ? `${report.reporter.name} (${report.reporter.email})`
                  : (report.contact ?? t("anonymousReporter")),
              })}
              {" · "}
              {t("reportClosesOnSave")}
            </p>
          </section>
        )}
        <TorCorrectionInfo tor={tor} />
        <TorEditForm action={updateWithId} className="rounded-xl border border-border bg-surface p-6">
          {report && <input type="hidden" name="reportId" value={report.id} />}
          <Field label={tv("field.classification")}>
            <select
              name="classification"
              defaultValue={tor.classification ?? "software"}
              className={inputCls}
            >
              {TOR_CLASSIFICATIONS.map((value) => (
                <option key={value} value={value}>
                  {valueLabel(tv, "classification", value)}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-ink-muted">
              {t("classificationHint", { notSoftware: valueLabel(tv, "classification", "not-software") })}
            </span>
          </Field>

          <Field label={tv("field.title")}>
            <input
              name="title"
              required
              defaultValue={tor.title}
              className={inputCls}
            />
          </Field>

          <Field label={tv("field.agency")}>
            <select
              name="agency"
              required
              defaultValue={tor.agency}
              className={inputCls}
            >
              {agencies.map((agency) => (
                <option key={agency} value={agency}>
                  {agency}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tv("field.budget")}>
              <input
                name="budget"
                required
                defaultValue={tor.budget}
                className={inputCls}
              />
            </Field>
            <Field label={tv("field.deadline")}>
              <input
                name="deadline"
                required
                defaultValue={tor.deadline}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tv("field.daysLeft")}>
              <input
                name="daysLeft"
                type="number"
                min={0}
                defaultValue={tor.daysLeft}
                className={inputCls}
              />
            </Field>
            <Field label={tv("field.budgetStatus")}>
              <select
                name="budgetStatus"
                defaultValue={tor.budgetStatus ?? "ปกติ"}
                className={inputCls}
              >
                <option value="ปกติ">{valueLabel(tv, "budgetStatus", "ปกติ")}</option>
                <option value="สูงกว่าปกติ">{valueLabel(tv, "budgetStatus", "สูงกว่าปกติ")}</option>
                <option value="ต่ำกว่าปกติ">{valueLabel(tv, "budgetStatus", "ต่ำกว่าปกติ")}</option>
              </select>
            </Field>
          </div>

          <Field label={tv("field.stage")}>
            <select name="stage" defaultValue={tor.stage} className={inputCls}>
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {valueLabel(tv, "stage", stage)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("tagsLabel")}>
            <input
              name="tags"
              defaultValue={tor.tags.join(", ")}
              className={inputCls}
            />
          </Field>

          <Field label={t("summaryHeading")}>
            <textarea
              name="summary"
              required
              rows={5}
              defaultValue={tor.summary}
              className={`${inputCls} h-auto resize-none py-3`}
            />
          </Field>

          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            {t("saveChanges")}
          </button>
          <p className="text-xs text-ink-muted">
            {t("lockOnSave")}
          </p>
        </TorEditForm>
      </div>
    </AdminPageShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
