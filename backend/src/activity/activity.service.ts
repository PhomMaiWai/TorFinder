import { Injectable, Logger } from "@nestjs/common";

import { ActivityDoc, DatabaseService } from "../database/database.service";
import { SyncResult } from "../tor/tor-import.service";

/** How many lines the audit page asks for at once. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** How far back the dashboard's import history reaches. */
const HISTORY_DAYS = 7;

export type ActivityEntry = Omit<ActivityDoc, "createdAt">;

/**
 * The record of what the system and its admins did. Two readers, one collection:
 * the audit page reads it as a feed, and the dashboard reads the import runs out
 * of it as a chart — which is why a run is a log line with numbers attached
 * rather than a table of its own.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Writes one line. Never throws: an action that succeeded must not be
   * reported as failed because the note about it couldn't be filed.
   */
  async record(entry: ActivityEntry): Promise<void> {
    try {
      await this.db.activity.insertOne({ ...entry, createdAt: new Date() });
    } catch (error) {
      this.logger.warn(`Could not record activity "${entry.action}": ${String(error)}`);
    }
  }

  /**
   * Runs one import and files the outcome either way. A portal that is down
   * throws before anything is written, and that failure is the single most
   * useful line in the log — so it is recorded here rather than left to the
   * caller, who would have to remember to.
   */
  async trackSync(source: string, run: () => Promise<SyncResult>): Promise<SyncResult> {
    try {
      const result = await run();
      await this.record({
        action: "ซิงก์ประกาศจัดซื้อจัดจ้าง",
        detail: this.describe(source, result),
        actor: source,
        kind: "auto",
        run: { source, ok: true, imported: result.imported, updated: result.updated },
      });
      return result;
    } catch (error) {
      await this.record({
        action: "ซิงก์ประกาศจัดซื้อจัดจ้าง",
        detail: `${source}: ดึงข้อมูลไม่สำเร็จ — ${error instanceof Error ? error.message : String(error)}`,
        actor: source,
        kind: "auto",
        run: { source, ok: false, imported: 0, updated: 0 },
      });
      throw error;
    }
  }

  /** The audit feed, newest first. */
  async recent(limit = DEFAULT_LIMIT): Promise<(ActivityDoc & { id: string })[]> {
    const docs = await this.db.activity
      .find({}, { sort: { createdAt: -1 }, limit: Math.min(limit, MAX_LIMIT) })
      .toArray();
    return docs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
  }

  /**
   * Everything the dashboard shows, in one round trip: whether the imports are
   * healthy, what arrived today, how far the document reading has got, and the
   * last week of runs.
   */
  async overview() {
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [runs, importedToday, agencies, extraction, notifications] = await Promise.all([
      this.db.activity
        .find({ run: { $exists: true }, createdAt: { $gte: since } }, { sort: { createdAt: -1 }, limit: 20 })
        .toArray(),
      this.db.tors.countDocuments({ createdAt: { $gte: startOfToday }, deletedAt: { $exists: false } }),
      this.db.tors.distinct("agency", { deletedAt: { $exists: false } }),
      this.extractionCounts(),
      this.db.notifications.countDocuments(),
    ]);

    const latest = runs[0];

    return {
      pipeline: {
        // Healthy when nothing in the recent history failed; a portal that was
        // down at 08:00 and fine at 14:00 is not something to still warn about.
        ok: !latest || latest.run!.ok,
        lastRunAt: latest?.createdAt ?? null,
        importedToday,
        agencies: agencies.length,
      },
      extraction,
      runs: runs.map((doc) => ({
        at: doc.createdAt,
        source: doc.run!.source,
        imported: doc.run!.imported,
        ok: doc.run!.ok,
      })),
      notifications,
    };
  }

  /**
   * How far the document reading has got. "Pending" counts only the records it
   * would actually attempt — an announcement with no readable file is not
   * waiting for anything.
   */
  private async extractionCounts() {
    const [done, failed, withDocument] = await Promise.all([
      this.db.tors.countDocuments({ extraction: { $exists: true } }),
      this.db.tors.countDocuments({
        extractionFailure: { $exists: true },
        extraction: { $exists: false },
      }),
      this.db.tors.countDocuments({
        "documents.url": { $regex: "(/api/file/|/files_procurement/).*\\.pdf$", $options: "i" },
        deletedAt: { $exists: false },
      }),
    ]);

    return { done, failed, pending: Math.max(withDocument - done - failed, 0) };
  }

  private describe(source: string, result: SyncResult): string {
    const parts = [
      `${source}: ${result.imported} ใหม่`,
      `${result.updated} อัปเดต`,
      result.skipped ? `${result.skipped} ซ้ำกับแหล่งอื่น` : null,
      result.failed.length ? `${result.failed.length} คำค้นล้มเหลว` : null,
    ];
    return parts.filter(Boolean).join(" · ");
  }
}
