"use client";

import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Mail,
  MapPin,
  Phone,
  User,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import type { AccountStatus, OrgAccount } from "@/lib/accounts-api";

const STATUS_STYLES: Record<AccountStatus, string> = {
  approved: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
  pending: "bg-warn-soft text-warn",
};

const STATUS_KEYS: Record<AccountStatus, string> = {
  approved: "statusApproved",
  rejected: "statusRejected",
  pending: "statusPending",
};

function ReviewButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {children}
    </button>
  );
}

export function AccountReviewList({
  accounts,
  onApprove,
  onReject,
}: {
  accounts: OrgAccount[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const t = useTranslations("AdminAccountsPage");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (accounts.length === 0) {
    return (
      <div className="py-20 text-center">
        <CheckCircle2 size={36} className="mx-auto mb-3 text-success opacity-70" />
        <p className="text-base font-semibold text-ink">{t("emptyState")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => {
        const isExpanded = expandedId === account.id;
        const company = account.company;

        return (
          <div key={account.id} className="rounded-xl border border-border bg-white">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpandedId(isExpanded ? null : account.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedId(isExpanded ? null : account.id);
                }
              }}
              className="flex w-full cursor-pointer items-start justify-between gap-4 p-5 text-left max-sm:flex-col"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[account.status]}`}
                  >
                    {t(STATUS_KEYS[account.status])}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-ink-muted">
                    <Mail size={12} />
                    {account.email}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-ink">
                  {company?.companyName ?? account.name}
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {[company?.specialty, company?.size].filter(Boolean).join(" · ")}
                  {company?.specialty || company?.size ? " · " : ""}
                  {t("submittedInfo", {
                    date: new Date(account.createdAt).toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })}
                </p>
              </div>

              <div
                className="flex shrink-0 items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {account.status === "pending" && (
                  <>
                    <form action={onReject.bind(null, account.id)}>
                      <ReviewButton className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink">
                        <XCircle size={15} />
                        {t("rejectAction")}
                      </ReviewButton>
                    </form>
                    <form action={onApprove.bind(null, account.id)}>
                      <ReviewButton className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark">
                        <Check size={15} />
                        {t("approveAction")}
                      </ReviewButton>
                    </form>
                  </>
                )}
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-ink-subtle transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            {isExpanded && company && (
              <div className="border-t border-border bg-surface-alt/50 px-5 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  {t("companyDetailsHeading")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail icon={Building2} label={t("taxIdLabel")} value={company.taxId} />
                  <Detail icon={User} label={t("contactNameLabel")} value={company.contactName} />
                  <Detail icon={Phone} label={t("phoneLabel")} value={company.phone} />
                  <div className="sm:col-span-2">
                    <Detail icon={MapPin} label={t("addressLabel")} value={company.address} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
      <div>
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="text-sm text-ink">{value || "-"}</p>
      </div>
    </div>
  );
}
