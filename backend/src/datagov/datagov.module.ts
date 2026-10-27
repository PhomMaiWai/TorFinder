import { Module } from "@nestjs/common";

import { TorModule } from "../tor/tor.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { DataGovClient } from "./datagov.client";
import { DataGovController } from "./datagov.controller";
import { DataGovScheduler } from "./datagov.scheduler";
import { DataGovService } from "./datagov.service";

@Module({
  imports: [TorModule, NotificationsModule],
  controllers: [DataGovController],
  providers: [DataGovService, DataGovClient, DataGovScheduler],
})
export class DataGovModule {}
