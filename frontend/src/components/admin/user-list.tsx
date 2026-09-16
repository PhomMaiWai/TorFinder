"use client";

import { Ban, CheckCircle2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { thaiDate } from "@/lib/datetime";
import type { OrgAccount } from "@/lib/accounts-api";

type Props = {
  accounts: OrgAccount[];
  onSuspend: (id: string) => Promise<void>;
  onReactivate: (id: string) => Promise<void>;
};

/**
 * An account is active once an admin has approved it and suspended once they
 * have rejected it — the same status the review screen sets, read from the
 * other end. A pending account has never been decided on and so has nothing to
 * suspend; the review queue is where it belongs.
 */
export function UserList({ accounts, onSuspend, onReactivate }: Props) {
  const t = useTranslations("AdminUsersPage");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = accounts.filter((account) => {
    const company = account.company?.companyName ?? "";
    const contact = account.company?.contactName ?? account.name;
    return !q || `${contact} ${account.email} ${company}`.toLowerCase().includes(q);
  });

  const statusLabel = (status: OrgAccount["status"]) =>
    status === "approved"
      ? t("statusActive")
      : status === "rejected"
        ? t("statusSuspended")
        : t("statusPending");

  return (
    <>
      <div className="mb-5">
        <label className="relative block max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">{t("emptyState")}</p>
        ) : (
          filtered.map((account) => {
            const contact = account.company?.contactName ?? account.name;
            const company = account.company?.companyName;
            const active = account.status === "approved";

            return (
              <div
                key={account.id}
                className="flex items-center gap-4 px-5 py-4 max-sm:flex-col max-sm:items-start"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-alt text-xs font-semibold text-ink-muted">
                  {contact.charAt(0)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                        active
                          ? "bg-success-soft text-success"
                          : account.status === "rejected"
                            ? "bg-danger-soft text-danger"
                            : "bg-surface-alt text-ink-muted"
                      }`}
                    >
                      {statusLabel(account.status)}
                    </span>
                    <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-text">
                      {t("roleOwner")}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-ink">{contact}</h3>
                  <p className="mt-1 text-xs text-ink-muted">
                    {[account.email, company, t("joinedInfo", { date: thaiDate(account.createdAt) })]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                {account.status !== "pending" && (
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await (active ? onSuspend(account.id) : onReactivate(account.id));
                      })
                    }
                    disabled={pending}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                  >
                    {active ? (
                      <>
                        <Ban size={14} />
                        {t("suspendAction")}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        {t("reactivateAction")}
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
