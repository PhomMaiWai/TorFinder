import { Dashboard } from "@/components/dashboard/dashboard";
import { fetchDashboard } from "@/lib/opportunities-api";

export default async function DashboardPage() {
  const { company, opportunities } = await fetchDashboard();

  return <Dashboard company={company} opportunities={opportunities} />;
}
