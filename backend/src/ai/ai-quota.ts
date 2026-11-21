import type { Collection } from "mongodb";

import { hitCounter, type RateCounterDoc } from "../common/shared-counters";
import { logSecurityEvent } from "../common/security-log";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in Bangkok, so a daily quota resets at local midnight. */
function bangkokDay(now = Date.now()): string {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Takes one unit from a daily quota kept in MongoDB, shared by every backend
 * process (docs/SECURITY.md G1). Returns false, and logs `ai.quota.exceeded`,
 * once today's limit is used up. A limit of 0 or less turns the quota off.
 */
export async function takeDailyAiQuota(
  counters: Collection<RateCounterDoc>,
  name: string,
  limit: number,
  context: { userId?: string } = {},
): Promise<boolean> {
  if (limit <= 0) return true;
  const { hits } = await hitCounter(counters, `ai-quota:${name}:${bangkokDay()}`, DAY_MS);
  if (hits <= limit) return true;
  // One log line when the quota first runs out, not one per refused call.
  if (hits === limit + 1) {
    logSecurityEvent("ai.quota.exceeded", { outcome: "failure", userId: context.userId, reason: `${name.replace(/:.*/, "")}_limit_${limit}_per_day` });
  }
  return false;
}
