import { Collection } from "mongodb";

/**
 * One counter shared by every backend process (docs/SECURITY.md G4): route
 * rate limits, failed sign-ins per address and daily AI quotas live in MongoDB
 * instead of process memory, so a restart doesn't reset them and several
 * replicas count together. A TTL index on `expiresAt` removes old ones.
 */
export type RateCounterDoc = { _id: string; hits: number; expiresAt: Date };

export type CounterState = { hits: number; expiresAt: Date };

/**
 * Adds one hit. `sliding: false` keeps the window that the first hit opened
 * (route throttling, daily quotas); `sliding: true` restarts it on every hit,
 * so the key only clears after a quiet spell (failed sign-ins). A window that
 * has already ended starts again at 1. One atomic round trip either way.
 */
export async function hitCounter(
  counters: Collection<RateCounterDoc>,
  key: string,
  windowMs: number,
  { sliding = false, by = 1 }: { sliding?: boolean; by?: number } = {},
): Promise<CounterState> {
  const now = new Date();
  const fresh = new Date(now.getTime() + windowMs);
  const live = { $gt: ["$expiresAt", now] };
  const doc = await counters.findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          hits: { $cond: [live, { $add: ["$hits", by] }, by] },
          expiresAt: sliding ? fresh : { $cond: [live, "$expiresAt", fresh] },
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );
  return { hits: doc?.hits ?? by, expiresAt: doc?.expiresAt ?? fresh };
}

/** The current count, or 0 once its window has ended (the TTL monitor may not have run yet). */
export async function readCounter(counters: Collection<RateCounterDoc>, key: string): Promise<number> {
  const doc = await counters.findOne({ _id: key });
  return doc && doc.expiresAt.getTime() > Date.now() ? doc.hits : 0;
}

export async function clearCounter(counters: Collection<RateCounterDoc>, key: string): Promise<void> {
  await counters.deleteOne({ _id: key });
}
