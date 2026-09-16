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
 * A dashboard is worth showing without the panel that failed, so a dead
 * endpoint reads as "nothing yet" rather than taking the whole page down.
 */
const NO_METRICS: EgpMetrics = {
  status: "idle",
  lastRunAt: null,
  importedToday: 0,
  history: [],
};

async function getJson<T>(path: string, fallback: T): Promise<T> {
  const res = await fetch(`${process.env.BACKEND_URL}${path}`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return fallback;
  return res.json();
}

export const fetchEgpMetrics = () => getJson<EgpMetrics>("/api/egp/metrics", NO_METRICS);
export const fetchAuditFeed = () => getJson<AuditFeedEntry[]>("/api/audit", []);
export const fetchUserDirectory = () => getJson<DirectoryUser[]>("/api/accounts/directory", []);

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
