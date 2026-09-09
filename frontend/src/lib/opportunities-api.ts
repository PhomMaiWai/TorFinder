import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth";
import type { ScoredTor } from "@/types/tor";

/**
 * Announcements scored for the signed-in account's own company. The backend
 * reads the profile from the session, so nothing about the company travels in
 * the request — and a signed-out visitor gets nothing rather than someone
 * else's ranking.
 */
export async function fetchRankedOpportunities(): Promise<ScoredTor[]> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return [];

  const res = await fetch(`${process.env.BACKEND_URL}/api/matching/opportunities`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}
