import { getTranslations } from "next-intl/server";
import type { Role } from "@/lib/auth";
import { idPath } from "@/lib/backend-path";
import { fetchJson, orEmptyWhenAnswered } from "@/lib/fetch-json";
import type { ReportReason } from "@/lib/report-reasons";
import { authHeaders } from "@/lib/session-headers";
import { type ActionResult, actionResultFrom } from "@/lib/action-result";

export type SyncRunStatus = "success" | "partial" | "failed";

export type SyncHistoryEntry = {
  startedAt: string;
  finishedAt: string;
  status: SyncRunStatus;
  fetched: number;
  imported: number;
  updated: number;
  failedFeeds: string[];
  error?: string;
};

export type EgpMetrics = {
  /** "idle" only before the very first sync has ever run. */
  status: SyncRunStatus | "idle";
  lastRunAt: string | null;
  importedToday: number;
  history: SyncHistoryEntry[];
};

export type AuditFeedEntry = {
  action: string;
  detail: string;
  actor: string;
  type: "manual" | "auto";
  /** ISO; the page formats it. */
  date: string;
};

export type AuditFeedPage = {
  items: AuditFeedEntry[];
  total: number;
  page: number;
  pageSize: number;
  /** Every action label there is, for the filter. */
  actions: string[];
};

/** What the audit page narrows by; all optional, days as YYYY-MM-DD. */
export type AuditFeedQuery = {
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  page?: number;
};

/** Every account the system knows, admins included — not the approval queue. */
export type DirectoryUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "pending" | "approved" | "rejected";
  /** Blocks sign-in without touching the approval decision. */
  suspended?: boolean;
  createdAt: string;
  lastLoginAt?: string;
  company?: { companyName: string };
};

/**
 * Read as an admin. A 403 is an answer — this account may not see the panel —
 * and comes back empty; a backend that can't answer throws, because an admin
 * reading "0 accounts" off a broken endpoint would act on a number that isn't
 * true.
 */
async function readAsAdmin<T>(path: string, whenForbidden: T): Promise<T> {
  return orEmptyWhenAnswered(fetchJson<T>(path, { headers: await authHeaders() }), whenForbidden);
}

/** Before the very first sync has ever run there is nothing to report. */
const NO_METRICS: EgpMetrics = {
  status: "idle",
  lastRunAt: null,
  importedToday: 0,
  history: [],
};

export const fetchEgpMetrics = () => readAsAdmin<EgpMetrics>("/api/egp/metrics", NO_METRICS);
export function fetchAuditFeed(query: AuditFeedQuery = {}): Promise<AuditFeedPage> {
  const params = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => (value ? [[key, String(value)]] : [])),
  );
  return readAsAdmin<AuditFeedPage>(`/api/audit?${params}`, {
    items: [],
    total: 0,
    page: query.page ?? 1,
    pageSize: 20,
    actions: [],
  });
}
export const fetchUserDirectory = () =>
  readAsAdmin<DirectoryUser[]>("/api/accounts/directory", []);

async function setSuspended(id: string, suspended: boolean): Promise<ActionResult> {
  const res = await fetch(
    `${process.env.BACKEND_URL}/api/accounts/${idPath(id)}/${suspended ? "suspend" : "reactivate"}`,
    {
      method: "PATCH",
      headers: await authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );
  return actionResultFrom(res, suspended ? "ระงับบัญชีไม่สำเร็จ" : "เปิดใช้งานบัญชีไม่สำเร็จ");
}

/** Clears a staff member's passkeys after they lose a device; they add a new one at their next sign-in. */
export async function resetUserPasskeys(id: string): Promise<ActionResult> {
  const te = await getTranslations("Errors");
  const res = await fetch(`${process.env.BACKEND_URL}/api/accounts/${idPath(id)}/passkeys/reset`, {
    method: "POST",
    headers: await authHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  return actionResultFrom(res, te("saveFailed"));
}

export const suspendUser = (id: string) => setSuspended(id, true);
export const reactivateUser = (id: string) => setSuspended(id, false);

/** An organization's role is fixed by its sign-up; see the backend's EDITABLE_ROLES. */
export type UserEdit = { name?: string; role?: Exclude<Role, "org"> };

/** The backend's own message on a refusal (e.g. demoting the last admin), so the admin sees why. */
export async function updateUser(id: string, edit: UserEdit): Promise<ActionResult> {
  const te = await getTranslations("Errors");
  const res = await fetch(`${process.env.BACKEND_URL}/api/accounts/${idPath(id)}/details`, {
    method: "PATCH",
    headers: { ...(await authHeaders()), "content-type": "application/json" },
    body: JSON.stringify(edit),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  return actionResultFrom(res, te("saveFailed"));
}

export type ReportStatus = "open" | "resolved";

/** One "report a problem" entry as the admin list shows it. Mirrors the backend's ReportsService. */
export type TorReport = {
  id: string;
  torId: string;
  /** Null when the TOR has since been removed from the collection. */
  torTitle: string | null;
  reason: ReportReason;
  message: string;
  /** The signed-in account that reported it; absent for a guest. */
  reporter?: { email: string; name: string };
  /** How a guest asked to be reached, if they did. */
  contact?: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type ReportsPage = { items: TorReport[]; total: number; page: number; pageSize: number };

export function fetchReports(status: ReportStatus | undefined, page: number): Promise<ReportsPage> {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set("status", status);
  return readAsAdmin<ReportsPage>(`/api/reports?${params}`, { items: [], total: 0, page, pageSize: 20 });
}

/** One report, for "Fix this TOR"; null when it doesn't exist or this account may not read it. */
export async function fetchReport(id: string): Promise<TorReport | null> {
  return readAsAdmin<TorReport | null>(`/api/reports/${encodeURIComponent(id)}`, null).catch(() => null);
}

/** `fixed`: resolved by correcting the TOR for it, which the audit log records apart from a plain close. */
export async function setReportStatus(id: string, status: ReportStatus, fixed = false): Promise<void> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/reports/${idPath(id)}`, {
    method: "PATCH",
    headers: { ...(await authHeaders()), "content-type": "application/json" },
    body: JSON.stringify(fixed ? { status, fixed } : { status }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(status === "resolved" ? "ปิดเรื่องไม่สำเร็จ" : "เปิดเรื่องอีกครั้งไม่สำเร็จ");
}
