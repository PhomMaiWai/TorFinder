import { Injectable } from "@nestjs/common";
import { ClientSession, ObjectId } from "mongodb";

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

  /**
   * Whether a token issued at `iatSeconds` is still accepted for this user.
   * A token that names its session (`sid`, ASVS 7.5.2) is also refused once
   * that one session has been ended, or if it never belonged to this user.
   */
  async isValid(userId: string, iatSeconds: number, sid?: string): Promise<boolean> {
    const minIssuedAt = await this.loadMinIssuedAt(userId);
    if (minIssuedAt && !(iatSeconds * 1000 >= minIssuedAt.getTime())) return false;
    if (sid === undefined) return true;
    if (typeof sid !== "string" || !ObjectId.isValid(userId)) return false;
    const session = await this.db.sessions.findOne({ _id: sid }, { projection: { userId: 1, revokedAt: 1 } });
    return !!session && session.userId.equals(new ObjectId(userId)) && !session.revokedAt;
  }

  /**
   * Invalidates every token already issued to this user — logout, a password
   * reset, a suspension, a lost approval. Pass the operation's `session` to
   * make it part of that transaction (DatabaseService.transaction).
   */
  async revoke(userId: string, session?: ClientSession): Promise<void> {
    if (!ObjectId.isValid(userId)) return;
    const now = new Date();
    await this.db.users.updateOne({ _id: new ObjectId(userId) }, { $set: { sessionMinIssuedAt: now } }, { session });
    await this.db.sessions.updateMany(
      { userId: new ObjectId(userId), revokedAt: { $exists: false } },
      { $set: { revokedAt: now } },
      { session },
    );
  }

  /** Ends one session of this user (ASVS 7.5.2); false when there is no such live session. */
  async revokeSession(userId: string, sid: string): Promise<boolean> {
    if (!ObjectId.isValid(userId) || typeof sid !== "string") return false;
    const result = await this.db.sessions.updateOne(
      { _id: sid, userId: new ObjectId(userId), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }

  /**
   * Signs every account out at once (ASVS 7.4.5's "all users"), without
   * rotating SESSION_SECRET. The admin doing it keeps only the session they
   * did it from (`keep`), so they can see the result; their other sessions
   * end too. Returns how many other accounts were signed out.
   */
  async revokeEveryone(keep: { userId: string; sid?: string }): Promise<number> {
    if (!ObjectId.isValid(keep.userId)) throw new Error("Invalid user id");
    const now = new Date();
    const actor = new ObjectId(keep.userId);
    const result = await this.db.users.updateMany({ _id: { $ne: actor } }, { $set: { sessionMinIssuedAt: now } });
    await this.db.sessions.updateMany(
      { revokedAt: { $exists: false }, ...(keep.sid ? { _id: { $ne: keep.sid } } : { userId: { $ne: actor } }) },
      { $set: { revokedAt: now } },
    );
    return result.modifiedCount;
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
