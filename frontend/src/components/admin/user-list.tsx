"use client";

import { Ban, CheckCircle2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { DirectoryUser } from "@/lib/admin-api";
import type { Role } from "@/lib/auth";
import { thaiDate, timeAgo } from "@/lib/datetime";

/** Exhaustive on purpose: a new role that has no label here is a compile error. */
const ROLE_LABEL = {
  admin: "roleAdmin",
  org: "roleOrg",
  owner: "roleProjectOwner",
  auditor: "roleAuditor",
  viewer: "roleViewer",
} as const satisfies Record<Role, string>;

/** Mirrors the backend's SUSPENDABLE_ROLES (backend/src/accounts/accounts.service.ts). */
const SUSPENDABLE_ROLES: readonly Role[] = ["org", "viewer"];
const ROLE_FILTERS = ["all", "org", "viewer", "staff"] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];
const ROLE_FILTER_LABEL = {
  all: "roleFilterAll",
  org: "roleOrg",
  viewer: "roleViewer",
  staff: "roleFilterStaff",
} as const satisfies Record<RoleFilter, string>;

function matchesRole(role: Role, filter: RoleFilter): boolean {
  if (filter === "all") return true;
  if (filter === "staff") return !SUSPENDABLE_ROLES.includes(role);
  return role === filter;
}

type Props = {
  users: DirectoryUser[];
  onSuspend: (id: string) => Promise<void>;
  onReactivate: (id: string) => Promise<void>;
};

/**
 * Suspension is separate from approval: a suspended account keeps whatever the
 * review queue decided about it and simply can't sign in. So the badge reports
 * suspension first — that is the state an admin is here to change — and falls
 * back to the approval status when the account is free to use.
 */
export function UserList({ users, onSuspend, onReactivate }: Props) {
  const t = useTranslations("AdminUsersPage");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = users.filter((user) => {
    if (!matchesRole(user.role, roleFilter)) return false;
    const company = user.company?.companyName ?? "";
    return !q || `${user.name} ${user.email} ${company}`.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            id="user-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
          />
        </label>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          aria-label={t("roleFilterLabel")}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
        >
          {ROLE_FILTERS.map((filter) => (
            <option key={filter} value={filter}>
              {t(ROLE_FILTER_LABEL[filter])}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">{t("emptyState")}</p>
        ) : (
          filtered.map((user) => {
            const canSuspend = SUSPENDABLE_ROLES.includes(user.role);
            const suspended = !!user.suspended;
            const statusLabel = suspended
              ? t("statusSuspended")
              : user.status === "approved"
                ? t("statusActive")
                : user.status === "rejected"
                  ? t("statusRejected")
                  : t("statusPending");

            return (
              <div
                key={user.id}
                className="flex items-center gap-4 px-5 py-4 max-sm:flex-col max-sm:items-start"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-alt text-xs font-semibold text-ink-muted">
                  {user.name.charAt(0)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                        suspended
                          ? "bg-danger-soft text-danger"
                          : user.status === "approved"
                            ? "bg-success-soft text-success"
                            : "bg-surface-alt text-ink-muted"
                      }`}
                    >
                      {statusLabel}
                    </span>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-danger-soft text-danger"
                          : user.role === "viewer"
                            ? "bg-surface-alt text-ink-muted"
                            : "bg-accent-soft text-accent-text"
                      }`}
                    >
                      {t(ROLE_LABEL[user.role])}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-ink">{user.name}</h3>
                  <p className="mt-1 break-words text-xs text-ink-muted">
                    {[
                      user.email,
                      user.company?.companyName,
                      user.lastLoginAt
                        ? t("lastActiveInfo", { date: timeAgo(user.lastLoginAt) })
                        : t("neverSignedIn", { date: thaiDate(user.createdAt) }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                {/* Only an organization has a sign-in this can block — the
                    route that does the blocking accepts nothing else. */}
                {canSuspend && (
                  <button
                    onClick={() => {
                      setBusyId(user.id);
                      startTransition(async () => {
                        try {
                          await (suspended ? onReactivate(user.id) : onSuspend(user.id));
                        } finally {
                          setBusyId(null);
                        }
                      });
                    }}
                    disabled={busyId === user.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                  >
                    {suspended ? (
                      <>
                        <CheckCircle2 size={14} />
                        {t("reactivateAction")}
                      </>
                    ) : (
                      <>
                        <Ban size={14} />
                        {t("suspendAction")}
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
