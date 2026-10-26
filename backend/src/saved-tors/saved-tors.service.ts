import { Injectable, NotFoundException } from "@nestjs/common";
import { MongoBulkWriteError, ObjectId } from "mongodb";

import { DatabaseService } from "../database/database.service";

const DUPLICATE_KEY = 11000;

@Injectable()
export class SavedTorsService {
  constructor(private readonly db: DatabaseService) {}

  async findOwn(userId: string): Promise<string[]> {
    const docs = await this.db.savedTors
      .find({ userId: new ObjectId(userId) }, { projection: { torId: 1 } })
      .sort({ createdAt: -1 })
      .toArray();
    return docs.map((doc) => doc.torId.toString());
  }

  /** A repeat save is a no-op — the unique (userId, torId) index makes this idempotent. */
  async save(userId: string, torId: string): Promise<void> {
    const tor = await this.findTorId(torId);

    await this.db.savedTors.updateOne(
      { userId: new ObjectId(userId), torId: tor },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
  }

  /**
   * Merges ids saved before signing in. Ids that aren't announcements (old
   * mock ids, deleted TORs) are dropped silently: they were never the
   * account's to begin with, so failing the whole merge over them would only
   * lose the valid ones. One lookup and one bulk write, however many ids.
   */
  async import(userId: string, torIds: string[]): Promise<string[]> {
    const candidates = [...new Set(torIds)].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));

    if (candidates.length > 0) {
      const existing = await this.db.tors
        .find({ _id: { $in: candidates } }, { projection: { _id: 1 } })
        .toArray();

      if (existing.length > 0) {
        const owner = new ObjectId(userId);
        const createdAt = new Date();
        await this.db.savedTors
          .bulkWrite(
            existing.map(({ _id }) => ({
              updateOne: {
                filter: { userId: owner, torId: _id },
                update: { $setOnInsert: { createdAt } },
                upsert: true,
              },
            })),
            // One failed upsert mustn't stop the rest.
            { ordered: false },
          )
          .catch((error: unknown) => {
            // A concurrent save of the same id already made the row: that's the outcome we wanted.
            const onlyDuplicates =
              error instanceof MongoBulkWriteError &&
              [error.writeErrors].flat().every((writeError) => writeError.code === DUPLICATE_KEY);
            if (!onlyDuplicates) throw error;
          });
      }
    }

    return this.findOwn(userId);
  }

  /** A repeat unsave is a no-op — nothing to remove is not an error. */
  async unsave(userId: string, torId: string): Promise<void> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");
    await this.db.savedTors.deleteOne({ userId: new ObjectId(userId), torId: new ObjectId(torId) });
  }

  /** A save can only exist against an announcement that does. */
  private async findTorId(torId: string): Promise<ObjectId> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");
    const id = new ObjectId(torId);
    const exists = await this.db.tors.countDocuments({ _id: id }, { limit: 1 });
    if (!exists) throw new NotFoundException("ไม่พบรายการ TOR");
    return id;
  }
}
