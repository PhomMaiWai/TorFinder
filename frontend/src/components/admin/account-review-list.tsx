"use client";

import {
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Layers,
  Mail,
  MapPin,
  Phone,
  Tag,
  User,
  Users,
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

type Company = NonNullable<OrgAccount["company"]>;

/**
 * Share of the profile an org has filled in, over the same seven fields the
 * org's own profile page scores itself on — so the admin sees the exact number
 * the company does.
 */
function profileCompleteness(company: Company): number {
  const filled = [
    company.contactName?.trim(),
    company.phone?.trim(),
    company.address?.trim(),
    company.specialty?.trim(),
    company.size?.trim(),
    company.techStack?.length ? "x" : "",
    company.pastExperience?.trim(),
  ].filter(Boolean).length;
  return Math.round((filled / 7) * 100);
}

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

            {isExpanded && company && <CompanyReviewDetail company={company} />}
          </div>
        );
      })}
    </div>
  );
}

function CompanyReviewDetail({ company }: { company: Company }) {
  const t = useTranslations("AdminAccountsPage");
  const percent = profileCompleteness(company);

  return (
    <div className="border-t border-border bg-surface-alt/50 px-5 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("companyDetailsHeading")}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-ink-muted">{t("profileCompletenessLabel")}</span>
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-alt">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="text-xs font-bold text-ink">{percent}%</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Detail icon={Building2} label={t("taxIdLabel")} value={company.taxId} />
        <Detail icon={User} label={t("contactNameLabel")} value={company.contactName} />
        <Detail icon={Phone} label={t("phoneLabel")} value={company.phone} />
        <Detail icon={Tag} label={t("specialtyLabel")} value={company.specialty} />
        <Detail icon={Users} label={t("sizeLabel")} value={company.size} />
        <div className="sm:col-span-2">
          <Detail icon={MapPin} label={t("addressLabel")} value={company.address} />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2">
        <Layers size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">{t("techStackLabel")}</p>
          {company.techStack && company.techStack.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {company.techStack.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink">{t("noneProvided")}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2">
        <Briefcase size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">{t("pastExperienceLabel")}</p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-ink">
            {company.pastExperience?.trim() || t("noneProvided")}
          </p>
        </div>
      </div>
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
