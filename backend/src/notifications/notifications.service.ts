import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { env } from "../config/env";
import { DatabaseService, NotificationChannels, NotificationType } from "../database/database.service";
import { UpdateChannelsDto } from "./dto/update-channels.dto";
import {
  canLinkLine,
  hashLinkCode,
  LineEvent,
  LINK_TTL_MS,
  lineLinkUrls,
  newLinkCode,
  parseLinkCode,
  replyLine,
} from "./line-link";
import { availableChannels, deliver, DeliveryResult, NotificationText } from "./notification-delivery";

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
  /**
   * `th` is what the app stores and shows; `en` is added under it in the
   * email, so a reader of either language gets the message.
   */
  async create(
    userId: ObjectId,
    type: NotificationType,
    { th, en }: { th: NotificationText; en: NotificationText },
    torId?: ObjectId,
    score?: number,
  ): Promise<void> {
    const { title, message } = th;
    await this.db.notifications.insertOne({
      userId,
      type,
      title,
      message,
      torId,
      ...(score !== undefined ? { score } : {}),
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
    for (const result of await deliver(account, { title, message, en, link })) {
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
    // Only the fields channels still have: a Slack webhook saved before Slack
    // was dropped is cleared the next time the settings are saved.
    const { email, lineUserId } = { email: false, ...account.notificationChannels };
    const next: NotificationChannels = { email, ...(lineUserId && { lineUserId }) };
    if (dto.email !== undefined) next.email = dto.email;
    // LINE is not set here: its id only ever comes from the link flow below,
    // so nobody can point notifications at someone else's LINE.
    await this.db.users.updateOne({ _id: new ObjectId(userId) }, { $set: { notificationChannels: next } });
    return this.getChannels(userId);
  }

  /**
   * Step one of connecting LINE: a one-time code for the user to send to our
   * OA, and the links that open the chat with it already typed in.
   */
  async startLineLink(userId: string) {
    if (!canLinkLine()) throw new ServiceUnavailableException("ยังไม่ได้เปิดใช้การแจ้งเตือนทาง LINE บนเซิร์ฟเวอร์นี้");
    const account = await this.findAccount(userId, { _id: 1 });
    const code = newLinkCode();
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);
    await this.db.users.updateOne({ _id: account._id }, { $set: { lineLink: { codeHash: hashLinkCode(code), expiresAt } } });
    return { code, expiresAt, ...lineLinkUrls(code) };
  }

  async unlinkLine(userId: string) {
    const account = await this.findAccount(userId, { _id: 1 });
    await this.db.users.updateOne(
      { _id: account._id },
      { $unset: { "notificationChannels.lineUserId": "", lineLink: "" } },
    );
    return this.getChannels(userId);
  }

  /**
   * Step two, from LINE's webhook (signature already checked): a message that
   * is a live code links its sender to the account that asked for it. Someone
   * blocking the OA unlinks them, since pushes to them would only fail.
   */
  async handleLineEvents(events: LineEvent[]): Promise<void> {
    for (const event of events) {
      const rawLineUserId = event.source?.type === "user" ? event.source.userId : undefined;
      if (typeof rawLineUserId !== "string" || rawLineUserId.length === 0) continue;
      const lineUserId = rawLineUserId;

      if (event.type === "unfollow") {
        await this.db.users.updateMany(
          { "notificationChannels.lineUserId": { $eq: lineUserId } },
          { $unset: { "notificationChannels.lineUserId": "" } },
        );
        continue;
      }

      if (event.type !== "message" || event.message?.type !== "text") continue;
      const code = parseLinkCode(event.message.text ?? "");
      if (!code) continue; // ordinary chat — left to the OA's own auto-reply

      const account = await this.db.users.findOneAndUpdate(
        { "lineLink.codeHash": hashLinkCode(code), "lineLink.expiresAt": { $gt: new Date() } },
        { $set: { "notificationChannels.lineUserId": lineUserId }, $unset: { lineLink: "" } },
        { projection: { notificationChannels: 1 } },
      );
      // A user who never set channels before has no `email` flag yet.
      if (account && account.notificationChannels?.email === undefined) {
        await this.db.users.updateOne({ _id: account._id }, { $set: { "notificationChannels.email": false } });
      }
      await this.reply(
        event.replyToken,
        account
          ? "เชื่อมต่อ LINE กับ TOR Finder เรียบร้อยแล้ว ✅\nคุณจะได้รับแจ้งเตือนที่นี่เมื่อมีประกาศ TOR ใหม่ที่ตรงกับบริษัทของคุณ"
          : "รหัสนี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณากด \"เชื่อมต่อ LINE\" ในหน้าการแจ้งเตือนของ TOR Finder เพื่อรับรหัสใหม่",
      );
    }
  }

  private async reply(replyToken: string | undefined, text: string) {
    if (!replyToken) return;
    await replyLine(replyToken, text).catch((error: Error) => this.logger.warn(`LINE reply failed: ${error.message}`));
  }

  /** Sends a sample to every channel the account turned on, and says which worked. */
  async sendTest(userId: string): Promise<DeliveryResult[]> {
    const account = await this.findAccount(userId, { email: 1, notificationChannels: 1 });
    return deliver(account, {
      title: "ทดสอบการแจ้งเตือนจาก TOR Finder",
      message: "ช่องทางนี้พร้อมรับแจ้งเตือนเมื่อมีประกาศ TOR ใหม่ที่ตรงกับบริษัทของคุณแล้ว",
      en: {
        title: "Test notification from TOR Finder",
        message: "This channel is ready to receive alerts when a new TOR matching your company is published.",
      },
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
