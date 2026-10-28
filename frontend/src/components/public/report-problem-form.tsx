"use client";

import { Check, Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { type ReportState, submitReport } from "@/app/tor/[id]/actions";
import { REPORT_REASONS } from "@/lib/report-reasons";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * "Report a problem" (FR-21): a wrong date or budget, a listing that isn't
 * software, a dead link, a duplicate. It goes to the admins' review list and is
 * never published. Closed until asked for, so it doesn't compete with the facts
 * around it. A guest may leave a contact; a signed-in reporter is known already.
 */
export function ReportProblemForm({ torId, signedIn }: { torId: string; signedIn: boolean }) {
  const t = useTranslations("ReportProblem");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ReportState, FormData>(submitReport.bind(null, torId), {});

  if (state.submitted) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm" role="status">
        <p className="flex items-start gap-2 text-sm font-medium text-success">
          <Check size={16} className="mt-0.5 shrink-0" />
          {t("submitted")}
        </p>
      </section>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-ink-muted shadow-sm transition-colors hover:bg-surface-alt hover:text-ink"
      >
        <Flag size={15} />
        {t("openButton")}
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Flag size={16} className="text-ink-subtle" />
          {t("heading")}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">{t("description")}</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">{t("reasonLabel")}</span>
        <select name="reason" required defaultValue="" className={`${inputCls} h-10`}>
          <option value="" disabled>
            {t("reasonPlaceholder")}
          </option>
          {REPORT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {t(`reason_${reason}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">{t("messageLabel")}</span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder={t("messagePlaceholder")}
          className={`${inputCls} py-2`}
        />
      </label>

      {!signedIn && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">{t("contactLabel")}</span>
          <input name="contact" maxLength={200} placeholder={t("contactPlaceholder")} className={`${inputCls} h-10`} />
        </label>
      )}

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-alt hover:text-ink"
        >
          {t("cancel")}
        </button>
        <SubmitButton label={t("submit")} pendingLabel={t("submitting")} />
      </div>
    </form>
  );
}
