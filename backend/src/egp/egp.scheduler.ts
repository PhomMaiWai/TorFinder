import { Injectable } from "@nestjs/common";

import { SyncScheduler } from "../common/sync-scheduler";
import { env } from "../config/env";
import { AdminAlertsService } from "../notifications/admin-alerts.service";
import { reportSync } from "../tor/tor-import.service";
import { EgpService } from "./egp.service";

/** First of the three: the official portal, and the one records rank highest. */
@Injectable()
export class EgpScheduler extends SyncScheduler {
  constructor(egp: EgpService, alerts: AdminAlertsService) {
    super("e-GP", env.egp, alerts, () => egp.sync().then(reportSync));
  }
}
