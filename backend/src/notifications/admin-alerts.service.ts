import { Injectable, Logger } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { NotificationsService } from "./notifications.service";

/** What went wrong with one background run, as the admins should hear it. */
export type SyncProblem =
  /** The run threw: nothing came back. */
  | { kind: "failed"; error: string }
  /** Data came back, but some feeds didn't answer. */
  | { kind: "partial"; failedFeeds: string[] };

/** Enough feed ids to see the pattern without the message running on. */
const FEEDS_LISTED = 5;

/**
 * Tells every admin when a background job goes wrong, so a portal outage is
 * noticed the day it starts rather than when someone wonders why the list
 * stopped growing. One unread alert per job and outcome: a source that stays
 * down for a day fails every tick, and eight copies of the same news bury it.
 */
@Injectable()
export class AdminAlertsService {
  private readonly logger = new Logger(AdminAlertsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async syncProblem(source: string, problem: SyncProblem): Promise<void> {
    const title =
      problem.kind === "failed" ? `ดึงข้อมูลจาก ${source} ไม่สำเร็จ` : `ดึงข้อมูลจาก ${source} ได้ไม่ครบ`;
    const message =
      problem.kind === "failed"
        ? `รอบอัตโนมัติล้มเหลว: ${problem.error} — ระบบจะลองใหม่ในรอบถัดไป`
        : `บางแหล่งไม่ตอบกลับ (${problem.failedFeeds.length}): ${problem.failedFeeds
            .slice(0, FEEDS_LISTED)
            .join(", ")}${problem.failedFeeds.length > FEEDS_LISTED ? " …" : ""} — ข้อมูลที่ได้มาถูกบันทึกแล้ว ส่วนที่ขาดจะดึงใหม่ในรอบถัดไป`;

    const titleEn =
      problem.kind === "failed" ? `Couldn't fetch data from ${source}` : `Data from ${source} came in incomplete`;
    const messageEn =
      problem.kind === "failed"
        ? `The automatic run failed: ${problem.error} — it will be retried in the next run.`
        : `Some feeds didn't respond (${problem.failedFeeds.length}): ${problem.failedFeeds
            .slice(0, FEEDS_LISTED)
            .join(", ")}${problem.failedFeeds.length > FEEDS_LISTED ? " …" : ""} — what came in is saved; the rest will be fetched again in the next run.`;

    try {
      const admins = await this.db.users
        .find({ role: "admin", suspended: { $ne: true } }, { projection: { _id: 1 } })
        .toArray();
      const alreadyTold = new Set(
        (
          await this.db.notifications
            .find(
              { userId: { $in: admins.map(({ _id }) => _id) }, type: "system", title, read: false },
              { projection: { userId: 1 } },
            )
            .toArray()
        ).map(({ userId }) => userId.toString()),
      );

      await Promise.all(
        admins
          .filter(({ _id }) => !alreadyTold.has(_id.toString()))
          .map(({ _id }) =>
            this.notifications.create(_id, "system", {
              th: { title, message },
              en: { title: titleEn, message: messageEn },
            }),
          ),
      );
    } catch (error) {
      // The alert is about a failure; it must never become a second one.
      this.logger.warn(`Couldn't alert admins about ${source}: ${String(error)}`);
    }
  }
}
