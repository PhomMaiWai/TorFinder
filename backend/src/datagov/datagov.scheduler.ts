import { Injectable } from "@nestjs/common";

import { SyncScheduler } from "../common/sync-scheduler";
import { env } from "../config/env";
import { AdminAlertsService } from "../notifications/admin-alerts.service";
import { reportSync } from "../tor/tor-import.service";
import { DataGovService } from "./datagov.service";

@Injectable()
export class DataGovScheduler extends SyncScheduler {
  constructor(dataGov: DataGovService, alerts: AdminAlertsService) {
    super("data.go.th", env.datagov, alerts, () => dataGov.sync().then(reportSync), 120_000);
  }
}
