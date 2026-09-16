import { authHeaders } from "@/lib/session-headers";

export type ActivityEntry = {
  id: string;
  action: string;
  detail: string;
  /** An admin's email, or the system that acted on its own. */
  actor: string;
  kind: "auto" | "manual";
  createdAt: string;
};

export type AdminOverview = {
  pipeline: {
    ok: boolean;
    lastRunAt: string | null;
    importedToday: number;
    agencies: number;
  };
  extraction: { done: number; failed: number; pending: number };
  runs: { at: string; source: string; imported: number; ok: boolean }[];
  notifications: number;
};

/** Empty on failure: the dashboard is worth showing without its history. */
const EMPTY_OVERVIEW: AdminOverview = {
  pipeline: { ok: true, lastRunAt: null, importedToday: 0, agencies: 0 },
  extraction: { done: 0, failed: 0, pending: 0 },
  runs: [],
  notifications: 0,
};

export async function fetchActivity(limit = 50): Promise<ActivityEntry[]> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/activity?limit=${limit}`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/activity/overview`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return EMPTY_OVERVIEW;
  return res.json();
}
