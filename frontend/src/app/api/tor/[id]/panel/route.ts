import { jsonResponse } from "@/lib/json-response";
import { fetchFeedback, fetchMatchedCompanies } from "@/lib/tor-api";

/**
 * What the owner view needs when a row is expanded. The browser can't call the
 * backend directly — its URL is server-only — and fetching this for every row
 * up front would be hundreds of requests for panels nobody opens.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [companies, feedback] = await Promise.all([fetchMatchedCompanies(id), fetchFeedback(id)]);
  return jsonResponse({ companies, feedback });
}
