import { Dashboard } from "@/components/dashboard/dashboard";
import { OPPORTUNITIES } from "@/data/opportunities";

export default function DashboardPage() {
  return <Dashboard opportunities={OPPORTUNITIES} />;
}
