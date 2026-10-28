import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { TorModule } from "../tor/tor.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { MeaClient } from "./mea.client";
import { MeaController } from "./mea.controller";
import { MeaScheduler } from "./mea.scheduler";
import { MeaService } from "./mea.service";

@Module({
  imports: [AuditModule, TorModule, NotificationsModule],
  controllers: [MeaController],
  providers: [MeaService, MeaClient, MeaScheduler],
})
export class MeaModule {}
