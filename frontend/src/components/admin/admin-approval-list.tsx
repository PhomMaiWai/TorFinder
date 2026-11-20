"use client";

import { Check, ShieldAlert, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { ROLE_LABEL, useStepUpMessage } from "@/components/admin/user-list";
import type { Locale } from "@/i18n/config";
import type { ActionResult } from "@/lib/action-result";
import type { PendingAdminChange } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/datetime";
import { withStepUp } from "@/lib/passkeys-client";

type Props = {
  approvals: PendingAdminChange[];
  onApprove: (id: string) => Promise<ActionResult>;
  onReject: (id: string) => Promise<ActionResult>;
};

/**
 * Requests to grant or remove the admin role, waiting for a second admin
 * (ASVS 2.3.5). Another admin may approve or reject; the one who asked may
 * only cancel. Both go through the same passkey step-up as other account
 * decisions. Nothing is shown when there are none.
 */
export function AdminApprovalList({ approvals, onApprove, onReject }: Props) {
  const t = useTranslations("AdminUsersPage");
  const locale = useLocale() as Locale;
  const stepUpMessage = useStepUpMessage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string } | null>(null);
  const [, startTransition] = useTransition();

  if (approvals.length === 0) return null;

  const decide = (id: string, action: (id: string) => Promise<ActionResult>) => {
    setBusyId(id);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await withStepUp(() => action(id), stepUpMessage);
        if (result.error) setMessage({ id, text: result.error });
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <section aria-labelledby="admin-approvals-heading" className="mb-6 rounded-xl border border-warn/40 bg-warn-soft">
      <h2 id="admin-approvals-heading" className="flex items-center gap-2 px-5 pt-4 text-sm font-semibold text-ink">
        <ShieldAlert size={16} className="text-warn" />
        {t("approvalsTitle", { count: approvals.length })}
      </h2>
      <p className="px-5 pb-3 pt-1 text-xs text-ink-muted">{t("approvalsDescription")}</p>
      <ul className="divide-y divide-border border-t border-border bg-surface">
        {approvals.map((request) => (
          <li key={request.id} className="px-5 py-4">
            <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-start">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {request.targetName}
                  <span className="ml-2 font-normal text-ink-muted">{request.targetEmail}</span>
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {t("approvalChange", {
                    from: t(ROLE_LABEL[request.fromRole]),
                    to: t(ROLE_LABEL[request.toRole]),
                  })}
                  {" · "}
                  {request.mine ? t("approvalRequestedByYou") : t("approvalRequestedBy", { email: request.requestedBy })}
                  {" · "}
                  {t("approvalExpires", { date: formatDateTime(request.expiresAt, locale) ?? "" })}
                </p>
              </div>
              {request.mine ? (
                <>
                  <span className="text-xs text-ink-subtle">{t("approvalWaiting")}</span>
                  <button
                    onClick={() => decide(request.id, onReject)}
                    disabled={busyId === request.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                  >
                    <X size={14} />
                    {t("approvalCancel")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => decide(request.id, onApprove)}
                    disabled={busyId === request.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
                  >
                    <Check size={14} />
                    {t("approvalApprove")}
                  </button>
                  <button
                    onClick={() => decide(request.id, onReject)}
                    disabled={busyId === request.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                  >
                    <X size={14} />
                    {t("approvalReject")}
                  </button>
                </>
              )}
            </div>
            {message?.id === request.id && (
              <p role="alert" className="mt-2 text-xs font-medium text-danger">
                {message.text}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
