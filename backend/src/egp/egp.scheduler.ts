import { Injectable } from "@nestjs/common";

import { SyncScheduler } from "../common/sync-scheduler";
import { env } from "../config/env";
import { summarizeSync } from "../tor/tor-import.service";
import { EgpService } from "./egp.service";

/** First of the three: the official portal, and the one records rank highest. */
@Injectable()
export class EgpScheduler extends SyncScheduler {
  constructor(egp: EgpService) {
    super("e-GP", env.egp, () => egp.sync().then(summarizeSync));
  }
}
