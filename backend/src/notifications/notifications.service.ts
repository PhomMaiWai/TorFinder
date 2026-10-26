import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { env } from "../config/env";
import { DatabaseService, NotificationChannels, NotificationType } from "../database/database.service";
import { UpdateChannelsDto } from "./dto/update-channels.dto";
import { availableChannels, deliver, DeliveryResult } from "./notification-delivery";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

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

    // The in-app copy is the record; the outside channels are best effort.
    const account = await this.db.users.findOne(
      { _id: userId },
      { projection: { email: 1, notificationChannels: 1 } },
    );
    if (!account?.notificationChannels) return;
    const link = torId ? `${env.frontendOrigin}/tor/${torId.toString()}?in=app` : env.frontendOrigin;
    for (const result of await deliver(account, { title, message, link })) {
      if (!result.ok) this.logger.warn(`${result.channel} to ${userId.toString()} failed: ${result.error}`);
    }
  }

  async getChannels(userId: string) {
    const account = await this.findAccount(userId, { notificationChannels: 1 });
    return {
      channels: account.notificationChannels ?? { email: false },
      available: availableChannels(),
    };
  }

  async updateChannels(userId: string, dto: UpdateChannelsDto) {
    const account = await this.findAccount(userId, { notificationChannels: 1 });
    const next: NotificationChannels = { email: false, ...account.notificationChannels };
    if (dto.email !== undefined) next.email = dto.email;
    for (const key of ["slackWebhookUrl", "lineUserId"] as const) {
      if (dto[key] === "") delete next[key];
      else if (dto[key] !== undefined) next[key] = dto[key];
    }
    await this.db.users.updateOne({ _id: new ObjectId(userId) }, { $set: { notificationChannels: next } });
    return this.getChannels(userId);
  }

  /** Sends a sample to every channel the account turned on, and says which worked. */
  async sendTest(userId: string): Promise<DeliveryResult[]> {
    const account = await this.findAccount(userId, { email: 1, notificationChannels: 1 });
    return deliver(account, {
      title: "ทดสอบการแจ้งเตือนจาก TOR Finder",
      message: "ช่องทางนี้พร้อมรับแจ้งเตือนเมื่อมีประกาศ TOR ใหม่ที่ตรงกับบริษัทของคุณแล้ว",
      link: env.frontendOrigin,
    });
  }

  private async findAccount(userId: string, projection: Record<string, 1>) {
    const account = ObjectId.isValid(userId)
      ? await this.db.users.findOne({ _id: new ObjectId(userId) }, { projection })
      : null;
    if (!account) throw new NotFoundException("ไม่พบบัญชีผู้ใช้");
    return account;
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
