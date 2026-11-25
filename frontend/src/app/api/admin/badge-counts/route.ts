import { fetchAccounts } from "@/lib/accounts-api";
import { jsonResponse } from "@/lib/json-response";
import type { AdminBadgeCounts } from "@/lib/use-admin-badge-counts";

/**
 * The admin sidebar's count of accounts waiting for review. Read from the same
 * backend queue the accounts page shows, so the badge and the page agree. A
 * non-admin is refused by the backend (403), which the helper turns into an
 * empty list — the badge then just doesn't show.
 */
export async function GET() {
  try {
    const accounts = await fetchAccounts("pending");
    const body: AdminBadgeCounts = { pendingAccounts: accounts.length };
    return jsonResponse(body);
  } catch {
    return jsonResponse({ error: "backend unavailable" }, { status: 502 });
  }
}
