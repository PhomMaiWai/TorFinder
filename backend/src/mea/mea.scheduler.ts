import { Injectable } from "@nestjs/common";

import { SyncScheduler } from "../common/sync-scheduler";
import { env } from "../config/env";
import { AdminAlertsService } from "../notifications/admin-alerts.service";
import { reportSync } from "../tor/tor-import.service";
import { MeaService } from "./mea.service";

@Injectable()
export class MeaScheduler extends SyncScheduler {
  constructor(mea: MeaService, alerts: AdminAlertsService) {
    // Starts a minute after e-GP: both read the detail page of every new
    // announcement, and there is no reason for them to do it at once.
    super("MEA", env.mea, alerts, () => mea.sync().then(reportSync), 60_000);
  }
}
