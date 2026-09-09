import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";

import { env } from "../config/env";
import { EgpService } from "./egp.service";

/**
 * Keeps the database current without anyone pressing the import button.
 * Overlap is impossible: EgpService hands every caller the same in-flight run.
 */
@Injectable()
export class EgpScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(EgpScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly egp: EgpService) {}

  onApplicationBootstrap(): void {
    const { pollMinutes, pollOnStartup } = env.egp;
    if (pollMinutes <= 0) {
      this.logger.log("e-GP polling disabled (EGP_POLL_MINUTES=0)");
      return;
    }

    this.timer = setInterval(() => void this.poll(), pollMinutes * 60_000);
    // Never keep the process alive just for the next poll.
    this.timer.unref();
    this.logger.log(`e-GP polling every ${pollMinutes} minutes`);

    // Not awaited: a fresh database fills itself in the background instead of
    // holding up startup and the health check.
    if (pollOnStartup) void this.poll();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    try {
      const { imported, updated, failed } = await this.egp.sync();
      this.logger.log(
        `Scheduled e-GP sync: ${imported} new, ${updated} updated` +
          (failed.length ? `, ${failed.length} feed(s) failed` : ""),
      );
    } catch (error) {
      // The next tick retries; a portal outage shouldn't crash the server.
      this.logger.warn(`Scheduled e-GP sync failed: ${String(error)}`);
    }
  }
}
