import { Injectable } from "@nestjs/common";

import { SyncScheduler } from "../common/sync-scheduler";
import { env } from "../config/env";
import { ExtractionService } from "./extraction.service";
import { VertexClient } from "./vertex.client";

/** Polling settings that keep the job switched off entirely. */
const NEVER = { pollMinutes: 0, pollOnStartup: false };

/**
 * Reads the documents the imports bring in. Last in the startup order and on a
 * timer of its own: every model call costs money, so this one waits for the
 * portals to have finished arriving and never runs at all where Vertex isn't
 * configured — a developer's checkout should not spend a cloud budget to boot.
 */
@Injectable()
export class ExtractionScheduler extends SyncScheduler {
  constructor(extraction: ExtractionService, vertex: VertexClient) {
    super(
      "Extraction",
      vertex.isConfigured ? env.ai : NEVER,
      async () => {
        const { extracted, skipped, failed, attempted } = await extraction.extractPending();
        return `${extracted} extracted, ${skipped} unreadable, ${failed} failed of ${attempted}`;
      },
      180_000,
    );
  }
}
