"use client";

import { FileText, Info, Landmark, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { AdminPageShell } from "@/components/layout/admin-page";
import { BMA_AGENCIES } from "@/data/opportunities";
import { valueLabel } from "@/lib/value-labels";
import { TOR_STAGES } from "@/types/tor";

import { createTorEntry, type CreateTorState } from "./actions";

const inputCls =
  "h-11 w-full rounded-lg border border-border px-4 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10";

const INITIAL_STATE: CreateTorState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("AdminTor");
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? t("saving") : t("saveEntry")}
    </button>
  );
}

export default function AdminCreateTorPage() {
  const [state, formAction] = useActionState(createTorEntry, INITIAL_STATE);
  const t = useTranslations("AdminTor");
  const tv = useTranslations("Values");

  return (
    <AdminPageShell title={t("createTitle")} description={t("createDescription")}>
      <form action={formAction} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section icon={FileText} title={t("projectSection")}>
            <Field label={tv("field.title")}>
              <input name="title" required placeholder={t("titlePlaceholder")} className={inputCls} />
            </Field>
            <Field label={tv("field.agency")}>
              <select name="agency" required defaultValue="" className={inputCls}>
                <option value="" disabled>
                  {t("chooseAgency")}
                </option>
                {BMA_AGENCIES.map((agency) => (
                  <option key={agency} value={agency}>
                    {agency}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tv("field.stage")}>
              <select name="stage" defaultValue="เปิดรับฟังความคิดเห็น" className={inputCls}>
                {TOR_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {valueLabel(tv, "stage", stage)}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section icon={Landmark} title={t("budgetSection")}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={tv("field.budget")}>
                <input name="budget" required placeholder="฿1,200,000" className={inputCls} />
              </Field>
              <Field label={tv("field.budgetStatus")}>
                <select name="budgetStatus" defaultValue="ปกติ" className={inputCls}>
                  <option value="ปกติ">{valueLabel(tv, "budgetStatus", "ปกติ")}</option>
                  <option value="สูงกว่าปกติ">{valueLabel(tv, "budgetStatus", "สูงกว่าปกติ")}</option>
                  <option value="ต่ำกว่าปกติ">{valueLabel(tv, "budgetStatus", "ต่ำกว่าปกติ")}</option>
                </select>
              </Field>
              <Field label={tv("field.deadline")}>
                <input name="deadline" required placeholder={t("deadlinePlaceholder")} className={inputCls} />
              </Field>
              <Field label={tv("field.daysLeft")}>
                <input name="daysLeft" type="number" min={0} defaultValue={0} className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section icon={Tags} title={t("extraSection")}>
            <Field label={t("tagsLabel")}>
              <input name="tags" placeholder="Next.js, Cloud, API" className={inputCls} />
            </Field>
            <Field label={t("summaryHeading")}>
              <textarea
                name="summary"
                required
                rows={5}
                placeholder={t("summaryPlaceholder")}
                className={`${inputCls} h-auto resize-none py-3`}
              />
            </Field>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:h-fit lg:col-span-1">
          <div className="rounded-xl border border-border bg-surface-alt p-5">
            <div className="mb-2 flex items-center gap-2">
              <Info size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-ink">{t("tipsHeading")}</h3>
            </div>
            <ul className="space-y-2 text-xs leading-relaxed text-ink-muted">
              <li>{t("tip1")}</li>
              <li>{t("tip2")}</li>
              <li>{t("tip3")}</li>
              <li>{t("tip4")}</li>
            </ul>
          </div>

          {state.error && (
            <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </aside>
      </form>
    </AdminPageShell>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-5 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
          <Icon size={16} />
        </span>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
