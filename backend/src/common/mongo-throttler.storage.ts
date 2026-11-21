import { ThrottlerStorage } from "@nestjs/throttler";

import { DatabaseService } from "../database/database.service";
import { hitCounter } from "./shared-counters";

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage["increment"]>>;

/**
 * @nestjs/throttler's storage, kept in MongoDB so the limits hold across
 * restarts and replicas (docs/SECURITY.md G4). Fixed window: the first request
 * opens it, the limit applies until it ends, and a caller over the limit is
 * blocked for the rest of that window.
 */
export class MongoThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly db: DatabaseService) {}

  async increment(key: string, ttl: number, limit: number, _blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    const { hits, expiresAt } = await hitCounter(this.db.rateCounters, `throttle:${throttlerName}:${key}`, ttl);
    const timeToExpire = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    const isBlocked = hits > limit;
    return { totalHits: hits, timeToExpire, isBlocked, timeToBlockExpire: isBlocked ? timeToExpire : 0 };
  }
}
