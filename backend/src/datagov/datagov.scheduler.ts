import { Injectable } from "@nestjs/common";

import { SyncScheduler } from "../common/sync-scheduler";
import { env } from "../config/env";
import { summarizeSync } from "../tor/tor-import.service";
import { DataGovService } from "./datagov.service";

@Injectable()
export class DataGovScheduler extends SyncScheduler {
  constructor(dataGov: DataGovService) {
    super("data.go.th", env.datagov, () => dataGov.sync().then(summarizeSync), 120_000);
  }
}
