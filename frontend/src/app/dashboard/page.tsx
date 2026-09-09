import { Dashboard } from "@/components/dashboard/dashboard";
import { fetchRankedOpportunities } from "@/lib/opportunities-api";

export default async function DashboardPage() {
  const opportunities = await fetchRankedOpportunities();

  return <Dashboard opportunities={opportunities} />;
}
