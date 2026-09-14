import { Injectable, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { DatabaseService, NotificationType } from "../database/database.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async findOwn(userId: string) {
    const docs = await this.db.notifications
      .find({ userId: new ObjectId(userId) }, { projection: { userId: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    return docs.map(({ _id, torId, ...rest }) => ({
      id: _id.toString(),
      torId: torId?.toString(),
      ...rest,
    }));
  }

  /**
   * Internal only — there is no route for a client to create a notification
   * for itself. Other services call this directly once they've done
   * something worth telling the account about.
   */
  async create(
    userId: ObjectId,
    type: NotificationType,
    title: string,
    message: string,
    torId?: ObjectId,
  ): Promise<void> {
    await this.db.notifications.insertOne({
      userId,
      type,
      title,
      message,
      torId,
      read: false,
      createdAt: new Date(),
    });
  }

  /** Scoped to (id, userId) so an account can only ever mark its own notifications read. */
  async markRead(userId: string, id: string): Promise<void> {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบการแจ้งเตือนนี้");

    const result = await this.db.notifications.updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(userId) },
      { $set: { read: true } },
    );
    if (result.matchedCount === 0) throw new NotFoundException("ไม่พบการแจ้งเตือนนี้");
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.notifications.updateMany(
      { userId: new ObjectId(userId), read: false },
      { $set: { read: true } },
    );
  }
}
