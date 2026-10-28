import { fetchJson, orEmptyWhenAnswered } from "@/lib/fetch-json";
import { authHeaders } from "@/lib/session-headers";
import type { TorRecord } from "@/types/tor";

/**
 * Announcements that have been hidden. Returns nothing for a caller who isn't
 * an admin — what was removed shouldn't be listed to everyone.
 */
export async function fetchDeletedTors(): Promise<TorRecord[]> {
  return orEmptyWhenAnswered(
    fetchJson<TorRecord[]>("/api/tor/deleted", { headers: await authHeaders() }),
    [],
  );
}

export type BudgetFlag = "สูงกว่าปกติ" | "ต่ำกว่าปกติ";

/** The auditor list's own tabs — one flagged reason, or every reason when omitted. */
export type FlaggedTorFilter = "budget-high" | "budget-low" | "competition";

export type FlaggedTor = {
  id: string;
  title: string;
  agency: string;
  budget: string;
  budgetAmount?: number;
  stage: TorRecord["stage"];
  budgetStatus?: BudgetFlag;
  procurementMethod?: string;
  /** One sentence per reason this record is on the list — budget, competition, or both. */
  reasons: string[];
  sourceUrl?: string;
  projectNumber?: string;
  createdAt: string;
};

export type FlaggedTorPage = {
  total: number;
  page: number;
  pageSize: number;
  items: FlaggedTor[];
};

const EMPTY_FLAGGED_PAGE: FlaggedTorPage = { total: 0, page: 1, pageSize: 20, items: [] };

/**
 * Announcements flagged for the Auditor Office — an unusual price, a
 * low-competition procurement method, or both. Returns the empty page for a
 * caller who isn't an auditor — the list simply isn't theirs to see.
 */
export async function fetchFlaggedTors(page: number, flag?: FlaggedTorFilter): Promise<FlaggedTorPage> {
  const params = new URLSearchParams({ page: String(page) });
  if (flag) params.set("flag", flag);

  return orEmptyWhenAnswered(
    fetchJson<FlaggedTorPage>(`/api/tor/flagged?${params}`, { headers: await authHeaders() }),
    EMPTY_FLAGGED_PAGE,
  );
}

export async function deleteTor(id: string): Promise<void> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("ลบประกาศไม่สำเร็จ");
}

export async function restoreTor(id: string): Promise<void> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${id}/restore`, {
    method: "POST",
    headers: await authHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("กู้คืนประกาศไม่สำเร็จ");
}
