import { OwnerContent } from "@/components/owner/owner-content";
import { fetchOwnTors } from "@/lib/owner-api";

/** The project owner's own announcements; the proxy lets only the owner role in. */
export default async function OwnerPage() {
  return <OwnerContent data={await fetchOwnTors()} />;
}
