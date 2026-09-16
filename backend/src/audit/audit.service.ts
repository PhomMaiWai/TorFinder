import { Injectable, Logger } from "@nestjs/common";

import { DatabaseService, SyncRunDoc, SyncRunStatus } from "../database/database.service";

const AUDIT_FEED_LIMIT = 50;

export type AuditFeedEntry = {
  action: string;
  detail: string;
  actor: string;
  type: "manual" | "auto";
  date: string;
};

const SYNC_ACTION_LABELS: Record<SyncRunStatus, string> = {
  success: "ซิงค์ข้อมูล e-GP สำเร็จ",
  partial: "ซิงค์ข้อมูล e-GP สำเร็จบางส่วน",
  failed: "ซิงค์ข้อมูล e-GP ล้มเหลว",
};

/** Reads back as one line: what came in, what changed, what didn't. */
function syncDetail(run: SyncRunDoc): string {
  if (run.status === "failed") return run.error ?? "ไม่สามารถเชื่อมต่อระบบ e-GP ได้";

  const parts = [`นำเข้าใหม่ ${run.imported} รายการ`, `อัปเดต ${run.updated} รายการ`];
  if (run.failedFeeds.length > 0) parts.push(`ดึงข้อมูลล้มเหลว ${run.failedFeeds.length} แหล่ง`);
  return parts.join(" · ");
}

/**
 * The admin dashboard's audit feed. Manual entries (see record()) come from
 * an admin doing something attributable — approving an account, moderating a
 * comment, hiding/restoring a TOR. Automatic entries are never written here:
 * e-GP sync runs already live in `syncRuns` (see EgpService), and are read
 * straight from there and merged in at query time, so there is exactly one
 * place a sync's outcome is stored.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Records one attributable admin action. Best-effort: a logging hiccup must
   * never block (or fail) the action itself, same posture as EgpService's
   * sync-run recording.
   */
  async record(actor: string, action: string, detail: string): Promise<void> {
    try {
      await this.db.auditLogEntries.insertOne({ actor, action, detail, createdAt: new Date() });
    } catch (error) {
      this.logger.warn(`Failed to record audit log entry: ${String(error)}`);
    }
  }

  /** Manual entries merged with recent e-GP sync runs, newest first. */
  async findAll(limit = AUDIT_FEED_LIMIT): Promise<AuditFeedEntry[]> {
    const [manual, syncRuns] = await Promise.all([
      this.db.auditLogEntries.find().sort({ createdAt: -1 }).limit(limit).toArray(),
      this.db.syncRuns.find().sort({ startedAt: -1 }).limit(limit).toArray(),
    ]);

    const manualEntries: AuditFeedEntry[] = manual.map((entry) => ({
      action: entry.action,
      detail: entry.detail,
      actor: entry.actor,
      type: "manual",
      date: entry.createdAt.toISOString(),
    }));

    const syncEntries: AuditFeedEntry[] = syncRuns.map((run) => ({
      action: SYNC_ACTION_LABELS[run.status],
      detail: syncDetail(run),
      actor: "e-GP Sync Bot",
      type: "auto",
      date: run.startedAt.toISOString(),
    }));

    return [...manualEntries, ...syncEntries]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }
}
