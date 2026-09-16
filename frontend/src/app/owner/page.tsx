import { OwnerContent } from "@/components/owner/owner-content";
import { fetchJson, orFallback } from "@/lib/fetch-json";
import { fetchDeletedTors } from "@/lib/tor-admin-api";
import { getAllTors } from "@/lib/tor-source";

/** Comment counts decorate the rows; the listing is worth showing without them. */
function fetchFeedbackCounts(): Promise<Record<string, number>> {
  return orFallback(fetchJson<Record<string, number>>("/api/feedback/counts"), {});
}

export default async function OwnerPage() {
  const [tors, deletedTors, feedbackCounts] = await Promise.all([
    getAllTors(),
    fetchDeletedTors(),
    fetchFeedbackCounts(),
  ]);

  return <OwnerContent tors={tors} deletedTors={deletedTors} feedbackCounts={feedbackCounts} />;
}
