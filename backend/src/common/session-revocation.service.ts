import { Injectable } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { DatabaseService } from "../database/database.service";
import { TtlCache } from "./ttl-cache";

// How long a revocation takes to take effect on a request that was already
// served from cache. Short enough that "logout" and "suspend" feel immediate,
// long enough that a normal authenticated request never pays for a database
// round trip.
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 10_000;

/**
 * Session tokens are self-contained (see token.ts) and can't be revoked by
 * themselves — there is no server-side list of "active" tokens to strike one
 * from. Instead, each user carries a `sessionMinIssuedAt` floor in the
 * database: a token whose `iat` falls before that floor is rejected even
 * though its signature and `exp` are still perfectly valid.
 *
 * This is the mechanism ASVS 7.4.1 names directly for self-contained tokens:
 * "disallowing tokens produced before a per-user date and time." It
 * deliberately revokes every session for the account, not just the one that
 * logged out — there's no per-session id to target individually, and
 * revoking everything is the safer failure mode.
 */
@Injectable()
export class SessionRevocationService {
  private readonly cache = new TtlCache<string, Promise<Date | null>>(CACHE_TTL_MS, CACHE_MAX_ENTRIES);

  constructor(private readonly db: DatabaseService) {}

  /** Whether a token issued at `iatSeconds` is still accepted for this user. */
  async isValid(userId: string, iatSeconds: number): Promise<boolean> {
    const minIssuedAt = await this.cache.getOrLoad(userId, () => this.loadMinIssuedAt(userId));
    if (!minIssuedAt) return true;
    return iatSeconds * 1000 >= minIssuedAt.getTime();
  }

  /** Invalidates every token already issued to this user — logout, a password reset, or a suspension. */
  async revoke(userId: string): Promise<void> {
    if (!ObjectId.isValid(userId)) return;
    await this.db.users.updateOne({ _id: new ObjectId(userId) }, { $set: { sessionMinIssuedAt: new Date() } });
    // Otherwise a request served from this process's cache in the next
    // CACHE_TTL_MS would still accept a token this call just revoked.
    this.cache.delete(userId);
  }

  private async loadMinIssuedAt(userId: string): Promise<Date | null> {
    if (!ObjectId.isValid(userId)) return null;
    const user = await this.db.users.findOne(
      { _id: new ObjectId(userId) },
      { projection: { sessionMinIssuedAt: 1 } },
    );
    return user?.sessionMinIssuedAt ?? null;
  }
}
