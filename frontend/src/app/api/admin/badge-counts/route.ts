import { fetchAccounts } from "@/lib/accounts-api";
import { fetchFeedbackQueue } from "@/lib/feedback-api";
import { jsonResponse } from "@/lib/json-response";
import type { AdminBadgeCounts } from "@/lib/use-admin-badge-counts";

/**
 * The admin sidebar's counts: accounts waiting for review and comments waiting
 * for moderation. Read from the same backend queues the two pages show, so the
 * badge and the page agree. A non-admin is refused by the backend (403), which
 * the helpers turn into empty lists — the badges then just don't show.
 */
export async function GET() {
  try {
    const [accounts, feedback] = await Promise.all([
      fetchAccounts("pending"),
      fetchFeedbackQueue("รอตรวจสอบ"),
    ]);
    const body: AdminBadgeCounts = {
      pendingAccounts: accounts.length,
      pendingFeedback: feedback.length,
    };
    return jsonResponse(body);
  } catch {
    return jsonResponse({ error: "backend unavailable" }, { status: 502 });
  }
}
