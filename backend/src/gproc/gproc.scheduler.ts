import { Injectable } from "@nestjs/common";

import { SyncScheduler } from "../common/sync-scheduler";
import { env } from "../config/env";
import { GprocService } from "./gproc.service";

/**
 * Keeps open announcements honest: reads where each one stands in the national
 * flow, then follows captured projects on to their next announcement.
 */
@Injectable()
export class GprocScheduler extends SyncScheduler {
  constructor(gproc: GprocService) {
    // After e-GP and MEA, so the steps read cover what they just imported.
    super(
      "process5",
      env.gproc,
      async () => `${await gproc.refreshSteps()}; ${await gproc.refresh()}`,
      120_000,
    );
  }
}
