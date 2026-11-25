import { Injectable } from "@nestjs/common";

import { SyncScheduler } from "../common/sync-scheduler";
import { env } from "../config/env";
import { AdminAlertsService } from "../notifications/admin-alerts.service";
import { TorImportService } from "../tor/tor-import.service";
import { ExtractionService } from "./extraction.service";
import { VertexClient } from "./vertex.client";

/** Polling settings that keep the job switched off entirely. */
const NEVER = { pollMinutes: 0, pollOnStartup: false };

/**
 * Reads the documents the imports bring in, two ways. Right after each import,
 * the records it just created — so a new TOR is read within minutes, not at the
 * top of the next hour (KPI K9). And on a timer of its own, for everything else
 * still waiting: records that failed and are due a retry, and whatever a busy
 * import left past the per-run cap. Every model call costs money, so neither
 * runs at all where Vertex isn't configured — a developer's checkout should not
 * spend a cloud budget to boot.
 */
@Injectable()
export class ExtractionScheduler extends SyncScheduler {
  constructor(
    extraction: ExtractionService,
    vertex: VertexClient,
    alerts: AdminAlertsService,
    importer: TorImportService,
  ) {
    super(
      "Extraction",
      vertex.isConfigured ? env.ai : NEVER,
      alerts,
      // A document that can't be read is routine (dead links, scans), not an outage.
      async () => {
        const { extracted, skipped, failed, attempted } = await extraction.extractPending();
        return { summary: `${extracted} extracted, ${skipped} unreadable, ${failed} failed of ${attempted}` };
      },
      180_000,
    );

    if (vertex.isConfigured && env.ai.extractAfterImport) {
      importer.onImported((_source, ids) => extraction.extractImported(ids));
    }
  }
}
