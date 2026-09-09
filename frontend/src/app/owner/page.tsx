import { OwnerContent } from "@/components/owner/owner-content";
import { fetchDeletedTors } from "@/lib/tor-admin-api";
import { getAllTors } from "@/lib/tor-source";

async function fetchFeedbackCounts(): Promise<Record<string, number>> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/feedback/counts`, { cache: "no-store" });
  if (!res.ok) return {};
  return res.json();
}

export default async function OwnerPage() {
  const [tors, deletedTors, feedbackCounts] = await Promise.all([
    getAllTors(),
    fetchDeletedTors(),
    fetchFeedbackCounts(),
  ]);

  return <OwnerContent tors={tors} deletedTors={deletedTors} feedbackCounts={feedbackCounts} />;
}
