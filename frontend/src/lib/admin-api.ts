import { fetchJson, orEmptyWhenAnswered } from "@/lib/fetch-json";
import { authHeaders } from "@/lib/session-headers";

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

/** Every account the system knows, admins included — not the approval queue. */
export type DirectoryUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "org";
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
export const fetchAuditFeed = () => readAsAdmin<AuditFeedEntry[]>("/api/audit", []);
export const fetchUserDirectory = () =>
  readAsAdmin<DirectoryUser[]>("/api/accounts/directory", []);

async function setSuspended(id: string, suspended: boolean): Promise<void> {
  const res = await fetch(
    `${process.env.BACKEND_URL}/api/accounts/${id}/${suspended ? "suspend" : "reactivate"}`,
    {
      method: "PATCH",
      headers: await authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!res.ok) throw new Error(suspended ? "ระงับบัญชีไม่สำเร็จ" : "เปิดใช้งานบัญชีไม่สำเร็จ");
}

export const suspendUser = (id: string) => setSuspended(id, true);
export const reactivateUser = (id: string) => setSuspended(id, false);
