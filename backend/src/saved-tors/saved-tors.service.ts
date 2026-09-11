import { Injectable, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { DatabaseService } from "../database/database.service";

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
