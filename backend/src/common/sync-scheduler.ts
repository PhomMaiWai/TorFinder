import { Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";

import { AdminAlertsService } from "../notifications/admin-alerts.service";

/** The two knobs an operator turns per portal. 0 minutes turns polling off. */
export type PollSettings = {
  pollMinutes: number;
  pollOnStartup: boolean;
};

/**
 * What one run reports back: the line worth logging, and the feeds that didn't
 * answer when some data still came back — a partial run, which the admins hear
 * about just like one that failed outright.
 */
export type RunReport = { summary: string; failedFeeds?: string[] };

/**
 * Keeps the database current without anyone pressing a button. Each background
 * job — a portal import, a batch of documents read — subclasses this with its
 * own label, settings and call; four jobs on four hand-written timers is four
 * places for a missing `unref()` or an unhandled rejection to hide.
 *
 * Overlapping runs are impossible by construction: every sync service hands
 * each caller the same in-flight promise, so a tick that lands while the admin
 * button's run is still going joins it instead of starting a second.
 */
export abstract class SyncScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger: Logger;
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;

  protected constructor(
    private readonly label: string,
    private readonly settings: PollSettings,
    private readonly alerts: AdminAlertsService,
    /** Runs the job and reports how it went. */
    private readonly run: () => Promise<RunReport>,
    /**
     * How long after boot this portal's first poll starts. Staggered per source
     * so three imports don't compete for the same startup — and because the
     * interval starts from here, they stay apart on every tick after it.
     */
    private readonly startupDelayMs = 0,
  ) {
    this.logger = new Logger(`${label}Scheduler`);
  }

  onApplicationBootstrap(): void {
    const { pollMinutes, pollOnStartup } = this.settings;
    if (pollMinutes <= 0) {
      this.logger.log(`${this.label} polling disabled`);
      return;
    }

    this.startupTimer = setTimeout(() => {
      this.timer = setInterval(() => void this.poll(), pollMinutes * 60_000);
      // Never keep the process alive just for the next poll.
      this.timer.unref();

      // Not awaited: a fresh database fills itself in the background instead of
      // holding up startup and the health check.
      if (pollOnStartup) void this.poll();
    }, this.startupDelayMs);
    this.startupTimer.unref();

    this.logger.log(`${this.label} polling every ${pollMinutes} minutes`);
  }

  onModuleDestroy(): void {
    clearTimeout(this.startupTimer);
    clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    let report: RunReport;
    try {
      report = await this.run();
    } catch (error) {
      // The next tick retries; a portal outage shouldn't crash the server.
      this.logger.warn(`Scheduled ${this.label} run failed: ${String(error)}`);
      await this.alerts.syncProblem(this.label, {
        kind: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    this.logger.log(`Scheduled ${this.label} run: ${report.summary}`);
    if (report.failedFeeds?.length) {
      await this.alerts.syncProblem(this.label, { kind: "partial", failedFeeds: report.failedFeeds });
    }
  }
}
