import { Injectable } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { DatabaseService } from "../database/database.service";

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
 *
 * The floor is read from the database on every authenticated request (one
 * lookup by _id, the primary key), with no cache: a revocation, a role change
 * or a suspension applies to the very next request in every backend process,
 * not after a cache expires (ASVS 8.3.2).
 */
@Injectable()
export class SessionRevocationService {
  constructor(private readonly db: DatabaseService) {}

  /** Whether a token issued at `iatSeconds` is still accepted for this user. */
  async isValid(userId: string, iatSeconds: number): Promise<boolean> {
    const minIssuedAt = await this.loadMinIssuedAt(userId);
    if (!minIssuedAt) return true;
    return iatSeconds * 1000 >= minIssuedAt.getTime();
  }

  /** Invalidates every token already issued to this user — logout, a password reset, a suspension, a lost approval. */
  async revoke(userId: string): Promise<void> {
    if (!ObjectId.isValid(userId)) return;
    await this.db.users.updateOne({ _id: new ObjectId(userId) }, { $set: { sessionMinIssuedAt: new Date() } });
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
