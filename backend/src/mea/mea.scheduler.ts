import { Injectable } from "@nestjs/common";

import { SyncScheduler } from "../common/sync-scheduler";
import { env } from "../config/env";
import { summarizeSync } from "../tor/tor-import.service";
import { MeaService } from "./mea.service";

@Injectable()
export class MeaScheduler extends SyncScheduler {
  constructor(mea: MeaService) {
    // Starts a minute after e-GP: both read the detail page of every new
    // announcement, and there is no reason for them to do it at once.
    super("MEA", env.mea, () => mea.sync().then(summarizeSync), 60_000);
  }
}
