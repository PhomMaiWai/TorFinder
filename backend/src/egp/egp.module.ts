import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { TorModule } from "../tor/tor.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { EgpClient } from "./egp.client";
import { EgpController } from "./egp.controller";
import { EgpScheduler } from "./egp.scheduler";
import { EgpService } from "./egp.service";

@Module({
  imports: [AuditModule, DatabaseModule, TorModule, NotificationsModule],
  controllers: [EgpController],
  providers: [EgpService, EgpClient, EgpScheduler],
})
export class EgpModule {}
